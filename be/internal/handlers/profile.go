package handlers

import (
	"net/http"

	"codon-backend/internal/middleware"
	"codon-backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ProfileHandler struct {
	DB *gorm.DB
}

func NewProfileHandler(db *gorm.DB) *ProfileHandler {
	return &ProfileHandler{DB: db}
}

// GetMe godoc
//
//	@Summary		Get my profile
//	@Description	Returns the authenticated user's profile, active subscription summary, and current KYC required flag.
//	@Tags			Profile
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	getMeResponse
//	@Failure		401	{object}	errorResponse
//	@Router			/me [get]
func (h *ProfileHandler) GetMe(c *gin.Context) {
	user := middleware.GetUser(c)

	var activeSub models.Subscription
	subResult := h.DB.WithContext(c.Request.Context()).
		Where("user_id = ? AND status = ? AND end_date >= NOW()", user.ID, models.SubActive).
		Preload("Plan").
		Preload("Course").
		First(&activeSub)

	var setting models.PlatformSetting
	kycRequired := false
	if h.DB.Where("key = ?", "kyc_required").First(&setting).Error == nil {
		kycRequired = setting.Value == "true"
	}

	resp := gin.H{
		"user":         user,
		"kyc_required": kycRequired,
	}
	if subResult.Error == nil {
		resp["active_subscription"] = activeSub
	}
	c.JSON(http.StatusOK, resp)
}

// UpdateMe godoc
//
//	@Summary		Update my profile
//	@Description	Updates the authenticated user's name, profile photo key, or selected course.
//	@Tags			Profile
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		updateMeRequest	true	"Fields to update (all optional)"
//	@Success		200		{object}	models.User
//	@Failure		400		{object}	errorResponse
//	@Failure		401		{object}	errorResponse
//	@Router			/me [patch]
func (h *ProfileHandler) UpdateMe(c *gin.Context) {
	user := middleware.GetUser(c)

	var req updateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = req.Name
	}
	if req.ProfilePhotoKey != nil {
		updates["profile_photo_key"] = req.ProfilePhotoKey
	}
	if req.SelectedCourseID != nil {
		var course models.Course
		if h.DB.Where("id = ?", *req.SelectedCourseID).First(&course).Error != nil {
			c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid course_id"})
			return
		}
		updates["selected_course_id"] = *req.SelectedCourseID
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "no fields to update"})
		return
	}

	if err := h.DB.WithContext(c.Request.Context()).Model(user).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to update profile"})
		return
	}

	h.DB.WithContext(c.Request.Context()).First(user, user.ID)
	c.JSON(http.StatusOK, user)
}

// GetProgress godoc
//
//	@Summary		Get my progress metrics
//	@Description	Returns the number of tests attempted and the average score for the authenticated student.
//	@Tags			Profile
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	progressResponse
//	@Failure		401	{object}	errorResponse
//	@Router			/me/progress [get]
func (h *ProfileHandler) GetProgress(c *gin.Context) {
	user := middleware.GetUser(c)

	var progress progressResponse
	h.DB.WithContext(c.Request.Context()).
		Model(&models.StudentAttempt{}).
		Select("COUNT(*) as attempted_count, COALESCE(AVG(score), 0) as avg_score").
		Where("user_id = ? AND status = ?", user.ID, models.AttemptSubmitted).
		Scan(&progress)

	c.JSON(http.StatusOK, progress)
}

// GetAttempts godoc
//
//	@Summary		List my test attempts
//	@Description	Returns the full attempt history for the authenticated student, ordered by most recent.
//	@Tags			Profile
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	listAttemptsResponse
//	@Failure		401	{object}	errorResponse
//	@Router			/me/attempts [get]
func (h *ProfileHandler) GetAttempts(c *gin.Context) {
	user := middleware.GetUser(c)

	var attempts []models.StudentAttempt
	h.DB.WithContext(c.Request.Context()).
		Where("user_id = ?", user.ID).
		Preload("Test").
		Order("created_at DESC").
		Find(&attempts)

	c.JSON(http.StatusOK, listAttemptsResponse{Attempts: attempts})
}

// GetMySubscription godoc
//
//	@Summary		Get my active subscription
//	@Description	Returns the student's current active subscription with plan and course details, or null if none.
//	@Tags			Profile
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	mySubscriptionResponse
//	@Failure		401	{object}	errorResponse
//	@Router			/me/subscription [get]
func (h *ProfileHandler) GetMySubscription(c *gin.Context) {
	user := middleware.GetUser(c)

	var sub models.Subscription
	err := h.DB.WithContext(c.Request.Context()).
		Where("user_id = ? AND status = ? AND end_date >= NOW()", user.ID, models.SubActive).
		Preload("Plan").
		Preload("Course").
		First(&sub).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusOK, mySubscriptionResponse{Subscription: nil})
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to fetch subscription"})
		return
	}
	c.JSON(http.StatusOK, mySubscriptionResponse{Subscription: &sub})
}

// ── Request / Response types ──────────────────────────────────────────────────

type getMeResponse struct {
	User               models.User          `json:"user"`
	KYCRequired        bool                 `json:"kyc_required" example:"false"`
	ActiveSubscription *models.Subscription `json:"active_subscription,omitempty"`
}

type updateMeRequest struct {
	Name             *string `json:"name"              example:"Arjun Sharma"`
	ProfilePhotoKey  *string `json:"profile_photo_key" example:"profile_photo/uuid/file.jpg"`
	SelectedCourseID *string `json:"selected_course_id" example:"550e8400-e29b-41d4-a716-446655440000"`
}

type progressResponse struct {
	AttemptedCount int     `json:"attempted_count" example:"12"`
	AvgScore       float64 `json:"avg_score"       example:"72.5"`
}

type listAttemptsResponse struct {
	Attempts []models.StudentAttempt `json:"attempts"`
}

type mySubscriptionResponse struct {
	Subscription *models.Subscription `json:"subscription"`
}
