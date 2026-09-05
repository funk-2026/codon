package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"codon-backend/internal/jobs"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/services"
	"codon-backend/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ContentHandler struct {
	DB     *gorm.DB
	SubSvc *services.SubscriptionService
}

func NewContentHandler(db *gorm.DB, subSvc *services.SubscriptionService) *ContentHandler {
	return &ContentHandler{DB: db, SubSvc: subSvc}
}

// kycRequired reports whether the platform currently requires approved KYC
// before a student can access subscription-gated content.
func kycRequired(db *gorm.DB) bool {
	var setting models.PlatformSetting
	if db.Where("key = ?", "kyc_required").First(&setting).Error == nil {
		return setting.Value == "true"
	}
	return false
}

// CreateContent godoc
//
//	@Summary		Upload content item (Teacher)
//	@Description	Creates a draft content item (video or document). For videos, a background transcoding job is automatically queued to convert the upload to HLS format. The file must be uploaded to S3 first via /uploads/presign.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		createContentRequest	true	"Content details"
//	@Success		201		{object}	models.ContentItem
//	@Failure		400		{object}	errorResponse
//	@Failure		401		{object}	errorResponse
//	@Router			/api/v1/teacher/content [post]
func (h *ContentHandler) CreateContent(c *gin.Context) {
	teacher := middleware.GetUser(c)

	var req createContentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid course_id"})
		return
	}

	chapterID, err := uuid.Parse(req.ChapterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid chapter_id"})
		return
	}

	ct := models.ContentType(req.ContentType)
	if ct != models.ContentVideo && ct != models.ContentDocument {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "content_type must be 'video' or 'document'"})
		return
	}

	requiresSub := true
	var course models.Course
	if h.DB.Where("id = ?", courseID).First(&course).Error == nil {
		if course.Slug != "neet-ug" {
			requiresSub = false
		}
	}
	if req.RequiresSubscription != nil {
		requiresSub = *req.RequiresSubscription
	}

	item := models.ContentItem{
		Title: req.Title, CourseID: courseID, ContentType: ct, ChapterID: chapterID,
		UploadedBy: teacher.ID, FileKey: req.FileKey,
		RequiresSubscription: requiresSub, Status: models.StatusDraft,
	}

	if ct == models.ContentVideo {
		vs := models.VideoQueued
		item.VideoStatus = &vs
	}

	if err := h.DB.WithContext(c.Request.Context()).Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to create content item"})
		return
	}

	if ct == models.ContentVideo {
		if strings.HasPrefix(item.FileKey, "stream:") {
			// Cloudflare Stream transcodes the upload itself — poll its API
			// for status instead of running our own ffmpeg job against it.
			uid := strings.TrimPrefix(item.FileKey, "stream:")
			jobs.EnqueueJob(h.DB, jobs.JobTypeStreamStatusCheck, jobs.StreamStatusCheckPayload{
				ContentItemID: item.ID, VideoUID: uid,
			})
		} else {
			jobs.EnqueueJob(h.DB, jobs.JobTypeTranscode, jobs.TranscodePayload{
				ContentItemID: item.ID, FileKey: item.FileKey,
			})
		}
	}

	c.JSON(http.StatusCreated, item)
}

// UpdateContent godoc
//
//	@Summary		Update a content item (Teacher)
//	@Description	Partially updates a content item's metadata.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string					true	"Content item UUID"
//	@Param			body	body		updateContentRequest	true	"Fields to update"
//	@Success		200		{object}	models.ContentItem
//	@Failure		400		{object}	errorResponse
//	@Failure		404		{object}	errorResponse
//	@Router			/api/v1/teacher/content/{id} [patch]
func (h *ContentHandler) UpdateContent(c *gin.Context) {
	teacher := middleware.GetUser(c)
	id := c.Param("id")

	var item models.ContentItem
	query := h.DB.Where("id = ?", id)
	if !teacher.CanManageAllContent {
		query = query.Where("uploaded_by = ?", teacher.ID)
	}
	if err := query.First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "content item not found"})
		return
	}

	var req updateContentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.ChapterID != nil {
		if u, err := uuid.Parse(*req.ChapterID); err == nil {
			updates["chapter_id"] = u
		}
	}
	fileKeyChanged := req.FileKey != nil && *req.FileKey != item.FileKey
	if fileKeyChanged {
		updates["file_key"] = *req.FileKey
	}
	if req.RequiresSubscription != nil {
		updates["requires_subscription"] = *req.RequiresSubscription
	}

	// Replacing a video's file makes the old video_status/hls_playlist_url
	// stale (they describe the previous file) — reset them and re-trigger
	// transcoding/status-checking against the new file, same as CreateContent.
	if fileKeyChanged && item.ContentType == models.ContentVideo {
		vs := models.VideoQueued
		updates["video_status"] = vs
		updates["hls_playlist_url"] = nil
	}

	h.DB.WithContext(c.Request.Context()).Model(&item).Updates(updates)
	h.DB.WithContext(c.Request.Context()).First(&item, item.ID)

	if fileKeyChanged && item.ContentType == models.ContentVideo {
		if strings.HasPrefix(item.FileKey, "stream:") {
			uid := strings.TrimPrefix(item.FileKey, "stream:")
			jobs.EnqueueJob(h.DB, jobs.JobTypeStreamStatusCheck, jobs.StreamStatusCheckPayload{
				ContentItemID: item.ID, VideoUID: uid,
			})
		} else {
			jobs.EnqueueJob(h.DB, jobs.JobTypeTranscode, jobs.TranscodePayload{
				ContentItemID: item.ID, FileKey: item.FileKey,
			})
		}
	}

	c.JSON(http.StatusOK, item)
}

// SubmitContentForReview godoc
//
//	@Summary		Submit content for admin review (Teacher)
//	@Description	Transitions a draft or rejected content item to pending_review status.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Content item UUID"
//	@Success		200	{object}	messageResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/teacher/content/{id}/submit-for-review [post]
func (h *ContentHandler) SubmitContentForReview(c *gin.Context) {
	teacher := middleware.GetUser(c)
	id := c.Param("id")

	var item models.ContentItem
	query := h.DB.Where("id = ? AND status IN ?", id, []string{string(models.StatusDraft), string(models.StatusRejected)})
	if !teacher.CanManageAllContent {
		query = query.Where("uploaded_by = ?", teacher.ID)
	}
	if err := query.First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "content item not found or not in draft/rejected"})
		return
	}

	h.DB.Model(&item).Update("status", models.StatusPendingReview)
	c.JSON(http.StatusOK, messageResponse{Message: "submitted for review"})
}

// PublishContent godoc
//
//	@Summary		Publish an approved content item (Teacher)
//	@Description	Transitions an approved content item to published, making it visible to students.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Content item UUID"
//	@Success		200	{object}	messageResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/teacher/content/{id}/publish [post]
func (h *ContentHandler) PublishContent(c *gin.Context) {
	teacher := middleware.GetUser(c)
	id := c.Param("id")

	var item models.ContentItem
	query := h.DB.Where("id = ? AND status = ?", id, models.StatusApproved)
	if !teacher.CanManageAllContent {
		query = query.Where("uploaded_by = ?", teacher.ID)
	}
	if err := query.First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "content item not found or not approved"})
		return
	}

	if item.ContentType == models.ContentVideo && (item.VideoStatus == nil || *item.VideoStatus != models.VideoReady) {
		c.JSON(http.StatusConflict, errorResponse{Error: "video is still processing — try again once it's ready"})
		return
	}

	h.DB.Model(&item).Update("status", models.StatusPublished)
	c.JSON(http.StatusOK, messageResponse{Message: "content published"})
}

// TeacherGetContent godoc
//
//	@Summary		Get a content item (Teacher)
//	@Description	Returns full content item details. A teacher can view their own content (or all content if they have platform-wide permission).
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Content item UUID"
//	@Success		200	{object}	adminContentDetailResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/teacher/content/{id} [get]
func (h *ContentHandler) TeacherGetContent(c *gin.Context) {
	teacher := middleware.GetUser(c)
	id := c.Param("id")

	var item models.ContentItem
	query := h.DB.WithContext(c.Request.Context()).
		Preload("Course").Preload("Chapter").Preload("Uploader").
		Where("id = ?", id)

	if !teacher.CanManageAllContent {
		query = query.Where("uploaded_by = ?", teacher.ID)
	}

	if err := query.First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "content not found"})
		return
	}

	c.JSON(http.StatusOK, adminContentDetailResponse{Content: item, URL: resolveContentURL(c.Request.Context(), &item)})
}

func resolveContentURL(ctx context.Context, item *models.ContentItem) string {
	if item.ContentType == models.ContentVideo {
		// 1. Cloudflare Stream video: the real HLS manifest URL is filled in
		// by the stream_status_check job once Cloudflare finishes
		// transcoding — an iframe embed URL wouldn't work for a native
		// video player, so return nothing (still processing) until then.
		if strings.HasPrefix(item.FileKey, "stream:") {
			if item.HLSPlaylistURL != nil && *item.HLSPlaylistURL != "" {
				return *item.HLSPlaylistURL
			}
			return ""
		}
		// 2. Direct HLS playlist URL if stored explicitly
		if item.HLSPlaylistURL != nil && *item.HLSPlaylistURL != "" {
			return *item.HLSPlaylistURL
		}
		// 3. R2 Presigned GET URL if stored as raw MP4 file in Cloudflare R2
		if storage.Client != nil && item.FileKey != "" {
			url, err := storage.Client.PresignGet(ctx, item.FileKey, 2*time.Hour)
			if err == nil && url != "" {
				return url
			}
		}
		// Fallback sample MP4 for testing when credentials are unconfigured
		return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
	} else if item.ContentType == models.ContentDocument {
		if storage.Client != nil && item.FileKey != "" {
			url, err := storage.Client.PresignGet(ctx, item.FileKey, 2*time.Hour)
			if err == nil && url != "" {
				return url
			}
		}
		return "https://s3.amazonaws.com/codon-files/" + item.FileKey
	}
	return ""
}

// ListTeacherContent godoc
//
//	@Summary		List teacher's content items
//	@Description	Returns all content items uploaded by the authenticated teacher. Teachers with can_manage_all_content=true see all content platform-wide.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	listContentResponse
//	@Failure		401	{object}	errorResponse
//	@Router			/api/v1/teacher/content [get]
func (h *ContentHandler) ListTeacherContent(c *gin.Context) {
	teacher := middleware.GetUser(c)

	var items []models.ContentItem
	query := h.DB.WithContext(c.Request.Context())
	if !teacher.CanManageAllContent {
		query = query.Where("uploaded_by = ?", teacher.ID)
	}
	query.Preload("Course").Order("created_at DESC").Find(&items)
	c.JSON(http.StatusOK, listContentResponse{Content: items})
}

// ─── Student Content Access ───────────────────────────────────────────────────

// GetChapterContent godoc
//
//	@Summary		List published content items for a chapter (Student)
//	@Description	Returns all published content items (videos, documents) for a specific chapter. Items the student hasn't unlocked (subscription/KYC required) are still listed but with file_key and hls_playlist_url stripped.
//	@Tags			Content
//	@Security		BearerAuth
//	@Produce		json
//	@Param			chapter_id	path		string	true	"Chapter UUID"
//	@Success		200	{object}	listContentResponse
//	@Failure		401	{object}	errorResponse
//	@Router			/api/v1/chapters/{chapter_id}/content [get]
func (h *ContentHandler) GetChapterContent(c *gin.Context) {
	user := middleware.GetUser(c)
	chapterID := c.Param("chapter_id")
	var items []models.ContentItem
	h.DB.WithContext(c.Request.Context()).
		Where("chapter_id = ? AND status = ?", chapterID, models.StatusPublished).
		Order("created_at ASC").
		Find(&items)

	kycReq := kycRequired(h.DB)
	for i := range items {
		if h.SubSvc.CheckAccess(c.Request.Context(), user, items[i].RequiresSubscription, items[i].CourseID, kycReq) != nil {
			items[i].FileKey = ""
			items[i].HLSPlaylistURL = nil
		}
	}

	c.JSON(http.StatusOK, listContentResponse{Content: items})
}

// GetContentItem godoc
//
//	@Summary		Get a single published content item (Student)
//	@Description	Returns the details of a published content item plus a playable URL. Requires an active subscription (and approved KYC, if the platform requires it) when the item has requires_subscription set.
//	@Tags			Content
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Content item UUID"
//	@Success		200	{object}	getContentResponse
//	@Failure		403	{object}	errorResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/content/{id} [get]
func (h *ContentHandler) GetContentItem(c *gin.Context) {
	user := middleware.GetUser(c)
	id := c.Param("id")
	var item models.ContentItem
	if err := h.DB.WithContext(c.Request.Context()).
		Where("id = ? AND status = ?", id, models.StatusPublished).
		First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "content not found"})
		return
	}

	if err := h.SubSvc.CheckAccess(c.Request.Context(), user, item.RequiresSubscription, item.CourseID, kycRequired(h.DB)); err != nil {
		c.JSON(http.StatusForbidden, errorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, getContentResponse{Content: item, URL: resolveContentURL(c.Request.Context(), &item)})
}

// AdminGetContent godoc
//
//	@Summary		Get a content item (Admin)
//	@Description	Returns full content item details regardless of status, including the file URL for review.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Content item UUID"
//	@Success		200	{object}	adminContentDetailResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/admin/content/{id} [get]
func (h *ContentHandler) AdminGetContent(c *gin.Context) {
	id := c.Param("id")
	var item models.ContentItem
	if err := h.DB.WithContext(c.Request.Context()).
		Preload("Course").Preload("Chapter").Preload("Uploader").
		Where("id = ?", id).
		First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "content not found"})
		return
	}

	c.JSON(http.StatusOK, adminContentDetailResponse{Content: item, URL: resolveContentURL(c.Request.Context(), &item)})
}

// ─── Admin Content Moderation ─────────────────────────────────────────────────

// AdminListContent godoc
//
//	@Summary		List content items by status (Admin)
//	@Description	Returns content items filterable by status. Defaults to pending_review.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			status		query		string	false	"Filter by status"	default(pending_review)
//	@Param			course_id	query		string	false	"Filter by course ID"
//	@Param			chapter_id	query		string	false	"Filter by chapter ID"
//	@Success		200			{object}	listContentResponse
//	@Failure		401			{object}	errorResponse
//	@Failure		403			{object}	errorResponse
//	@Router			/api/v1/admin/content [get]
func (h *ContentHandler) AdminListContent(c *gin.Context) {
	status := c.DefaultQuery("status", string(models.StatusPendingReview))
	courseID := c.Query("course_id")
	chapterID := c.Query("chapter_id")

	query := h.DB.WithContext(c.Request.Context()).Where("status = ?", status)
	
	if courseID != "" {
		query = query.Where("course_id = ?", courseID)
	}
	if chapterID != "" {
		query = query.Where("chapter_id = ?", chapterID)
	}

	var items []models.ContentItem
	query.Preload("Course").Preload("Chapter").Preload("Uploader").
		Order("created_at DESC").
		Find(&items)
	c.JSON(http.StatusOK, listContentResponse{Content: items})
}

// AdminApproveContent godoc
//
//	@Summary		Approve a content item (Admin)
//	@Description	Approves a pending_review content item. The teacher can then publish it.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Content item UUID"
//	@Success		200	{object}	messageResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/admin/content/{id}/approve [post]
func (h *ContentHandler) AdminApproveContent(c *gin.Context) {
	admin := middleware.GetUser(c)
	id := c.Param("id")

	var item models.ContentItem
	if err := h.DB.Where("id = ? AND status = ?", id, models.StatusPendingReview).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "content not found or not pending review"})
		return
	}

	now := time.Now()
	h.DB.Model(&item).Updates(map[string]interface{}{
		"status": models.StatusApproved, "reviewed_by": admin.ID, "reviewed_at": now,
	})
	c.JSON(http.StatusOK, messageResponse{Message: "content approved"})
}

// AdminRejectContent godoc
//
//	@Summary		Reject a content item (Admin)
//	@Description	Rejects a pending_review content item with a mandatory reason.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string					true	"Content item UUID"
//	@Param			body	body		rejectContentRequest	true	"Rejection reason"
//	@Success		200		{object}	messageResponse
//	@Failure		400		{object}	errorResponse
//	@Failure		404		{object}	errorResponse
//	@Router			/api/v1/admin/content/{id}/reject [post]
func (h *ContentHandler) AdminRejectContent(c *gin.Context) {
	admin := middleware.GetUser(c)
	id := c.Param("id")

	var req rejectContentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	var item models.ContentItem
	if err := h.DB.Where("id = ? AND status = ?", id, models.StatusPendingReview).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "content not found or not pending review"})
		return
	}

	now := time.Now()
	h.DB.Model(&item).Updates(map[string]interface{}{
		"status": models.StatusRejected, "reviewed_by": admin.ID,
		"reviewed_at": now, "rejection_reason": req.Reason,
	})
	c.JSON(http.StatusOK, messageResponse{Message: "content rejected"})
}

// ── Request / Response types ──────────────────────────────────────────────────

type listContentResponse struct {
	Content []models.ContentItem `json:"content"`
}

type createContentRequest struct {
	Title                string  `json:"title"        example:"Cell Biology — Lecture 1"`
	CourseID             string  `json:"course_id"    example:"550e8400-e29b-41d4-a716-446655440000"`
	ContentType          string  `json:"content_type" example:"video" enums:"video,document"`
	ChapterID            string  `json:"chapter_id"   example:"550e8400-e29b-41d4-a716-446655440002"`
	FileKey              string  `json:"file_key"     example:"video/user-uuid/file-uuid.mp4"`
	RequiresSubscription *bool   `json:"requires_subscription" example:"true"`
}

type updateContentRequest struct {
	Title                *string `json:"title"`
	ChapterID            *string `json:"chapter_id"`
	FileKey              *string `json:"file_key"`
	RequiresSubscription *bool   `json:"requires_subscription"`
}

type getContentResponse struct {
	Content models.ContentItem `json:"content"`
	URL     string             `json:"url,omitempty"`
}

type adminContentDetailResponse struct {
	Content models.ContentItem `json:"content"`
	URL     string             `json:"url,omitempty"`
}

