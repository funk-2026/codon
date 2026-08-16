package handlers

import (
	"net/http"

	"codon-backend/internal/middleware"
	"codon-backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

type CourseHandler struct{ DB *gorm.DB }

func NewCourseHandler(db *gorm.DB) *CourseHandler { return &CourseHandler{DB: db} }

// ListCourses godoc
//
//	@Summary		List all courses
//	@Description	Returns the fixed set of 3 active courses: NEET UG, 9th Standard, 10th Standard.
//	@Tags			Courses
//	@Produce		json
//	@Success		200	{object}	listCoursesResponse
//	@Router			/api/v1/courses [get]
func (h *CourseHandler) ListCourses(c *gin.Context) {
	var courses []models.Course
	h.DB.WithContext(c.Request.Context()).Where("is_active = ?", true).Find(&courses)
	c.JSON(http.StatusOK, listCoursesResponse{Courses: courses})
}

// GetCourse godoc
//
//	@Summary		Get a course by ID
//	@Description	Returns a single active course by its UUID.
//	@Tags			Courses
//	@Produce		json
//	@Param			id	path		string	true	"Course UUID"
//	@Success		200	{object}	models.Course
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/courses/{id} [get]
func (h *CourseHandler) GetCourse(c *gin.Context) {
	id := c.Param("id")
	var course models.Course
	if err := h.DB.WithContext(c.Request.Context()).Where("id = ? AND is_active = ?", id, true).First(&course).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "course not found"})
		return
	}
	c.JSON(http.StatusOK, course)
}

// ─── Subscription Plans ───────────────────────────────────────────────────────

type PlanHandler struct{ DB *gorm.DB }

func NewPlanHandler(db *gorm.DB) *PlanHandler { return &PlanHandler{DB: db} }

// ListPlans godoc
//
//	@Summary		List active subscription plans
//	@Description	Returns all active subscription plans. Plans are admin-managed (name, price, duration).
//	@Tags			Subscription Plans
//	@Produce		json
//	@Success		200	{object}	listPlansResponse
//	@Router			/api/v1/subscription-plans [get]
func (h *PlanHandler) ListPlans(c *gin.Context) {
	var plans []models.SubscriptionPlan
	h.DB.WithContext(c.Request.Context()).
		Where("is_active = ?", true).
		Preload("Course").
		Order("price_paise ASC").
		Find(&plans)
	c.JSON(http.StatusOK, listPlansResponse{Plans: plans})
}

// AdminListPlans godoc
//
//	@Summary		List all subscription plans (Admin)
//	@Description	Returns all subscription plans, including inactive ones.
//	@Tags			Subscription Plans
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	listPlansResponse
//	@Router			/api/v1/admin/subscription-plans [get]
func (h *PlanHandler) AdminListPlans(c *gin.Context) {
	var plans []models.SubscriptionPlan
	h.DB.WithContext(c.Request.Context()).
		Preload("Course").
		Order("price_paise ASC").
		Find(&plans)
	c.JSON(http.StatusOK, listPlansResponse{Plans: plans})
}

// CreatePlan godoc
//
//	@Summary		Create a subscription plan (Admin)
//	@Description	Creates a new subscription plan. Only admins can call this.
//	@Tags			Subscription Plans
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		createPlanRequest	true	"Plan details"
//	@Success		201		{object}	models.SubscriptionPlan
//	@Failure		400		{object}	errorResponse
//	@Failure		401		{object}	errorResponse
//	@Failure		403		{object}	errorResponse
//	@Router			/api/v1/admin/subscription-plans [post]
func (h *PlanHandler) CreatePlan(c *gin.Context) {
	admin := middleware.GetUser(c)

	var req createPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid course_id"})
		return
	}
	currency := req.Currency
	if currency == "" {
		currency = "INR"
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	plan := models.SubscriptionPlan{
		Name:         req.Name,
		CourseID:     courseID,
		DurationDays: req.DurationDays,
		PricePaise:   req.PricePaise,
		Currency:     currency,
		Benefits:     pq.StringArray(req.Benefits),
		IsActive:     isActive,
		CreatedBy:    admin.ID,
	}
	if err := h.DB.WithContext(c.Request.Context()).Create(&plan).Error; err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to create plan"})
		return
	}
	c.JSON(http.StatusCreated, plan)
}

// UpdatePlan godoc
//
//	@Summary		Update a subscription plan (Admin)
//	@Description	Partially updates an existing subscription plan. Supports toggling is_active for soft-deactivation.
//	@Tags			Subscription Plans
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string				true	"Plan UUID"
//	@Param			body	body		updatePlanRequest	true	"Fields to update"
//	@Success		200		{object}	models.SubscriptionPlan
//	@Failure		400		{object}	errorResponse
//	@Failure		404		{object}	errorResponse
//	@Router			/api/v1/admin/subscription-plans/{id} [patch]
func (h *PlanHandler) UpdatePlan(c *gin.Context) {
	id := c.Param("id")
	var plan models.SubscriptionPlan
	if err := h.DB.WithContext(c.Request.Context()).Where("id = ?", id).First(&plan).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "plan not found"})
		return
	}

	var req updatePlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.DurationDays != nil {
		updates["duration_days"] = *req.DurationDays
	}
	if req.PricePaise != nil {
		updates["price_paise"] = *req.PricePaise
	}
	if req.Currency != nil {
		updates["currency"] = *req.Currency
	}
	if req.Benefits != nil {
		updates["benefits"] = pq.StringArray(req.Benefits)
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	h.DB.WithContext(c.Request.Context()).Model(&plan).Updates(updates)
	h.DB.WithContext(c.Request.Context()).First(&plan, plan.ID)
	c.JSON(http.StatusOK, plan)
}

// DeletePlan godoc
//
//	@Summary		Deactivate a subscription plan (Admin)
//	@Description	Soft-deletes a plan by setting is_active=false. Existing subscriptions are not affected.
//	@Tags			Subscription Plans
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Plan UUID"
//	@Success		200	{object}	messageResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/admin/subscription-plans/{id} [delete]
func (h *PlanHandler) DeletePlan(c *gin.Context) {
	id := c.Param("id")
	var plan models.SubscriptionPlan
	if err := h.DB.WithContext(c.Request.Context()).Where("id = ?", id).First(&plan).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "plan not found"})
		return
	}
	h.DB.WithContext(c.Request.Context()).Model(&plan).Update("is_active", false)
	c.JSON(http.StatusOK, messageResponse{Message: "plan deactivated"})
}

// ── Request / Response types ──────────────────────────────────────────────────

type listCoursesResponse struct {
	Courses []models.Course `json:"courses"`
}

type listPlansResponse struct {
	Plans []models.SubscriptionPlan `json:"plans"`
}

type createPlanRequest struct {
	Name         string   `json:"name"          example:"3 Months NEET UG"`
	CourseID     string   `json:"course_id"     example:"550e8400-e29b-41d4-a716-446655440000"`
	DurationDays int      `json:"duration_days" example:"90"`
	PricePaise   int64    `json:"price_paise"   example:"299900"`
	Currency     string   `json:"currency"      example:"INR"`
	Benefits     []string `json:"benefits"      example:"Unlimited Q Bank,Full Test Series,Video Classes"`
	IsActive     *bool    `json:"is_active"     example:"true"`
}

type updatePlanRequest struct {
	Name         *string  `json:"name"`
	DurationDays *int     `json:"duration_days"`
	PricePaise   *int64   `json:"price_paise"`
	Currency     *string  `json:"currency"`
	Benefits     []string `json:"benefits"`
	IsActive     *bool    `json:"is_active"`
}
