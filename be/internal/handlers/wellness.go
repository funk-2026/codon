package handlers

import (
	"net/http"

	"codon-backend/internal/middleware"
	"codon-backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type WellnessHandler struct{ DB *gorm.DB }

func NewWellnessHandler(db *gorm.DB) *WellnessHandler { return &WellnessHandler{DB: db} }

// ListWellnessContent godoc
//
//	@Summary		List wellness content
//	@Description	Returns active wellness content of category guidance or motivation. Filter by category using the query param.
//	@Tags			Wellness
//	@Security		BearerAuth
//	@Produce		json
//	@Param			category	query		string	false	"Filter by category: guidance | motivation"
//	@Success		200			{object}	listWellnessResponse
//	@Failure		401			{object}	errorResponse
//	@Router			/wellness/content [get]
func (h *WellnessHandler) ListWellnessContent(c *gin.Context) {
	category := c.Query("category")

	query := h.DB.WithContext(c.Request.Context()).
		Where("is_active = ? AND category IN ?", true, []string{
			string(models.WellnessGuidance),
			string(models.WellnessMotivation),
		})
	if category != "" {
		query = h.DB.WithContext(c.Request.Context()).
			Where("is_active = ? AND category = ?", true, category)
	}

	var items []models.WellnessContent
	query.Order("created_at DESC").Find(&items)
	c.JSON(http.StatusOK, listWellnessResponse{Content: items})
}

// ListReflectionPrompts godoc
//
//	@Summary		List reflection prompts
//	@Description	Returns active reflection_prompt wellness content. These are read-only in v1 — no student response is captured.
//	@Tags			Wellness
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	listPromptsResponse
//	@Failure		401	{object}	errorResponse
//	@Router			/wellness/reflection-prompts [get]
func (h *WellnessHandler) ListReflectionPrompts(c *gin.Context) {
	var items []models.WellnessContent
	h.DB.WithContext(c.Request.Context()).
		Where("is_active = ? AND category = ?", true, models.WellnessReflectionPrompt).
		Order("created_at DESC").
		Find(&items)
	c.JSON(http.StatusOK, listPromptsResponse{Prompts: items})
}

// CreateWellnessContent godoc
//
//	@Summary		Create wellness content (Admin)
//	@Description	Creates a new wellness content item. Category must be guidance, motivation, or reflection_prompt.
//	@Tags			Wellness
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		createWellnessRequest	true	"Wellness content"
//	@Success		201		{object}	models.WellnessContent
//	@Failure		400		{object}	errorResponse
//	@Failure		401		{object}	errorResponse
//	@Failure		403		{object}	errorResponse
//	@Router			/admin/wellness-content [post]
func (h *WellnessHandler) CreateWellnessContent(c *gin.Context) {
	admin := middleware.GetUser(c)

	var req createWellnessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	cat := models.WellnessCategory(req.Category)
	if cat != models.WellnessGuidance && cat != models.WellnessMotivation && cat != models.WellnessReflectionPrompt {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "category must be guidance, motivation, or reflection_prompt"})
		return
	}

	item := models.WellnessContent{
		Title: req.Title, Category: cat, BodyText: req.BodyText,
		MediaURL: req.MediaURL, IsActive: true, CreatedBy: admin.ID,
	}
	if err := h.DB.WithContext(c.Request.Context()).Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to create wellness content"})
		return
	}
	c.JSON(http.StatusCreated, item)
}

// UpdateWellnessContent godoc
//
//	@Summary		Update wellness content (Admin)
//	@Description	Partially updates a wellness content item. Use is_active=false to hide it from students.
//	@Tags			Wellness
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string					true	"Wellness content UUID"
//	@Param			body	body		updateWellnessRequest	true	"Fields to update"
//	@Success		200		{object}	models.WellnessContent
//	@Failure		404		{object}	errorResponse
//	@Router			/admin/wellness-content/{id} [patch]
func (h *WellnessHandler) UpdateWellnessContent(c *gin.Context) {
	id := c.Param("id")
	var item models.WellnessContent
	if err := h.DB.Where("id = ?", id).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "not found"})
		return
	}

	var req updateWellnessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.BodyText != nil {
		updates["body_text"] = *req.BodyText
	}
	if req.MediaURL != nil {
		updates["media_url"] = *req.MediaURL
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	h.DB.Model(&item).Updates(updates)
	h.DB.First(&item, item.ID)
	c.JSON(http.StatusOK, item)
}

// DeleteWellnessContent godoc
//
//	@Summary		Delete wellness content (Admin)
//	@Description	Soft-deletes (deactivates) a wellness content item by setting is_active=false.
//	@Tags			Wellness
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Wellness content UUID"
//	@Success		200	{object}	messageResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/admin/wellness-content/{id} [delete]
func (h *WellnessHandler) DeleteWellnessContent(c *gin.Context) {
	id := c.Param("id")
	var item models.WellnessContent
	if err := h.DB.Where("id = ?", id).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "not found"})
		return
	}
	h.DB.Model(&item).Update("is_active", false)
	c.JSON(http.StatusOK, messageResponse{Message: "deleted"})
}

// ── Request / Response types ──────────────────────────────────────────────────

type listWellnessResponse struct {
	Content []models.WellnessContent `json:"content"`
}

type listPromptsResponse struct {
	Prompts []models.WellnessContent `json:"prompts"`
}

type createWellnessRequest struct {
	Title    string  `json:"title"    example:"5 Tips to Stay Calm Before Exams"`
	Category string  `json:"category" example:"guidance" enums:"guidance,motivation,reflection_prompt"`
	BodyText string  `json:"body_text" example:"Take deep breaths and review your preparation..."`
	MediaURL *string `json:"media_url" example:"https://cdn.codon.app/wellness/calm.mp3"`
}

type updateWellnessRequest struct {
	Title    *string `json:"title"`
	BodyText *string `json:"body_text"`
	MediaURL *string `json:"media_url"`
	IsActive *bool   `json:"is_active"`
}
