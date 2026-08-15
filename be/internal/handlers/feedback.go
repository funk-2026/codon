package handlers

import (
	"net/http"

	"codon-backend/internal/middleware"
	"codon-backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type FeedbackHandler struct {
	DB *gorm.DB
}

func NewFeedbackHandler(db *gorm.DB) *FeedbackHandler {
	return &FeedbackHandler{DB: db}
}

// Submit godoc
//
//	@Summary		Submit feedback
//	@Description	Submits a feedback entry from the authenticated user.
//	@Tags			Feedback
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		submitFeedbackRequest	true	"Feedback payload"
//	@Success		201		{object}	models.UserFeedback
//	@Failure		400		{object}	errorResponse
//	@Failure		401		{object}	errorResponse
//	@Router			/api/v1/feedback [post]
func (h *FeedbackHandler) Submit(c *gin.Context) {
	user := middleware.GetUser(c)

	var req submitFeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	if req.Category == "" || req.Message == "" {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "category and message are required"})
		return
	}

	feedback := models.UserFeedback{
		UserID:     user.ID,
		Category:   req.Category,
		Message:    req.Message,
		AppVersion: req.AppVersion,
		DeviceOS:   req.DeviceOS,
	}

	if err := h.DB.WithContext(c.Request.Context()).Create(&feedback).Error; err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to save feedback"})
		return
	}

	c.JSON(http.StatusCreated, feedback)
}

// ── Request types ─────────────────────────────────────────────────────────────

type submitFeedbackRequest struct {
	Category   string  `json:"category"    binding:"required" example:"bug"`
	Message    string  `json:"message"     binding:"required" example:"The timer freezes on submit"`
	AppVersion *string `json:"app_version" example:"1.0.0"`
	DeviceOS   *string `json:"device_os"   example:"Android 14"`
}
