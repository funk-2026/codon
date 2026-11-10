package handlers

import (
	"net/http"
	"strings"
	"time"

	"codon-backend/internal/authz"
	"codon-backend/internal/httpx"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/pagination"
	"codon-backend/internal/services"
	"codon-backend/internal/settings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type KYCHandler struct{ DB *gorm.DB }

func NewKYCHandler(db *gorm.DB) *KYCHandler { return &KYCHandler{DB: db} }

// GetKYCRequired godoc
//
//	@Summary		Get KYC required flag
//	@Description	Returns whether the KYC feature is currently enabled platform-wide. When true, students must have approved KYC to access subscription-gated content.
//	@Tags			KYC
//	@Produce		json
//	@Success		200	{object}	kycRequiredResponse
//	@Router			/api/v1/platform-settings/kyc-required [get]
func (h *KYCHandler) GetKYCRequired(c *gin.Context) {
	c.JSON(http.StatusOK, kycRequiredResponse{KYCRequired: settings.Bool("kyc_required"), Required: settings.Bool("kyc_required")})
}

// SetKYCRequired godoc
//
//	@Summary		Toggle KYC required flag (Admin)
//	@Description	Enables or disables the KYC requirement platform-wide. When enabled, subscribed students must have approved KYC to access premium content.
//	@Tags			KYC
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		setKYCRequiredRequest	true	"Toggle value"
//	@Success		200		{object}	kycRequiredResponse
//	@Failure		400		{object}	errorResponse
//	@Failure		401		{object}	errorResponse
//	@Failure		403		{object}	errorResponse
//	@Router			/api/v1/admin/settings/kyc-required [patch]
func (h *KYCHandler) SetKYCRequired(c *gin.Context) {
	admin := middleware.GetUser(c)

	var req setKYCRequiredRequest
	if !httpx.Bind(c, &req) {
		return
	}
	var enabled bool
	switch {
	case req.Enabled != nil:
		enabled = *req.Enabled
	case req.Required != nil:
		enabled = *req.Required
	default:
		respondErr(c, http.StatusBadRequest, "bad_request", "enabled is required")
		return
	}
	value := "false"
	if enabled {
		value = "true"
	}
	if err := settings.Default.Set("kyc_required", value, &admin.ID); err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, kycRequiredResponse{KYCRequired: enabled, Required: enabled})
}

// SubmitKYC godoc
//
//	@Summary		Submit KYC document
//	@Description	Submits identity verification for the authenticated student. The document must first be uploaded to S3 via /uploads/presign. Sets user kyc_status to 'pending'.
//	@Tags			KYC
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		submitKYCRequest	true	"KYC submission"
//	@Success		201		{object}	models.KYCRecord
//	@Failure		400		{object}	errorResponse
//	@Failure		401		{object}	errorResponse
//	@Failure		409		{object}	errorResponse	"KYC already submitted or approved"
//	@Router			/api/v1/me/kyc [post]
func (h *KYCHandler) SubmitKYC(c *gin.Context) {
	user := middleware.GetUser(c)

	var req submitKYCRequest
	if !httpx.Bind(c, &req) {
		return
	}
	if req.IDType != string(models.IDTypeAadhaar) && req.IDType != string(models.IDTypePAN) {
		respondErr(c, http.StatusBadRequest, "invalid_id_type", "id_type must be 'aadhaar' or 'pan'")
		return
	}
	if strings.TrimSpace(req.IDNumber) == "" {
		respondErr(c, http.StatusBadRequest, "invalid_id_number", "id_number is required")
		return
	}
	if !authz.OwnsUploadKey(user, "kyc_document", req.DocumentFileKey) {
		respondErr(c, http.StatusBadRequest, "invalid_document", "document must be uploaded by you with purpose kyc_document")
		return
	}

	record := models.KYCRecord{
		UserID:          user.ID,
		IDType:          models.IDType(req.IDType),
		IDNumber:        req.IDNumber,
		DocumentFileKey: req.DocumentFileKey,
		Status:          models.KYCPending,
		SubmittedAt:     time.Now(),
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		// serialise submissions per user so the "one pending/approved" rule holds
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id").First(&models.User{}, "id = ?", user.ID).Error; err != nil {
			return err
		}
		var n int64
		if err := tx.Model(&models.KYCRecord{}).Where("user_id = ? AND status IN ?", user.ID,
			[]models.KYCStatus{models.KYCPending, models.KYCApproved}).Count(&n).Error; err != nil {
			return err
		}
		if n > 0 {
			return services.Conflict("kyc_exists", "KYC already submitted or approved")
		}
		if err := tx.Create(&record).Error; err != nil {
			return err
		}
		return tx.Model(&models.User{}).Where("id = ?", user.ID).Update("kyc_status", models.KYCPending).Error
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	record.IDNumber = maskID(record.IDNumber)
	c.JSON(http.StatusCreated, record)
}

// GetMyKYC godoc
//
//	@Summary		Get my KYC record
//	@Description	Returns the authenticated student's most recent KYC record and status.
//	@Tags			KYC
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	models.KYCRecord
//	@Failure		401	{object}	errorResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/me/kyc [get]
func (h *KYCHandler) GetMyKYC(c *gin.Context) {
	user := middleware.GetUser(c)
	var record models.KYCRecord
	if err := h.DB.WithContext(c.Request.Context()).Where("user_id = ?", user.ID).Order("created_at DESC").First(&record).Error; err != nil {
		respondErr(c, http.StatusNotFound, "kyc_not_found", "no KYC record found")
		return
	}
	record.IDNumber = maskID(record.IDNumber)
	c.JSON(http.StatusOK, record)
}

// ListKYC godoc
//
//	@Summary		List KYC records (Admin)
//	@Description	Returns KYC records filterable by status. Defaults to 'pending' to show the admin review queue.
//	@Tags			KYC
//	@Security		BearerAuth
//	@Produce		json
//	@Param			status	query		string	false	"Filter by status: pending | approved | rejected"	default(pending)
//	@Success		200		{object}	listKYCResponse
//	@Failure		401		{object}	errorResponse
//	@Failure		403		{object}	errorResponse
//	@Router			/api/v1/admin/kyc [get]
func (h *KYCHandler) ListKYC(c *gin.Context) {
	status := c.DefaultQuery("status", "pending")
	if !models.KYCStatus(status).Valid() {
		respondErr(c, http.StatusBadRequest, "invalid_status", "status must be pending, approved or rejected")
		return
	}
	limit := pagination.LimitOr(c.Query("limit"), 200, 200)
	q := h.DB.WithContext(c.Request.Context()).Preload("User").Where("status = ?", status)
	// review queues are worked oldest-first: cursor walks (submitted_at, id) upwards
	if cur := pagination.Decode(c.Query("cursor")); cur != nil {
		q = q.Where("(submitted_at, id) > (?, ?)", cur.T, cur.ID)
	}
	var records []models.KYCRecord
	if err := q.Order("submitted_at ASC, id ASC").Limit(limit + 1).Find(&records).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	records, next := pagination.Page(records, limit, func(r models.KYCRecord) (time.Time, uuid.UUID) { return r.SubmittedAt, r.ID })
	c.JSON(http.StatusOK, gin.H{"records": records, "next_cursor": nilIfEmpty(next)})
}

// ApproveKYC godoc
//
//	@Summary		Approve a KYC record (Admin)
//	@Description	Approves a student's KYC submission and sets their kyc_status to 'approved'.
//	@Tags			KYC
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"KYC record UUID"
//	@Success		200	{object}	messageResponse
//	@Failure		400	{object}	errorResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/admin/kyc/{id}/approve [post]
func (h *KYCHandler) ApproveKYC(c *gin.Context) {
	admin := middleware.GetUser(c)
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	if err := h.review(c, id, models.KYCApproved, admin.ID, nil); err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "KYC approved"})
}

// RejectKYC godoc
//
//	@Summary		Reject a KYC record (Admin)
//	@Description	Rejects a student's KYC submission with a mandatory reason. Sets their kyc_status to 'rejected'.
//	@Tags			KYC
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string			true	"KYC record UUID"
//	@Param			body	body		rejectKYCRequest	true	"Rejection reason"
//	@Success		200		{object}	messageResponse
//	@Failure		400		{object}	errorResponse
//	@Failure		404		{object}	errorResponse
//	@Router			/api/v1/admin/kyc/{id}/reject [post]
func (h *KYCHandler) RejectKYC(c *gin.Context) {
	admin := middleware.GetUser(c)
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var req rejectKYCRequest
	if !httpx.Bind(c, &req) {
		return
	}
	if err := h.review(c, id, models.KYCRejected, admin.ID, &req.Reason); err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "KYC rejected"})
}

// review moves a pending record to approved/rejected and mirrors the result on
// the user, atomically. Records that are not pending are refused, so an old
// decision can never overwrite a newer one.
func (h *KYCHandler) review(c *gin.Context, id uuid.UUID, to models.KYCStatus, reviewer uuid.UUID, reason *string) error {
	return h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		upd := map[string]interface{}{"status": to, "reviewed_by": reviewer, "reviewed_at": now, "rejection_reason": reason}
		res := tx.Model(&models.KYCRecord{}).Where("id = ? AND status = ?", id, models.KYCPending).Updates(upd)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return services.NotFound("kyc_not_pending", "KYC record not found or not pending")
		}
		var rec models.KYCRecord
		if err := tx.First(&rec, "id = ?", id).Error; err != nil {
			return err
		}
		return tx.Model(&models.User{}).Where("id = ?", rec.UserID).Update("kyc_status", to).Error
	})
}

// maskID hides all but the last 4 characters of an identity number.
func maskID(n string) string {
	r := []rune(n)
	if len(r) <= 4 {
		return strings.Repeat("X", len(r))
	}
	return strings.Repeat("X", len(r)-4) + string(r[len(r)-4:])
}

// ── Request / Response types ──────────────────────────────────────────────────

type kycRequiredResponse struct {
	KYCRequired bool `json:"kyc_required" example:"false"`
	// Required repeats kyc_required under the name older app builds read.
	Required bool `json:"required" example:"false"`
}

type setKYCRequiredRequest struct {
	Enabled *bool `json:"enabled" example:"true"`
	// Required is the name older app builds send; either field works.
	Required *bool `json:"required"`
}

type submitKYCRequest struct {
	IDType          string `json:"id_type"           example:"aadhaar"`
	IDNumber        string `json:"id_number"         example:"123456789012"`
	DocumentFileKey string `json:"document_file_key" example:"kyc_document/user-uuid/file.jpg"`
}

type rejectKYCRequest struct {
	Reason string `json:"reason" example:"Document is blurry or unreadable"`
}

type listKYCResponse struct {
	Records []models.KYCRecord `json:"records"`
}
