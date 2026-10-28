package handlers

import (
	"net/http"

	"codon-backend/internal/media"
	"github.com/google/uuid"

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
//	@Router			/api/v1/wellness/content [get]
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
	c.JSON(http.StatusOK, listWellnessResponse{Content: items, Media: h.mediaOf(c, items)})
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
//	@Router			/api/v1/wellness/reflection-prompts [get]
func (h *WellnessHandler) ListReflectionPrompts(c *gin.Context) {
	var items []models.WellnessContent
	h.DB.WithContext(c.Request.Context()).
		Where("is_active = ? AND category = ?", true, models.WellnessReflectionPrompt).
		Order("created_at DESC").
		Find(&items)
	c.JSON(http.StatusOK, listPromptsResponse{Prompts: items, Media: h.mediaOf(c, items)})
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
//	@Router			/api/v1/admin/wellness-content [post]
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

	format := models.ContentFormatPlain
	if req.ContentFormat == models.ContentFormatRichV1 {
		format = models.ContentFormatRichV1
	}
	item := models.WellnessContent{
		ID: uuid.New(), Title: req.Title, Category: cat, BodyText: req.BodyText, ContentFormat: format,
		MediaURL: req.MediaURL, IsActive: true, CreatedBy: admin.ID,
	}
	if req.MediaID != nil {
		mid, err := uuid.Parse(*req.MediaID)
		if err != nil {
			respondErr(c, http.StatusBadRequest, "invalid_id", "invalid media_id")
			return
		}
		item.MediaID = &mid
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := h.checkRich(c, tx, admin, &item); err != nil {
			return err
		}
		return tx.Create(&item).Error
	})
	if err != nil {
		respondService(c, err)
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
//	@Router			/api/v1/admin/wellness-content/{id} [patch]
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
		item.BodyText = *req.BodyText
	}
	if req.ContentFormat != nil && (*req.ContentFormat == models.ContentFormatPlain || *req.ContentFormat == models.ContentFormatRichV1) {
		updates["content_format"] = *req.ContentFormat
		item.ContentFormat = *req.ContentFormat
	}
	if req.MediaID != nil {
		if *req.MediaID == "" {
			updates["media_id"] = nil
			item.MediaID = nil
		} else if mid, err := uuid.Parse(*req.MediaID); err == nil {
			updates["media_id"] = mid
			item.MediaID = &mid
		}
	}
	if req.BodyText != nil || req.ContentFormat != nil || req.MediaID != nil {
		if err := h.checkRich(c, h.DB, middleware.GetUser(c), &item); err != nil {
			respondService(c, err)
			return
		}
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
//	@Router			/api/v1/admin/wellness-content/{id} [delete]
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
	Media   map[string]media.View    `json:"media"`
}

type listPromptsResponse struct {
	Prompts []models.WellnessContent `json:"prompts"`
	Media   map[string]media.View    `json:"media"`
}

type createWellnessRequest struct {
	ContentFormat string  `json:"content_format" enums:"plain,rich_v1"`
	MediaID       *string `json:"media_id"`
	Title         string  `json:"title"    example:"5 Tips to Stay Calm Before Exams"`
	Category      string  `json:"category" example:"guidance" enums:"guidance,motivation,reflection_prompt"`
	BodyText      string  `json:"body_text" example:"Take deep breaths and review your preparation..."`
	MediaURL      *string `json:"media_url" example:"https://cdn.codon.app/wellness/calm.mp3"`
}

type updateWellnessRequest struct {
	ContentFormat *string `json:"content_format"`
	MediaID       *string `json:"media_id"`
	Title         *string `json:"title"`
	BodyText      *string `json:"body_text"`
	MediaURL      *string `json:"media_url"`
	IsActive      *bool   `json:"is_active"`
}

// mediaOf resolves body images and cover images of wellness items in one query.
func (h *WellnessHandler) mediaOf(c *gin.Context, items []models.WellnessContent) map[string]media.View {
	mc := media.NewCollector()
	for i := range items {
		mc.Add(items[i].ContentFormat, &items[i].BodyText)
		mc.AddID(items[i].MediaID)
	}
	return media.NewService(h.DB).ResolveCollector(c.Request.Context(), mc, media.URLTTL(nil))
}

// checkRich validates a wellness item's rich body and cover image.
func (h *WellnessHandler) checkRich(c *gin.Context, tx *gorm.DB, actor *models.User, item *models.WellnessContent) error {
	ctx := c.Request.Context()
	if item.MediaID != nil {
		if err := media.CheckOwned(ctx, tx, actor, *item.MediaID, "wellness_image"); err != nil {
			return err
		}
	}
	return media.SaveRefs(ctx, tx, actor, "wellness", item.ID, item.ContentFormat,
		[]media.Field{{Name: "body_text", Text: item.BodyText, Kind: "explanation"}})
}

// GetWellnessContent godoc
//
//	@Summary		Get one wellness item (Student/Admin)
//	@Description	Returns an active wellness item with its resolved body/cover images.
//	@Tags			Wellness
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Wellness content UUID"
//	@Success		200	{object}	map[string]interface{}
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/wellness/content/{id} [get]
func (h *WellnessHandler) GetWellnessContent(c *gin.Context) {
	var item models.WellnessContent
	if err := h.DB.WithContext(c.Request.Context()).First(&item, "id = ? AND is_active = true", c.Param("id")).Error; err != nil {
		respondErr(c, http.StatusNotFound, "not_found", "wellness content not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"content": item, "media": h.mediaOf(c, []models.WellnessContent{item})})
}
