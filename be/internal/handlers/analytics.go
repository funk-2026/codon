package handlers

import (
	"net/http"
	"strings"
	"time"

	"codon-backend/internal/generation"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/services"
	"codon-backend/internal/settings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AnalyticsHandler serves the learning-analytics views (mastery, coverage,
// weak areas, trend, recommendations) and question/pool statistics.
type AnalyticsHandler struct {
	DB     *gorm.DB
	Engine *generation.Engine
}

func NewAnalyticsHandler(db *gorm.DB, eng *generation.Engine) *AnalyticsHandler {
	return &AnalyticsHandler{DB: db, Engine: eng}
}

type masteryRow struct {
	ChapterID     *uuid.UUID `json:"chapter_id"`
	Chapter       string     `json:"chapter"`
	SubjectID     *uuid.UUID `json:"subject_id"`
	Subject       string     `json:"subject"`
	Questions     int        `json:"questions_attempted"`
	Answers       int        `json:"answers"`
	Correct       int        `json:"correct"`
	Accuracy      float64    `json:"accuracy"`
	LastPractised *time.Time `json:"last_practised"`
	Bucket        string     `json:"bucket"`
}

func bucketOf(answers int, acc float64) string {
	if answers < settings.Int("analytics.min_answers") {
		return "not_enough_data"
	}
	switch {
	case acc < settings.Float("analytics.weak_accuracy_threshold"):
		return "weak"
	case acc < 0.75:
		return "improving"
	}
	return "strong"
}

func (h *AnalyticsHandler) mastery(c *gin.Context, userID uuid.UUID, topics bool) []masteryRow {
	var rows []masteryRow
	group := "q.chapter_id, ch.name, q.subject_id, sub.name"
	sel := "q.chapter_id AS chapter_id, COALESCE(ch.name, 'Unspecified') AS chapter, q.subject_id AS subject_id, COALESCE(sub.name, 'Unspecified') AS subject,"
	if topics {
		group += ", q.topic_id, tp.name"
		sel += " COALESCE(tp.name, 'General') AS topic,"
	}
	_ = topics
	q := h.DB.WithContext(c.Request.Context()).Table("student_question_states s").
		Joins("JOIN questions q ON q.id = s.question_id").
		Joins("LEFT JOIN chapters ch ON ch.id = q.chapter_id").
		Joins("LEFT JOIN subjects sub ON sub.id = q.subject_id").
		Where("s.user_id = ? AND s.times_answered > 0", userID)
	if topics {
		q = q.Joins("LEFT JOIN topics tp ON tp.id = q.topic_id")
	}
	if v := c.Query("subject_id"); v != "" {
		q = q.Where("q.subject_id = ?", v)
	}
	q.Select(strings.TrimSuffix(sel, ",") + `,
		count(*) AS questions, sum(s.times_answered) AS answers, sum(s.times_correct) AS correct,
		max(s.last_answered_at) AS last_practised`).
		Group(group).Order("subject, chapter").Scan(&rows)
	for i := range rows {
		if rows[i].Answers > 0 {
			rows[i].Accuracy = float64(rows[i].Correct) / float64(rows[i].Answers)
		}
		rows[i].Bucket = bucketOf(rows[i].Answers, rows[i].Accuracy)
	}
	if rows == nil {
		rows = []masteryRow{}
	}
	return rows
}

// Mastery godoc
//
//	@Summary		Topic mastery map
//	@Description	Per chapter: how many distinct questions the student has answered, total answers, accuracy (correct ÷ answered), last practised date and a bucket — weak / improving / strong / not_enough_data (thresholds and minimum sample come from settings).
//	@Tags			Analytics
//	@Security		BearerAuth
//	@Produce		json
//	@Param			subject_id	query		string	false	"Restrict to a subject"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/me/analytics/mastery [get]
func (h *AnalyticsHandler) Mastery(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"chapters": h.mastery(c, middleware.GetUser(c).ID, false)})
}

// Coverage godoc
//
//	@Summary		How much of the question bank the student has seen
//	@Description	Distinct questions answered ÷ eligible questions, overall and per subject, for one course (entitlement-aware: free students are measured against the free pool).
//	@Tags			Analytics
//	@Security		BearerAuth
//	@Produce		json
//	@Param			course_id	query		string	true	"Course UUID"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/me/analytics/coverage [get]
func (h *AnalyticsHandler) Coverage(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	courseID, err := uuid.Parse(c.Query("course_id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "course_id is required")
		return
	}
	ent := h.Engine.EntitlementFor(ctx, user, courseID)
	pool := h.Engine.PoolCounts(ctx, ent)
	var seen []struct {
		SubjectID *uuid.UUID
		N         int
	}
	pq := h.DB.WithContext(ctx).Table("student_question_states s").
		Joins("JOIN questions q ON q.id = s.question_id").Joins("JOIN tests t ON t.id = q.test_id").
		Where("s.user_id = ? AND s.times_answered > 0 AND t.course_id = ? AND t.origin = 'authored'", user.ID, courseID)
	if ent.Tier == generation.TierFree {
		pq = pq.Where("t.requires_subscription = false")
	}
	pq.Select("q.subject_id, count(*) AS n").Group("q.subject_id").Scan(&seen)
	seenBy := map[uuid.UUID]int{}
	total := 0
	for _, s := range seen {
		total += s.N
		if s.SubjectID != nil {
			seenBy[*s.SubjectID] = s.N
		}
	}
	var subs []models.Subject
	h.DB.WithContext(ctx).Where("course_id = ?", courseID).Order("order_index, name").Find(&subs)
	out := make([]gin.H, len(subs))
	for i, s := range subs {
		avail := pool.BySubject[s.ID]
		pct := 0.0
		if avail > 0 {
			pct = float64(seenBy[s.ID]) / float64(avail)
		}
		out[i] = gin.H{"subject_id": s.ID, "subject": s.Name, "seen": seenBy[s.ID], "available": avail, "pct": pct}
	}
	pct := 0.0
	if pool.Total > 0 {
		pct = float64(total) / float64(pool.Total)
	}
	c.JSON(http.StatusOK, gin.H{"seen": total, "available": pool.Total, "pct": pct, "subjects": out})
}

// WeakAreas godoc
//
//	@Summary		Weak areas with a one-tap practice suggestion
//	@Description	Chapters where the student has answered at least `analytics.min_answers` questions with accuracy below `analytics.weak_accuracy_threshold`, weakest first. Each carries a ready-to-use blueprint patch.
//	@Tags			Analytics
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/me/analytics/weak-areas [get]
func (h *AnalyticsHandler) WeakAreas(c *gin.Context) {
	rows := h.mastery(c, middleware.GetUser(c).ID, false)
	type weak struct {
		masteryRow
		Suggestion gin.H `json:"suggestion"`
	}
	out := []weak{}
	for _, r := range rows {
		if r.Bucket != "weak" || r.ChapterID == nil {
			continue
		}
		out = append(out, weak{r, gin.H{"label": "Practise " + r.Chapter,
			"patch": gin.H{"count": 15, "strategy": "weak_first", "filters": gin.H{"chapter_ids": []uuid.UUID{*r.ChapterID}}}}})
	}
	for i := 0; i < len(out); i++ { // weakest first
		for j := i + 1; j < len(out); j++ {
			if out[j].Accuracy < out[i].Accuracy {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"weak_areas": out})
}

// Trend godoc
//
//	@Summary		Score trend over the last attempts
//	@Description	Percentage score (score ÷ total marks) of the last N (default 20, max 100) submitted attempts, oldest first, optionally for one module.
//	@Tags			Analytics
//	@Security		BearerAuth
//	@Produce		json
//	@Param			module	query		string	false	"qbank|test_series|practice|custom"
//	@Param			limit	query		int		false	"Default 20"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/me/analytics/trend [get]
func (h *AnalyticsHandler) Trend(c *gin.Context) {
	user := middleware.GetUser(c)
	limit := 20
	if n := c.Query("limit"); n != "" {
		if v := atoiDefault(n, 20); v > 0 && v <= 100 {
			limit = v
		}
	}
	mod, args := "", []interface{}{user.ID, limit}
	if m := c.Query("module"); m != "" {
		mod = " AND t.module_type = ?"
		args = []interface{}{user.ID, m, limit}
	}
	var pts []struct {
		AttemptID   uuid.UUID  `json:"attempt_id"`
		TestID      uuid.UUID  `json:"test_id"`
		Title       string     `json:"title"`
		Module      string     `json:"module"`
		Pct         float64    `json:"pct"`
		SubmittedAt *time.Time `json:"submitted_at"`
	}
	h.DB.WithContext(c.Request.Context()).Raw(`SELECT * FROM (
		SELECT sa.id AS attempt_id, t.id AS test_id, t.title, t.module_type AS module,
		       CASE WHEN sa.total_marks > 0 THEN (sa.score / sa.total_marks) * 100 ELSE 0 END AS pct, sa.submitted_at
		FROM student_attempts sa JOIN tests t ON t.id = sa.test_id
		WHERE sa.user_id = ? AND sa.status = 'submitted' AND sa.score IS NOT NULL`+mod+`
		ORDER BY sa.submitted_at DESC NULLS LAST LIMIT ?) x ORDER BY submitted_at ASC NULLS LAST`, args...).Scan(&pts)
	if pts == nil {
		pts = []struct {
			AttemptID   uuid.UUID  `json:"attempt_id"`
			TestID      uuid.UUID  `json:"test_id"`
			Title       string     `json:"title"`
			Module      string     `json:"module"`
			Pct         float64    `json:"pct"`
			SubmittedAt *time.Time `json:"submitted_at"`
		}{}
	}
	c.JSON(http.StatusOK, gin.H{"points": pts})
}

func atoiDefault(s string, d int) int {
	n := 0
	for _, r := range s {
		if r < '0' || r > '9' {
			return d
		}
		n = n*10 + int(r-'0')
	}
	return n
}

// Recommendations godoc
//
//	@Summary		Rule-based practice suggestions
//	@Description	Up to 3 suggestions, each with a title, reason and a blueprint patch the app can pre-fill: revisit the weakest chapter; work through questions due for spaced revision; or (for new students) start with unseen questions.
//	@Tags			Analytics
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/me/recommendations [get]
func (h *AnalyticsHandler) Recommendations(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"recommendations": h.recommend(c, middleware.GetUser(c))})
}

// recommend builds the rule-based suggestion list (shared with Explore).
func (h *AnalyticsHandler) recommend(c *gin.Context, user *models.User) []gin.H {
	ctx := c.Request.Context()
	recs := []gin.H{}
	rows := h.mastery(c, user.ID, false)
	var weakest *masteryRow
	for i := range rows {
		if rows[i].Bucket == "weak" && rows[i].ChapterID != nil && (weakest == nil || rows[i].Accuracy < weakest.Accuracy) {
			weakest = &rows[i]
		}
	}
	if weakest != nil {
		recs = append(recs, gin.H{"code": "weak_chapter", "title": "Strengthen " + weakest.Chapter,
			"reason": "Your accuracy here is " + pct(weakest.Accuracy) + " over " + itoa(weakest.Answers) + " answers.",
			"patch":  gin.H{"count": 15, "strategy": "weak_first", "filters": gin.H{"chapter_ids": []uuid.UUID{*weakest.ChapterID}}}})
	}
	var due int64
	h.DB.WithContext(ctx).Model(&models.StudentQuestionState{}).Where("user_id = ? AND srs_due_at IS NOT NULL AND srs_due_at <= ?", user.ID, time.Now()).Count(&due)
	if due > 0 {
		recs = append(recs, gin.H{"code": "due_for_revision", "title": "Revise what's due",
			"reason": itoa(int(due)) + " questions are due for revision.", "patch": gin.H{"count": 20, "strategy": "spaced"}})
	}
	var answered int64
	h.DB.WithContext(ctx).Model(&models.StudentQuestionState{}).Where("user_id = ? AND times_answered > 0", user.ID).Count(&answered)
	if answered < 20 {
		recs = append(recs, gin.H{"code": "start_fresh", "title": "Start with fresh questions",
			"reason": "Build a baseline — 20 questions you haven't seen.", "patch": gin.H{"count": 20, "strategy": "unseen_first"}})
	}
	if len(recs) > 3 {
		recs = recs[:3]
	}
	return recs
}

func pct(f float64) string { return itoa(int(f*100+0.5)) + "%" }
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b []byte
	for n > 0 {
		b = append([]byte{byte('0' + n%10)}, b...)
		n /= 10
	}
	if neg {
		b = append([]byte{'-'}, b...)
	}
	return string(b)
}

// ── Question stats (teacher) ─────────────────────────────────────────────────

// QuestionStats godoc
//
//	@Summary		Cohort statistics for one of my questions (Teacher)
//	@Description	Attempts, correct, accuracy, average time, open reports and an empirical difficulty — shown only once at least `analytics.cohort_min_attempts` students answered it. Outlier flags: `low_accuracy` (< 20 % with n ≥ 50 — likely a wrong key) and `too_easy` (> 95 %).
//	@Tags			Analytics
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Question UUID"
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/teacher/questions/{id}/stats [get]
func (h *AnalyticsHandler) QuestionStats(c *gin.Context) {
	user := middleware.GetUser(c)
	var q models.Question
	if h.DB.First(&q, "id = ?", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "question_not_found", "question not found")
		return
	}
	var t models.Test
	tq := h.DB.Where("id = ?", q.TestID)
	if !canManageAllTests(user) {
		tq = tq.Where("created_by = ?", user.ID)
	}
	if tq.First(&t).Error != nil {
		respondErr(c, http.StatusNotFound, "question_not_found", "question not found")
		return
	}
	var st models.QuestionStats
	h.DB.First(&st, "question_id = ?", q.ID)
	min := settings.Int("analytics.cohort_min_attempts")
	out := gin.H{"question_id": q.ID, "attempts": st.Attempts, "sufficient_data": st.Attempts >= min, "min_attempts": min,
		"open_reports": st.ReportCount, "authored_difficulty": q.Difficulty}
	if st.Attempts >= min {
		acc := float64(st.Correct) / float64(st.Attempts)
		out["correct"], out["accuracy"] = st.Correct, acc
		if st.TimedAnswers > 0 {
			out["avg_time_seconds"] = float64(st.TotalTimeSeconds) / float64(st.TimedAnswers)
		}
		out["empirical_difficulty"] = empiricalDifficulty(acc)
		flags := []string{}
		if st.Attempts >= 50 && acc < 0.2 {
			flags = append(flags, "low_accuracy")
		}
		if st.Attempts >= 50 && acc > 0.95 {
			flags = append(flags, "too_easy")
		}
		out["flags"] = flags
	}
	c.JSON(http.StatusOK, out)
}

func empiricalDifficulty(acc float64) string {
	switch {
	case acc >= 0.7:
		return "easy"
	case acc >= 0.4:
		return "medium"
	}
	return "hard"
}

// ── Pool health ───────────────────────────────────────────────────────────────

type poolRow struct {
	CourseID     uuid.UUID  `json:"course_id"`
	SubjectID    *uuid.UUID `json:"subject_id"`
	Subject      string     `json:"subject"`
	ChapterID    *uuid.UUID `json:"chapter_id"`
	Chapter      string     `json:"chapter"`
	Eligible     int        `json:"eligible"`
	Easy         int        `json:"easy"`
	Medium       int        `json:"medium"`
	Hard         int        `json:"hard"`
	Unrated      int        `json:"no_difficulty"`
	MissingTopic int        `json:"missing_topic"`
	MissingTags  int        `json:"missing_tags"`
	MissingNCERT int        `json:"missing_ncert"`
	UnderReview  int        `json:"under_review"`
	OpenReports  int        `json:"open_reports"`
	LowInventory bool       `json:"low_inventory"`
}

func (h *AnalyticsHandler) poolRows(c *gin.Context, teacherScope *models.User) []poolRow {
	q := h.DB.WithContext(c.Request.Context()).Table("chapters ch").
		Joins("JOIN subjects sub ON sub.id = ch.subject_id").
		Joins(`LEFT JOIN (SELECT q.* FROM questions q JOIN tests t ON t.id = q.test_id
			WHERE t.status = 'published' AND t.origin = 'authored' AND t.archived_at IS NULL AND q.source_type IN ?`+scopeSQL(teacherScope)+`) q ON q.chapter_id = ch.id`,
			append([]interface{}{settings.List("custom_test.eligible_sources")}, scopeArgs(teacherScope)...)...)
	if v := c.Query("course_id"); v != "" {
		q = q.Where("sub.course_id = ?", v)
	}
	var rows []poolRow
	q.Select(`sub.course_id AS course_id, sub.id AS subject_id, sub.name AS subject, ch.id AS chapter_id, ch.name AS chapter,
		count(q.id) FILTER (WHERE q.custom_eligible AND q.flag_status = 'active') AS eligible,
		count(q.id) FILTER (WHERE q.custom_eligible AND q.flag_status = 'active' AND q.difficulty = 'easy') AS easy,
		count(q.id) FILTER (WHERE q.custom_eligible AND q.flag_status = 'active' AND q.difficulty = 'medium') AS medium,
		count(q.id) FILTER (WHERE q.custom_eligible AND q.flag_status = 'active' AND q.difficulty = 'hard') AS hard,
		count(q.id) FILTER (WHERE q.custom_eligible AND q.flag_status = 'active' AND q.difficulty IS NULL) AS unrated,
		count(q.id) FILTER (WHERE q.topic_id IS NULL) AS missing_topic,
		count(q.id) FILTER (WHERE NOT EXISTS (SELECT 1 FROM question_tags qt WHERE qt.question_id = q.id)) AS missing_tags,
		count(q.id) FILTER (WHERE q.ncert_page IS NULL) AS missing_ncert,
		count(q.id) FILTER (WHERE q.flag_status = 'under_review') AS under_review,
		count(q.id) FILTER (WHERE EXISTS (SELECT 1 FROM content_reports r WHERE r.item_type = 'question' AND r.item_id = q.id AND r.status = 'open')) AS open_reports`).
		Group("sub.course_id, sub.id, sub.name, sub.order_index, ch.id, ch.name, ch.order_index").
		Order("sub.order_index, sub.name, ch.order_index, ch.name").Scan(&rows)
	floor := settings.Int("pool.low_inventory_floor")
	for i := range rows {
		rows[i].LowInventory = rows[i].Eligible < floor
	}
	if rows == nil {
		rows = []poolRow{}
	}
	return rows
}

func scopeSQL(u *models.User) string {
	if u == nil || canManageAllTests(u) {
		return ""
	}
	return " AND t.created_by = ?"
}
func scopeArgs(u *models.User) []interface{} {
	if u == nil || canManageAllTests(u) {
		return nil
	}
	return []interface{}{u.ID}
}

// PoolHealth godoc
//
//	@Summary		Question-pool health by chapter (Admin)
//	@Description	Eligible question counts per subject/chapter with difficulty split, metadata completeness (missing topic/tags/NCERT/difficulty), questions under review, open reports and a `low_inventory` alert below `pool.low_inventory_floor`.
//	@Tags			Analytics
//	@Security		BearerAuth
//	@Produce		json
//	@Param			course_id	query		string	false	"Course UUID"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/admin/pool-health [get]
func (h *AnalyticsHandler) PoolHealth(c *gin.Context) {
	rows := h.poolRows(c, nil)
	low := 0
	total := 0
	for _, r := range rows {
		total += r.Eligible
		if r.LowInventory {
			low++
		}
	}
	c.JSON(http.StatusOK, gin.H{"chapters": rows, "totals": gin.H{"eligible": total, "low_inventory_chapters": low, "floor": settings.Int("pool.low_inventory_floor")}})
}

// Inventory godoc
//
//	@Summary		Which chapters need more questions (Teacher)
//	@Description	The chapters with the fewest eligible questions (below the inventory floor), scoped to the teacher's own questions unless they have platform-wide permission — so authors fill real gaps.
//	@Tags			Analytics
//	@Security		BearerAuth
//	@Produce		json
//	@Param			course_id	query		string	false	"Course UUID"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/teacher/inventory [get]
func (h *AnalyticsHandler) Inventory(c *gin.Context) {
	user := middleware.GetUser(c)
	// gaps are measured against the WHOLE pool; "mine" is the teacher's own contribution
	all := h.poolRows(c, nil)
	mine := h.poolRows(c, user)
	mineBy := map[uuid.UUID]int{}
	for _, m := range mine {
		if m.ChapterID != nil {
			mineBy[*m.ChapterID] = m.Eligible
		}
	}
	out := []gin.H{}
	for _, r := range all {
		if r.LowInventory && r.ChapterID != nil {
			out = append(out, gin.H{"course_id": r.CourseID, "subject": r.Subject, "chapter_id": r.ChapterID, "chapter": r.Chapter, "eligible": r.Eligible, "mine": mineBy[*r.ChapterID],
				"needed": settings.Int("pool.low_inventory_floor") - r.Eligible})
		}
	}
	for i := 0; i < len(out); i++ {
		for j := i + 1; j < len(out); j++ {
			if out[j]["eligible"].(int) < out[i]["eligible"].(int) {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	if len(out) > 20 {
		out = out[:20]
	}
	c.JSON(http.StatusOK, gin.H{"low_inventory": out, "floor": settings.Int("pool.low_inventory_floor")})
}

// ── Question notes ────────────────────────────────────────────────────────────

type noteRequest struct {
	Body string `json:"body"`
}

// PutNote godoc
//
//	@Summary		Save my private note on a question
//	@Description	Private to the student, up to 4000 characters of plain text/markdown (no images in v1). Only for questions the student has been shown.
//	@Tags			Notes
//	@Security		BearerAuth
//	@Accept			json
//	@Param			question_id	path	string		true	"Question UUID"
//	@Param			body		body	noteRequest	true	"Note"
//	@Success		200			{object}	models.QuestionNote
//	@Router			/api/v1/me/question-notes/{question_id} [put]
func (h *AnalyticsHandler) PutNote(c *gin.Context) {
	user := middleware.GetUser(c)
	qid, err := uuid.Parse(c.Param("question_id"))
	var req noteRequest
	if err != nil || c.ShouldBindJSON(&req) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "valid question id and body required")
		return
	}
	body := strings.TrimSpace(req.Body)
	if body == "" || len([]rune(body)) > 4000 {
		respondErr(c, http.StatusBadRequest, "invalid_body", "note must be 1-4000 characters")
		return
	}
	if strings.Contains(body, "](media:") {
		respondErr(c, http.StatusBadRequest, "images_not_supported", "images in notes are not supported yet")
		return
	}
	var n int64
	h.DB.Table("attempt_answers aa").Joins("JOIN student_attempts sa ON sa.id = aa.attempt_id").
		Where("sa.user_id = ? AND aa.question_id = ?", user.ID, qid).Count(&n)
	if n == 0 {
		respondErr(c, http.StatusForbidden, "not_exposed", "you can only add notes to questions you have seen")
		return
	}
	note := models.QuestionNote{UserID: user.ID, QuestionID: qid, Body: body}
	h.DB.Where(models.QuestionNote{UserID: user.ID, QuestionID: qid}).Assign(models.QuestionNote{Body: body}).FirstOrCreate(&note)
	c.JSON(http.StatusOK, note)
}

// ListNotes godoc
//
//	@Summary		My question notes
//	@Tags			Notes
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/me/question-notes [get]
func (h *AnalyticsHandler) ListNotes(c *gin.Context) {
	var ns []models.QuestionNote
	h.DB.Where("user_id = ?", middleware.GetUser(c).ID).Order("updated_at DESC").Limit(200).Find(&ns)
	c.JSON(http.StatusOK, gin.H{"notes": ns})
}

// DeleteNote godoc
//
//	@Summary		Delete my note on a question
//	@Tags			Notes
//	@Security		BearerAuth
//	@Param			question_id	path	string	true	"Question UUID"
//	@Success		200			{object}	messageResponse
//	@Router			/api/v1/me/question-notes/{question_id} [delete]
func (h *AnalyticsHandler) DeleteNote(c *gin.Context) {
	h.DB.Where("user_id = ? AND question_id = ?", middleware.GetUser(c).ID, c.Param("question_id")).Delete(&models.QuestionNote{})
	c.JSON(http.StatusOK, messageResponse{Message: "note deleted"})
}

// ── Personal-data purge (Admin) ───────────────────────────────────────────────

// PurgePersonalData godoc
//
//	@Summary		Erase a user's personal study data (Admin)
//	@Description	Deletes bookmarks, notes, ratings, reports they filed, templates, generated custom tests (with their attempts), question state, flashcard state, video notes, push tokens and notifications. Account/profile, payments and authored content are untouched. Audit-logged.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Param			id	path	string	true	"User UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/admin/users/{id}/purge-personal-data [post]
func (h *AnalyticsHandler) PurgePersonalData(c *gin.Context) {
	admin := middleware.GetUser(c)
	uid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid user id")
		return
	}
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		if err := services.PurgePersonalData(tx, uid); err != nil {
			return err
		}
		return tx.Create(&models.AdminAuditLog{ActorID: admin.ID, Action: "user.purge_personal_data", Target: "user:" + uid.String()}).Error
	})
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "purge failed")
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "personal data erased"})
}
