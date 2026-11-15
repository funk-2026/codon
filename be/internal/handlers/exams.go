package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"codon-backend/internal/httpx"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ExamHandler serves the student Tests tab, results, leaderboards and analysis, and the admin exam tools.
type ExamHandler struct {
	DB  *gorm.DB
	Sub *services.SubscriptionService
}

func NewExamHandler(db *gorm.DB, sub *services.SubscriptionService) *ExamHandler {
	return &ExamHandler{DB: db, Sub: sub}
}

// ── Shared: who is in the cohort ────────────────────────────────────────────

type cohortRow struct {
	UserID  uuid.UUID
	Score   float64
	Name    *string
	OptOut  bool
	Seconds int
}

// examCohort is everyone whose official attempt counts for ranking this test: the first attempt of each student,
// and for a live test only attempts that started inside the live window. Admins' test drives are left out.
func examCohort(ctx context.Context, db *gorm.DB, test *models.Test) []cohortRow {
	var rows []cohortRow
	db.WithContext(ctx).Raw(`
		SELECT a.user_id, a.score::float8 AS score, u.name, u.leaderboard_opt_out AS opt_out, COALESCE(a.time_taken_seconds, 0) AS seconds
		FROM student_attempts a JOIN users u ON u.id = a.user_id
		WHERE a.test_id = ? AND a.status = 'submitted' AND a.official AND a.score IS NOT NULL AND u.role = 'student'
		  AND (? <> 'live' OR a.source = 'live')
		ORDER BY a.score DESC, seconds ASC`, test.ID, test.Delivery).Scan(&rows)
	return rows
}

// rankIn gives the rank of a score in a cohort sorted by score descending: ties share a rank.
func rankIn(rows []cohortRow, score float64) int {
	better := 0
	for _, r := range rows {
		if r.Score > score {
			better++
		}
	}
	return better + 1
}

// shortName is "Arjun S." for a leaderboard: first name and last initial, never the full name.
func shortName(n *string) string {
	if n == nil {
		return "Student"
	}
	parts := strings.Fields(*n)
	switch len(parts) {
	case 0:
		return "Student"
	case 1:
		return parts[0]
	}
	last := []rune(parts[len(parts)-1])
	return parts[0] + " " + strings.ToUpper(string(last[0])) + "."
}

// rankLocked is true when the test shows rank to subscribers only and this student is not one.
func (h *ExamHandler) rankLocked(ctx context.Context, user *models.User, t *models.Test) bool {
	if t.RankVisibility != models.RankSubscribers {
		return false
	}
	return h.Sub.Allow(ctx, user, true, t.CourseID) != nil
}

// ── Student: the Tests tab ──────────────────────────────────────────────────

type examSeriesRef struct {
	ID    uuid.UUID `json:"id"`
	Title string    `json:"title"`
}

type examMyAttempt struct {
	ID          uuid.UUID  `json:"id"`
	Status      string     `json:"status"`
	Official    bool       `json:"official"`
	SubmittedAt *time.Time `json:"submitted_at,omitempty"`
}

type examCard struct {
	ID                   uuid.UUID      `json:"id"`
	Title                string         `json:"title"`
	Kind                 string         `json:"kind"`
	ExamStyle            string         `json:"exam_style"`
	Delivery             string         `json:"delivery"`
	Phase                string         `json:"phase"`
	OpensAt              *time.Time     `json:"opens_at,omitempty"`
	LastStartAt          *time.Time     `json:"last_start_at,omitempty"`
	EndsAt               *time.Time     `json:"ends_at,omitempty"`
	ResultsAt            *time.Time     `json:"results_at,omitempty"`
	ResultsReleased      bool           `json:"results_released"`
	LateEntryMinutes     int            `json:"late_entry_minutes"`
	DurationMinutes      *int           `json:"duration_minutes,omitempty"`
	TotalQuestions       int            `json:"total_questions"`
	RequiresSubscription bool           `json:"requires_subscription"`
	CourseID             uuid.UUID      `json:"course_id"`
	ExamYear             *int           `json:"exam_year,omitempty"`
	AuthorName           *string        `json:"author_name,omitempty"`
	Series               *examSeriesRef `json:"series,omitempty"`
	Registered           bool           `json:"registered"`
	MyAttempt            *examMyAttempt `json:"my_attempt,omitempty"`
}

// Exams lists the published tests (Test Series module) with where each one stands for this student.
func (h *ExamHandler) Exams(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	q := h.DB.WithContext(ctx).Where("module_type = ? AND status = ? AND origin = ? AND archived_at IS NULL",
		models.ModuleTestSeries, models.StatusPublished, models.OriginAuthored)
	if cid := c.Query("course_id"); cid != "" {
		q = q.Where("course_id = ?", cid)
	}
	var tests []models.Test
	q.Order("opens_at DESC NULLS LAST, created_at DESC").Limit(200).Find(&tests)

	ids := make([]uuid.UUID, len(tests))
	creators := make([]uuid.UUID, len(tests))
	var seriesIDs []uuid.UUID
	for i, t := range tests {
		ids[i], creators[i] = t.ID, t.CreatedBy
		if t.SeriesID != nil {
			seriesIDs = append(seriesIDs, *t.SeriesID)
		}
	}
	authors := authorNames(h.DB.WithContext(ctx), creators)
	series := map[uuid.UUID]examSeriesRef{}
	if len(seriesIDs) > 0 {
		var ss []models.TestSeries
		h.DB.WithContext(ctx).Where("id IN ?", seriesIDs).Find(&ss)
		for _, s := range ss {
			series[s.ID] = examSeriesRef{ID: s.ID, Title: s.Title}
		}
	}
	registered := map[uuid.UUID]bool{}
	mine := map[uuid.UUID]examMyAttempt{}
	if len(ids) > 0 {
		var regs []models.TestRegistration
		h.DB.WithContext(ctx).Where("user_id = ? AND test_id IN ?", user.ID, ids).Find(&regs)
		for _, r := range regs {
			registered[r.TestID] = true
		}
		var atts []models.StudentAttempt
		h.DB.WithContext(ctx).Select("id", "test_id", "status", "official", "submitted_at", "started_at").
			Where("user_id = ? AND test_id IN ?", user.ID, ids).Order("started_at ASC").Find(&atts)
		for _, a := range atts { // later attempts replace earlier ones, but the official one and an unfinished one win
			cur, has := mine[a.TestID]
			if has && (cur.Official || cur.Status == string(models.AttemptInProgress)) && !(a.Status == models.AttemptInProgress) {
				continue
			}
			mine[a.TestID] = examMyAttempt{ID: a.ID, Status: string(a.Status), Official: a.Official, SubmittedAt: a.SubmittedAt}
		}
	}
	now := time.Now()
	cards := make([]examCard, 0, len(tests))
	for i := range tests {
		t := &tests[i]
		if !visibleToUser(t, user.ID) {
			continue
		}
		card := examCard{
			ID: t.ID, Title: t.Title, Kind: t.Kind, ExamStyle: t.ExamStyle, Delivery: t.Delivery, Phase: services.PhaseOf(t, now),
			OpensAt: t.OpensAt, ResultsAt: t.ResultsAt, ResultsReleased: services.ResultsReleased(t, now), LateEntryMinutes: t.LateEntryMinutes,
			DurationMinutes: t.DurationMinutes, TotalQuestions: t.TotalQuestions, RequiresSubscription: t.RequiresSubscription,
			CourseID: t.CourseID, ExamYear: t.ExamYear, Registered: registered[t.ID],
		}
		if w, ok := services.WindowOf(t); ok {
			card.LastStartAt, card.EndsAt = &w.LastStart, &w.Ends
			if at, ok := services.EarliestResults(t); ok && (card.ResultsAt == nil || card.ResultsAt.Before(at)) {
				card.ResultsAt = &at
			}
		}
		if n, ok := authors[t.CreatedBy]; ok {
			card.AuthorName = &n
		}
		if t.SeriesID != nil {
			if s, ok := series[*t.SeriesID]; ok {
				sc := s
				card.Series = &sc
			}
		}
		if a, ok := mine[t.ID]; ok {
			aa := a
			card.MyAttempt = &aa
		}
		cards = append(cards, card)
	}
	c.JSON(http.StatusOK, gin.H{"tests": cards, "server_now": now})
}

// Register is "remind me" for a live test that has not ended.
func (h *ExamHandler) Register(c *gin.Context) {
	user := middleware.GetUser(c)
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var t models.Test
	if h.DB.WithContext(c.Request.Context()).Where("id = ? AND status = ? AND delivery = ?", id, models.StatusPublished, models.DeliveryLive).First(&t).Error != nil {
		httpx.NotFound(c, "test_not_found", "live test not found")
		return
	}
	if services.PhaseOf(&t, time.Now()) == services.PhaseEnded {
		httpx.Fail(c, services.Conflict("ended", "this live test has ended"))
		return
	}
	reg := models.TestRegistration{TestID: id, UserID: user.ID, CreatedAt: time.Now()}
	if err := h.DB.WithContext(c.Request.Context()).Clauses(clause.OnConflict{DoNothing: true}).Create(&reg).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"registered": true})
}

func (h *ExamHandler) Unregister(c *gin.Context) {
	user := middleware.GetUser(c)
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	h.DB.WithContext(c.Request.Context()).Where("test_id = ? AND user_id = ?", id, user.ID).Delete(&models.TestRegistration{})
	c.JSON(http.StatusOK, gin.H{"registered": false})
}

// ── Results: leaderboard, analysis, leave tracking ──────────────────────────

type boardEntry struct {
	Rank  int     `json:"rank"`
	Name  string  `json:"name"`
	Score float64 `json:"score"`
	IsMe  bool    `json:"is_me"`
}

// Leaderboard is the top ten of a test plus where the caller stands. School-style tests have no public board:
// the student only sees their own position. Students who opted out are left off the board but still count in ranks.
func (h *ExamHandler) Leaderboard(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var t models.Test
	if h.DB.WithContext(ctx).Where("id = ? AND status = ?", id, models.StatusPublished).First(&t).Error != nil || !visibleToUser(&t, user.ID) {
		httpx.NotFound(c, "test_not_found", "test not found")
		return
	}
	if !services.ResultsReleased(&t, time.Now()) {
		respondErr(c, http.StatusForbidden, "results_pending", "results are not out yet")
		return
	}
	rows := examCohort(ctx, h.DB, &t)
	out := gin.H{"total": len(rows), "public": t.ExamStyle != models.ExamStyleSchool, "entries": []boardEntry{}}
	if h.rankLocked(ctx, user, &t) {
		out["locked"] = true
		c.JSON(http.StatusOK, out)
		return
	}
	var myScore *float64
	h.DB.WithContext(ctx).Model(&models.StudentAttempt{}).Select("MAX(score)").
		Where("user_id = ? AND test_id = ? AND status = ? AND score IS NOT NULL", user.ID, id, models.AttemptSubmitted).Scan(&myScore)
	if myScore != nil {
		me := gin.H{"rank": rankIn(rows, *myScore), "score": *myScore, "total": len(rows)}
		var official bool
		for _, r := range rows {
			if r.UserID == user.ID {
				official = true
			}
		}
		me["estimated"] = !official
		out["me"] = me
	}
	if t.ExamStyle != models.ExamStyleSchool {
		entries := []boardEntry{}
		for i, r := range rows {
			if r.OptOut && r.UserID != user.ID {
				continue
			}
			if len(entries) >= 10 {
				break
			}
			rk := 1
			if i > 0 {
				rk = rankIn(rows, r.Score)
			}
			entries = append(entries, boardEntry{Rank: rk, Name: shortName(r.Name), Score: r.Score, IsMe: r.UserID == user.ID})
		}
		out["entries"] = entries
	}
	c.JSON(http.StatusOK, out)
}

type sectionStat struct {
	Name     string  `json:"name"`
	Total    int     `json:"total"`
	Correct  int     `json:"correct"`
	Wrong    int     `json:"wrong"`
	Skipped  int     `json:"skipped"`
	Marks    float64 `json:"marks"`
	Negative float64 `json:"negative"`
	Seconds  int     `json:"seconds"`
	Avg      *float64 `json:"cohort_avg,omitempty"`
	Top      *float64 `json:"cohort_top,omitempty"`
}

// Analysis breaks a finished attempt down by section: correct, wrong, skipped, marks, marks lost to negative
// marking and time, with the cohort's average and best per section, plus the answers that were wrong and hurried.
func (h *ExamHandler) Analysis(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var a models.StudentAttempt
	if h.DB.WithContext(ctx).Preload("Test").Where("id = ? AND user_id = ? AND status = ?", id, user.ID, models.AttemptSubmitted).First(&a).Error != nil {
		httpx.NotFound(c, "result_not_found", "result not found")
		return
	}
	if !services.ResultsReleased(&a.Test, time.Now()) {
		respondErr(c, http.StatusForbidden, "results_pending", "results are not out yet")
		return
	}
	var secs []sectionStat
	h.DB.WithContext(ctx).Raw(`
		SELECT COALESCE(NULLIF(q.section, ''), s.name, 'General') AS name,
		       COUNT(*) AS total,
		       COUNT(*) FILTER (WHERE aa.is_correct) AS correct,
		       COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL AND aa.is_correct IS NOT TRUE) AS wrong,
		       COUNT(*) FILTER (WHERE aa.selected_option IS NULL) AS skipped,
		       COALESCE(SUM(aa.marks_awarded), 0)::float8 AS marks,
		       COALESCE(-SUM(aa.marks_awarded) FILTER (WHERE aa.marks_awarded < 0), 0)::float8 AS negative,
		       COALESCE(SUM(aa.time_spent_seconds), 0) AS seconds
		FROM attempt_answers aa JOIN questions q ON q.id = aa.question_id LEFT JOIN subjects s ON s.id = q.subject_id
		WHERE aa.attempt_id = ?
		GROUP BY 1 ORDER BY MIN(aa.position)`, a.ID).Scan(&secs)

	var per []struct {
		Name string
		Avg  float64
		Top  float64
	}
	h.DB.WithContext(ctx).Raw(`
		WITH coh AS (
			SELECT a.id FROM student_attempts a JOIN users u ON u.id = a.user_id
			WHERE a.test_id = ? AND a.status = 'submitted' AND a.official AND u.role = 'student' AND (? <> 'live' OR a.source = 'live')),
		per AS (
			SELECT aa.attempt_id, COALESCE(NULLIF(q.section, ''), s.name, 'General') AS name, SUM(aa.marks_awarded) AS m
			FROM attempt_answers aa JOIN questions q ON q.id = aa.question_id LEFT JOIN subjects s ON s.id = q.subject_id
			WHERE aa.attempt_id IN (SELECT id FROM coh) GROUP BY 1, 2)
		SELECT name, AVG(m)::float8 AS avg, MAX(m)::float8 AS top FROM per GROUP BY name`, a.TestID, a.Test.Delivery).Scan(&per)
	for i := range secs {
		for _, p := range per {
			if p.Name == secs[i].Name {
				avg, top := p.Avg, p.Top
				secs[i].Avg, secs[i].Top = &avg, &top
			}
		}
	}
	// Wrong answers given in under 20 seconds: the "hurried" list.
	var hurried []struct {
		Position int `json:"position"`
		Seconds  int `json:"seconds"`
	}
	h.DB.WithContext(ctx).Raw(`
		SELECT position, time_spent_seconds AS seconds FROM attempt_answers
		WHERE attempt_id = ? AND selected_option IS NOT NULL AND is_correct IS NOT TRUE
		  AND time_spent_seconds IS NOT NULL AND time_spent_seconds < 20
		ORDER BY position LIMIT 30`, a.ID).Scan(&hurried)

	out := gin.H{"sections": secs, "hurried": hurried, "leave_count": a.LeaveCount, "leave_seconds": a.LeaveSeconds}
	if rows := examCohort(ctx, h.DB, &a.Test); len(rows) > 0 && a.Score != nil {
		var sum float64
		for _, r := range rows {
			sum += r.Score
		}
		out["cohort"] = gin.H{"total": len(rows), "avg_score": sum / float64(len(rows)), "top_score": rows[0].Score}
	}
	c.JSON(http.StatusOK, out)
}

// Leave records one time the student left the app during an exam. Counting only; it never fails the attempt.
func (h *ExamHandler) Leave(c *gin.Context) {
	user := middleware.GetUser(c)
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var req struct {
		Seconds int `json:"seconds"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.Seconds < 0 {
		req.Seconds = 0
	}
	if req.Seconds > 3600 {
		req.Seconds = 3600
	}
	h.DB.WithContext(c.Request.Context()).Model(&models.StudentAttempt{}).
		Where("id = ? AND user_id = ? AND status = ?", id, user.ID, models.AttemptInProgress).
		Updates(map[string]interface{}{"leave_count": gorm.Expr("leave_count + 1"), "leave_seconds": gorm.Expr("leave_seconds + ?", req.Seconds)})
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// ── Series (teachers and admins) ────────────────────────────────────────────

func (h *ExamHandler) ListSeries(c *gin.Context) {
	var ss []models.TestSeries
	q := h.DB.WithContext(c.Request.Context()).Order("created_at DESC").Limit(200)
	if cid := c.Query("course_id"); cid != "" {
		q = q.Where("course_id = ?", cid)
	}
	q.Find(&ss)
	c.JSON(http.StatusOK, gin.H{"series": ss})
}

func (h *ExamHandler) CreateSeries(c *gin.Context) {
	user := middleware.GetUser(c)
	var req struct {
		CourseID    string  `json:"course_id"`
		Title       string  `json:"title"`
		Description *string `json:"description"`
	}
	if !httpx.Bind(c, &req) {
		return
	}
	cid, err := uuid.Parse(req.CourseID)
	title := strings.TrimSpace(req.Title)
	if err != nil || len([]rune(title)) < 3 || len([]rune(title)) > 120 {
		httpx.BadRequest(c, "bad_request", "a course and a title of 3 to 120 characters are required")
		return
	}
	var n int64
	h.DB.WithContext(c.Request.Context()).Model(&models.Course{}).Where("id = ?", cid).Count(&n)
	if n == 0 {
		httpx.BadRequest(c, "bad_request", "unknown course")
		return
	}
	s := models.TestSeries{CourseID: cid, Title: title, Description: req.Description, CreatedBy: user.ID}
	if err := h.DB.WithContext(c.Request.Context()).Create(&s).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, s)
}
