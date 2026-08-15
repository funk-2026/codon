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
//	@Router			/api/v1/me [get]
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
//	@Router			/api/v1/me [patch]
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
//	@Router			/api/v1/me/subscription [get]
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
	contentID := c.Param("id")

	var req heartbeatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	var parsedID uuid.UUID
	var err error
	if parsedID, err = uuid.Parse(contentID); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid content id"})
		return
	}

	// Update or create watch history
	var history models.UserWatchHistory
	err = h.DB.WithContext(c.Request.Context()).
		Where("user_id = ? AND content_item_id = ?", user.ID, parsedID).
		First(&history).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			history = models.UserWatchHistory{
				UserID:          user.ID,
				ContentItemID:   parsedID,
				ProgressSeconds: req.ProgressSeconds,
				IsCompleted:     req.IsCompleted,
				LastWatchedAt:   time.Now(),
			}
			h.DB.Create(&history)
		} else {
			c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to save heartbeat"})
			return
		}
	} else {
		if req.ProgressSeconds > history.ProgressSeconds {
			history.ProgressSeconds = req.ProgressSeconds
		}
		if req.IsCompleted {
			history.IsCompleted = true
		}
		history.LastWatchedAt = time.Now()
		h.DB.Save(&history)
	}

	// Update daily activity
	today := time.Now().Truncate(24 * time.Hour)
	var daily models.DailyActivity
	err = h.DB.Where("user_id = ? AND date = ?", user.ID, today).First(&daily).Error
	if err == gorm.ErrRecordNotFound {
		h.DB.Create(&models.DailyActivity{
			UserID:    user.ID,
			Date:      today,
			CreatedAt: time.Now(),
		})
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *ProfileHandler) GetRecentContent(c *gin.Context) {
	user := middleware.GetUser(c)

	var history []models.UserWatchHistory
	h.DB.WithContext(c.Request.Context()).
		Where("user_id = ?", user.ID).
		Preload("ContentItem").
		Order("last_watched_at desc").
		Limit(10).
		Find(&history)

	var recent []map[string]interface{}
	for _, hist := range history {
		if hist.ContentItem.ID == uuid.Nil {
			continue
		}
		
		breadcrumb := "Subject › Chapter"
		var chapter models.Chapter
		if err := h.DB.Preload("Subject").Where("id = ?", hist.ContentItem.ChapterID).First(&chapter).Error; err == nil {
			breadcrumb = chapter.Subject.Name + " › " + chapter.Name
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

	// Trend: last 10 attempts
	var trendScores []float64
	h.DB.WithContext(c.Request.Context()).
		Model(&models.StudentAttempt{}).
		Where("user_id = ? AND status = ?", user.ID, models.AttemptSubmitted).
		Order("created_at ASC").
		Limit(10).
		Pluck("score", &trendScores)

	trend := make([]int, len(trendScores))
	for i, s := range trendScores {
		trend[i] = int(s)
	}
	if len(trend) == 0 {
		trend = []int{0, 0, 0, 0, 0, 0, 0, 0, 0, 0}
	}

	// Subjects Accuracy
	type subjectStat struct {
		Name     string
		Accuracy float64
	}
	var subStats []subjectStat

	query := `
		SELECT s.name as name,
		       (COUNT(CASE WHEN aa.selected_option = q.correct_option THEN 1 END) * 100.0) / NULLIF(COUNT(aa.id), 0) as accuracy
		FROM attempt_answers aa
		JOIN questions q ON aa.question_id = q.id
		JOIN student_attempts sa ON aa.attempt_id = sa.id
		JOIN tests t ON sa.test_id = t.id
		JOIN subjects s ON t.subject_id = s.id
		WHERE sa.user_id = ? AND sa.status = ?
		GROUP BY s.id, s.name
	`
	h.DB.WithContext(c.Request.Context()).Raw(query, user.ID, models.AttemptSubmitted).Scan(&subStats)

	subjects := make([]progressSubject, len(subStats))
	for i, s := range subStats {
		subjects[i] = progressSubject{
			Name:     s.Name,
			Accuracy: int(s.Accuracy),
		}
	}
	if len(subjects) == 0 {
		subjects = []progressSubject{
			{Name: "Physics", Accuracy: 0},
			{Name: "Chemistry", Accuracy: 0},
			{Name: "Botany", Accuracy: 0},
			{Name: "Zoology", Accuracy: 0},
		}
	}

	// Real streak calculation
	dayStreak := 0
	today := time.Now().Truncate(24 * time.Hour)
	for i := 0; ; i++ {
		checkDate := today.AddDate(0, 0, -i)
		var count int64
		h.DB.Model(&models.DailyActivity{}).
			Where("user_id = ? AND date = ?", user.ID, checkDate).
			Count(&count)
		if count > 0 {
			dayStreak++
		} else {
			if i > 0 {
				break
			}
		}
	}

	last7Days := make([]bool, 7)
	for i := 0; i < 7; i++ {
		checkDate := today.AddDate(0, 0, -i)
		var count int64
		h.DB.Model(&models.DailyActivity{}).
			Where("user_id = ? AND date = ?", user.ID, checkDate).
			Count(&count)
		last7Days[6-i] = count > 0
	}

	resp := progressBreakdownResponse{
		Trend:     trend,
		Subjects:  subjects,
		DayStreak: dayStreak,
		Last7Days: last7Days,
	}

	c.JSON(http.StatusOK, resp)
}

type progressSubject struct {
	Name     string `json:"name"`
	Accuracy int    `json:"accuracy"`
}

type progressBreakdownResponse struct {
	Trend     []int             `json:"trend"`
	Subjects  []progressSubject `json:"subjects"`
	DayStreak int               `json:"day_streak"`
	Last7Days []bool            `json:"last_7_days"`
}
