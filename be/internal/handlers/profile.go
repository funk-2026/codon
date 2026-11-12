package handlers

import (
	"net/http"
	"time"

	"codon-backend/internal/httpx"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ProfileHandler struct {
	DB  *gorm.DB
	Sub *services.SubscriptionService
}

func NewProfileHandler(db *gorm.DB, sub *services.SubscriptionService) *ProfileHandler {
	return &ProfileHandler{DB: db, Sub: sub}
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
//	@Router			/api/v1/me [get]
func (h *ProfileHandler) GetMe(c *gin.Context) {
	user := middleware.GetUser(c)

	activeSub, err := h.Sub.ActiveAny(c.Request.Context(), user.ID)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	resp := gin.H{
		"user":         user,
		"kyc_required": h.Sub.KYCRequired(),
	}
	if activeSub != nil {
		resp["active_subscription"] = activeSub // kept for older clients: the one ending last
	}
	all, err := h.Sub.ActiveAll(c.Request.Context(), user.ID)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	resp["active_subscriptions"] = all // one per course
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
//	@Router			/api/v1/me [patch]
func (h *ProfileHandler) UpdateMe(c *gin.Context) {
	user := middleware.GetUser(c)

	var req updateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
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
			respondErr(c, http.StatusBadRequest, "bad_request", "invalid course_id")
			return
		}
		updates["selected_course_id"] = *req.SelectedCourseID
	}

	if len(updates) == 0 {
		respondErr(c, http.StatusBadRequest, "bad_request", "no fields to update")
		return
	}

	if err := h.DB.WithContext(c.Request.Context()).Model(user).Updates(updates).Error; err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to update profile")
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
//	@Router			/api/v1/me/progress [get]
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
//	@Router			/api/v1/me/attempts [get]
func (h *ProfileHandler) GetAttempts(c *gin.Context) {
	user := middleware.GetUser(c)

	attempts, next, err := paged(c, h.DB.WithContext(c.Request.Context()).Where("user_id = ?", user.ID).Preload("Test"), "student_attempts",
		func(a models.StudentAttempt) (time.Time, uuid.UUID) { return a.CreatedAt, a.ID })
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"attempts": attempts, "next_cursor": nilIfEmpty(next)})
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
//	@Router			/api/v1/me/subscription [get]
func (h *ProfileHandler) GetMySubscription(c *gin.Context) {
	user := middleware.GetUser(c)

	sub, err := h.Sub.ActiveAny(c.Request.Context(), user.ID)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, mySubscriptionResponse{Subscription: sub})
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

// GetRecentContent godoc
//
//	@Summary		Get recently watched/viewed content
//	@Description	Returns a list of recently accessed content for the authenticated student.
//	@Tags			Profile
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	recentContentResponse
//	@Failure		401	{object}	errorResponse
//	@Router			/api/v1/me/recent-content [get]
type heartbeatRequest struct {
	ProgressSeconds int  `json:"progress_seconds"`
	IsCompleted     bool `json:"is_completed"`
}

func (h *ProfileHandler) ContentHeartbeat(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	contentID, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var req heartbeatRequest
	if !httpx.Bind(c, &req) {
		return
	}
	if req.ProgressSeconds < 0 {
		httpx.BadRequest(c, "invalid_progress", "progress_seconds must be >= 0")
		return
	}

	var n int64
	if err := h.DB.WithContext(ctx).Model(&models.ContentItem{}).Where("id = ?", contentID).Count(&n).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	if n == 0 {
		httpx.NotFound(c, "content_not_found", "content not found")
		return
	}

	// One atomic upsert: progress only moves forward, completion is sticky.
	now := time.Now()
	err := h.DB.WithContext(ctx).Exec(`
		INSERT INTO user_watch_histories (id, user_id, content_item_id, progress_seconds, is_completed, last_watched_at)
		VALUES (gen_random_uuid(), ?, ?, ?, ?, ?)
		ON CONFLICT (user_id, content_item_id) DO UPDATE SET
			progress_seconds = GREATEST(user_watch_histories.progress_seconds, EXCLUDED.progress_seconds),
			is_completed     = user_watch_histories.is_completed OR EXCLUDED.is_completed,
			last_watched_at  = EXCLUDED.last_watched_at`,
		user.ID, contentID, req.ProgressSeconds, req.IsCompleted, now).Error
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	if err := services.RecordDailyActivity(h.DB.WithContext(ctx), user.ID, now); err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *ProfileHandler) GetRecentContent(c *gin.Context) {
	user := middleware.GetUser(c)

	var history []models.UserWatchHistory
	h.DB.WithContext(c.Request.Context()).
		Where("user_id = ?", user.ID).
		Preload("ContentItem.Chapter.Subject").
		Order("last_watched_at desc").
		Limit(10).
		Find(&history)

	var recent []map[string]interface{}
	for _, hist := range history {
		if hist.ContentItem.ID == uuid.Nil {
			continue
		}

		breadcrumb := "Subject › Chapter"
		if ch := hist.ContentItem.Chapter; ch.ID != uuid.Nil {
			breadcrumb = ch.Subject.Name + " › " + ch.Name
		}

		pct := 0
		if hist.IsCompleted {
			pct = 100
		} else if hist.ProgressSeconds > 0 {
			pct = 50 // Mocking 50% for in-progress since we don't have duration
		}

		recent = append(recent, map[string]interface{}{
			"id":         hist.ContentItem.ID.String(),
			"title":      hist.ContentItem.Title,
			"breadcrumb": breadcrumb,
			"kind":       string(hist.ContentItem.ContentType),
			"pct":        pct,
		})
	}

	if recent == nil {
		recent = []map[string]interface{}{}
	}

	c.JSON(http.StatusOK, recentContentResponse{Recent: recent})
}

type recentContentResponse struct {
	Recent []map[string]interface{} `json:"recent"`
}

type mySubscriptionResponse struct {
	Subscription *models.Subscription `json:"subscription"`
}

// GetProgressBreakdown godoc
//
//	@Summary		Get my progress breakdown
//	@Description	Returns detailed progress metrics including trend, subject accuracy, and streaks.
//	@Tags			Profile
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	progressBreakdownResponse
//	@Failure		401	{object}	errorResponse
//	@Router			/api/v1/me/progress/breakdown [get]
func (h *ProfileHandler) GetProgressBreakdown(c *gin.Context) {
	user := middleware.GetUser(c)
	res, err := services.Progress(c.Request.Context(), h.DB, user.ID, c.Query("module"), time.Now())
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, res)
}

type progressBreakdownResponse = services.ProgressBreakdown
