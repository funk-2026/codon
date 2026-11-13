package handlers

import (
	"codon-backend/internal/httpx"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	rzp "codon-backend/internal/razorpay"
	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PaymentHandler struct {
	DB     *gorm.DB
	SubSvc *services.SubscriptionService
}

func NewPaymentHandler(db *gorm.DB, subSvc *services.SubscriptionService) *PaymentHandler {
	return &PaymentHandler{DB: db, SubSvc: subSvc}
}

// Checkout godoc
//
//	@Summary		Create Razorpay checkout order
//	@Description	Creates a Razorpay order for the given plan and a pending subscription record. Returns the order details needed to open the Razorpay payment sheet on the frontend.
//	@Tags			Subscriptions & Payments
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		checkoutRequest		true	"Plan to purchase"
//	@Success		200		{object}	checkoutResponse
//	@Failure		400		{object}	errorResponse
//	@Failure		401		{object}	errorResponse
//	@Failure		500		{object}	errorResponse
//	@Router			/api/v1/subscriptions/checkout [post]
func (h *PaymentHandler) Checkout(c *gin.Context) {
	user := middleware.GetUser(c)

	var req checkoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	planID, err := uuid.Parse(req.PlanID)
	if err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid plan_id")
		return
	}

	result, err := h.SubSvc.Checkout(c.Request.Context(), user, planID)
	if err != nil {
		var ce *services.CodedError
		if errors.As(err, &ce) {
			respondService(c, err)
			return
		}
		log.Printf("[payments] checkout: %v", err)
		respondErr(c, http.StatusBadGateway, "checkout_failed", "could not start checkout, please try again")
		return
	}

	c.JSON(http.StatusOK, checkoutResponse{
		RazorpayOrderID: result.RazorpayOrderID,
		AmountPaise:     result.AmountPaise,
		Currency:        result.Currency,
		KeyID:           result.KeyID,
	})
}

// VerifyPayment godoc
//
//	@Summary		Verify Razorpay payment (client-side fallback)
//	@Description	Client-side confirmation endpoint. Call this if the webhook hasn't arrived yet. Verifies the Razorpay HMAC signature and activates the subscription. Idempotent — safe to call multiple times for the same order.
//	@Tags			Subscriptions & Payments
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		verifyPaymentRequest	true	"Payment verification payload from Razorpay SDK"
//	@Success		200		{object}	messageResponse
//	@Failure		400		{object}	errorResponse
//	@Failure		401		{object}	errorResponse
//	@Router			/api/v1/subscriptions/verify-payment [post]
func (h *PaymentHandler) VerifyPayment(c *gin.Context) {
	var req verifyPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	if !rzp.VerifyPaymentSignature(req.RazorpayOrderID, req.RazorpayPaymentID, req.RazorpaySignature) {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid payment signature")
		return
	}

	user := middleware.GetUser(c)
	if !h.SubSvc.OrderBelongsTo(c.Request.Context(), req.RazorpayOrderID, user.ID) {
		respondErr(c, http.StatusNotFound, "order_not_found", "order not found")
		return
	}
	if err := h.SubSvc.ActivateSubscription(c.Request.Context(), req.RazorpayOrderID, req.RazorpayPaymentID, req.RazorpaySignature); err != nil {
		log.Printf("[payments] verify %s: %v", req.RazorpayOrderID, err)
		respondErr(c, http.StatusInternalServerError, "internal", "could not activate subscription")
		return
	}

	c.JSON(http.StatusOK, messageResponse{Message: "payment verified and subscription activated"})
}

// RazorpayWebhook godoc
//
//	@Summary		Razorpay webhook receiver
//	@Description	Receives Razorpay webhook events. Verifies the X-Razorpay-Signature header before processing. Handles payment.captured (activates subscription) and payment.failed (marks record failed). Idempotent.
//	@Tags			Subscriptions & Payments
//	@Accept			json
//	@Produce		json
//	@Param			X-Razorpay-Signature	header		string				true	"HMAC-SHA256 signature from Razorpay"
//	@Param			body					body		razorpayWebhookBody	true	"Razorpay webhook payload"
//	@Success		200						{object}	webhookAckResponse
//	@Failure		400						{object}	errorResponse
//	@Failure		401						{object}	errorResponse
//	@Router			/api/v1/webhooks/razorpay [post]
func (h *PaymentHandler) RazorpayWebhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "failed to read body")
		return
	}

	signature := c.GetHeader("X-Razorpay-Signature")
	if !rzp.VerifyWebhookSignature(body, signature) {
		respondErr(c, http.StatusUnauthorized, "unauthorized", "invalid webhook signature")
		return
	}

	var event struct {
		Event   string `json:"event"`
		Payload struct {
			Payment struct {
				Entity struct {
					ID      string `json:"id"`
					OrderID string `json:"order_id"`
					Error   struct {
						Description string `json:"description"`
					} `json:"error"`
				} `json:"entity"`
			} `json:"payment"`
		} `json:"payload"`
	}
	if err := json.Unmarshal(body, &event); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid JSON")
		return
	}

	orderID := event.Payload.Payment.Entity.OrderID
	paymentID := event.Payload.Payment.Entity.ID

	switch event.Event {
	case "payment.captured":
		if err := h.SubSvc.ActivateSubscription(c.Request.Context(), orderID, paymentID, ""); err != nil {
			log.Printf("[payments] webhook activate %s: %v", orderID, err)
			respondErr(c, http.StatusInternalServerError, "internal", "could not activate subscription")
			return
		}
	case "payment.failed":
		reason := event.Payload.Payment.Entity.Error.Description
		if err := h.SubSvc.MarkPaymentFailed(c.Request.Context(), orderID, reason); err != nil {
			log.Printf("[payments] webhook fail %s: %v", orderID, err)
			respondErr(c, http.StatusInternalServerError, "internal", "could not record failure")
			return
		}
	}

	c.JSON(http.StatusOK, webhookAckResponse{Status: "ok"})
}

// ListPayments godoc
//
//	@Summary		List all payment records (Admin)
//	@Description	Returns all payment records with optional filtering by status and user_id.
//	@Tags			Subscriptions & Payments
//	@Security		BearerAuth
//	@Produce		json
//	@Param			status	query		string	false	"Filter by status: created | captured | failed | refunded"
//	@Param			user_id	query		string	false	"Filter by user UUID"
//	@Param			search	query		string	false	"Payer name, phone or order id"
//	@Success		200		{object}	listPaymentsResponse
//	@Failure		401		{object}	errorResponse
//	@Failure		403		{object}	errorResponse
//	@Router			/api/v1/admin/payments [get]
func (h *PaymentHandler) ListPayments(c *gin.Context) {
	status := c.Query("status")
	userIDStr := c.Query("user_id")

	query := h.DB.WithContext(c.Request.Context()).Model(&models.PaymentRecord{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if userIDStr != "" {
		query = query.Where("user_id = ?", userIDStr)
	}
	// ?search= matches the payer's name or phone, or the order id.
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		like := "%" + search + "%"
		query = query.Where("(user_id IN (SELECT id FROM users WHERE name ILIKE ? OR phone_number LIKE ?) OR razorpay_order_id ILIKE ?)", like, like, like)
	}

	payments, next, err := paged(c, query.Preload("User").Preload("Subscription.Plan"), "payment_records",
		func(p models.PaymentRecord) (time.Time, uuid.UUID) { return p.CreatedAt, p.ID })
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"payments": payments, "next_cursor": nilIfEmpty(next)})
}

// GetPayment godoc
//
//	@Summary		Get a payment record by ID (Admin)
//	@Description	Returns a single payment record by its UUID.
//	@Tags			Subscriptions & Payments
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Payment record UUID"
//	@Success		200	{object}	models.PaymentRecord
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/admin/payments/{id} [get]
func (h *PaymentHandler) GetPayment(c *gin.Context) {
	id := c.Param("id")
	var payment models.PaymentRecord
	if err := h.DB.WithContext(c.Request.Context()).Preload("User").Preload("Subscription.Plan").Where("id = ?", id).First(&payment).Error; err != nil {
		respondErr(c, http.StatusNotFound, "not_found", "payment not found")
		return
	}
	c.JSON(http.StatusOK, payment)
}

// ── Request / Response types ──────────────────────────────────────────────────

type checkoutRequest struct {
	PlanID string `json:"plan_id" example:"550e8400-e29b-41d4-a716-446655440000"`
}

type checkoutResponse struct {
	RazorpayOrderID string `json:"razorpay_order_id" example:"order_Abc123"`
	AmountPaise     int64  `json:"amount_paise"      example:"299900"`
	Currency        string `json:"currency"          example:"INR"`
	KeyID           string `json:"key_id"            example:"rzp_test_XXXX"`
}

type verifyPaymentRequest struct {
	RazorpayOrderID   string `json:"razorpay_order_id"   example:"order_Abc123"`
	RazorpayPaymentID string `json:"razorpay_payment_id" example:"pay_Xyz789"`
	RazorpaySignature string `json:"razorpay_signature"  example:"abcdef1234..."`
}

// razorpayWebhookBody documents the Razorpay webhook envelope for Swagger.
type razorpayWebhookBody struct {
	Event   string `json:"event" example:"payment.captured"`
	Payload struct {
		Payment struct {
			Entity struct {
				ID      string `json:"id"       example:"pay_Xyz789"`
				OrderID string `json:"order_id" example:"order_Abc123"`
			} `json:"entity"`
		} `json:"payment"`
	} `json:"payload"`
}

type webhookAckResponse struct {
	Status string `json:"status" example:"ok"`
}

type listPaymentsResponse struct {
	Payments []models.PaymentRecord `json:"payments"`
}

// PaymentsSummary godoc
//
//	@Summary		Totals over every payment (Admin)
//	@Description	Captured amount and counts by outcome, across all payments (not just one page).
//	@Tags			Subscriptions & Payments
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/admin/payments/summary [get]
func (h *PaymentHandler) PaymentsSummary(c *gin.Context) {
	var out struct {
		CapturedPaise int64 `json:"captured_paise"`
		CapturedCount int64 `json:"captured_count"`
		FailedCount   int64 `json:"failed_count"`
		RefundedCount int64 `json:"refunded_count"`
	}
	err := h.DB.WithContext(c.Request.Context()).Raw(`
		SELECT COALESCE(sum(amount_paise) FILTER (WHERE status = 'captured'), 0) AS captured_paise,
		       count(*) FILTER (WHERE status = 'captured') AS captured_count,
		       count(*) FILTER (WHERE status = 'failed')   AS failed_count,
		       count(*) FILTER (WHERE status = 'refunded') AS refunded_count
		FROM payment_records`).Scan(&out).Error
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, out)
}
