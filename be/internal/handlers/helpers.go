package handlers

import (
	"codon-backend/internal/services"
	"context"
	"errors"

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

// testDuration returns a test's duration in minutes (nil if untimed/unknown).
func testDuration(db *gorm.DB, ctx context.Context, testID uuid.UUID) *int {
	var t models.Test
	if err := db.WithContext(ctx).Select("id", "duration_minutes").First(&t, "id = ?", testID).Error; err != nil {
		return nil
	}
	return t.DurationMinutes
}

func asCoded(err error, target **services.CodedError) bool { return errors.As(err, target) }
