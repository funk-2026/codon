package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"

	"codon-backend/internal/httpx"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/settings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Student-facing extras: product-analytics intake, payment history, search and a data export.

// ── Analytics intake ─────────────────────────────────────────────────────────

type eventIn struct {
	Name  string                 `json:"name"`
	Props map[string]interface{} `json:"props"`
	At    *time.Time             `json:"at"`
}

type eventsRequest struct {
	Events     []eventIn `json:"events"`
	AppVersion string    `json:"app_version"`
	Platform   string    `json:"platform"`
}

var eventNameRE = regexp.MustCompile(`^[a-z0-9_.]{1,64}$`)

func clip(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}

// IngestEvents godoc
//
//	@Summary		Receive a batch of app analytics events
//	@Description	Stores up to 50 events. While `analytics.events` is off (the default) the batch is accepted and discarded, so the app never needs to know.
//	@Tags			Analytics
//	@Security		BearerAuth
//	@Accept			json
//	@Success		202
//	@Router			/api/v1/events [post]
func (h *ProfileHandler) IngestEvents(c *gin.Context) {
	user := middleware.GetUser(c)
	var req eventsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if len(req.Events) > 50 {
		respondErr(c, http.StatusBadRequest, "too_many_events", "send at most 50 events at a time")
		return
	}
	if !settings.Default.Bool("analytics.events") {
		c.Status(http.StatusAccepted)
		return
	}
	now := time.Now()
	rows := make([]models.AnalyticsEvent, 0, len(req.Events))
	for _, e := range req.Events {
		if !eventNameRE.MatchString(e.Name) {
			continue
		}
		props, err := json.Marshal(e.Props)
		if err != nil || len(props) > 2048 {
			props = []byte("{}")
		}
		at := now
		if e.At != nil && e.At.Before(now.Add(time.Minute)) && e.At.After(now.Add(-7*24*time.Hour)) {
			at = *e.At
		}
		uid := user.ID
		rows = append(rows, models.AnalyticsEvent{
			UserID: &uid, Name: e.Name, Props: models.JSONB(props),
			AppVersion: clip(req.AppVersion, 20), Platform: clip(req.Platform, 10), At: at,
		})
	}
	if len(rows) > 0 {
		if err := h.DB.WithContext(c.Request.Context()).Create(&rows).Error; err != nil {
			httpx.Fail(c, err)
			return
		}
	}
	c.Status(http.StatusAccepted)
}

// ── Payment history ──────────────────────────────────────────────────────────

// MyPayments godoc
//
//	@Summary		My payments (receipts)
//	@Tags			Subscriptions & Payments
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/me/payments [get]
func (h *ProfileHandler) MyPayments(c *gin.Context) {
	user := middleware.GetUser(c)
	q := h.DB.WithContext(c.Request.Context()).Model(&models.PaymentRecord{}).
		Where("user_id = ?", user.ID).Preload("Subscription.Plan")
	rows, next, err := paged(c, q, "payment_records", func(p models.PaymentRecord) (time.Time, uuid.UUID) { return p.CreatedAt, p.ID })
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	out := make([]gin.H, 0, len(rows))
	for _, p := range rows {
		plan := ""
		if p.Subscription != nil {
			plan = p.Subscription.Plan.Name
		}
		out = append(out, gin.H{
			"id": p.ID, "order_id": p.RazorpayOrderID, "payment_id": p.RazorpayPaymentID,
			"amount_paise": p.AmountPaise, "currency": p.Currency, "status": p.Status,
			"plan_name": plan, "created_at": p.CreatedAt, "refunded_at": p.RefundedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"payments": out, "next_cursor": nilIfEmpty(next)})
}

// ── Search ───────────────────────────────────────────────────────────────────

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

type searchHit struct {
	ID                   uuid.UUID `json:"id"`
	Title                string    `json:"title"`
	Meta                 string    `json:"meta"`
	Kind                 string    `json:"kind"`
	RequiresSubscription bool      `json:"requires_subscription"`
}

var moduleLabel = map[models.ModuleType]string{
	models.ModuleQBank:      "Q Bank",
	models.ModulePractice:   "Q Bank",
	models.ModuleTestSeries: "Test Series",
}

// Search godoc
//
//	@Summary		Search tests, lessons, flashcard decks and Brain Hacks by title
//	@Description	Published items only, for the student's course. Two characters minimum; up to 8 per kind.
//	@Tags			Search
//	@Security		BearerAuth
//	@Produce		json
//	@Param			q	query		string	true	"Search text"
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/search [get]
func (h *ProfileHandler) Search(c *gin.Context) {
	user := middleware.GetUser(c)
	q := strings.TrimSpace(c.Query("q"))
	out := gin.H{"tests": []searchHit{}, "content": []searchHit{}, "decks": []searchHit{}, "hacks": []searchHit{}}
	if len([]rune(q)) < 2 {
		c.JSON(http.StatusOK, out)
		return
	}
	like := "%" + likeEscaper.Replace(q) + "%"
	db := h.DB.WithContext(c.Request.Context())
	const limit = 8

	var tests []models.Test
	tq := db.Where("status = ? AND origin = ? AND visibility = ? AND title ILIKE ?", models.StatusPublished, models.OriginAuthored, models.VisibilityPublic, like).
		Where("module_type IN ?", []string{"qbank", "test_series", "practice"})
	if user.SelectedCourseID != nil {
		tq = tq.Where("course_id = ?", *user.SelectedCourseID)
	}
	if err := tq.Order("created_at DESC").Limit(limit).Find(&tests).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	th := make([]searchHit, 0, len(tests))
	for _, t := range tests {
		th = append(th, searchHit{ID: t.ID, Title: t.Title, Meta: moduleLabel[t.ModuleType], Kind: "test", RequiresSubscription: t.RequiresSubscription})
	}
	out["tests"] = th

	var items []models.ContentItem
	cq := db.Where("status = ? AND title ILIKE ?", models.StatusPublished, like)
	if user.SelectedCourseID != nil {
		cq = cq.Where("course_id = ?", *user.SelectedCourseID)
	}
	if err := cq.Order("created_at DESC").Limit(limit).Find(&items).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	ch := make([]searchHit, 0, len(items))
	for _, it := range items {
		kind, meta := "document", "Notes"
		if it.ContentType == models.ContentVideo {
			kind, meta = "video", "Video"
		}
		ch = append(ch, searchHit{ID: it.ID, Title: it.Title, Meta: meta, Kind: kind, RequiresSubscription: it.RequiresSubscription})
	}
	out["content"] = ch

	var decks []models.FlashcardDeck
	dq := db.Where("status = ? AND title ILIKE ?", models.StatusPublished, like)
	if user.SelectedCourseID != nil {
		dq = dq.Where("course_id = ?", *user.SelectedCourseID)
	}
	if err := dq.Order("created_at DESC").Limit(limit).Find(&decks).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	dh := make([]searchHit, 0, len(decks))
	for _, d := range decks {
		dh = append(dh, searchHit{ID: d.ID, Title: d.Title, Meta: "Flashcards", Kind: "deck", RequiresSubscription: d.RequiresSubscription})
	}
	out["decks"] = dh

	var hacks []models.BrainHack
	if err := db.Where("status = ? AND title ILIKE ?", models.StatusPublished, like).Order("created_at DESC").Limit(limit).Find(&hacks).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	hh := make([]searchHit, 0, len(hacks))
	for _, b := range hacks {
		hh = append(hh, searchHit{ID: b.ID, Title: b.Title, Meta: b.Category, Kind: "hack"})
	}
	out["hacks"] = hh

	c.JSON(http.StatusOK, out)
}

// ── Data export ──────────────────────────────────────────────────────────────

// ExportMyData godoc
//
//	@Summary		Download a copy of my data
//	@Description	Profile, subscriptions, payments and test attempts as JSON.
//	@Tags			Profile
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/me/export [get]
func (h *ProfileHandler) ExportMyData(c *gin.Context) {
	user := middleware.GetUser(c)
	db := h.DB.WithContext(c.Request.Context())

	var subs, payments, attempts []map[string]interface{}
	if err := db.Raw(`SELECT s.id::text AS id, p.name AS plan, s.status, s.start_date, s.end_date
		FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
		WHERE s.user_id = ? ORDER BY s.created_at DESC`, user.ID).Scan(&subs).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	if err := db.Raw(`SELECT id::text AS id, razorpay_order_id AS order_id, razorpay_payment_id AS payment_id,
		amount_paise, currency, status, created_at
		FROM payment_records WHERE user_id = ? ORDER BY created_at DESC`, user.ID).Scan(&payments).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	if err := db.Raw(`SELECT a.id::text AS id, t.title AS test, a.status, a.score::float8 AS score,
		a.total_marks::float8 AS total_marks, a.started_at, a.submitted_at
		FROM student_attempts a JOIN tests t ON t.id = a.test_id
		WHERE a.user_id = ? ORDER BY a.started_at DESC`, user.ID).Scan(&attempts).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	c.Header("Content-Disposition", `attachment; filename="my-codon-data.json"`)
	c.JSON(http.StatusOK, gin.H{
		"exported_at": time.Now(), "profile": user,
		"subscriptions": subs, "payments": payments, "attempts": attempts,
	})
}
