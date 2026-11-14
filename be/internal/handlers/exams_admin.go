package handlers

import (
	"net/http"
	"strconv"
	"time"

	"codon-backend/internal/httpx"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type adminExamRow struct {
	ID               string     `json:"id"`
	Title            string     `json:"title"`
	Kind             string     `json:"kind"`
	ExamStyle        string     `json:"exam_style"`
	Phase            string     `json:"phase"`
	OpensAt          *time.Time `json:"opens_at,omitempty"`
	EndsAt           *time.Time `json:"ends_at,omitempty"`
	ResultsAt        *time.Time `json:"results_at,omitempty"`
	ExtraMinutes     int        `json:"extra_minutes"`
	Registered       int        `json:"registered"`
	Started          int        `json:"started"`
	InProgress       int        `json:"in_progress"`
	Submitted        int        `json:"submitted"`
	ResultsReleased  bool       `json:"results_released"`
}

// AdminExams lists live tests (newest first) with the numbers an operator watches on exam day.
func (h *ExamHandler) AdminExams(c *gin.Context) {
	ctx := c.Request.Context()
	var tests []models.Test
	h.DB.WithContext(ctx).Where("delivery = ? AND status IN ?", models.DeliveryLive, []models.ContentStatus{models.StatusPublished, models.StatusApproved}).
		Order("opens_at DESC").Limit(60).Find(&tests)
	now := time.Now()
	rows := make([]adminExamRow, 0, len(tests))
	for i := range tests {
		t := &tests[i]
		r := adminExamRow{ID: t.ID.String(), Title: t.Title, Kind: t.Kind, ExamStyle: t.ExamStyle, Phase: services.PhaseOf(t, now),
			OpensAt: t.OpensAt, ResultsAt: t.ResultsAt, ExtraMinutes: t.ExtraMinutes, ResultsReleased: services.ResultsReleased(t, now)}
		if w, ok := services.WindowOf(t); ok {
			r.EndsAt = &w.Ends
		}
		if at, ok := services.EarliestResults(t); ok && (r.ResultsAt == nil || r.ResultsAt.Before(at)) {
			r.ResultsAt = &at
		}
		var n int64
		h.DB.WithContext(ctx).Model(&models.TestRegistration{}).Where("test_id = ?", t.ID).Count(&n)
		r.Registered = int(n)
		var st struct{ Started, InProgress, Submitted int }
		h.DB.WithContext(ctx).Raw(`SELECT COUNT(*) AS started,
			COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
			COUNT(*) FILTER (WHERE status = 'submitted') AS submitted
			FROM student_attempts WHERE test_id = ? AND source = 'live'`, t.ID).Scan(&st)
		r.Started, r.InProgress, r.Submitted = st.Started, st.InProgress, st.Submitted
		rows = append(rows, r)
	}
	c.JSON(http.StatusOK, gin.H{"exams": rows, "server_now": now})
}

// notifyExamUsers tells everyone registered for a test or with an attempt on it.
func notifyExamUsers(tx *gorm.DB, testID string, typ, title, body string, data map[string]interface{}) int {
	var users []string
	tx.Raw(`SELECT user_id::text FROM test_registrations WHERE test_id = ?
		UNION SELECT user_id::text FROM student_attempts WHERE test_id = ?`, testID, testID).Scan(&users)
	for _, u := range users {
		if id, err := uuid.Parse(u); err == nil {
			services.Notify(tx, id, typ, title, body, data)
		}
	}
	return len(users)
}

// ExtendExam adds minutes to a live test after an outage: late entry and the end both move, attempts in progress
// get the time, and everyone involved is told.
func (h *ExamHandler) ExtendExam(c *gin.Context) {
	actor := middleware.GetUser(c)
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var req struct {
		Minutes int `json:"minutes"`
	}
	if !httpx.Bind(c, &req) || req.Minutes < 1 || req.Minutes > 120 {
		httpx.BadRequest(c, "bad_request", "minutes must be between 1 and 120")
		return
	}
	var t models.Test
	if h.DB.WithContext(c.Request.Context()).First(&t, "id = ? AND delivery = ?", id, models.DeliveryLive).Error != nil {
		httpx.NotFound(c, "test_not_found", "live test not found")
		return
	}
	if services.PhaseOf(&t, time.Now()) == services.PhaseEnded {
		httpx.Fail(c, services.Conflict("ended", "this test has already ended"))
		return
	}
	extra := time.Duration(req.Minutes) * time.Minute
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{"extra_minutes": gorm.Expr("extra_minutes + ?", req.Minutes)}
		if t.ResultsAt != nil {
			updates["results_at"] = t.ResultsAt.Add(extra)
		}
		if err := tx.Model(&models.Test{}).Where("id = ?", id).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.StudentAttempt{}).Where("test_id = ? AND status = ? AND source = 'live' AND expires_at IS NOT NULL", id, models.AttemptInProgress).
			Update("expires_at", gorm.Expr("expires_at + make_interval(mins => ?)", req.Minutes)).Error; err != nil {
			return err
		}
		notifyExamUsers(tx, id.String(), "exam_extended", "The exam has been extended",
			t.Title+": "+strconv.Itoa(req.Minutes)+" extra minutes. Your time has been added.", map[string]interface{}{"id": id, "route": "/(student)/test-pre-start?id=" + id.String()})
		return auditAdmin(tx, actor, "exam.extend", "test:"+id.String(), nil, map[string]interface{}{"minutes": req.Minutes})
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"extended_by": req.Minutes})
}

// SetResultsAt moves the time results open. It can never be earlier than the platform minimum after the exam ends.
func (h *ExamHandler) SetResultsAt(c *gin.Context) {
	actor := middleware.GetUser(c)
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var req struct {
		ResultsAt time.Time `json:"results_at"`
	}
	if !httpx.Bind(c, &req) {
		return
	}
	var t models.Test
	if h.DB.WithContext(c.Request.Context()).First(&t, "id = ? AND delivery = ?", id, models.DeliveryLive).Error != nil {
		httpx.NotFound(c, "test_not_found", "live test not found")
		return
	}
	if earliest, ok := services.EarliestResults(&t); ok && req.ResultsAt.Before(earliest) {
		httpx.BadRequest(c, "results_too_early", "results must open at least "+services.MinResultGap().String()+" after the exam ends")
		return
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Test{}).Where("id = ?", id).Updates(map[string]interface{}{"results_at": req.ResultsAt, "results_notified_at": nil}).Error; err != nil {
			return err
		}
		return auditAdmin(tx, actor, "exam.results_at", "test:"+id.String(), t.ResultsAt, req.ResultsAt)
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"results_at": req.ResultsAt})
}

// RescoreExam recomputes every score against the current answer key. With dry_run=true it only reports the effect.
func (h *ExamHandler) RescoreExam(c *gin.Context) {
	actor := middleware.GetUser(c)
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var req struct {
		DryRun bool `json:"dry_run"`
	}
	_ = c.ShouldBindJSON(&req)
	res, err := services.RescoreTest(c.Request.Context(), h.DB, id, !req.DryRun)
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	if !req.DryRun && res.Changed > 0 {
		var title string
		h.DB.WithContext(c.Request.Context()).Model(&models.Test{}).Select("title").Where("id = ?", id).Scan(&title)
		for _, u := range res.Users {
			services.Notify(h.DB.WithContext(c.Request.Context()), u, "exam_score_changed", "Your score was updated",
				title+": the answer key was corrected and your score changed.", map[string]interface{}{"id": id, "route": "/(student)/test-history"})
		}
		_ = auditAdmin(h.DB.WithContext(c.Request.Context()), actor, "exam.rescore", "test:"+id.String(), nil,
			map[string]interface{}{"changed": res.Changed, "attempts": res.Attempts})
	}
	c.JSON(http.StatusOK, res)
}
