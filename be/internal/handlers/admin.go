package handlers

import (
	"net/http"

	"codon-backend/internal/middleware"
	"codon-backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AdminHandler struct{ DB *gorm.DB }

func NewAdminHandler(db *gorm.DB) *AdminHandler { return &AdminHandler{DB: db} }

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
		TotalUsers:             userCount,
		ActiveSubscriptions:    activeSubCount,
		PendingKYC:             pendingKYCCount,
		PendingTestReviews:     pendingTestCount,
		PendingContentReviews:  pendingContentCount,
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
