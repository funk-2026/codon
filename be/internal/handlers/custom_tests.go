package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"codon-backend/internal/blueprint"
	"codon-backend/internal/generation"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/pagination"
	"codon-backend/internal/services"
	"codon-backend/internal/settings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// RequireFlag blocks a route group while a feature flag is off (admins are
// exempt so the feature can be tested before launch).
func RequireFlag(key string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if u := middleware.GetUser(c); u != nil && u.Role == models.RoleAdmin {
			c.Next()
			return
		}
		if !settings.Bool(key) {
			c.AbortWithStatusJSON(http.StatusForbidden, errorResponse{Error: "this feature is not available yet", Code: "feature_disabled"})
			return
		}
		c.Next()
	}
}

type CustomTestHandler struct {
	DB     *gorm.DB
	Engine *generation.Engine

	mu       sync.Mutex
	countLog map[uuid.UUID][]time.Time
	cfgCache map[string]cachedConfig
}

type cachedConfig struct {
	at   time.Time
	body gin.H
}

func NewCustomTestHandler(db *gorm.DB, eng *generation.Engine) *CustomTestHandler {
	return &CustomTestHandler{DB: db, Engine: eng, countLog: map[uuid.UUID][]time.Time{}, cfgCache: map[string]cachedConfig{}}
}

func readBody(c *gin.Context) ([]byte, bool) {
	b, err := io.ReadAll(io.LimitReader(c.Request.Body, 64<<10))
	if err != nil || len(b) == 0 {
		respondErr(c, http.StatusBadRequest, "bad_request", "a JSON blueprint body is required")
		return nil, false
	}
	return b, true
}

// Count godoc
//
//	@Summary		Dry-run a blueprint: how many questions match?
//	@Description	Runs the same pool query as generation but persists nothing. Returns matches by subject and difficulty, the tightest filter (`bottleneck`) and ready-to-apply `suggestions` (each verified to increase the match count). Rate-limited per user. Free-tier requests report the clamped count (`clamped_to`).
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		blueprint.Blueprint	true	"Blueprint"
//	@Success		200		{object}	generation.CountResult
//	@Failure		422		{object}	errorResponse
//	@Failure		429		{object}	errorResponse
//	@Router			/api/v1/custom-tests/count [post]
func (h *CustomTestHandler) Count(c *gin.Context) {
	user := middleware.GetUser(c)
	// sliding-window limit
	h.mu.Lock()
	now := time.Now()
	keep := h.countLog[user.ID][:0]
	for _, t := range h.countLog[user.ID] {
		if now.Sub(t) < time.Minute {
			keep = append(keep, t)
		}
	}
	if len(keep) >= settings.Int("custom_test.count_rate_per_minute") {
		h.countLog[user.ID] = keep
		h.mu.Unlock()
		respondErr(c, http.StatusTooManyRequests, "rate_limited", "slow down — too many availability checks")
		return
	}
	h.countLog[user.ID] = append(keep, now)
	h.mu.Unlock()

	raw, ok := readBody(c)
	if !ok {
		return
	}
	bp, err := h.Engine.Prepare(c.Request.Context(), raw)
	if err != nil {
		respondService(c, err)
		return
	}
	res, err := h.Engine.Count(c.Request.Context(), user, bp)
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, res)
}

// Generate godoc
//
//	@Summary		Generate a custom test from a blueprint
//	@Description	Selects questions server-side, freezes them (order, marks, mode, duration, blueprint) into a private test owned by the caller and returns it with any `relaxations` applied (never silent). The test then runs through the normal attempt endpoints. Send an `Idempotency-Key` header so a retried request returns the same test. Errors: `invalid_blueprint`, `pool_too_small` (with suggestions), `quota_exceeded` (free tier, with `resets_at`), `rate_limited`, `too_many_tests`.
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			Idempotency-Key	header		string				false	"Client-generated key"
//	@Param			body			body		blueprint.Blueprint	true	"Blueprint"
//	@Success		201				{object}	generation.Result
//	@Success		200				{object}	generation.Result	"replayed"
//	@Router			/api/v1/custom-tests [post]
func (h *CustomTestHandler) Generate(c *gin.Context) {
	user := middleware.GetUser(c)
	raw, ok := readBody(c)
	if !ok {
		return
	}
	bp, err := h.Engine.Prepare(c.Request.Context(), raw)
	if err != nil {
		respondService(c, err)
		return
	}
	res, err := h.Engine.Generate(c.Request.Context(), user, bp, c.GetHeader("Idempotency-Key"), nil)
	if err != nil {
		respondService(c, err)
		return
	}
	status := http.StatusCreated
	if res.Replayed {
		status = http.StatusOK
	}
	c.JSON(status, res)
}

type customTestRow struct {
	Test          models.Test      `json:"test"`
	State         string           `json:"state"`
	AttemptsCount int              `json:"attempts_count"`
	LastAttempt   *lastAttemptView `json:"last_attempt,omitempty"`
	Summary       string           `json:"summary"`
}

type lastAttemptView struct {
	ID          uuid.UUID  `json:"id"`
	AttemptNo   int        `json:"attempt_no"`
	Status      string     `json:"status"`
	Score       *float64   `json:"score,omitempty"`
	TotalMarks  *float64   `json:"total_marks,omitempty"`
	SubmittedAt *time.Time `json:"submitted_at,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
}

func summaryOf(t models.Test) string {
	timing := "untimed"
	if t.DurationMinutes != nil && *t.DurationMinutes > 0 {
		timing = fmt.Sprintf("%d min", *t.DurationMinutes)
	}
	return fmt.Sprintf("%dQ · %s · %s", t.TotalQuestions, timing, t.Mode)
}

func (h *CustomTestHandler) rows(c *gin.Context, tests []models.Test) []customTestRow {
	ids := make([]uuid.UUID, len(tests))
	for i, t := range tests {
		ids[i] = t.ID
	}
	latest := map[uuid.UUID]models.StudentAttempt{}
	counts := map[uuid.UUID]int{}
	if len(ids) > 0 {
		var as []models.StudentAttempt
		h.DB.WithContext(c.Request.Context()).Where("test_id IN ?", ids).Order("created_at DESC").Find(&as)
		for _, a := range as {
			counts[a.TestID]++
			if _, ok := latest[a.TestID]; !ok {
				latest[a.TestID] = a
			}
		}
	}
	out := make([]customTestRow, len(tests))
	for i, t := range tests {
		r := customTestRow{Test: t, State: "not_started", AttemptsCount: counts[t.ID], Summary: summaryOf(t)}
		if a, ok := latest[t.ID]; ok {
			r.State = "completed"
			if a.Status == models.AttemptInProgress {
				r.State = "in_progress"
			}
			r.LastAttempt = &lastAttemptView{a.ID, a.AttemptNo, string(a.Status), a.Score, a.TotalMarks, a.SubmittedAt, a.ExpiresAt}
		}
		out[i] = r
	}
	return out
}

// List godoc
//
//	@Summary		My custom tests
//	@Description	Cursor-paginated. `state` filter: not_started | in_progress | completed. Each row carries the derived state, attempt count and last attempt summary. Archived tests are hidden.
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Produce		json
//	@Param			state	query		string	false	"not_started|in_progress|completed"
//	@Param			limit	query		int		false	"Page size"
//	@Param			cursor	query		string	false	"Cursor"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/custom-tests [get]
func (h *CustomTestHandler) List(c *gin.Context) {
	user := middleware.GetUser(c)
	limit := pagination.Limit(c.Query("limit"))
	q := h.DB.WithContext(c.Request.Context()).Model(&models.Test{}).
		Where("tests.owner_user_id = ? AND tests.origin = 'generated' AND tests.archived_at IS NULL", user.ID)
	switch c.Query("state") {
	case "not_started":
		q = q.Where("NOT EXISTS (SELECT 1 FROM student_attempts a WHERE a.test_id = tests.id)")
	case "in_progress":
		q = q.Where("EXISTS (SELECT 1 FROM student_attempts a WHERE a.test_id = tests.id AND a.status = 'in_progress')")
	case "completed":
		q = q.Where("EXISTS (SELECT 1 FROM student_attempts a WHERE a.test_id = tests.id AND a.status = 'submitted') AND NOT EXISTS (SELECT 1 FROM student_attempts a WHERE a.test_id = tests.id AND a.status = 'in_progress')")
	case "":
	default:
		respondErr(c, http.StatusBadRequest, "invalid_state", "state must be not_started, in_progress or completed")
		return
	}
	q = pagination.Apply(q, "tests", pagination.Decode(c.Query("cursor")), limit)
	var tests []models.Test
	q.Find(&tests)
	tests, next := pagination.Page(tests, limit, func(t models.Test) (time.Time, uuid.UUID) { return t.CreatedAt, t.ID })
	c.JSON(http.StatusOK, gin.H{"items": h.rows(c, tests), "next_cursor": nilIfEmpty(next)})
}

func (h *CustomTestHandler) mine(c *gin.Context) (*models.Test, bool) {
	user := middleware.GetUser(c)
	var t models.Test
	// non-owners get 404, not 403 — existence must not leak
	if err := h.DB.WithContext(c.Request.Context()).
		First(&t, "id = ? AND owner_user_id = ? AND origin = 'generated' AND archived_at IS NULL", c.Param("id"), user.ID).Error; err != nil {
		respondErr(c, http.StatusNotFound, "test_not_found", "custom test not found")
		return nil, false
	}
	return &t, true
}

// Get godoc
//
//	@Summary		One custom test with its blueprint and attempts
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Test UUID"
//	@Success		200	{object}	map[string]interface{}
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/custom-tests/{id} [get]
func (h *CustomTestHandler) Get(c *gin.Context) {
	t, ok := h.mine(c)
	if !ok {
		return
	}
	var attempts []models.StudentAttempt
	h.DB.Where("test_id = ?", t.ID).Order("attempt_no ASC").Find(&attempts)
	c.JSON(http.StatusOK, gin.H{"test": t, "blueprint": t.Blueprint, "summary": summaryOf(*t), "attempts": attempts})
}

type renameRequest struct {
	Title string `json:"title"`
}

// Rename godoc
//
//	@Summary		Rename a custom test
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Accept			json
//	@Param			id		path	string			true	"Test UUID"
//	@Param			body	body	renameRequest	true	"Title"
//	@Success		200		{object}	models.Test
//	@Router			/api/v1/custom-tests/{id} [patch]
func (h *CustomTestHandler) Rename(c *gin.Context) {
	t, ok := h.mine(c)
	if !ok {
		return
	}
	var req renameRequest
	if c.ShouldBindJSON(&req) != nil || len([]rune(req.Title)) < 1 || len([]rune(req.Title)) > 120 {
		respondErr(c, http.StatusBadRequest, "invalid_title", "title must be 1-120 characters")
		return
	}
	h.DB.Model(t).Update("title", req.Title)
	c.JSON(http.StatusOK, t)
}

// Delete godoc
//
//	@Summary		Delete (archive) a custom test
//	@Description	Soft delete: the test disappears from lists but its attempts, scores and analytics are kept. (The teacher DeleteTest path hard-deletes attempts and is deliberately not used here.)
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Test UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/custom-tests/{id} [delete]
func (h *CustomTestHandler) Delete(c *gin.Context) {
	t, ok := h.mine(c)
	if !ok {
		return
	}
	// an in-progress attempt is finalised first so nothing is left dangling
	var open []models.StudentAttempt
	h.DB.Where("test_id = ? AND status = 'in_progress'", t.ID).Find(&open)
	svc := services.NewScoringService(h.DB)
	for _, a := range open {
		_, _ = svc.SubmitAttempt(c.Request.Context(), a.ID, a.UserID, nil)
	}
	now := time.Now()
	h.DB.Model(t).Update("archived_at", now)
	c.JSON(http.StatusOK, messageResponse{Message: "custom test deleted"})
}

// Regenerate godoc
//
//	@Summary		"New set": same blueprint, fresh questions
//	@Description	Runs the stored blueprint again with a new random seed and returns a NEW test. (Retaking the SAME questions is just starting another attempt on the same test — attempts are numbered `attempt_no`.)
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Test UUID"
//	@Success		201	{object}	generation.Result
//	@Router			/api/v1/custom-tests/{id}/regenerate [post]
func (h *CustomTestHandler) Regenerate(c *gin.Context) {
	user := middleware.GetUser(c)
	t, ok := h.mine(c)
	if !ok {
		return
	}
	bp, ok := generation.BlueprintOf(t)
	if !ok {
		respondErr(c, http.StatusConflict, "no_blueprint", "this test has no stored blueprint")
		return
	}
	bp.Seed = nil
	raw, _ := json.Marshal(bp)
	nb, err := h.Engine.Prepare(c.Request.Context(), raw)
	if err != nil {
		respondService(c, err)
		return
	}
	res, err := h.Engine.Generate(c.Request.Context(), user, nb, c.GetHeader("Idempotency-Key"), nil)
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusCreated, res)
}

type fromAttemptRequest struct {
	Include string            `json:"include" enums:"wrong,unattempted,both"`
	Mode    string            `json:"mode"`
	Timing  blueprint.Timing  `json:"timing"`
	Marking blueprint.Marking `json:"marking"`
	Title   string            `json:"title"`
}

// FromAttempt godoc
//
//	@Summary		"Practise my mistakes"
//	@Description	Builds a new custom test from the wrong and/or unattempted questions of one of the caller's submitted attempts. Eligibility and entitlement rules still apply (a question that was since held for review is skipped).
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			attempt_id	path		string				true	"Attempt UUID"
//	@Param			body		body		fromAttemptRequest	false	"Options"
//	@Success		201			{object}	generation.Result
//	@Router			/api/v1/custom-tests/from-attempt/{attempt_id} [post]
func (h *CustomTestHandler) FromAttempt(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	aid, err := uuid.Parse(c.Param("attempt_id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid attempt id")
		return
	}
	var req fromAttemptRequest
	_ = c.ShouldBindJSON(&req)
	ids, err := h.Engine.FixedFromAttempt(ctx, user, aid, req.Include)
	if err != nil {
		respondService(c, err)
		return
	}
	var att models.StudentAttempt
	var src models.Test
	h.DB.First(&att, "id = ?", aid)
	h.DB.First(&src, "id = ?", att.TestID)

	min := settings.Int("custom_test.min_questions")
	count := len(ids)
	if count < min {
		count = min // satisfy validation; the real count is restored below
	}
	if count > settings.Int("custom_test.max_questions") {
		count = settings.Int("custom_test.max_questions")
		ids = ids[:count]
	}
	bp := blueprint.Blueprint{SchemaVersion: 1, CourseID: src.CourseID, Title: req.Title, Count: count, Mode: req.Mode, Timing: req.Timing, Marking: req.Marking, Order: "syllabus"}
	if bp.Title == "" {
		bp.Title = "Practise my mistakes · " + fmt.Sprint(len(ids)) + "Q"
	}
	if issues := blueprint.Normalize(&bp, generation.Limits()); len(issues) > 0 {
		respondErr(c, http.StatusUnprocessableEntity, "invalid_blueprint", "the blueprint is not valid", issues)
		return
	}
	bp.Count = len(ids)
	res, err := h.Engine.Generate(ctx, user, bp, c.GetHeader("Idempotency-Key"), ids)
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusCreated, res)
}

// ── Builder config ────────────────────────────────────────────────────────────

var difficultyLabels = []gin.H{{"key": "easy", "label": "Easy"}, {"key": "medium", "label": "Medium"}, {"key": "hard", "label": "Hard"}}
var statusLabels = []gin.H{{"key": "unattempted", "label": "Unattempted"}, {"key": "incorrect", "label": "Incorrect"}, {"key": "correct", "label": "Correct"}, {"key": "bookmarked", "label": "Bookmarked"}}
var sourceLabels = map[string]string{"qbank": "Q Bank", "practice": "Practice", "pyq": "Previous year", "test_series": "Test Series", "other": "Other"}

// BuilderConfig godoc
//
//	@Summary		Everything the custom-test builder renders
//	@Description	Server-driven builder schema for one course and this user's entitlement: the subject → chapter → topic tree with eligible question counts, difficulty levels with counts, status filters (and whether they are enabled), allowed sources, popular tags, limits, modes, marking presets, orders, strategies, system presets, entitlement/quota and feature flags. Cached ~60 s per (course, tier).
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Produce		json
//	@Param			course_id	query		string	true	"Course UUID"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/custom-tests/builder-config [get]
func (h *CustomTestHandler) BuilderConfig(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	courseID, err := uuid.Parse(c.Query("course_id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "course_id is required")
		return
	}
	var course models.Course
	if h.DB.First(&course, "id = ? AND is_active = true", courseID).Error != nil {
		respondErr(c, http.StatusNotFound, "course_not_found", "course not found")
		return
	}
	ent := h.Engine.EntitlementFor(ctx, user, courseID)

	// free-tier quota is per user, so it is added outside the cached body
	quota := gin.H{"tier": ent.Tier}
	if ent.Tier == generation.TierFree {
		start, reset := generation.StartOfISTDay(time.Now())
		var today int64
		h.DB.Model(&models.Test{}).Where("owner_user_id = ? AND origin = 'generated' AND created_at >= ?", user.ID, start).Count(&today)
		left := settings.Int("custom_test.free_daily_generations") - int(today)
		if left < 0 {
			left = 0
		}
		quota["max_questions"], quota["daily_generations_left"], quota["daily_generations_limit"], quota["resets_at"] =
			settings.Int("custom_test.free_max_questions"), left, settings.Int("custom_test.free_daily_generations"), reset
	}

	key := courseID.String() + "|" + string(ent.Tier)
	h.mu.Lock()
	cached, ok := h.cfgCache[key]
	h.mu.Unlock()
	if ok && time.Since(cached.at) < 60*time.Second {
		out := gin.H{}
		for k, v := range cached.body {
			out[k] = v
		}
		out["entitlement"] = quota
		c.JSON(http.StatusOK, out)
		return
	}

	counts := h.Engine.PoolCounts(ctx, ent)
	type chNode struct {
		gin.H
	}
	var subjects []models.Subject
	h.DB.WithContext(ctx).Where("course_id = ?", courseID).Order("order_index ASC, name ASC").Find(&subjects)
	subIDs := make([]uuid.UUID, len(subjects))
	for i, s := range subjects {
		subIDs[i] = s.ID
	}
	var chapters []models.Chapter
	if len(subIDs) > 0 {
		h.DB.WithContext(ctx).Where("subject_id IN ?", subIDs).Order("order_index ASC, name ASC").Find(&chapters)
	}
	chIDs := make([]uuid.UUID, len(chapters))
	for i, ch := range chapters {
		chIDs[i] = ch.ID
	}
	var topics []models.Topic
	if len(chIDs) > 0 {
		h.DB.WithContext(ctx).Where("chapter_id IN ?", chIDs).Order("order_index ASC, name ASC").Find(&topics)
	}
	topicsBy := map[uuid.UUID][]gin.H{}
	for _, t := range topics {
		topicsBy[t.ChapterID] = append(topicsBy[t.ChapterID], gin.H{"id": t.ID, "name": t.Name, "available": counts.ByTopic[t.ID]})
	}
	chaptersBy := map[uuid.UUID][]gin.H{}
	for _, ch := range chapters {
		tp := topicsBy[ch.ID]
		if tp == nil {
			tp = []gin.H{}
		}
		chaptersBy[ch.SubjectID] = append(chaptersBy[ch.SubjectID], gin.H{"id": ch.ID, "name": ch.Name, "available": counts.ByChapter[ch.ID], "topics": tp})
	}
	subOut := make([]gin.H, len(subjects))
	for i, s := range subjects {
		chs := chaptersBy[s.ID]
		if chs == nil {
			chs = []gin.H{}
		}
		subOut[i] = gin.H{"id": s.ID, "name": s.Name, "available": counts.BySubject[s.ID], "chapters": chs}
	}
	diffOut := make([]gin.H, len(difficultyLabels))
	for i, d := range difficultyLabels {
		diffOut[i] = gin.H{"key": d["key"], "label": d["label"], "available": counts.ByDifficulty[d["key"].(string)]}
	}
	statusEnabled := settings.Bool("custom_test.status_filters")
	stOut := make([]gin.H, len(statusLabels))
	for i, s := range statusLabels {
		stOut[i] = gin.H{"key": s["key"], "label": s["label"], "supported": statusEnabled}
	}
	var srcOut []gin.H
	for _, sname := range settings.List("custom_test.eligible_sources") {
		srcOut = append(srcOut, gin.H{"key": sname, "label": sourceLabels[sname]})
	}
	var tagRows []struct {
		ID    uuid.UUID `json:"id"`
		Label string    `json:"label"`
		Uses  int       `json:"uses"`
	}
	h.DB.WithContext(ctx).Raw(`SELECT t.id, t.label, count(*) AS uses FROM tags t JOIN question_tags qt ON qt.tag_id = t.id
		WHERE t.alias_of IS NULL GROUP BY t.id, t.label ORDER BY uses DESC LIMIT 30`).Scan(&tagRows)
	var presets []models.CustomTestPreset
	h.DB.WithContext(ctx).Where("course_id = ? AND is_active = true", courseID).Order("order_index ASC, title ASC").Find(&presets)
	modes := []string{"exam"}
	if settings.Bool("custom_test.tutor_mode") {
		modes = append(modes, "tutor")
	}
	body := gin.H{
		"schema_version": blueprint.CurrentVersion, "course_id": courseID,
		"subjects": subOut, "difficulty": diffOut, "statuses": stOut, "sources": srcOut, "tags": tagRows,
		"total_available": counts.Total,
		"limits": gin.H{"min_questions": settings.Int("custom_test.min_questions"), "max_questions": settings.Int("custom_test.max_questions"),
			"min_duration_minutes": settings.Int("custom_test.min_duration_minutes"), "max_duration_minutes": settings.Int("custom_test.max_duration_minutes"),
			"suggested_minutes_per_question": 1},
		"modes":           modes,
		"marking_presets": []gin.H{{"key": "neet", "label": "NEET (+4 / −1)", "correct": 4, "wrong": -1}, {"key": "no_negative", "label": "No negative marking (+1 / 0)", "correct": 1, "wrong": 0}, {"key": "custom", "label": "Custom"}},
		"orders":          blueprint.Orders, "strategies": blueprint.Strategies,
		"presets": presets,
		"flags":   gin.H{"tutor_mode": settings.Bool("custom_test.tutor_mode"), "status_filters": statusEnabled},
	}
	h.mu.Lock()
	h.cfgCache[key] = cachedConfig{at: time.Now(), body: body}
	h.mu.Unlock()
	out := gin.H{}
	for k, v := range body {
		out[k] = v
	}
	out["entitlement"] = quota
	c.JSON(http.StatusOK, out)
}

// InvalidateConfig drops cached builder configs (called when questions are
// published or corrected).
func (h *CustomTestHandler) InvalidateConfig() {
	h.mu.Lock()
	h.cfgCache = map[string]cachedConfig{}
	h.mu.Unlock()
}

// ── Templates ─────────────────────────────────────────────────────────────────

type templateRequest struct {
	Title     *string          `json:"title"`
	Blueprint *json.RawMessage `json:"blueprint"`
}

func (h *CustomTestHandler) validateTemplate(c *gin.Context, raw json.RawMessage) (blueprint.Blueprint, bool) {
	bp, err := h.Engine.Prepare(c.Request.Context(), raw)
	if err != nil {
		respondService(c, err)
		return bp, false
	}
	return bp, true
}

// ListTemplates godoc
//
//	@Summary		My saved blueprints (templates)
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/custom-tests/templates [get]
func (h *CustomTestHandler) ListTemplates(c *gin.Context) {
	var ts []models.CustomTestTemplate
	h.DB.Where("user_id = ?", middleware.GetUser(c).ID).Order("updated_at DESC").Find(&ts)
	c.JSON(http.StatusOK, gin.H{"templates": ts})
}

// CreateTemplate godoc
//
//	@Summary		Save a blueprint as a template
//	@Description	The blueprint is validated like a generation request; users may keep a limited number of templates (default 30).
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		templateRequest	true	"Template"
//	@Success		201		{object}	models.CustomTestTemplate
//	@Router			/api/v1/custom-tests/templates [post]
func (h *CustomTestHandler) CreateTemplate(c *gin.Context) {
	user := middleware.GetUser(c)
	var req templateRequest
	if c.ShouldBindJSON(&req) != nil || req.Title == nil || req.Blueprint == nil || len([]rune(*req.Title)) < 1 || len([]rune(*req.Title)) > 80 {
		respondErr(c, http.StatusBadRequest, "bad_request", "title (1-80 chars) and blueprint are required")
		return
	}
	var n int64
	h.DB.Model(&models.CustomTestTemplate{}).Where("user_id = ?", user.ID).Count(&n)
	if int(n) >= settings.Int("custom_test.max_templates") {
		respondErr(c, http.StatusConflict, "too_many_templates", "you have reached the template limit")
		return
	}
	bp, ok := h.validateTemplate(c, *req.Blueprint)
	if !ok {
		return
	}
	t := models.CustomTestTemplate{UserID: user.ID, Title: *req.Title, Blueprint: bp.JSON()}
	h.DB.Create(&t)
	c.JSON(http.StatusCreated, t)
}

// UpdateTemplate godoc
//
//	@Summary		Rename or replace a template's blueprint
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Accept			json
//	@Param			id		path	string			true	"Template UUID"
//	@Param			body	body	templateRequest	true	"Fields"
//	@Success		200		{object}	models.CustomTestTemplate
//	@Router			/api/v1/custom-tests/templates/{id} [patch]
func (h *CustomTestHandler) UpdateTemplate(c *gin.Context) {
	var t models.CustomTestTemplate
	if h.DB.First(&t, "id = ? AND user_id = ?", c.Param("id"), middleware.GetUser(c).ID).Error != nil {
		respondErr(c, http.StatusNotFound, "template_not_found", "template not found")
		return
	}
	var req templateRequest
	if c.ShouldBindJSON(&req) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	up := map[string]interface{}{}
	if req.Title != nil {
		if len([]rune(*req.Title)) < 1 || len([]rune(*req.Title)) > 80 {
			respondErr(c, http.StatusBadRequest, "invalid_title", "title must be 1-80 characters")
			return
		}
		up["title"] = *req.Title
	}
	if req.Blueprint != nil {
		bp, ok := h.validateTemplate(c, *req.Blueprint)
		if !ok {
			return
		}
		up["blueprint"] = models.JSONB(bp.JSON())
	}
	h.DB.Model(&t).Updates(up)
	h.DB.First(&t, "id = ?", t.ID)
	c.JSON(http.StatusOK, t)
}

// DeleteTemplate godoc
//
//	@Summary		Delete a template
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Template UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/custom-tests/templates/{id} [delete]
func (h *CustomTestHandler) DeleteTemplate(c *gin.Context) {
	h.DB.Where("id = ? AND user_id = ?", c.Param("id"), middleware.GetUser(c).ID).Delete(&models.CustomTestTemplate{})
	c.JSON(http.StatusOK, messageResponse{Message: "template deleted"})
}

// ── Admin: presets + metrics ─────────────────────────────────────────────────

type presetRequest struct {
	CourseID    *string          `json:"course_id"`
	Title       *string          `json:"title"`
	Description *string          `json:"description"`
	Blueprint   *json.RawMessage `json:"blueprint"`
	OrderIndex  *int             `json:"order_index"`
	IsActive    *bool            `json:"is_active"`
}

// AdminListPresets godoc
//
//	@Summary		System presets (Admin)
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Produce		json
//	@Param			course_id	query	string	false	"Course UUID"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/admin/custom-test/presets [get]
func (h *CustomTestHandler) AdminListPresets(c *gin.Context) {
	q := h.DB.Model(&models.CustomTestPreset{})
	if v := c.Query("course_id"); v != "" {
		q = q.Where("course_id = ?", v)
	}
	var ps []models.CustomTestPreset
	q.Order("course_id, order_index, title").Find(&ps)
	c.JSON(http.StatusOK, gin.H{"presets": ps})
}

// AdminCreatePreset godoc
//
//	@Summary		Create a system preset (Admin)
//	@Description	Presets are data, not code: title, description and a blueprint validated exactly like a student's.
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		presetRequest	true	"Preset"
//	@Success		201		{object}	models.CustomTestPreset
//	@Router			/api/v1/admin/custom-test/presets [post]
func (h *CustomTestHandler) AdminCreatePreset(c *gin.Context) {
	admin := middleware.GetUser(c)
	var req presetRequest
	if c.ShouldBindJSON(&req) != nil || req.CourseID == nil || req.Title == nil || req.Blueprint == nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "course_id, title and blueprint are required")
		return
	}
	cid, err := uuid.Parse(*req.CourseID)
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid course_id")
		return
	}
	// the blueprint's own course must match the preset's course
	var probe map[string]interface{}
	_ = json.Unmarshal(*req.Blueprint, &probe)
	probe["course_id"] = cid.String()
	raw, _ := json.Marshal(probe)
	bp, prepErr := h.Engine.Prepare(c.Request.Context(), raw)
	if prepErr != nil {
		respondService(c, prepErr)
		return
	}
	p := models.CustomTestPreset{CourseID: cid, Title: *req.Title, Blueprint: bp.JSON(), IsActive: true}
	if req.Description != nil {
		p.Description = *req.Description
	}
	if req.OrderIndex != nil {
		p.OrderIndex = *req.OrderIndex
	}
	h.DB.Create(&p)
	h.DB.Create(&models.AdminAuditLog{ActorID: admin.ID, Action: "preset.create", Target: "preset:" + p.ID.String()})
	h.InvalidateConfig()
	c.JSON(http.StatusCreated, p)
}

// AdminUpdatePreset godoc
//
//	@Summary		Update a system preset (Admin)
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Accept			json
//	@Param			id		path	string			true	"Preset UUID"
//	@Param			body	body	presetRequest	true	"Fields"
//	@Success		200		{object}	models.CustomTestPreset
//	@Router			/api/v1/admin/custom-test/presets/{id} [patch]
func (h *CustomTestHandler) AdminUpdatePreset(c *gin.Context) {
	admin := middleware.GetUser(c)
	var p models.CustomTestPreset
	if h.DB.First(&p, "id = ?", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "preset_not_found", "preset not found")
		return
	}
	var req presetRequest
	if c.ShouldBindJSON(&req) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	up := map[string]interface{}{}
	if req.Title != nil {
		up["title"] = *req.Title
	}
	if req.Description != nil {
		up["description"] = *req.Description
	}
	if req.OrderIndex != nil {
		up["order_index"] = *req.OrderIndex
	}
	if req.IsActive != nil {
		up["is_active"] = *req.IsActive
	}
	if req.Blueprint != nil {
		var probe map[string]interface{}
		_ = json.Unmarshal(*req.Blueprint, &probe)
		probe["course_id"] = p.CourseID.String()
		raw, _ := json.Marshal(probe)
		bp, err := h.Engine.Prepare(c.Request.Context(), raw)
		if err != nil {
			respondService(c, err)
			return
		}
		up["blueprint"] = models.JSONB(bp.JSON())
	}
	h.DB.Model(&p).Updates(up)
	h.DB.Create(&models.AdminAuditLog{ActorID: admin.ID, Action: "preset.update", Target: "preset:" + p.ID.String()})
	h.DB.First(&p, "id = ?", p.ID)
	h.InvalidateConfig()
	c.JSON(http.StatusOK, p)
}

// AdminDeletePreset godoc
//
//	@Summary		Delete a system preset (Admin)
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Preset UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/admin/custom-test/presets/{id} [delete]
func (h *CustomTestHandler) AdminDeletePreset(c *gin.Context) {
	h.DB.Delete(&models.CustomTestPreset{}, "id = ?", c.Param("id"))
	h.DB.Create(&models.AdminAuditLog{ActorID: middleware.GetUser(c).ID, Action: "preset.delete", Target: "preset:" + c.Param("id")})
	h.InvalidateConfig()
	c.JSON(http.StatusOK, messageResponse{Message: "preset deleted"})
}

// AdminMetrics godoc
//
//	@Summary		Custom-test health metrics (Admin)
//	@Description	Process-local generation counters (latency, relaxations, empty-pool rejections) plus database-derived figures for the last 24 h: generated tests, auto-submitted attempts, questions held under review, rejected uploads, open reports.
//	@Tags			CustomTests
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/admin/custom-test/metrics [get]
func (h *CustomTestHandler) AdminMetrics(c *gin.Context) {
	since := time.Now().Add(-24 * time.Hour)
	var generated, autoSubmitted, held, rejected, openReports, active int64
	h.DB.Model(&models.Test{}).Where("origin = 'generated' AND created_at > ?", since).Count(&generated)
	h.DB.Model(&models.StudentAttempt{}).Where("auto_submitted = true AND submitted_at > ?", since).Count(&autoSubmitted)
	h.DB.Model(&models.Question{}).Where("flag_status = ?", models.FlagUnderReview).Count(&held)
	h.DB.Model(&models.MediaAsset{}).Where("status = ? AND created_at > ?", models.MediaRejected, since).Count(&rejected)
	h.DB.Model(&models.ContentReport{}).Where("status = 'open'").Count(&openReports)
	h.DB.Model(&models.Test{}).Where("origin = 'generated' AND archived_at IS NULL").Count(&active)
	c.JSON(http.StatusOK, gin.H{
		"process":  generation.Metrics.Snapshot(),
		"last_24h": gin.H{"generated_tests": generated, "auto_submitted_attempts": autoSubmitted, "rejected_uploads": rejected},
		"now":      gin.H{"active_generated_tests": active, "questions_under_review": held, "open_reports": openReports},
	})
}
