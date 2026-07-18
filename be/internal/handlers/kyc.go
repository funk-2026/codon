package handlers

import (
	"net/http"
	"time"

	"codon-backend/internal/middleware"
	"codon-backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
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
//	@Router			/platform-settings/kyc-required [get]
func (h *KYCHandler) GetKYCRequired(c *gin.Context) {
	var setting models.PlatformSetting
	if err := h.DB.Where("key = ?", "kyc_required").First(&setting).Error; err != nil {
		c.JSON(http.StatusOK, kycRequiredResponse{KYCRequired: false})
		return
	}
	c.JSON(http.StatusOK, kycRequiredResponse{KYCRequired: setting.Value == "true"})
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
//	@Router			/admin/settings/kyc-required [patch]
func (h *KYCHandler) SetKYCRequired(c *gin.Context) {
	admin := middleware.GetUser(c)

	var req setKYCRequiredRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	value := "false"
	if req.Enabled {
		value = "true"
	}

	updatedBy := admin.ID
	result := h.DB.Model(&models.PlatformSetting{}).
		Where("key = ?", "kyc_required").
		Updates(map[string]interface{}{
			"value":      value,
			"updated_at": time.Now(),
			"updated_by": updatedBy,
		})
	if result.RowsAffected == 0 {
		h.DB.Create(&models.PlatformSetting{
			Key:       "kyc_required",
			Value:     value,
			UpdatedBy: &updatedBy,
		})
	}

	c.JSON(http.StatusOK, kycRequiredResponse{KYCRequired: req.Enabled})
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
//	@Router			/me/kyc [post]
func (h *KYCHandler) SubmitKYC(c *gin.Context) {
	user := middleware.GetUser(c)

	var req submitKYCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	if req.IDType != string(models.IDTypeAadhaar) && req.IDType != string(models.IDTypePAN) {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "id_type must be 'aadhaar' or 'pan'"})
		return
	}

	var existing models.KYCRecord
	if h.DB.Where("user_id = ? AND status IN ?", user.ID, []string{"pending", "approved"}).First(&existing).Error == nil {
		c.JSON(http.StatusConflict, errorResponse{Error: "KYC already submitted or approved"})
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
	if err := h.DB.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to submit KYC"})
		return
	}

	h.DB.Model(user).Update("kyc_status", models.KYCPending)
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
//	@Router			/me/kyc [get]
func (h *KYCHandler) GetMyKYC(c *gin.Context) {
	user := middleware.GetUser(c)
	var record models.KYCRecord
	if err := h.DB.Where("user_id = ?", user.ID).Order("created_at DESC").First(&record).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "no KYC record found"})
		return
	}
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
//	@Router			/admin/kyc [get]
func (h *KYCHandler) ListKYC(c *gin.Context) {
	status := c.DefaultQuery("status", "pending")
	var records []models.KYCRecord
	h.DB.Where("status = ?", status).Order("submitted_at ASC").Find(&records)
	c.JSON(http.StatusOK, listKYCResponse{Records: records})
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
//	@Router			/admin/kyc/{id}/approve [post]
func (h *KYCHandler) ApproveKYC(c *gin.Context) {
	admin := middleware.GetUser(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid id"})
		return
	}

	var record models.KYCRecord
	if err := h.DB.Where("id = ?", id).First(&record).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "KYC record not found"})
		return
	}

	now := time.Now()
	record.Status = models.KYCApproved
	record.ReviewedBy = &admin.ID
	record.ReviewedAt = &now
	h.DB.Save(&record)

	h.DB.Model(&models.User{}).Where("id = ?", record.UserID).Update("kyc_status", models.KYCApproved)
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
//	@Router			/admin/kyc/{id}/reject [post]
func (h *KYCHandler) RejectKYC(c *gin.Context) {
	admin := middleware.GetUser(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid id"})
		return
	}

	var req rejectKYCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	var record models.KYCRecord
	if err := h.DB.Where("id = ?", id).First(&record).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "KYC record not found"})
		return
	}

	now := time.Now()
	record.Status = models.KYCRejected
	record.ReviewedBy = &admin.ID
	record.ReviewedAt = &now
	record.RejectionReason = &req.Reason
	h.DB.Save(&record)

	h.DB.Model(&models.User{}).Where("id = ?", record.UserID).Update("kyc_status", models.KYCRejected)
	c.JSON(http.StatusOK, messageResponse{Message: "KYC rejected"})
}

// ── Request / Response types ──────────────────────────────────────────────────

type kycRequiredResponse struct {
	KYCRequired bool `json:"kyc_required" example:"false"`
}

type setKYCRequiredRequest struct {
	Enabled bool `json:"enabled" example:"true"`
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
