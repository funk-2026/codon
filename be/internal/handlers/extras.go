package handlers

import (
	"crypto/rand"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"codon-backend/internal/blueprint"
	"codon-backend/internal/generation"
	"codon-backend/internal/media"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/pagination"
	"codon-backend/internal/services"
	"codon-backend/internal/settings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ExtrasHandler groups the small follow-on APIs: video notes, push tokens and
// preferences, in-app notifications, home updates and the Explore feed.
type ExtrasHandler struct {
	DB          *gorm.DB
	Sub         *services.SubscriptionService
	KYCRequired func() bool
	Engine      *generation.Engine
	Analytics   *AnalyticsHandler
}

func NewExtrasHandler(db *gorm.DB, sub *services.SubscriptionService, kyc func() bool, eng *generation.Engine, an *AnalyticsHandler) *ExtrasHandler {
	if kyc == nil {
		kyc = func() bool { return false }
	}
	return &ExtrasHandler{DB: db, Sub: sub, KYCRequired: kyc, Engine: eng, Analytics: an}
}

// ── Video notes ───────────────────────────────────────────────────────────────

type videoNoteRequest struct {
	ContentID        *string `json:"content_id"`
	TimestampSeconds *int    `json:"timestamp_seconds"`
	Body             *string `json:"body"`
}

func (h *ExtrasHandler) videoAccess(c *gin.Context, id uuid.UUID) bool {
	user := middleware.GetUser(c)
	var ct models.ContentItem
	if h.DB.First(&ct, "id = ? AND status = ?", id, models.StatusPublished).Error != nil {
		respondErr(c, http.StatusNotFound, "content_not_found", "content not found")
		return false
	}
	if err := h.Sub.CheckAccess(c.Request.Context(), user, ct.RequiresSubscription, ct.CourseID, h.KYCRequired()); err != nil {
		respondErr(c, http.StatusForbidden, "subscription_required", err.Error())
		return false
	}
	return true
}

func validNoteBody(c *gin.Context, body string) bool {
	body = strings.TrimSpace(body)
	if body == "" || len([]rune(body)) > 4000 {
		respondErr(c, http.StatusBadRequest, "invalid_body", "note must be 1-4000 characters")
		return false
	}
	if strings.Contains(body, "](media:") {
		respondErr(c, http.StatusBadRequest, "images_not_supported", "images in notes are not supported yet")
		return false
	}
	return true
}

// ListVideoNotes godoc
//
//	@Summary		My notes on a video/document, in time order
//	@Tags			VideoNotes
//	@Security		BearerAuth
//	@Produce		json
//	@Param			content_id	query		string	true	"Content item UUID"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/me/video-notes [get]
func (h *ExtrasHandler) ListVideoNotes(c *gin.Context) {
	cid, err := uuid.Parse(c.Query("content_id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "content_id is required")
		return
	}
	var ns []models.VideoNote
	h.DB.Where("user_id = ? AND content_item_id = ?", middleware.GetUser(c).ID, cid).Order("timestamp_seconds ASC, created_at ASC").Find(&ns)
	c.JSON(http.StatusOK, gin.H{"notes": ns})
}

// CreateVideoNote godoc
//
//	@Summary		Add a note at a moment of a video (markdown text, ≤4000 chars)
//	@Tags			VideoNotes
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		videoNoteRequest	true	"Note"
//	@Success		201		{object}	models.VideoNote
//	@Router			/api/v1/me/video-notes [post]
func (h *ExtrasHandler) CreateVideoNote(c *gin.Context) {
	user := middleware.GetUser(c)
	var req videoNoteRequest
	if c.ShouldBindJSON(&req) != nil || req.ContentID == nil || req.Body == nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "content_id and body are required")
		return
	}
	cid, err := uuid.Parse(*req.ContentID)
	if err != nil || !validNoteBody(c, *req.Body) {
		if err != nil {
			respondErr(c, http.StatusBadRequest, "invalid_id", "invalid content_id")
		}
		return
	}
	if !h.videoAccess(c, cid) {
		return
	}
	ts := 0
	if req.TimestampSeconds != nil && *req.TimestampSeconds >= 0 {
		ts = *req.TimestampSeconds
	}
	var n int64
	h.DB.Model(&models.VideoNote{}).Where("user_id = ? AND content_item_id = ?", user.ID, cid).Count(&n)
	if n >= 500 {
		respondErr(c, http.StatusConflict, "too_many_notes", "you have reached the note limit for this item")
		return
	}
	note := models.VideoNote{UserID: user.ID, ContentItemID: cid, TimestampSeconds: ts, Body: strings.TrimSpace(*req.Body)}
	h.DB.Create(&note)
	c.JSON(http.StatusCreated, note)
}

// UpdateVideoNote godoc
//
//	@Summary		Edit my video note
//	@Tags			VideoNotes
//	@Security		BearerAuth
//	@Accept			json
//	@Param			id		path	string				true	"Note UUID"
//	@Param			body	body	videoNoteRequest	true	"Fields"
//	@Success		200		{object}	models.VideoNote
//	@Router			/api/v1/me/video-notes/{id} [patch]
func (h *ExtrasHandler) UpdateVideoNote(c *gin.Context) {
	var note models.VideoNote
	if h.DB.First(&note, "id = ? AND user_id = ?", c.Param("id"), middleware.GetUser(c).ID).Error != nil {
		respondErr(c, http.StatusNotFound, "note_not_found", "note not found")
		return
	}
	var req videoNoteRequest
	if c.ShouldBindJSON(&req) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	up := map[string]interface{}{}
	if req.Body != nil {
		if !validNoteBody(c, *req.Body) {
			return
		}
		up["body"] = strings.TrimSpace(*req.Body)
	}
	if req.TimestampSeconds != nil && *req.TimestampSeconds >= 0 {
		up["timestamp_seconds"] = *req.TimestampSeconds
	}
	h.DB.Model(&note).Updates(up)
	h.DB.First(&note, "id = ?", note.ID)
	c.JSON(http.StatusOK, note)
}

// DeleteVideoNote godoc
//
//	@Summary		Delete my video note
//	@Tags			VideoNotes
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Note UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/me/video-notes/{id} [delete]
func (h *ExtrasHandler) DeleteVideoNote(c *gin.Context) {
	h.DB.Where("id = ? AND user_id = ?", c.Param("id"), middleware.GetUser(c).ID).Delete(&models.VideoNote{})
	c.JSON(http.StatusOK, messageResponse{Message: "note deleted"})
}

// ── Push tokens, preferences, notifications ──────────────────────────────────

type pushTokenRequest struct {
	Token    string `json:"token"`
	Platform string `json:"platform" enums:"ios,android"`
	DeviceID string `json:"device_id"`
}

// RegisterPushToken godoc
//
//	@Summary		Register this device for push notifications
//	@Description	Idempotent upsert. A token is owned by exactly one user: registering it from another account moves it there. Expo push tokens only (`ExponentPushToken[...]`).
//	@Tags			Notifications
//	@Security		BearerAuth
//	@Accept			json
//	@Param			body	body	pushTokenRequest	true	"Token"
//	@Success		200		{object}	messageResponse
//	@Router			/api/v1/me/push-tokens [post]
func (h *ExtrasHandler) RegisterPushToken(c *gin.Context) {
	user := middleware.GetUser(c)
	var req pushTokenRequest
	if c.ShouldBindJSON(&req) != nil || !strings.HasPrefix(req.Token, "ExponentPushToken[") || len(req.Token) > 200 ||
		(req.Platform != "ios" && req.Platform != "android") {
		respondErr(c, http.StatusBadRequest, "invalid_token", "an Expo push token and platform (ios|android) are required")
		return
	}
	t := models.PushToken{UserID: user.ID, Token: req.Token, Platform: req.Platform, DeviceID: req.DeviceID}
	h.DB.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "token"}},
		DoUpdates: clause.AssignmentColumns([]string{"user_id", "platform", "device_id", "updated_at"})}).Create(&t)
	c.JSON(http.StatusOK, messageResponse{Message: "registered"})
}

// DeletePushToken godoc
//
//	@Summary		Unregister a device token (call on logout)
//	@Tags			Notifications
//	@Security		BearerAuth
//	@Param			token	path	string	true	"Expo push token"
//	@Success		200		{object}	messageResponse
//	@Router			/api/v1/me/push-tokens/{token} [delete]
func (h *ExtrasHandler) DeletePushToken(c *gin.Context) {
	h.DB.Where("user_id = ? AND token = ?", middleware.GetUser(c).ID, c.Param("token")).Delete(&models.PushToken{})
	c.JSON(http.StatusOK, messageResponse{Message: "unregistered"})
}

// GetPrefs godoc
//
//	@Summary		My notification preferences
//	@Tags			Notifications
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	models.NotificationPref
//	@Router			/api/v1/me/notification-preferences [get]
func (h *ExtrasHandler) GetPrefs(c *gin.Context) {
	user := middleware.GetUser(c)
	p := models.NotificationPref{UserID: user.ID, PushEnabled: true, StreakNudges: true, ReportUpdates: true}
	h.DB.First(&p, "user_id = ?", user.ID)
	c.JSON(http.StatusOK, p)
}

type prefsRequest struct {
	PushEnabled   *bool `json:"push_enabled"`
	StreakNudges  *bool `json:"streak_nudges"`
	ReportUpdates *bool `json:"report_updates"`
}

// PutPrefs godoc
//
//	@Summary		Change my notification preferences
//	@Tags			Notifications
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		prefsRequest	true	"Fields"
//	@Success		200		{object}	models.NotificationPref
//	@Router			/api/v1/me/notification-preferences [put]
func (h *ExtrasHandler) PutPrefs(c *gin.Context) {
	user := middleware.GetUser(c)
	var req prefsRequest
	if c.ShouldBindJSON(&req) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	p := models.NotificationPref{UserID: user.ID, PushEnabled: true, StreakNudges: true, ReportUpdates: true}
	h.DB.First(&p, "user_id = ?", user.ID)
	if req.PushEnabled != nil {
		p.PushEnabled = *req.PushEnabled
	}
	if req.StreakNudges != nil {
		p.StreakNudges = *req.StreakNudges
	}
	if req.ReportUpdates != nil {
		p.ReportUpdates = *req.ReportUpdates
	}
	// ensure the row exists, then write the real values (GORM rewrites a false bool on a
	// default:true column to true on INSERT, so the values go in through UPDATE)
	h.DB.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "user_id"}}, DoNothing: true}).Create(&models.NotificationPref{UserID: user.ID})
	h.DB.Model(&models.NotificationPref{}).Where("user_id = ?", user.ID).
		UpdateColumns(map[string]interface{}{"push_enabled": p.PushEnabled, "streak_nudges": p.StreakNudges, "report_updates": p.ReportUpdates, "updated_at": time.Now()})
	want := p
	c.JSON(http.StatusOK, want)
}

// ListNotifications godoc
//
//	@Summary		My in-app notifications
//	@Description	Newest first, cursor-paginated; `unread=true` filters. Includes `unread_count`.
//	@Tags			Notifications
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/me/notifications [get]
func (h *ExtrasHandler) ListNotifications(c *gin.Context) {
	user := middleware.GetUser(c)
	limit := pagination.Limit(c.Query("limit"))
	q := h.DB.Model(&models.Notification{}).Where("notifications.user_id = ?", user.ID)
	if c.Query("unread") == "true" {
		q = q.Where("notifications.read_at IS NULL")
	}
	q = pagination.Apply(q, "notifications", pagination.Decode(c.Query("cursor")), limit)
	var ns []models.Notification
	q.Find(&ns)
	ns, next := pagination.Page(ns, limit, func(n models.Notification) (time.Time, uuid.UUID) { return n.CreatedAt, n.ID })
	var unread int64
	h.DB.Model(&models.Notification{}).Where("user_id = ? AND read_at IS NULL", user.ID).Count(&unread)
	c.JSON(http.StatusOK, gin.H{"items": ns, "next_cursor": nilIfEmpty(next), "unread_count": unread})
}

type readRequest struct {
	IDs []string `json:"ids"`
	All bool     `json:"all"`
}

// MarkRead godoc
//
//	@Summary		Mark notifications read (ids, or all)
//	@Tags			Notifications
//	@Security		BearerAuth
//	@Accept			json
//	@Param			body	body	readRequest	true	"Which"
//	@Success		200		{object}	messageResponse
//	@Router			/api/v1/me/notifications/read [post]
func (h *ExtrasHandler) MarkRead(c *gin.Context) {
	user := middleware.GetUser(c)
	var req readRequest
	if c.ShouldBindJSON(&req) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	q := h.DB.Model(&models.Notification{}).Where("user_id = ? AND read_at IS NULL", user.ID)
	if !req.All {
		if len(req.IDs) == 0 || len(req.IDs) > 200 {
			respondErr(c, http.StatusBadRequest, "bad_request", "ids (1-200) or all=true required")
			return
		}
		q = q.Where("id IN ?", req.IDs)
	}
	q.Update("read_at", time.Now())
	c.JSON(http.StatusOK, messageResponse{Message: "marked read"})
}

// ── Home updates ──────────────────────────────────────────────────────────────

type homeUpdateRequest struct {
	Title      *string `json:"title"`
	Body       *string `json:"body"`
	CTALabel   *string `json:"cta_label"`
	CTARoute   *string `json:"cta_route"`
	MediaID    *string `json:"media_id"`
	OrderIndex *int    `json:"order_index"`
	IsActive   *bool   `json:"is_active"`
	StartsAt   *string `json:"starts_at"`
	EndsAt     *string `json:"ends_at"`
}

func (h *ExtrasHandler) applyHome(c *gin.Context, u *models.HomeUpdate, req homeUpdateRequest) bool {
	admin := middleware.GetUser(c)
	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if t == "" || len([]rune(t)) > 100 {
			respondErr(c, http.StatusBadRequest, "invalid_title", "title must be 1-100 characters")
			return false
		}
		u.Title = t
	}
	if req.Body != nil {
		if len([]rune(*req.Body)) > 400 {
			respondErr(c, http.StatusBadRequest, "invalid_body", "body must be at most 400 characters")
			return false
		}
		u.Body = *req.Body
	}
	if req.CTALabel != nil {
		u.CTALabel = *req.CTALabel
	}
	if req.CTARoute != nil {
		// in-app routes only — never an arbitrary URL
		if *req.CTARoute != "" && !strings.HasPrefix(*req.CTARoute, "/(") {
			respondErr(c, http.StatusBadRequest, "invalid_route", "cta_route must be an in-app route starting with /(")
			return false
		}
		u.CTARoute = *req.CTARoute
	}
	if req.MediaID != nil {
		if *req.MediaID == "" {
			u.MediaID = nil
		} else {
			id, err := uuid.Parse(*req.MediaID)
			if err != nil {
				respondErr(c, http.StatusBadRequest, "invalid_id", "invalid media_id")
				return false
			}
			if err := media.CheckOwned(c.Request.Context(), h.DB, admin, id, "home_update_image"); err != nil {
				respondService(c, err)
				return false
			}
			u.MediaID = &id
		}
	}
	if req.OrderIndex != nil {
		u.OrderIndex = *req.OrderIndex
	}
	if req.IsActive != nil {
		u.IsActive = *req.IsActive
	}
	parse := func(s *string, dst **time.Time) bool {
		if s == nil {
			return true
		}
		if *s == "" {
			*dst = nil
			return true
		}
		t, err := time.Parse(time.RFC3339, *s)
		if err != nil {
			respondErr(c, http.StatusBadRequest, "invalid_time", "times must be RFC 3339")
			return false
		}
		*dst = &t
		return true
	}
	return parse(req.StartsAt, &u.StartsAt) && parse(req.EndsAt, &u.EndsAt)
}

// AdminListHome godoc
//
//	@Summary		All home "Updates" items (Admin)
//	@Tags			HomeUpdates
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/admin/home-updates [get]
func (h *ExtrasHandler) AdminListHome(c *gin.Context) {
	var us []models.HomeUpdate
	h.DB.Order("order_index ASC, created_at DESC").Find(&us)
	mc := media.NewCollector()
	for _, u := range us {
		mc.AddID(u.MediaID)
	}
	c.JSON(http.StatusOK, gin.H{"updates": us, "media": media.NewService(h.DB).ResolveCollector(c.Request.Context(), mc, media.URLTTL(nil))})
}

// AdminCreateHome godoc
//
//	@Summary		Create a home update (Admin)
//	@Tags			HomeUpdates
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		homeUpdateRequest	true	"Update"
//	@Success		201		{object}	models.HomeUpdate
//	@Router			/api/v1/admin/home-updates [post]
func (h *ExtrasHandler) AdminCreateHome(c *gin.Context) {
	var req homeUpdateRequest
	if c.ShouldBindJSON(&req) != nil || req.Title == nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "title is required")
		return
	}
	u := models.HomeUpdate{IsActive: true}
	if !h.applyHome(c, &u, req) {
		return
	}
	want := u.IsActive
	h.DB.Create(&u)
	// GORM turns a false bool on a default:true column back into true — restore the intended value.
	h.DB.Model(&u).UpdateColumn("is_active", want)
	u.IsActive = want
	c.JSON(http.StatusCreated, u)
}

// AdminUpdateHome godoc
//
//	@Summary		Edit a home update (Admin)
//	@Tags			HomeUpdates
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string				true	"Update UUID"
//	@Param			body	body		homeUpdateRequest	true	"Fields"
//	@Success		200		{object}	models.HomeUpdate
//	@Router			/api/v1/admin/home-updates/{id} [patch]
func (h *ExtrasHandler) AdminUpdateHome(c *gin.Context) {
	var u models.HomeUpdate
	if h.DB.First(&u, "id = ?", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "not_found", "update not found")
		return
	}
	var req homeUpdateRequest
	if c.ShouldBindJSON(&req) != nil || !h.applyHome(c, &u, req) {
		return
	}
	h.DB.Select("*").Save(&u)
	c.JSON(http.StatusOK, u)
}

// AdminDeleteHome godoc
//
//	@Summary		Delete a home update (Admin)
//	@Tags			HomeUpdates
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Update UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/admin/home-updates/{id} [delete]
func (h *ExtrasHandler) AdminDeleteHome(c *gin.Context) {
	h.DB.Delete(&models.HomeUpdate{}, "id = ?", c.Param("id"))
	c.JSON(http.StatusOK, messageResponse{Message: "deleted"})
}

// HomeUpdates godoc
//
//	@Summary		Active home carousel items
//	@Description	Active items inside their optional start/end window, ordered. Empty means the app should hide the carousel — there is no placeholder content.
//	@Tags			HomeUpdates
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/home/updates [get]
func (h *ExtrasHandler) HomeUpdates(c *gin.Context) {
	now := time.Now()
	var us []models.HomeUpdate
	h.DB.Where("is_active = true AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at > ?)", now, now).
		Order("order_index ASC, created_at DESC").Limit(10).Find(&us)
	mc := media.NewCollector()
	for _, u := range us {
		mc.AddID(u.MediaID)
	}
	c.JSON(http.StatusOK, gin.H{"updates": us, "media": media.NewService(h.DB).ResolveCollector(c.Request.Context(), mc, media.URLTTL(nil))})
}

// ── Explore ───────────────────────────────────────────────────────────────────

// Explore godoc
//
//	@Summary		Discovery feed for the Explore section
//	@Description	One composite response for a course: `continue` (in-progress attempts), `recommended` (rule-based practice suggestions), `qbank` (chapters with the most eligible questions), `presets` (custom-test presets, when the module is enabled), `flashcard_decks` (newest and top-rated) and `brain_hacks` (newest). Sections that have nothing are empty arrays — the app hides them rather than showing placeholders.
//	@Tags			Explore
//	@Security		BearerAuth
//	@Produce		json
//	@Param			course_id	query		string	true	"Course UUID"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/explore [get]
func (h *ExtrasHandler) Explore(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	courseID, err := uuid.Parse(c.Query("course_id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "course_id is required")
		return
	}
	// continue
	var cont []struct {
		AttemptID uuid.UUID  `json:"attempt_id"`
		TestID    uuid.UUID  `json:"test_id"`
		Title     string     `json:"title"`
		Module    string     `json:"module"`
		ExpiresAt *time.Time `json:"expires_at"`
	}
	h.DB.WithContext(ctx).Raw(`SELECT a.id AS attempt_id, t.id AS test_id, t.title, t.module_type AS module, a.expires_at
		FROM student_attempts a JOIN tests t ON t.id = a.test_id
		WHERE a.user_id = ? AND a.status = 'in_progress' AND t.course_id = ? ORDER BY a.started_at DESC LIMIT 3`, user.ID, courseID).Scan(&cont)
	if cont == nil {
		cont = []struct {
			AttemptID uuid.UUID  `json:"attempt_id"`
			TestID    uuid.UUID  `json:"test_id"`
			Title     string     `json:"title"`
			Module    string     `json:"module"`
			ExpiresAt *time.Time `json:"expires_at"`
		}{}
	}
	// qbank: chapters with most eligible questions
	ent := h.Engine.EntitlementFor(ctx, user, courseID)
	pc := h.Engine.PoolCounts(ctx, ent)
	var chs []models.Chapter
	h.DB.WithContext(ctx).Joins("JOIN subjects s ON s.id = chapters.subject_id").Where("s.course_id = ?", courseID).Preload("Subject").Find(&chs)
	qb := []gin.H{}
	for _, ch := range chs {
		if n := pc.ByChapter[ch.ID]; n > 0 {
			qb = append(qb, gin.H{"chapter_id": ch.ID, "chapter": ch.Name, "subject": ch.Subject.Name, "questions": n})
		}
	}
	for i := 0; i < len(qb); i++ {
		for j := i + 1; j < len(qb); j++ {
			if qb[j]["questions"].(int) > qb[i]["questions"].(int) {
				qb[i], qb[j] = qb[j], qb[i]
			}
		}
	}
	if len(qb) > 8 {
		qb = qb[:8]
	}
	presets := []models.CustomTestPreset{}
	if settings.Bool("custom_test.enabled") {
		h.DB.WithContext(ctx).Where("course_id = ? AND is_active = true", courseID).Order("order_index").Find(&presets)
	}
	var newest, top []models.FlashcardDeck
	h.DB.WithContext(ctx).Where("course_id = ? AND status = ? AND card_count > 0", courseID, models.StatusPublished).Order("created_at DESC").Limit(6).Find(&newest)
	h.DB.WithContext(ctx).Where("course_id = ? AND status = ? AND card_count > 0 AND rating_count >= ?", courseID, models.StatusPublished, settings.Int("ratings.min_count_display")).
		Order("rating_avg DESC, rating_count DESC").Limit(6).Find(&top)
	var hacks []models.BrainHack
	h.DB.WithContext(ctx).Where("status = ?", models.StatusPublished).Order("created_at DESC").Limit(5).Find(&hacks)
	if newest == nil {
		newest = []models.FlashcardDeck{}
	}
	if top == nil {
		top = []models.FlashcardDeck{}
	}
	if hacks == nil {
		hacks = []models.BrainHack{}
	}
	mc := media.NewCollector()
	for i := range hacks {
		mc.AddID(hacks[i].CoverMediaID)
	}
	c.JSON(http.StatusOK, gin.H{
		"continue": cont, "recommended": h.Analytics.recommend(c, user), "qbank": qb, "presets": presets,
		"flashcard_decks": gin.H{"newest": newest, "top_rated": top}, "brain_hacks": hacks,
		"media": media.NewService(h.DB).ResolveCollector(ctx, mc, media.URLTTL(nil)),
	})
}

// ── Blueprint sharing ─────────────────────────────────────────────────────────

const shareAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

func shareCode() string {
	b := make([]byte, 8)
	rand.Read(b)
	for i := range b {
		b[i] = shareAlphabet[int(b[i])%len(shareAlphabet)]
	}
	return string(b)
}

type shareRequest struct {
	Blueprint blueprintRaw `json:"blueprint"`
}

type blueprintRaw = json.RawMessage

// ShareBlueprint godoc
//
//	@Summary		Share a blueprint by short code
//	@Description	The recipient receives the BLUEPRINT (filters, count, mode…), never the questions — they generate their own test. Codes expire after 30 days; bookmarks/status filters are personal, so they are stripped from what is shared.
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Success		201	{object}	map[string]interface{}
//	@Router			/api/v1/custom-tests/share [post]
func (h *CustomTestHandler) ShareBlueprint(c *gin.Context) {
	user := middleware.GetUser(c)
	var req shareRequest
	if c.ShouldBindJSON(&req) != nil || len(req.Blueprint) == 0 {
		respondErr(c, http.StatusBadRequest, "bad_request", "blueprint is required")
		return
	}
	bp, err := h.Engine.Prepare(c.Request.Context(), req.Blueprint)
	if err != nil {
		respondService(c, err)
		return
	}
	// personal state is never shared
	bp.Filters.Status, bp.Filters.BookmarkCollectionIDs, bp.Filters.ExcludeAttemptedWithinDay, bp.Seed, bp.Title = nil, nil, 0, nil, ""
	var n int64
	h.DB.Model(&models.BlueprintShare{}).Where("owner_id = ? AND created_at > ?", user.ID, time.Now().Add(-24*time.Hour)).Count(&n)
	if n >= 20 {
		respondErr(c, http.StatusTooManyRequests, "rate_limited", "too many shares today")
		return
	}
	share := models.BlueprintShare{Code: shareCode(), OwnerID: user.ID, Blueprint: bp.JSON(), ExpiresAt: time.Now().AddDate(0, 0, 30)}
	if err := h.DB.Create(&share).Error; err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to create share code")
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": share.Code, "expires_at": share.ExpiresAt, "deep_link": "codon://custom-test/shared/" + share.Code})
}

// GetShared godoc
//
//	@Summary		Open a shared blueprint
//	@Description	Returns the blueprint for the app to pre-fill the builder. Re-validated against the current limits; 410 once expired.
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Produce		json
//	@Param			code	path		string	true	"Share code"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/custom-tests/shared/{code} [get]
func (h *CustomTestHandler) GetShared(c *gin.Context) {
	var s models.BlueprintShare
	if h.DB.First(&s, "code = ?", strings.ToUpper(c.Param("code"))).Error != nil {
		respondErr(c, http.StatusNotFound, "code_not_found", "that code doesn't exist")
		return
	}
	if time.Now().After(s.ExpiresAt) {
		respondErr(c, http.StatusGone, "code_expired", "that share code has expired")
		return
	}
	bp, issues := blueprint.Parse(s.Blueprint)
	if len(issues) == 0 {
		issues = blueprint.Normalize(&bp, generation.Limits())
	}
	c.JSON(http.StatusOK, gin.H{"blueprint": bp, "still_valid": len(issues) == 0, "issues": issues})
}
