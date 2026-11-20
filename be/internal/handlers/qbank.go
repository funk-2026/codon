package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"codon-backend/internal/httpx"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/services"
)

type QBankHandler struct {
	DB  *gorm.DB
	Sub *services.SubscriptionService
}

func NewQBankHandler(db *gorm.DB, sub *services.SubscriptionService) *QBankHandler {
	return &QBankHandler{DB: db, Sub: sub}
}

type qbankModule struct {
	TestID               uuid.UUID  `json:"test_id"`
	Title                string     `json:"title"`
	ChapterID            uuid.UUID  `json:"chapter_id"`
	ChapterName          string     `json:"chapter_name"`
	ChapterOrder         int        `json:"chapter_order"`
	MCQCount             int        `json:"mcq_count"`
	RequiresSubscription bool       `json:"requires_subscription"`
	Locked               bool       `json:"locked"`
	State                string     `json:"state"` // unattempted | paused | completed
	ScorePct             *int       `json:"score_pct,omitempty"`
	SolvedAt             *time.Time `json:"solved_at,omitempty"`
	AttemptID            *uuid.UUID `json:"attempt_id,omitempty"`
}

type qbankSubject struct {
	SubjectID uuid.UUID     `json:"subject_id"`
	Name      string        `json:"name"`
	Completed int           `json:"completed"`
	Total     int           `json:"total"`
	Modules   []qbankModule `json:"modules"`
}

// Overview godoc
//
//	@Summary		QBank by subject: every module with my result saved on it
//	@Description	One QBank module is one published QBank test. A finished module carries its percentage and the day it was solved; it can be solved once, until the student resets the QBank. `completed` / `total` is the "x / y modules" line. Subjects come as Biology, Chemistry, Physics first.
//	@Tags			QBank
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/qbank/overview [get]
func (h *QBankHandler) Overview(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	courseID := user.SelectedCourseID
	if v := strings.TrimSpace(c.Query("course_id")); v != "" {
		id, err := uuid.Parse(v)
		if err != nil {
			respondErr(c, http.StatusBadRequest, "invalid_id", "invalid course_id")
			return
		}
		courseID = &id
	}
	var subs []models.Subject
	q := h.DB.WithContext(ctx).Model(&models.Subject{})
	if courseID != nil {
		q = q.Where("course_id = ?", *courseID)
	}
	q.Find(&subs)

	var rows []struct {
		TestID               uuid.UUID
		Title                string
		ChapterID            uuid.UUID
		ChapterName          string
		ChapterOrder         int
		McqCount             int
		RequiresSubscription bool
		SubjectID            uuid.UUID
		CourseID             uuid.UUID
		AttStatus            *string
		Score                *float64
		TotalMarks           *float64
		SubmittedAt          *time.Time
		AttID                *uuid.UUID
	}
	err := h.DB.WithContext(ctx).Raw(`
		SELECT t.id AS test_id, t.title, ch.id AS chapter_id, ch.name AS chapter_name, ch.order_index AS chapter_order,
		       t.total_questions AS mcq_count, t.requires_subscription, ch.subject_id, t.course_id,
		       la.status AS att_status, la.score, la.total_marks, la.submitted_at, la.id AS att_id
		FROM tests t
		JOIN chapters ch ON ch.id = t.chapter_id
		JOIN subjects s ON s.id = ch.subject_id
		LEFT JOIN LATERAL (
			SELECT a.id, a.status, a.score, a.total_marks, a.submitted_at FROM student_attempts a
			WHERE a.user_id = ? AND a.test_id = t.id ORDER BY a.started_at DESC LIMIT 1
		) la ON true
		WHERE t.module_type = 'qbank' AND t.status = 'published' AND t.origin = 'authored' AND t.archived_at IS NULL
		  AND (?::uuid IS NULL OR s.course_id = ?::uuid)
		ORDER BY ch.order_index ASC, ch.name ASC, t.created_at ASC`, user.ID, courseID, courseID).Scan(&rows).Error
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	access, aerr := h.Sub.AccessFor(ctx, user)
	if aerr != nil {
		httpx.Fail(c, aerr)
		return
	}
	bySubject := map[uuid.UUID][]qbankModule{}
	for _, r := range rows {
		m := qbankModule{TestID: r.TestID, Title: r.Title, ChapterID: r.ChapterID, ChapterName: r.ChapterName, ChapterOrder: r.ChapterOrder, MCQCount: r.McqCount, RequiresSubscription: r.RequiresSubscription}
		m.Locked = access.Allow(m.RequiresSubscription, r.CourseID) != nil
		m.State = "unattempted"
		if r.AttStatus != nil {
			switch *r.AttStatus {
			case string(models.AttemptSubmitted):
				m.State, m.SolvedAt, m.AttemptID = "completed", r.SubmittedAt, r.AttID
				if r.Score != nil && r.TotalMarks != nil && *r.TotalMarks > 0 {
					p := int(*r.Score*100 / *r.TotalMarks + 0.5)
					m.ScorePct = &p
				}
			case string(models.AttemptInProgress):
				m.State, m.AttemptID = "paused", r.AttID
			}
		}
		bySubject[r.SubjectID] = append(bySubject[r.SubjectID], m)
	}
	rank := func(name string) int {
		switch strings.ToLower(name) {
		case "biology":
			return 0
		case "chemistry":
			return 1
		case "physics":
			return 2
		}
		return 3
	}
	out := make([]qbankSubject, 0, len(subs))
	for _, s := range subs {
		mods := bySubject[s.ID]
		if mods == nil {
			mods = []qbankModule{}
		}
		done := 0
		for _, m := range mods {
			if m.State == "completed" {
				done++
			}
		}
		out = append(out, qbankSubject{SubjectID: s.ID, Name: s.Name, Completed: done, Total: len(mods), Modules: mods})
	}
	for i := 0; i < len(out); i++ {
		for j := i + 1; j < len(out); j++ {
			if rank(out[j].Name) < rank(out[i].Name) {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"subjects": out})
}
