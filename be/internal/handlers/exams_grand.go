package handlers

import (
	"net/http"
	"time"

	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/services"
	"codon-backend/internal/settings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type grandPart struct {
	Name      string  `json:"name"`
	Subject   string  `json:"subject,omitempty"`
	Total     int     `json:"total"`
	Attempted int     `json:"attempted"`
	Correct   int     `json:"correct"`
	Marks     float64 `json:"marks"`
	Percent   float64 `json:"percent"` // correct ÷ total
	// Percentile is my place among the students who took the test, in this subject (subjects only; needs enough students).
	Percentile *float64 `json:"percentile,omitempty"`
}

type grandAttempt struct {
	AttemptID  uuid.UUID   `json:"attempt_id"`
	TestID     uuid.UUID   `json:"test_id"`
	Title      string      `json:"title"`
	At         time.Time   `json:"at"`
	Score      float64     `json:"score"`
	TotalMarks float64     `json:"total_marks"`
	Percent    float64     `json:"percent"`
	Rank       *int        `json:"rank,omitempty"`
	Cohort     int         `json:"cohort"`
	Percentile *float64    `json:"percentile,omitempty"`
	Subjects   []grandPart `json:"subjects"`
	Chapters   []grandPart `json:"chapters"`
}

// GrandAnalysis is the student's Grand Test history for the performance analysis: one row per Grand Test taken
// (the counting attempt, results released), oldest first, each with subject and chapter marks.
// With fewer than two such tests the app shows a gate instead of a graph.
func (h *ExamHandler) GrandAnalysis(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	var attempts []models.StudentAttempt
	if err := h.DB.WithContext(ctx).Raw(`
		SELECT DISTINCT ON (a.test_id) a.* FROM student_attempts a
		JOIN tests t ON t.id = a.test_id
		WHERE a.user_id = ? AND a.status = 'submitted' AND a.score IS NOT NULL AND t.kind = 'full' AND t.module_type = 'test_series'
		ORDER BY a.test_id, a.official DESC, a.submitted_at ASC`, user.ID).Scan(&attempts).Error; err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "could not load your tests")
		return
	}
	out := []grandAttempt{}
	now := time.Now()
	for i := range attempts {
		a := &attempts[i]
		var t models.Test
		if h.DB.WithContext(ctx).First(&t, "id = ?", a.TestID).Error != nil || !services.ResultsReleased(&t, now) {
			continue
		}
		a.Test = t
		row := grandAttempt{AttemptID: a.ID, TestID: t.ID, Title: t.Title, Score: *a.Score, Subjects: []grandPart{}, Chapters: []grandPart{}}
		if a.SubmittedAt != nil {
			row.At = *a.SubmittedAt
		} else {
			row.At = a.StartedAt
		}
		if a.TotalMarks != nil && *a.TotalMarks > 0 {
			row.TotalMarks = *a.TotalMarks
			row.Percent = *a.Score * 100 / *a.TotalMarks
		}
		if cohort := examCohort(ctx, h.DB, &t); len(cohort) > 0 {
			rank := rankIn(cohort, *a.Score)
			row.Rank, row.Cohort = &rank, len(cohort)
			if int64(len(cohort)) >= int64(settings.Default.Int("results.percentile_min")) {
				p := float64(len(cohort)-rank) * 100 / float64(len(cohort))
				row.Percentile = &p
			}
		}
		parts := func(idCol, join, nameExpr string, subjectExpr string) []grandPart {
			var ps []grandPart
			h.DB.WithContext(ctx).Raw(`
				SELECT `+nameExpr+` AS name, `+subjectExpr+` AS subject, count(*)::int AS total,
				       count(*) FILTER (WHERE aa.selected_option IS NOT NULL)::int AS attempted,
				       count(*) FILTER (WHERE aa.is_correct IS TRUE)::int AS correct,
				       COALESCE(sum(aa.marks_awarded), 0)::float8 AS marks
				FROM attempt_answers aa JOIN questions q ON q.id = aa.question_id `+join+`
				WHERE aa.attempt_id = ? GROUP BY 1, 2 ORDER BY 1`, a.ID).Scan(&ps)
			for j := range ps {
				if ps[j].Total > 0 {
					ps[j].Percent = float64(ps[j].Correct) * 100 / float64(ps[j].Total)
				}
			}
			return ps
		}
		row.Subjects = append(row.Subjects, parts("", "LEFT JOIN subjects s ON s.id = q.subject_id", "COALESCE(s.name, 'Unspecified')", "''")...)
		row.Chapters = append(row.Chapters, parts("", "LEFT JOIN chapters ch ON ch.id = q.chapter_id LEFT JOIN subjects s ON s.id = q.subject_id", "COALESCE(ch.name, 'Unspecified')", "COALESCE(s.name, 'Unspecified')")...)
		if row.Percentile != nil {
			var per []struct {
				Name string
				M    float64
			}
			h.DB.WithContext(ctx).Raw(`
				SELECT COALESCE(s.name, 'Unspecified') AS name, SUM(aa.marks_awarded)::float8 AS m
				FROM student_attempts a JOIN users u ON u.id = a.user_id
				JOIN attempt_answers aa ON aa.attempt_id = a.id JOIN questions q ON q.id = aa.question_id LEFT JOIN subjects s ON s.id = q.subject_id
				WHERE a.test_id = ? AND a.status = 'submitted' AND a.official AND a.score IS NOT NULL AND u.role = 'student' AND (? <> 'live' OR a.source = 'live')
				GROUP BY a.id, 1`, t.ID, t.Delivery).Scan(&per)
			for j := range row.Subjects {
				var n, better float64
				for _, p := range per {
					if p.Name != row.Subjects[j].Name {
						continue
					}
					n++
					if p.M > row.Subjects[j].Marks {
						better++
					}
				}
				if n > 0 {
					v := (n - (better + 1)) * 100 / n
					row.Subjects[j].Percentile = &v
				}
			}
		}
		out = append(out, row)
	}
	// Oldest first for the trend line.
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	c.JSON(http.StatusOK, gin.H{"attempts": sortGrand(out), "min_attempts": 2})
}

func sortGrand(rows []grandAttempt) []grandAttempt {
	for i := 1; i < len(rows); i++ {
		for j := i; j > 0 && rows[j].At.Before(rows[j-1].At); j-- {
			rows[j], rows[j-1] = rows[j-1], rows[j]
		}
	}
	return rows
}
