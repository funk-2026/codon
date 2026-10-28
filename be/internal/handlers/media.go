package handlers

import (
	"net/http"
	"time"

	"codon-backend/internal/media"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/pagination"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MediaHandler struct {
	DB  *gorm.DB
	Svc *media.Service
}

func NewMediaHandler(db *gorm.DB) *MediaHandler {
	return &MediaHandler{DB: db, Svc: media.NewService(db)}
}

// Presign godoc
//
//	@Summary		Presign an image upload
//	@Description	Creates a pending media asset and returns a presigned PUT URL that only accepts exactly `bytes` bytes of the declared type. After uploading, call `POST /media/{id}/complete`. Allowed purposes and roles are enforced server-side; limits (size, mime, quota, rate) come from platform settings. `import_bundle` returns just a `file_key` for a zip (no media row).
//	@Tags			Media
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		media.PresignRequest	true	"Upload details"
//	@Success		200		{object}	media.PresignResult
//	@Failure		400		{object}	errorResponse
//	@Failure		403		{object}	errorResponse
//	@Failure		429		{object}	errorResponse
//	@Router			/api/v1/media/presign [post]
func (h *MediaHandler) Presign(c *gin.Context) {
	var req media.PresignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	res, err := h.Svc.Presign(c.Request.Context(), middleware.GetUser(c), req)
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, res)
}

// Complete godoc
//
//	@Summary		Finish an image upload
//	@Description	Verifies the uploaded object (real size, magic-byte sniffing — the declared content type is not trusted — dimensions, decompression-bomb guard), strips EXIF/GPS by re-encoding, generates the display (≤1600px) and thumbnail (≤400px) variants and returns the ready asset. A byte-identical re-upload by the same owner returns the existing asset. Rejections carry a `code`: too_large, too_large_dimensions, unsupported_type, corrupt_image.
//	@Tags			Media
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Media UUID"
//	@Success		200	{object}	map[string]interface{}
//	@Failure		409	{object}	errorResponse
//	@Failure		422	{object}	errorResponse
//	@Router			/api/v1/media/{id}/complete [post]
func (h *MediaHandler) Complete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid media id")
		return
	}
	a, err := h.Svc.Complete(c.Request.Context(), middleware.GetUser(c), id)
	if err != nil {
		respondService(c, err)
		return
	}
	views := h.Svc.Resolve(c.Request.Context(), []uuid.UUID{a.ID}, media.URLTTL(nil))
	c.JSON(http.StatusOK, gin.H{"media": a, "view": views[a.ID.String()]})
}

// Get godoc
//
//	@Summary		Get one media asset with signed URLs (author preview)
//	@Tags			Media
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Media UUID"
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/media/{id} [get]
func (h *MediaHandler) Get(c *gin.Context) {
	user := middleware.GetUser(c)
	var a models.MediaAsset
	if err := h.DB.WithContext(c.Request.Context()).First(&a, "id = ?", c.Param("id")).Error; err != nil ||
		(a.OwnerID != user.ID && user.Role != models.RoleAdmin && !user.CanManageAllContent) {
		respondErr(c, http.StatusNotFound, "media_not_found", "media not found")
		return
	}
	views := h.Svc.Resolve(c.Request.Context(), []uuid.UUID{a.ID}, media.URLTTL(nil))
	c.JSON(http.StatusOK, gin.H{"media": a, "view": views[a.ID.String()]})
}

// List godoc
//
//	@Summary		My media library (Teacher)
//	@Description	Cursor-paginated list of my uploads. `unreferenced=true` shows assets not used by any content (safe to delete).
//	@Tags			Media
//	@Security		BearerAuth
//	@Produce		json
//	@Param			limit			query		int		false	"Page size"
//	@Param			cursor			query		string	false	"Cursor"
//	@Param			unreferenced	query		bool	false	"Only unreferenced assets"
//	@Success		200				{object}	map[string]interface{}
//	@Router			/api/v1/teacher/media [get]
func (h *MediaHandler) List(c *gin.Context) {
	user := middleware.GetUser(c)
	limit := pagination.Limit(c.Query("limit"))
	q := h.DB.WithContext(c.Request.Context()).Model(&models.MediaAsset{}).
		Where("owner_id = ? AND status = ?", user.ID, models.MediaReady)
	if c.Query("unreferenced") == "true" {
		q = q.Where("NOT EXISTS (SELECT 1 FROM media_refs r WHERE r.media_id = media_assets.id)")
	}
	q = pagination.Apply(q, "media_assets", pagination.Decode(c.Query("cursor")), limit)
	var rows []models.MediaAsset
	q.Find(&rows)
	rows, next := pagination.Page(rows, limit, func(a models.MediaAsset) (time.Time, uuid.UUID) { return a.CreatedAt, a.ID })
	ids := make([]uuid.UUID, len(rows))
	for i, r := range rows {
		ids[i] = r.ID
	}
	c.JSON(http.StatusOK, gin.H{"items": rows, "next_cursor": nilIfEmpty(next), "media": h.Svc.Resolve(c.Request.Context(), ids, media.URLTTL(nil))})
}

type updateMediaRequest struct {
	Alt string `json:"alt"`
}

// Update godoc
//
//	@Summary		Update a media asset's default alt text
//	@Tags			Media
//	@Security		BearerAuth
//	@Accept			json
//	@Param			id		path	string				true	"Media UUID"
//	@Param			body	body	updateMediaRequest	true	"Alt text"
//	@Success		200		{object}	models.MediaAsset
//	@Router			/api/v1/teacher/media/{id} [patch]
func (h *MediaHandler) Update(c *gin.Context) {
	user := middleware.GetUser(c)
	var req updateMediaRequest
	if err := c.ShouldBindJSON(&req); err != nil || len([]rune(req.Alt)) > 300 {
		respondErr(c, http.StatusBadRequest, "bad_request", "alt must be at most 300 characters")
		return
	}
	var a models.MediaAsset
	if err := h.DB.First(&a, "id = ? AND owner_id = ?", c.Param("id"), user.ID).Error; err != nil {
		respondErr(c, http.StatusNotFound, "media_not_found", "media not found")
		return
	}
	h.DB.Model(&a).Update("alt_text", req.Alt)
	c.JSON(http.StatusOK, a)
}

// Delete godoc
//
//	@Summary		Delete an unused media asset
//	@Description	409 `media_in_use` if any content still references it.
//	@Tags			Media
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Media UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/teacher/media/{id} [delete]
func (h *MediaHandler) Delete(c *gin.Context) {
	user := middleware.GetUser(c)
	var a models.MediaAsset
	if err := h.DB.First(&a, "id = ? AND owner_id = ?", c.Param("id"), user.ID).Error; err != nil {
		respondErr(c, http.StatusNotFound, "media_not_found", "media not found")
		return
	}
	var refs int64
	h.DB.Model(&models.MediaRef{}).Where("media_id = ?", a.ID).Count(&refs)
	if refs > 0 {
		respondErr(c, http.StatusConflict, "media_in_use", "this image is used by content and can't be deleted")
		return
	}
	h.Svc.DeleteAsset(c.Request.Context(), &a)
	c.JSON(http.StatusOK, messageResponse{Message: "media deleted"})
}
