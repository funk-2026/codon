package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"codon-backend/internal/authz"
	"codon-backend/internal/bunny"
	"codon-backend/internal/httpx"
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
	Review *services.ReviewService
}

func NewContentHandler(db *gorm.DB, subSvc *services.SubscriptionService) *ContentHandler {
	return &ContentHandler{DB: db, SubSvc: subSvc, Review: services.NewReviewService(db)}
}

// textLessonKey marks a document lesson whose body lives in body_text rather than in file storage.
const textLessonKey = "text:inline"

func canManageAllContent(u *models.User) bool { return authz.ManagesAll(u) }

func (h *ContentHandler) CreateContent(c *gin.Context) {
	teacher := middleware.GetUser(c)

	var req createContentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid course_id")
		return
	}

	chapterID, err := uuid.Parse(req.ChapterID)
	if err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid chapter_id")
		return
	}

	ct := models.ContentType(req.ContentType)
	if ct != models.ContentVideo && ct != models.ContentDocument {
		respondErr(c, http.StatusBadRequest, "bad_request", "content_type must be 'video' or 'document'")
		return
	}

	course, _, _, terr := services.ResolveTaxonomy(c.Request.Context(), h.DB, courseID, nil, &chapterID)
	if terr != nil {
		respondService(c, terr)
		return
	}
	body := strings.TrimSpace(req.BodyText)
	if ct == models.ContentDocument && body != "" {
		if len([]rune(body)) > 60000 {
			respondErr(c, http.StatusBadRequest, "body_too_long", "a document lesson can be at most 60,000 characters")
			return
		}
		req.FileKey = textLessonKey
	}
	if req.FileKey == "" {
		respondErr(c, http.StatusBadRequest, "bad_request", "upload a file or write the lesson text")
		return
	}
	requiresSub := course.DefaultRequiresSubscription
	if req.RequiresSubscription != nil {
		requiresSub = *req.RequiresSubscription
	}

	item := models.ContentItem{
		Title: req.Title, CourseID: courseID, ContentType: ct, ChapterID: chapterID,
		UploadedBy: teacher.ID, FileKey: req.FileKey,
		RequiresSubscription: requiresSub, Status: models.StatusDraft,
	}
	if ct == models.ContentDocument && body != "" {
		item.BodyText = &body
	}
	for _, f := range []struct {
		key string
		dst **string
	}{{req.NotesPDFKey, &item.NotesPDFKey}, {req.AnnotatedPDFKey, &item.AnnotatedPDFKey}} {
		if f.key == "" {
			continue
		}
		if !validLecturePDFKey(teacher, f.key) {
			respondErr(c, http.StatusBadRequest, "invalid_pdf", "PDFs must be uploaded with purpose lecture_pdf by you")
			return
		}
		k := f.key
		*f.dst = &k
	}

	if ct == models.ContentVideo {
		vs := models.VideoQueued
		item.VideoStatus = &vs
	}

	if err := h.DB.WithContext(c.Request.Context()).Create(&item).Error; err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to create content item")
		return
	}
	if ct == models.ContentVideo {
		if guid := bunny.GUIDFromKey(item.FileKey); guid != "" {
			jobs.EnqueueJob(h.DB, jobs.JobTypeVideoStatusCheck, jobs.VideoStatusCheckPayload{
				ContentItemID: item.ID, VideoGUID: guid,
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
	if !canManageAllContent(teacher) {
		query = query.Where("uploaded_by = ?", teacher.ID)
	}
	if err := query.First(&item).Error; err != nil {
		respondErr(c, http.StatusNotFound, "not_found", "content item not found")
		return
	}

	var req updateContentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	updates := map[string]interface{}{}
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.ChapterID != nil {
		u, perr := uuid.Parse(*req.ChapterID)
		if perr != nil {
			respondErr(c, http.StatusBadRequest, "invalid_id", "invalid chapter_id")
			return
		}
		if _, _, _, terr := services.ResolveTaxonomy(c.Request.Context(), h.DB, item.CourseID, nil, &u); terr != nil {
			respondService(c, terr)
			return
		}
		updates["chapter_id"] = u
	}
	fileKeyChanged := req.FileKey != nil && *req.FileKey != item.FileKey
	if fileKeyChanged {
		updates["file_key"] = *req.FileKey
	}
	if req.RequiresSubscription != nil {
		updates["requires_subscription"] = *req.RequiresSubscription
	}
	if req.BodyText != nil {
		t := strings.TrimSpace(*req.BodyText)
		if item.Status != models.StatusDraft && item.Status != models.StatusRejected {
			respondErr(c, http.StatusConflict, "conflict", "the text of a lesson can only be edited while it is a draft or needs changes")
			return
		}
		if item.ContentType != models.ContentDocument || item.FileKey != textLessonKey {
			respondErr(c, http.StatusBadRequest, "not_a_text_lesson", "only lessons written in the app have editable text")
			return
		}
		if t == "" || len([]rune(t)) > 60000 {
			respondErr(c, http.StatusBadRequest, "invalid_body", "lesson text is required (max 60,000 characters)")
			return
		}
		updates["body_text"] = t
	}
	// Lecture PDFs can be added or replaced at any time (annotated notes often come after the class).
	for col, v := range map[string]*string{"notes_pdf_key": req.NotesPDFKey, "annotated_pdf_key": req.AnnotatedPDFKey} {
		switch {
		case v == nil:
		case *v == "":
			updates[col] = nil
		case !validLecturePDFKey(teacher, *v):
			respondErr(c, http.StatusBadRequest, "invalid_pdf", "PDFs must be uploaded with purpose lecture_pdf by you")
			return
		default:
			updates[col] = *v
		}
	}

	// Replacing a video's file makes the old video_status/hls_playlist_url
	// stale (they describe the previous file) — reset them and re-trigger
	// transcoding/status-checking against the new file, same as CreateContent.
	if fileKeyChanged && item.ContentType == models.ContentVideo {
		vs := models.VideoQueued
		updates["video_status"] = vs
		updates["hls_playlist_url"] = nil
	}

	if err := h.DB.WithContext(c.Request.Context()).Model(&item).Updates(updates).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	h.DB.WithContext(c.Request.Context()).First(&item, item.ID)

	if fileKeyChanged && item.ContentType == models.ContentVideo {
		if guid := bunny.GUIDFromKey(item.FileKey); guid != "" {
			jobs.EnqueueJob(h.DB, jobs.JobTypeVideoStatusCheck, jobs.VideoStatusCheckPayload{
				ContentItemID: item.ID, VideoGUID: guid,
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
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	if err := h.Review.SubmitWithNote(c.Request.Context(), middleware.GetUser(c), services.ReviewContent, id, nil, submitNote(c)); err != nil {
		respondService(c, err)
		return
	}
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
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	gate := func(ctx context.Context, id uuid.UUID) error {
		var item models.ContentItem
		if err := h.DB.WithContext(ctx).Select("id", "content_type", "video_status").First(&item, "id = ?", id).Error; err != nil {
			return err
		}
		if item.ContentType == models.ContentVideo && (item.VideoStatus == nil || *item.VideoStatus != models.VideoReady) {
			return services.Conflict("video_processing", "video is still processing — try again once it's ready")
		}
		return nil
	}
	if err := h.Review.Publish(c.Request.Context(), middleware.GetUser(c), services.ReviewContent, id, gate); err != nil {
		respondService(c, err)
		return
	}
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

	if !canManageAllContent(teacher) {
		query = query.Where("uploaded_by = ?", teacher.ID)
	}

	if err := query.First(&item).Error; err != nil {
		respondErr(c, http.StatusNotFound, "not_found", "content not found")
		return
	}

	c.JSON(http.StatusOK, adminContentDetailResponse{Content: item, URL: resolveContentURL(c.Request.Context(), &item), lecturePDFs: h.lecturePDFsFor(c.Request.Context(), &item, nil)})
}

func resolveContentURL(ctx context.Context, item *models.ContentItem) string {
	if item.ContentType == models.ContentVideo {
		// Bunny Stream video: the real HLS manifest URL is filled in
		// by the video_status_check job once Bunny finishes transcoding
		if strings.HasPrefix(item.FileKey, "bunny:") || strings.HasPrefix(item.FileKey, "stream:") {
			if item.HLSPlaylistURL != nil && *item.HLSPlaylistURL != "" {
				return *item.HLSPlaylistURL
			}
			return ""
		}
		// Direct HLS playlist URL if stored explicitly
		if item.HLSPlaylistURL != nil && *item.HLSPlaylistURL != "" {
			return *item.HLSPlaylistURL
		}
		return ""
	} else if item.ContentType == models.ContentDocument {
		if item.FileKey == textLessonKey {
			return "" // written in the app: the text travels in body_text
		}
		if storage.Client != nil && item.FileKey != "" {
			url, err := storage.Client.PresignGet(ctx, item.FileKey, 2*time.Hour)
			if err == nil && url != "" {
				return url
			}
		}
		return "" // storage not configured: never invent a public URL for a private key
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

	query := h.DB.WithContext(c.Request.Context())
	if !canManageAllContent(teacher) {
		query = query.Where("uploaded_by = ?", teacher.ID)
	}
	items, next, err := paged(c, query.Preload("Course"), "content_items", contentKey)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"content": items, "next_cursor": nilIfEmpty(next)})
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
	order := "created_at ASC"
	if c.Query("sort") == "rating" {
		order = "rating_avg DESC, rating_count DESC, created_at ASC"
	}
	h.DB.WithContext(c.Request.Context()).
		Where("chapter_id = ? AND status = ?", chapterID, models.StatusPublished).
		Order(order).
		Find(&items)

	access, aerr := h.SubSvc.AccessFor(c.Request.Context(), user)
	if aerr != nil {
		httpx.Fail(c, aerr)
		return
	}
	for i := range items {
		if access.Allow(items[i].RequiresSubscription, items[i].CourseID) != nil {
			items[i].FileKey = ""
			items[i].HLSPlaylistURL = nil
		}
		items[i].BodyText = nil // lists never carry the text; GET /content/:id does, after the access check
	}
	authors := authorNames(h.DB.WithContext(c.Request.Context()), func() []uuid.UUID {
		ids := make([]uuid.UUID, len(items))
		for i := range items {
			ids[i] = items[i].UploadedBy
		}
		return ids
	}())
	for i := range items {
		if n, ok := authors[items[i].UploadedBy]; ok {
			items[i].AuthorName = &n
		}
	}

	// the caller's own ratings, keyed by content id
	mine := map[string]int{}
	if len(items) > 0 {
		ids := make([]uuid.UUID, len(items))
		for i, it := range items {
			ids[i] = it.ID
		}
		var rs []models.Rating
		h.DB.WithContext(c.Request.Context()).Where("user_id = ? AND item_type = 'content' AND item_id IN ?", user.ID, ids).Find(&rs)
		for _, r := range rs {
			mine[r.ItemID.String()] = r.Value
		}
	}
	c.JSON(http.StatusOK, listContentResponse{Content: items, MyRatings: mine})
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
		respondErr(c, http.StatusNotFound, "not_found", "content not found")
		return
	}

	if err := h.SubSvc.Allow(c.Request.Context(), user, item.RequiresSubscription, item.CourseID); err != nil {
		respondErr(c, http.StatusForbidden, "forbidden", err.Error())
		return
	}

	if n, ok := authorNames(h.DB.WithContext(c.Request.Context()), []uuid.UUID{item.UploadedBy})[item.UploadedBy]; ok {
		item.AuthorName = &n
	}
	resp := getContentResponse{Content: item, URL: resolveContentURL(c.Request.Context(), &item), lecturePDFs: h.lecturePDFsFor(c.Request.Context(), &item, user)}
	var r models.Rating
	if h.DB.WithContext(c.Request.Context()).Where("user_id = ? AND item_type = 'content' AND item_id = ?", user.ID, item.ID).First(&r).Error == nil {
		v := r.Value
		resp.MyRating = &v
	}
	var hist models.UserWatchHistory
	if h.DB.WithContext(c.Request.Context()).Where("user_id = ? AND content_item_id = ?", user.ID, item.ID).First(&hist).Error == nil && !hist.IsCompleted && hist.ProgressSeconds > 0 {
		p := hist.ProgressSeconds
		resp.ProgressSeconds = &p
	}
	c.JSON(http.StatusOK, resp)
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
		respondErr(c, http.StatusNotFound, "not_found", "content not found")
		return
	}

	c.JSON(http.StatusOK, adminContentDetailResponse{Content: item, URL: resolveContentURL(c.Request.Context(), &item), lecturePDFs: h.lecturePDFsFor(c.Request.Context(), &item, nil)})
}

// ─── Admin Content Moderation ─────────────────────────────────────────────────

// AdminListContent godoc
//
//	@Summary		List content items by status (Admin)
//	@Description	Returns content items filterable by status. Defaults to pending_review.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			status		query		string	false	"Filter by status, or all"	default(pending_review)
//	@Param			uploader_id	query		string	false	"Only this uploader's items"
//	@Param			course_id	query		string	false	"Filter by course ID"
//	@Param			chapter_id	query		string	false	"Filter by chapter ID"
//	@Success		200			{object}	listContentResponse
//	@Failure		401			{object}	errorResponse
//	@Failure		403			{object}	errorResponse
//	@Router			/api/v1/admin/content [get]
func (h *ContentHandler) AdminListContent(c *gin.Context) {
	courseID := c.Query("course_id")
	chapterID := c.Query("chapter_id")

	query := h.DB.WithContext(c.Request.Context())
	// status=all lists every status; otherwise one status (default: pending_review).
	if c.Query("status") != "all" {
		status, ok := statusParam(c)
		if !ok {
			return
		}
		query = query.Where("status = ?", status)
	}
	if v := c.Query("uploader_id"); v != "" {
		query = query.Where("uploaded_by = ?", v)
	}

	if courseID != "" {
		query = query.Where("course_id = ?", courseID)
	}
	if chapterID != "" {
		query = query.Where("chapter_id = ?", chapterID)
	}

	items, next, err := paged(c, query.Preload("Course").Preload("Chapter").Preload("Uploader"), "content_items", contentKey)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"content": items, "next_cursor": nilIfEmpty(next)})
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
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	if err := h.Review.Approve(c.Request.Context(), middleware.GetUser(c), services.ReviewContent, id); err != nil {
		respondService(c, err)
		return
	}
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
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var req rejectContentRequest
	if !httpx.Bind(c, &req) {
		return
	}
	if err := h.Review.Reject(c.Request.Context(), middleware.GetUser(c), services.ReviewContent, id, req.Reason); err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "content rejected"})
}

// ── Request / Response types ──────────────────────────────────────────────────

type listContentResponse struct {
	Content   []models.ContentItem `json:"content"`
	MyRatings map[string]int       `json:"my_ratings,omitempty"`
}

type createContentRequest struct {
	Title                string `json:"title"        example:"Cell Biology — Lecture 1"`
	CourseID             string `json:"course_id"    example:"550e8400-e29b-41d4-a716-446655440000"`
	ContentType          string `json:"content_type" example:"video" enums:"video,document"`
	ChapterID            string `json:"chapter_id"   example:"550e8400-e29b-41d4-a716-446655440002"`
	FileKey              string `json:"file_key"     example:"video/user-uuid/file-uuid.mp4"`
	RequiresSubscription *bool  `json:"requires_subscription" example:"true"`
	NotesPDFKey          string `json:"notes_pdf_key"     example:"lecture_pdf/user-uuid/file-uuid.pdf"`
	AnnotatedPDFKey      string `json:"annotated_pdf_key" example:"lecture_pdf/user-uuid/file-uuid.pdf"`
	// BodyText is the text of a document lesson written in the app (instead of an uploaded file).
	BodyText string `json:"body_text"`
}

type updateContentRequest struct {
	Title                *string `json:"title"`
	ChapterID            *string `json:"chapter_id"`
	FileKey              *string `json:"file_key"`
	RequiresSubscription *bool   `json:"requires_subscription"`
	// "" removes the PDF; omitted leaves it unchanged.
	NotesPDFKey     *string `json:"notes_pdf_key"`
	AnnotatedPDFKey *string `json:"annotated_pdf_key"`
	BodyText        *string `json:"body_text"`
}

type getContentResponse struct {
	Content  models.ContentItem `json:"content"`
	URL      string             `json:"url,omitempty"`
	MyRating *int               `json:"my_rating,omitempty"`
	// ProgressSeconds is where this student left off, so the player can resume. Absent when finished or never started.
	ProgressSeconds *int `json:"progress_seconds,omitempty"`
	lecturePDFs
}

// lecturePDFs is how a lecture's PDFs are exposed. The annotated PDF is only
// linked for students once they've watched the lecture; until then
// annotated_pdf_locked tells the app to show it as locked.
type lecturePDFs struct {
	HasNotesPDF        bool   `json:"has_notes_pdf"`
	NotesPDFURL        string `json:"notes_pdf_url,omitempty"`
	HasAnnotatedPDF    bool   `json:"has_annotated_pdf"`
	AnnotatedPDFURL    string `json:"annotated_pdf_url,omitempty"`
	AnnotatedPDFLocked bool   `json:"annotated_pdf_locked,omitempty"`
}

type adminContentDetailResponse struct {
	Content models.ContentItem `json:"content"`
	URL     string             `json:"url,omitempty"`
	lecturePDFs
}

// validLecturePDFKey accepts only keys from a lecture_pdf upload by this user
// (or anyone's, for admins / manage-all teachers), so a lecture can't point at
// someone else's private file.
func validLecturePDFKey(u *models.User, key string) bool {
	if !strings.HasPrefix(key, "lecture_pdf/") || strings.Contains(key, "..") {
		return false
	}
	return canManageAllContent(u) || strings.HasPrefix(key, "lecture_pdf/"+strings.ToLower(u.ID.String())+"/")
}

func pdfURL(ctx context.Context, key *string) string {
	if key == nil || *key == "" || storage.Client == nil {
		return ""
	}
	url, err := storage.Client.PresignGet(ctx, *key, 2*time.Hour)
	if err != nil {
		return ""
	}
	return url
}

// lecturePDFsFor links a lecture's PDFs. student == nil means an author/reviewer
// view (both linked). For a student the annotated PDF stays locked until their
// watch history marks the lecture completed.
func (h *ContentHandler) lecturePDFsFor(ctx context.Context, item *models.ContentItem, student *models.User) lecturePDFs {
	out := lecturePDFs{HasNotesPDF: item.NotesPDFKey != nil && *item.NotesPDFKey != "", HasAnnotatedPDF: item.AnnotatedPDFKey != nil && *item.AnnotatedPDFKey != ""}
	out.NotesPDFURL = pdfURL(ctx, item.NotesPDFKey)
	if !out.HasAnnotatedPDF {
		return out
	}
	if student != nil && student.Role == models.RoleStudent {
		var n int64
		h.DB.WithContext(ctx).Model(&models.UserWatchHistory{}).
			Where("user_id = ? AND content_item_id = ? AND is_completed = ?", student.ID, item.ID, true).Count(&n)
		if n == 0 {
			out.AnnotatedPDFLocked = true
			return out
		}
	}
	out.AnnotatedPDFURL = pdfURL(ctx, item.AnnotatedPDFKey)
	return out
}

func contentKey(i models.ContentItem) (time.Time, uuid.UUID) { return i.CreatedAt, i.ID }
