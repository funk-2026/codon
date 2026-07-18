package handlers

import (
	"encoding/json"
	"io"
	"net/http"

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
//	@Router			/subscriptions/checkout [post]
func (h *PaymentHandler) Checkout(c *gin.Context) {
	user := middleware.GetUser(c)

	var req checkoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	planID, err := uuid.Parse(req.PlanID)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid plan_id"})
		return
	}

	result, err := h.SubSvc.Checkout(c.Request.Context(), user, planID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: err.Error()})
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
//	@Router			/subscriptions/verify-payment [post]
func (h *PaymentHandler) VerifyPayment(c *gin.Context) {
	var req verifyPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	if !rzp.VerifyPaymentSignature(req.RazorpayOrderID, req.RazorpayPaymentID, req.RazorpaySignature) {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid payment signature"})
		return
	}

	if err := h.SubSvc.ActivateSubscription(c.Request.Context(), req.RazorpayOrderID, req.RazorpayPaymentID, req.RazorpaySignature); err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: err.Error()})
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
//	@Router			/webhooks/razorpay [post]
func (h *PaymentHandler) RazorpayWebhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "failed to read body"})
		return
	}

	signature := c.GetHeader("X-Razorpay-Signature")
	if !rzp.VerifyWebhookSignature(body, signature) {
		c.JSON(http.StatusUnauthorized, errorResponse{Error: "invalid webhook signature"})
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
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid JSON"})
		return
	}

	orderID := event.Payload.Payment.Entity.OrderID
	paymentID := event.Payload.Payment.Entity.ID

	switch event.Event {
	case "payment.captured":
		if err := h.SubSvc.ActivateSubscription(c.Request.Context(), orderID, paymentID, "webhook"); err != nil {
			c.JSON(http.StatusInternalServerError, errorResponse{Error: err.Error()})
			return
		}
	case "payment.failed":
		reason := event.Payload.Payment.Entity.Error.Description
		h.SubSvc.MarkPaymentFailed(c.Request.Context(), orderID, reason)
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
//	@Success		200		{object}	listPaymentsResponse
//	@Failure		401		{object}	errorResponse
//	@Failure		403		{object}	errorResponse
//	@Router			/admin/payments [get]
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

	var payments []models.PaymentRecord
	query.Order("created_at DESC").Find(&payments)
	c.JSON(http.StatusOK, listPaymentsResponse{Payments: payments})
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
//	@Router			/admin/payments/{id} [get]
func (h *PaymentHandler) GetPayment(c *gin.Context) {
	id := c.Param("id")
	var payment models.PaymentRecord
	if err := h.DB.WithContext(c.Request.Context()).Where("id = ?", id).First(&payment).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "payment not found"})
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
