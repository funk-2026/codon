package services

import (
	"context"
	"time"

	"codon-backend/internal/models"
	"codon-backend/internal/validate"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProgressSubject is one subject's accuracy (correct ÷ attempted, percent).
type ProgressSubject struct {
	Name     string `json:"name"`
	Accuracy int    `json:"accuracy"`
}

// ProgressBreakdown is the student's progress dashboard payload.
type ProgressBreakdown struct {
	Trend     []int             `json:"trend"`
	Subjects  []ProgressSubject `json:"subjects"`
	DayStreak int               `json:"day_streak"`
	Last7Days []bool            `json:"last_7_days"`
}

// Progress computes a student's progress, optionally for one module type
// (qbank|test_series|practice|custom).
func Progress(ctx context.Context, db *gorm.DB, userID uuid.UUID, module string, now time.Time) (*ProgressBreakdown, error) {
	modFilter := ""
	var modArgs []interface{}
	if module != "" {
		if !validate.OneOf(module, validate.ModuleTypes) {
			return nil, Coded(400, "invalid_module", "module must be one of: qbank, test_series, practice, custom")
		}
		modFilter = " AND t.module_type = ?"
		modArgs = []interface{}{module}
	}
	args := append([]interface{}{userID, models.AttemptSubmitted}, modArgs...)
	db = db.WithContext(ctx)

	// Trend: the LAST 10 submitted attempts, oldest first.
	var scores []float64
	if err := db.Raw(`SELECT score FROM (
		SELECT sa.score, sa.submitted_at FROM student_attempts sa JOIN tests t ON t.id = sa.test_id
		WHERE sa.user_id = ? AND sa.status = ? AND sa.score IS NOT NULL`+modFilter+`
		ORDER BY sa.submitted_at DESC NULLS LAST LIMIT 10) x ORDER BY submitted_at ASC NULLS LAST`, args...).Scan(&scores).Error; err != nil {
		return nil, err
	}
	trend := make([]int, len(scores))
	for i, sc := range scores {
		trend[i] = int(sc)
	}

	// Subject accuracy from the QUESTION-level subject (custom tests span subjects).
	var stats []struct {
		Name     string
		Accuracy float64
	}
	if err := db.Raw(`
		SELECT s.name AS name,
		       (COUNT(CASE WHEN aa.is_correct IS TRUE THEN 1 END) * 100.0) / NULLIF(COUNT(aa.id), 0) AS accuracy
		FROM attempt_answers aa
		JOIN questions q ON aa.question_id = q.id
		JOIN student_attempts sa ON aa.attempt_id = sa.id
		JOIN tests t ON sa.test_id = t.id
		JOIN subjects s ON q.subject_id = s.id
		WHERE sa.user_id = ? AND sa.status = ? AND aa.selected_option IS NOT NULL`+modFilter+`
		GROUP BY s.id, s.name
		ORDER BY s.name`, args...).Scan(&stats).Error; err != nil {
		return nil, err
	}
	subjects := make([]ProgressSubject, len(stats))
	for i, s := range stats {
		subjects[i] = ProgressSubject{Name: s.Name, Accuracy: int(s.Accuracy)}
	}

	active, err := ActiveDays(ctx, db, userID, now, 400)
	if err != nil {
		return nil, err
	}
	return &ProgressBreakdown{Trend: trend, Subjects: subjects, DayStreak: Streak(active, now), Last7Days: Last7(active, now)}, nil
}
