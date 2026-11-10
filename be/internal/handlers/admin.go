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

type AdminHandler struct {
	DB         *gorm.DB
	SessionSvc *services.SessionService
	SubSvc     *services.SubscriptionService
}

func NewAdminHandler(db *gorm.DB, sessionSvc *services.SessionService, sub *services.SubscriptionService) *AdminHandler {
	return &AdminHandler{DB: db, SessionSvc: sessionSvc, SubSvc: sub}
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
		like := "%" + httpx.EscapeLike(search) + "%"
		query = query.Where("phone_number LIKE ? OR name ILIKE ?", like, like)
	}

	users, next, err := paged(c, query, "users", func(u models.User) (time.Time, uuid.UUID) { return u.CreatedAt, u.ID })
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": users, "next_cursor": nilIfEmpty(next)})
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
		respondErr(c, http.StatusNotFound, "not_found", "user not found")
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
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	if err := models.ValidateUserRole(req.Role); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	result := h.DB.WithContext(c.Request.Context()).
		Model(&models.User{}).
		Where("id = ?", id).
		Update("role", req.Role)
	if result.RowsAffected == 0 {
		respondErr(c, http.StatusNotFound, "not_found", "user not found")
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
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	result := h.DB.WithContext(c.Request.Context()).
		Model(&models.User{}).
		Where("id = ? AND role = ?", id, models.RoleTeacher).
		Update("can_manage_all_content", req.CanManageAllContent)
	if result.RowsAffected == 0 {
		respondErr(c, http.StatusNotFound, "not_found", "teacher not found")
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
	userID, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	sub, err := h.SubSvc.ActiveAny(c.Request.Context(), userID)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, adminUserSubscriptionResponse{Subscription: sub})
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
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid user id")
		return
	}

	sessions, err := h.SessionSvc.ListActiveSessions(c.Request.Context(), userID)
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to list sessions")
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
	out, err := services.NewAdminStats(h.DB).Dashboard(c.Request.Context())
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, out)
}

// AnalyticsOverview godoc
//
//	@Summary		Analytics overview (Admin)
//	@Description	Headline numbers with period-over-period deltas and chart buckets for `range` = 7D | 30D | ALL. `active_subscriptions` counts ACTIVE subscriptions created in the window.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			range	query		string	false	"7D, 30D or ALL"	default(7D)
//	@Success		200		{object}	analyticsOverviewResponse
//	@Failure		400		{object}	errorResponse
//	@Router			/api/v1/admin/analytics [get]
func (h *AdminHandler) AnalyticsOverview(c *gin.Context) {
	out, err := services.NewAdminStats(h.DB).Overview(c.Request.Context(), c.DefaultQuery("range", "7D"), time.Now())
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, out)
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

type dashboardSummaryResponse = services.DashboardSummary

type analyticsOverviewResponse = services.AnalyticsOverview

type adminUserSubscriptionResponse struct {
	Subscription *models.Subscription `json:"subscription"`
}

type adminUserSessionsResponse struct {
	Sessions    []models.Session `json:"sessions"`
	ActiveCount int              `json:"active_count"`
}
