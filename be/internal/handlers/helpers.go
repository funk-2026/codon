package handlers

import (
	"context"
	"github.com/gin-gonic/gin"

	"codon-backend/internal/models"
	"codon-backend/internal/settings"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// idSet runs a query that selects uuids (one column) and returns them as a set.
// The query must take the user id followed by an `IN ?` list.
func idSet(db *gorm.DB, ctx context.Context, query string, userID uuid.UUID, ids []uuid.UUID) map[uuid.UUID]bool {
	out := map[uuid.UUID]bool{}
	if len(ids) == 0 {
		return out
	}
	var found []uuid.UUID
	db.WithContext(ctx).Raw(query, userID, ids).Scan(&found)
	for _, id := range found {
		out[id] = true
	}
	return out
}

// cohortCorrectPct returns "% of students who got this right" per question,
// only for questions with enough attempts (analytics.cohort_min_attempts) so a
// tiny sample never masquerades as a signal, and never any per-person data.
func cohortCorrectPct(db *gorm.DB, ctx context.Context, ids []uuid.UUID) map[uuid.UUID]float64 {
	out := map[uuid.UUID]float64{}
	if len(ids) == 0 || settings.Default == nil {
		return out
	}
	var rows []models.QuestionStats
	db.WithContext(ctx).Where("question_id IN ? AND attempts >= ?", ids, settings.Int("analytics.cohort_min_attempts")).Find(&rows)
	for _, r := range rows {
		if r.Attempts > 0 {
			out[r.QuestionID] = float64(r.Correct) * 100 / float64(r.Attempts)
		}
	}
	return out
}

// optionShares tells, per question, what percent of students who answered chose each option (A to D).
// Questions with fewer answers than the cohort minimum are left out, so early numbers don't mislead.
func optionShares(db *gorm.DB, ctx context.Context, ids []uuid.UUID) map[uuid.UUID]map[string]int {
	out := map[uuid.UUID]map[string]int{}
	if len(ids) == 0 || settings.Default == nil {
		return out
	}
	var rows []struct {
		QuestionID uuid.UUID
		Opt        string
		N          int
	}
	db.WithContext(ctx).Raw(`SELECT aa.question_id, aa.selected_option AS opt, COUNT(*) AS n
		FROM attempt_answers aa JOIN student_attempts a ON a.id = aa.attempt_id
		WHERE a.status = 'submitted' AND aa.question_id IN ? AND aa.selected_option IS NOT NULL
		GROUP BY aa.question_id, aa.selected_option`, ids).Scan(&rows)
	total := map[uuid.UUID]int{}
	for _, r := range rows {
		total[r.QuestionID] += r.N
	}
	floor := settings.Int("analytics.cohort_min_attempts")
	for _, r := range rows {
		if total[r.QuestionID] < floor || total[r.QuestionID] == 0 {
			continue
		}
		if out[r.QuestionID] == nil {
			out[r.QuestionID] = map[string]int{"A": 0, "B": 0, "C": 0, "D": 0}
		}
		out[r.QuestionID][r.Opt] = int(float64(r.N)*100/float64(total[r.QuestionID]) + 0.5)
	}
	return out
}

// testDuration returns a test's duration in minutes (nil if untimed/unknown).
func testDuration(db *gorm.DB, ctx context.Context, testID uuid.UUID) *int {
	var t models.Test
	if err := db.WithContext(ctx).Select("id", "duration_minutes").First(&t, "id = ?", testID).Error; err != nil {
		return nil
	}
	return t.DurationMinutes
}

// statusParam reads ?status= for admin review queues (default: pending_review)
// and rejects values that are not a workflow status.
func statusParam(c *gin.Context) (models.ContentStatus, bool) {
	st := models.ContentStatus(c.DefaultQuery("status", string(models.StatusPendingReview)))
	if !st.Valid() {
		respondErr(c, 400, "invalid_status", "status must be one of: draft, pending_review, approved, rejected, published")
		return "", false
	}
	return st, true
}
