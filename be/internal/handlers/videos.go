package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"codon-backend/internal/httpx"
	"codon-backend/internal/media"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
)

type videoRow struct {
	ID                   uuid.UUID `json:"id"`
	Title                string    `json:"title"`
	ChapterID            uuid.UUID `json:"chapter_id"`
	ChapterName          string    `json:"chapter_name"`
	ChapterOrder         int       `json:"chapter_order"`
	DurationSeconds      int       `json:"duration_seconds"`
	RequiresSubscription bool      `json:"requires_subscription"`
	ProgressSeconds      int       `json:"progress_seconds"`
	IsCompleted          bool      `json:"is_completed"`
	Locked               bool      `json:"locked"`
}

// SubjectVideos godoc
//
//	@Summary		The video lectures of one subject, by chapter, with my progress
//	@Description	Published video lectures only, chapter order then oldest first. `progress_seconds` > 0 and not completed means paused; no progress means not started. `locked` is true when a plan is needed.
//	@Tags			Content
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Subject UUID"
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/subjects/{id}/videos [get]
func (h *ContentHandler) SubjectVideos(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	sid, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var rows []videoRow
	h.DB.WithContext(ctx).Raw(`
		SELECT ci.id, ci.title, ci.chapter_id, ch.name AS chapter_name, ch.order_index AS chapter_order, ci.duration_seconds,
		       ci.requires_subscription, COALESCE(w.progress_seconds, 0) AS progress_seconds, COALESCE(w.is_completed, false) AS is_completed
		FROM content_items ci
		JOIN chapters ch ON ch.id = ci.chapter_id
		LEFT JOIN user_watch_histories w ON w.content_item_id = ci.id AND w.user_id = ?
		WHERE ch.subject_id = ? AND ci.content_type = 'video' AND ci.status = 'published'
		ORDER BY ch.order_index ASC, ch.name ASC, ci.created_at ASC`, user.ID, sid).Scan(&rows)
	access, err := h.SubSvc.AccessFor(ctx, user)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	for i := range rows {
		var courseID uuid.UUID
		h.DB.WithContext(ctx).Model(&models.ContentItem{}).Where("id = ?", rows[i].ID).Select("course_id").Scan(&courseID)
		rows[i].Locked = access.Allow(rows[i].RequiresSubscription, courseID) != nil
	}
	if len(rows) == 0 {
		c.JSON(http.StatusOK, gin.H{"videos": []interface{}{}})
		return
	}
	// Chapter covers, so each lecture can show its chapter's image.
	covers := map[uuid.UUID]uuid.UUID{}
	var chs []models.Chapter
	h.DB.WithContext(ctx).Select("id", "cover_media_id").Where("subject_id = ? AND cover_media_id IS NOT NULL", sid).Find(&chs)
	mc := media.NewCollector()
	for _, ch := range chs {
		covers[ch.ID] = *ch.CoverMediaID
		mc.AddID(ch.CoverMediaID)
	}
	byChapter := map[string]string{}
	for k, v := range covers {
		byChapter[k.String()] = v.String()
	}
	c.JSON(http.StatusOK, gin.H{"videos": rows, "covers": byChapter, "media": media.NewService(h.DB).ResolveCollector(ctx, mc, media.URLTTL(nil))})
}

type completeRequest struct {
	Completed bool `json:"completed"`
}

// SetLectureCompleted godoc
//
//	@Summary		Mark a lecture complete, or not complete again
//	@Tags			Content
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string				true	"Content item UUID"
//	@Param			body	body		completeRequest		true	"completed"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/content/{id}/complete [post]
func (h *ContentHandler) SetLectureCompleted(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var req completeRequest
	if !httpx.Bind(c, &req) {
		return
	}
	var n int64
	h.DB.WithContext(ctx).Model(&models.ContentItem{}).Where("id = ? AND status = ?", id, models.StatusPublished).Count(&n)
	if n == 0 {
		respondErr(c, http.StatusNotFound, "not_found", "content not found")
		return
	}
	now := time.Now()
	if err := h.DB.WithContext(ctx).Exec(`
		INSERT INTO user_watch_histories (id, user_id, content_item_id, progress_seconds, is_completed, last_watched_at)
		VALUES (gen_random_uuid(), ?, ?, 0, ?, ?)
		ON CONFLICT (user_id, content_item_id) DO UPDATE SET is_completed = EXCLUDED.is_completed, last_watched_at = EXCLUDED.last_watched_at`,
		user.ID, id, req.Completed, now).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"completed": req.Completed})
}

// VideoCompletions godoc
//
//	@Summary		Lectures I completed, newest first (for the daily video graph)
//	@Description	One row per lecture currently marked complete, with the day it was last watched or marked.
//	@Tags			Content
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/me/video-completions [get]
func (h *ContentHandler) VideoCompletions(c *gin.Context) {
	user := middleware.GetUser(c)
	var rows []struct {
		ID          uuid.UUID `json:"id"`
		Title       string    `json:"title"`
		Subject     string    `json:"subject"`
		Chapter     string    `json:"chapter"`
		CompletedAt time.Time `json:"completed_at"`
	}
	h.DB.WithContext(c.Request.Context()).Raw(`
		SELECT ci.id, ci.title, s.name AS subject, ch.name AS chapter, w.last_watched_at AS completed_at
		FROM user_watch_histories w JOIN content_items ci ON ci.id = w.content_item_id
		JOIN chapters ch ON ch.id = ci.chapter_id JOIN subjects s ON s.id = ch.subject_id
		WHERE w.user_id = ? AND w.is_completed = true AND ci.content_type = 'video'
		ORDER BY w.last_watched_at DESC LIMIT 400`, user.ID).Scan(&rows)
	if len(rows) == 0 {
		c.JSON(http.StatusOK, gin.H{"completions": []interface{}{}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"completions": rows})
}

type freeVideo struct {
	ID              uuid.UUID `json:"id"`
	Title           string    `json:"title"`
	SubjectName     string    `json:"subject_name"`
	ChapterName     string    `json:"chapter_name"`
	DurationSeconds int       `json:"duration_seconds"`
	IsCompleted     bool      `json:"is_completed"`
}

// FreeVideos lists the published lectures anyone can watch without a plan, Biology first, in chapter order.
func (h *ContentHandler) FreeVideos(c *gin.Context) {
	user := middleware.GetUser(c)
	rows := []freeVideo{}
	q := `SELECT ci.id, ci.title, s.name AS subject_name, ch.name AS chapter_name, ci.duration_seconds, COALESCE(w.is_completed, false) AS is_completed
		FROM content_items ci JOIN chapters ch ON ch.id = ci.chapter_id JOIN subjects s ON s.id = ch.subject_id
		LEFT JOIN user_watch_histories w ON w.content_item_id = ci.id AND w.user_id = ?
		WHERE ci.content_type = 'video' AND ci.status = 'published' AND NOT ci.requires_subscription`
	args := []interface{}{user.ID}
	if cid := c.Query("course_id"); cid != "" {
		q += " AND ci.course_id = ?"
		args = append(args, cid)
	}
	h.DB.WithContext(c.Request.Context()).Raw(q+" ORDER BY s.order_index, s.name, ch.order_index, ci.created_at", args...).Scan(&rows)
	c.JSON(http.StatusOK, gin.H{"videos": rows})
}
