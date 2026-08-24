package handlers

import (
	"fmt"
	"net/http"
	"time"

	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AdminHandler struct {
	DB         *gorm.DB
	SessionSvc *services.SessionService
}

func NewAdminHandler(db *gorm.DB, sessionSvc *services.SessionService) *AdminHandler {
	return &AdminHandler{DB: db, SessionSvc: sessionSvc}
}

// ListUsers godoc
//
//	@Summary		List all users (Admin)
//	@Description	Returns all users filterable by role and searchable by phone number or name.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			role	query		string	false	"Filter by role: student | teacher | admin"
//	@Param			search	query		string	false	"Search by phone number or name"
//	@Success		200		{object}	listUsersResponse
//	@Failure		401		{object}	errorResponse
//	@Failure		403		{object}	errorResponse
//	@Router			/api/v1/admin/users [get]
func (h *AdminHandler) ListUsers(c *gin.Context) {
	role := c.Query("role")
	search := c.Query("search")

	query := h.DB.WithContext(c.Request.Context()).Model(&models.User{})
	if role != "" {
		query = query.Where("role = ?", role)
	}
	if search != "" {
		query = query.Where("phone_number LIKE ? OR name ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	var users []models.User
	query.Order("created_at DESC").Find(&users)
	c.JSON(http.StatusOK, listUsersResponse{Users: users})
}

// GetAdminUser godoc
//
//	@Summary		Get a user by ID (Admin)
//	@Description	Returns a single user's profile including their selected course.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"User UUID"
//	@Success		200	{object}	models.User
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/admin/users/{id} [get]
func (h *AdminHandler) GetUser(c *gin.Context) {
	id := c.Param("id")
	var user models.User
	if err := h.DB.WithContext(c.Request.Context()).
		Preload("SelectedCourse").
		Where("id = ?", id).
		First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "user not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

// UpdateUserRole godoc
//
//	@Summary		Update a user's role (Admin)
//	@Description	Changes a user's role. Role is always admin-managed; users cannot self-assign roles. Valid roles: student, teacher, admin.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string				true	"User UUID"
//	@Param			body	body		updateRoleRequest	true	"New role"
//	@Success		200		{object}	messageResponse
//	@Failure		400		{object}	errorResponse
//	@Failure		404		{object}	errorResponse
//	@Router			/api/v1/admin/users/{id}/role [patch]
func (h *AdminHandler) UpdateUserRole(c *gin.Context) {
	_ = middleware.GetUser(c)
	id := c.Param("id")

	var req updateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	if err := models.ValidateUserRole(req.Role); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	result := h.DB.WithContext(c.Request.Context()).
		Model(&models.User{}).
		Where("id = ?", id).
		Update("role", req.Role)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, errorResponse{Error: "user not found"})
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "role updated"})
}

// UpdateTeacherPermissions godoc
//
//	@Summary		Update teacher content permissions (Admin)
//	@Description	Grants or revokes the can_manage_all_content flag for a teacher. When true, the teacher can edit and moderate all content platform-wide regardless of authorship.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string							true	"User UUID (must be a teacher)"
//	@Param			body	body		updateTeacherPermissionsRequest	true	"Permission flag"
//	@Success		200		{object}	messageResponse
//	@Failure		404		{object}	errorResponse
//	@Router			/api/v1/admin/users/{id}/teacher-permissions [patch]
func (h *AdminHandler) UpdateTeacherPermissions(c *gin.Context) {
	id := c.Param("id")

	var req updateTeacherPermissionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	result := h.DB.WithContext(c.Request.Context()).
		Model(&models.User{}).
		Where("id = ? AND role = ?", id, models.RoleTeacher).
		Update("can_manage_all_content", req.CanManageAllContent)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, errorResponse{Error: "teacher not found"})
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "permissions updated"})
}

// GetUserSubscription godoc
//
//	@Summary		Get a user's active subscription (Admin)
//	@Description	Returns the active subscription for the specified user, or null if none.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"User UUID"
//	@Success		200	{object}	adminUserSubscriptionResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/admin/users/{id}/subscription [get]
func (h *AdminHandler) GetUserSubscription(c *gin.Context) {
	userID := c.Param("id")

	var sub models.Subscription
	err := h.DB.WithContext(c.Request.Context()).
		Where("user_id = ? AND status = ? AND end_date >= NOW()", userID, models.SubActive).
		Preload("Plan").
		Preload("Course").
		First(&sub).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusOK, adminUserSubscriptionResponse{Subscription: nil})
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to fetch subscription"})
		return
	}
	c.JSON(http.StatusOK, adminUserSubscriptionResponse{Subscription: &sub})
}

// GetUserSessions godoc
//
//	@Summary		Get a user's active sessions (Admin)
//	@Description	Returns the list of active (non-revoked, non-expired) device sessions for a user.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"User UUID"
//	@Success		200	{object}	adminUserSessionsResponse
//	@Failure		400	{object}	errorResponse
//	@Router			/api/v1/admin/users/{id}/sessions [get]
func (h *AdminHandler) GetUserSessions(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid user id"})
		return
	}

	sessions, err := h.SessionSvc.ListActiveSessions(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to list sessions"})
		return
	}
	c.JSON(http.StatusOK, adminUserSessionsResponse{
		Sessions:    sessions,
		ActiveCount: len(sessions),
	})
}

// DashboardSummary godoc
//
//	@Summary		Get admin dashboard summary
//	@Description	Returns live counts for the admin dashboard: total users, active subscriptions, pending KYC records, and pending content review items.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	dashboardSummaryResponse
//	@Failure		401	{object}	errorResponse
//	@Failure		403	{object}	errorResponse
//	@Router			/api/v1/admin/dashboard/summary [get]
func (h *AdminHandler) DashboardSummary(c *gin.Context) {
	var userCount, activeSubCount, pendingKYCCount, pendingTestCount, pendingContentCount int64

	h.DB.Model(&models.User{}).Count(&userCount)
	h.DB.Model(&models.Subscription{}).
		Where("status = ? AND end_date >= NOW()", models.SubActive).
		Count(&activeSubCount)
	h.DB.Model(&models.KYCRecord{}).
		Where("status = ?", models.KYCPending).
		Count(&pendingKYCCount)
	h.DB.Model(&models.Test{}).
		Where("status = ?", models.StatusPendingReview).
		Count(&pendingTestCount)
	h.DB.Model(&models.ContentItem{}).
		Where("status = ?", models.StatusPendingReview).
		Count(&pendingContentCount)

	c.JSON(http.StatusOK, dashboardSummaryResponse{
		TotalUsers:            userCount,
		ActiveSubscriptions:   activeSubCount,
		PendingKYC:            pendingKYCCount,
		PendingTestReviews:    pendingTestCount,
		PendingContentReviews: pendingContentCount,
	})
}

// AnalyticsOverview godoc
//
//	@Summary		Get admin analytics overview
//	@Description	Returns analytics data for charts and stats
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	analyticsOverviewResponse
//	@Failure		401	{object}	errorResponse
//	@Failure		403	{object}	errorResponse
//	@Router			/api/v1/admin/analytics [get]
func calcDelta(current, previous int64) (string, bool) {
	if previous == 0 {
		if current == 0 {
			return "0%", true
		}
		return "+100%", true
	}
	diff := float64(current - previous)
	pct := (diff / float64(previous)) * 100
	positive := pct >= 0
	sign := "+"
	if !positive {
		sign = "" // float format handles minus
	}
	return fmt.Sprintf("%s%.0f%%", sign, pct), positive
}

// AnalyticsOverview godoc
//
//	@Summary		Get admin analytics overview
//	@Description	Returns analytics data for charts and stats, with computed deltas based on date ranges
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			range	query		string	false	"Time range (7D, 30D, All Time)"	default(7D)
//	@Success		200		{object}	analyticsOverviewResponse
//	@Failure		401		{object}	errorResponse
//	@Failure		403		{object}	errorResponse
//	@Router			/api/v1/admin/analytics [get]
func (h *AdminHandler) AnalyticsOverview(c *gin.Context) {
	rangeStr := c.DefaultQuery("range", "7D")
	now := time.Now()
	var startDate, prevStartDate time.Time
	hasPrev := false

	switch rangeStr {
	case "7D":
		startDate = now.AddDate(0, 0, -7)
		prevStartDate = startDate.AddDate(0, 0, -7)
		hasPrev = true
	case "30D":
		startDate = now.AddDate(0, 0, -30)
		prevStartDate = startDate.AddDate(0, 0, -30)
		hasPrev = true
	default:
		// All Time
		startDate = time.Time{}
		hasPrev = false
	}

	var userCount, prevUserCount int64
	var activeSubCount, prevActiveSubCount int64
	var testsAttempted, prevTestsAttempted int64

	type result struct{ Total int64 }

	// Current Period Queries
	queryCurrent := func(model interface{}, timeCol string) *gorm.DB {
		q := h.DB.Model(model)
		if !startDate.IsZero() {
			q = q.Where(timeCol+" >= ?", startDate)
		}
		return q
	}

	// Previous Period Queries
	queryPrev := func(model interface{}, timeCol string) *gorm.DB {
		if !hasPrev {
			return h.DB.Model(model).Where("1 = 0") // Returns 0 if no previous period
		}
		return h.DB.Model(model).Where(timeCol+" >= ? AND "+timeCol+" < ?", prevStartDate, startDate)
	}

	queryCurrent(&models.User{}, "created_at").Count(&userCount)
	queryPrev(&models.User{}, "created_at").Count(&prevUserCount)

	queryCurrent(&models.Subscription{}, "created_at").Where("status = ?", models.SubActive).Count(&activeSubCount)
	queryPrev(&models.Subscription{}, "created_at").Where("status = ?", models.SubActive).Count(&prevActiveSubCount)

	queryCurrent(&models.StudentAttempt{}, "started_at").Count(&testsAttempted)
	queryPrev(&models.StudentAttempt{}, "started_at").Count(&prevTestsAttempted)

	var res result
	var prevRes result
	queryCurrent(&models.PaymentRecord{}, "created_at").
		Select("COALESCE(SUM(amount_paise), 0) as total").Where("status = ?", models.PayCaptured).Scan(&res)
	queryPrev(&models.PaymentRecord{}, "created_at").
		Select("COALESCE(SUM(amount_paise), 0) as total").Where("status = ?", models.PayCaptured).Scan(&prevRes)

	revenue := res.Total / 100
	prevRevenue := prevRes.Total / 100

	userDelta, userPos := calcDelta(userCount, prevUserCount)
	revDelta, revPos := calcDelta(revenue, prevRevenue)
	subDelta, subPos := calcDelta(activeSubCount, prevActiveSubCount)
	testDelta, testPos := calcDelta(testsAttempted, prevTestsAttempted)

	if !hasPrev {
		userDelta, userPos = "0%", true
		revDelta, revPos = "0%", true
		subDelta, subPos = "0%", true
		testDelta, testPos = "0%", true
	}

	// Keep these as global counts (or adjust if needed)

	var publishedTests, publishedContent, publishedBrainHacks, pendingReviews int64
	h.DB.Model(&models.Test{}).Where("status = ?", models.StatusPublished).Count(&publishedTests)
	h.DB.Model(&models.ContentItem{}).Where("status = ? AND content_type != ?", models.StatusPublished, "brain_hack").Count(&publishedContent)
	h.DB.Model(&models.ContentItem{}).Where("status = ? AND content_type = ?", models.StatusPublished, "brain_hack").Count(&publishedBrainHacks)

	var pt, pc int64
	h.DB.Model(&models.Test{}).Where("status = ?", models.StatusPendingReview).Count(&pt)
	h.DB.Model(&models.ContentItem{}).Where("status = ?", models.StatusPendingReview).Count(&pc)
	pendingReviews = pt + pc

	// Chart Bucketing Logic
	var numBars int
	switch rangeStr {
	case "7D":
		numBars = 7
	case "30D":
		numBars = 30
	default:
		numBars = 12 // Last 12 months for All Time
	}

	revBars := make([]int, numBars)
	studentBars := make([]int, numBars)
	teacherBars := make([]int, numBars)

	bod := func(t time.Time) time.Time {
		y, m, d := t.Date()
		return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
	}
	today := bod(now)

	bucketIndex := func(t time.Time) int {
		if rangeStr == "All Time" {
			diffMonths := (now.Year()-t.Year())*12 + int(now.Month()-t.Month())
			idx := (numBars - 1) - diffMonths
			if idx >= 0 && idx < numBars {
				return idx
			}
			return -1
		}
		tDay := bod(t)
		diffDays := int(today.Sub(tDay).Hours() / 24)
		idx := (numBars - 1) - diffDays
		if idx >= 0 && idx < numBars {
			return idx
		}
		return -1
	}

	type timeRec struct {
		CreatedAt time.Time
	}
	type payRec struct {
		CreatedAt   time.Time
		AmountPaise int64
	}

	var students []timeRec
	var teachers []timeRec
	var payments []payRec

	queryCurrent(&models.User{}, "created_at").Where("role = ?", "student").Select("created_at").Find(&students)
	queryCurrent(&models.User{}, "created_at").Where("role = ?", "teacher").Select("created_at").Find(&teachers)
	queryCurrent(&models.PaymentRecord{}, "created_at").Where("status = ?", models.PayCaptured).Select("created_at, amount_paise").Find(&payments)

	for _, s := range students {
		if idx := bucketIndex(s.CreatedAt); idx != -1 {
			studentBars[idx]++
		}
	}
	for _, t := range teachers {
		if idx := bucketIndex(t.CreatedAt); idx != -1 {
			teacherBars[idx]++
		}
	}
	for _, p := range payments {
		if idx := bucketIndex(p.CreatedAt); idx != -1 {
			revBars[idx] += int(p.AmountPaise / 100)
		}
	}

	c.JSON(http.StatusOK, analyticsOverviewResponse{
		NewUsers:            userCount,
		NewUsersDelta:       userDelta,
		NewUsersPositive:    userPos,
		Revenue:             revenue,
		RevenueDelta:        revDelta,
		RevenuePositive:     revPos,
		ActiveSubscriptions: activeSubCount,
		ActiveSubDelta:      subDelta,
		ActiveSubPositive:   subPos,
		TestsAttempted:      testsAttempted,
		TestsAttemptedDelta: testDelta,
		TestsAttemptedPos:   testPos,
		RevenueBars:         revBars,
		StudentBars:         studentBars,
		TeacherBars:         teacherBars,
		PublishedTests:      publishedTests,
		PublishedContent:    publishedContent,
		PublishedBrainHacks: publishedBrainHacks,
		PendingReviews:      pendingReviews,
	})
}

// ── Request / Response types ──────────────────────────────────────────────────

type listUsersResponse struct {
	Users []models.User `json:"users"`
}

type updateRoleRequest struct {
	Role string `json:"role" example:"teacher" enums:"student,teacher,admin"`
}

type updateTeacherPermissionsRequest struct {
	CanManageAllContent bool `json:"can_manage_all_content" example:"true"`
}

type dashboardSummaryResponse struct {
	TotalUsers            int64 `json:"total_users"             example:"1420"`
	ActiveSubscriptions   int64 `json:"active_subscriptions"    example:"830"`
	PendingKYC            int64 `json:"pending_kyc"             example:"12"`
	PendingTestReviews    int64 `json:"pending_test_reviews"    example:"5"`
	PendingContentReviews int64 `json:"pending_content_reviews" example:"3"`
}

type analyticsOverviewResponse struct {
	NewUsers            int64  `json:"new_users"`
	NewUsersDelta       string `json:"new_users_delta"`
	NewUsersPositive    bool   `json:"new_users_positive"`
	Revenue             int64  `json:"revenue"`
	RevenueDelta        string `json:"revenue_delta"`
	RevenuePositive     bool   `json:"revenue_positive"`
	ActiveSubscriptions int64  `json:"active_subscriptions"`
	ActiveSubDelta      string `json:"active_subscriptions_delta"`
	ActiveSubPositive   bool   `json:"active_subscriptions_positive"`
	TestsAttempted      int64  `json:"tests_attempted"`
	TestsAttemptedDelta string `json:"tests_attempted_delta"`
	TestsAttemptedPos   bool   `json:"tests_attempted_positive"`
	RevenueBars         []int  `json:"revenue_bars"`
	StudentBars         []int  `json:"student_bars"`
	TeacherBars         []int  `json:"teacher_bars"`
	PublishedTests      int64  `json:"published_tests"`
	PublishedContent    int64  `json:"published_content"`
	PublishedBrainHacks int64  `json:"published_brain_hacks"`
	PendingReviews      int64  `json:"pending_reviews"`
}

type adminUserSubscriptionResponse struct {
	Subscription *models.Subscription `json:"subscription"`
}

type adminUserSessionsResponse struct {
	Sessions    []models.Session `json:"sessions"`
	ActiveCount int              `json:"active_count"`
}
