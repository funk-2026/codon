package services

import (
	"context"
	"time"

	"codon-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// RescoreResult says what recomputing a test against its current answer key changes.
type RescoreResult struct {
	Attempts int         `json:"attempts"`         // submitted attempts looked at
	Changed  int         `json:"changed"`          // attempts whose score changes
	Users    []uuid.UUID `json:"-"`                // students whose score changes
	MaxDrop  float64     `json:"max_drop"`         // largest fall in a score
	MaxRise  float64     `json:"max_rise"`         // largest rise in a score
	Applied  bool        `json:"applied"`          // false for a preview
	At       time.Time   `json:"at"`
}

type rescoreRow struct {
	AttemptID  uuid.UUID
	AnswerID   uuid.UUID
	Selected   *string
	Correct    string
	WasCorrect *bool
}

// RescoreTest recomputes every submitted attempt of a test against the question's current correct option.
// With apply=false it only reports what would change, so an admin can see the effect before confirming.
func RescoreTest(ctx context.Context, db *gorm.DB, testID uuid.UUID, apply bool) (RescoreResult, error) {
	res := RescoreResult{Applied: apply, At: time.Now()}
	var test models.Test
	if err := db.WithContext(ctx).First(&test, "id = ?", testID).Error; err != nil {
		return res, err
	}
	var attempts []models.StudentAttempt
	if err := db.WithContext(ctx).Where("test_id = ? AND status = ?", testID, models.AttemptSubmitted).Find(&attempts).Error; err != nil {
		return res, err
	}
	res.Attempts = len(attempts)
	byID := make(map[uuid.UUID]*models.StudentAttempt, len(attempts))
	for i := range attempts {
		byID[attempts[i].ID] = &attempts[i]
	}
	var rows []rescoreRow
	if err := db.WithContext(ctx).Raw(`
		SELECT aa.attempt_id, aa.id AS answer_id, aa.selected_option AS selected, q.correct_option AS correct, aa.is_correct AS was_correct
		FROM attempt_answers aa
		JOIN student_attempts a ON a.id = aa.attempt_id
		JOIN questions q ON q.id = aa.question_id
		WHERE a.test_id = ? AND a.status = 'submitted'`, testID).Scan(&rows).Error; err != nil {
		return res, err
	}

	type tally struct {
		score          float64
		correct, wrong int
		answerFix      []rescoreRow // answers whose correctness flips
		flipTo         []bool
	}
	t := map[uuid.UUID]*tally{}
	for _, r := range rows {
		a := byID[r.AttemptID]
		if a == nil {
			continue
		}
		mc, mw := marksFor(a, &test)
		x := t[r.AttemptID]
		if x == nil {
			x = &tally{}
			t[r.AttemptID] = x
		}
		if r.Selected == nil {
			continue
		}
		ok := *r.Selected == r.Correct
		if ok {
			x.score += mc
			x.correct++
		} else {
			x.score += mw
			x.wrong++
		}
		if r.WasCorrect == nil || *r.WasCorrect != ok {
			x.answerFix = append(x.answerFix, r)
			x.flipTo = append(x.flipTo, ok)
		}
	}

	type change struct {
		id        uuid.UUID
		x         *tally
		mc, mw    float64
		wasScore  float64
	}
	var changes []change
	for id, x := range t {
		a := byID[id]
		old := 0.0
		if a.Score != nil {
			old = *a.Score
		}
		if x.score == old && len(x.answerFix) == 0 {
			continue
		}
		if x.score != old {
			res.Changed++
			res.Users = append(res.Users, a.UserID)
			if d := x.score - old; d > res.MaxRise {
				res.MaxRise = d
			} else if -d > res.MaxDrop {
				res.MaxDrop = -d
			}
		}
		changes = append(changes, change{id: id, x: x, wasScore: old})
	}
	if !apply || len(changes) == 0 {
		return res, nil
	}
	err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, c := range changes {
			for i, r := range c.x.answerFix {
				mc, mw := marksFor(byID[c.id], &test)
				marks := mw
				if c.x.flipTo[i] {
					marks = mc
				}
				if err := tx.Model(&models.AttemptAnswer{}).Where("id = ?", r.AnswerID).
					Updates(map[string]interface{}{"is_correct": c.x.flipTo[i], "marks_awarded": marks}).Error; err != nil {
					return err
				}
			}
			unattempted := 0
			if a := byID[c.id]; a.UnattemptedCount != nil {
				unattempted = *a.UnattemptedCount
			}
			if err := tx.Model(&models.StudentAttempt{}).Where("id = ?", c.id).Updates(map[string]interface{}{
				"score": c.x.score, "correct_count": c.x.correct, "wrong_count": c.x.wrong, "unattempted_count": unattempted,
			}).Error; err != nil {
				return err
			}
		}
		return nil
	})
	return res, err
}
