package services

import (
	"context"
	"log"
	"time"

	"codon-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// RetentionSweep is the daily housekeeping job:
//   - never-started generated tests past their expiry are archived;
//   - read notifications older than 90 days are deleted;
//   - question empirical difficulty is refreshed from cohort stats (≥ 50 answers).
func RetentionSweep(ctx context.Context, db *gorm.DB) {
	now := time.Now()
	res := db.WithContext(ctx).Exec(`UPDATE tests SET archived_at = ?
		WHERE origin = 'generated' AND archived_at IS NULL AND expires_at IS NOT NULL AND expires_at < ?
		  AND NOT EXISTS (SELECT 1 FROM student_attempts a WHERE a.test_id = tests.id)`, now, now)
	if res.RowsAffected > 0 {
		log.Printf("[retention] archived %d expired, never-started custom tests", res.RowsAffected)
	}
	db.WithContext(ctx).Where("read_at IS NOT NULL AND read_at < ?", now.AddDate(0, 0, -90)).Delete(&models.Notification{})
	db.WithContext(ctx).Exec(`UPDATE question_stats SET empirical_difficulty = CASE
			WHEN correct::float / NULLIF(attempts, 0) >= 0.7 THEN 'easy'
			WHEN correct::float / NULLIF(attempts, 0) >= 0.4 THEN 'medium' ELSE 'hard' END
		WHERE attempts >= 50`)
}

// PurgePersonalData erases a user's personal study data inside tx (see the
// admin endpoint). It deliberately keeps the account, payments and any
// content the user authored.
func PurgePersonalData(tx *gorm.DB, userID uuid.UUID) error {
	stmts := []string{
		"DELETE FROM attempt_answers WHERE attempt_id IN (SELECT a.id FROM student_attempts a JOIN tests t ON t.id = a.test_id WHERE t.owner_user_id = @u AND t.origin = 'generated')",
		"DELETE FROM student_attempts WHERE test_id IN (SELECT id FROM tests WHERE owner_user_id = @u AND origin = 'generated')",
		"DELETE FROM test_questions WHERE test_id IN (SELECT id FROM tests WHERE owner_user_id = @u AND origin = 'generated')",
		"DELETE FROM tests WHERE owner_user_id = @u AND origin = 'generated'",
		"DELETE FROM bookmarks WHERE user_id = @u",
		"DELETE FROM question_notes WHERE user_id = @u",
		"DELETE FROM ratings WHERE user_id = @u",
		"DELETE FROM content_reports WHERE reporter_id = @u",
		"DELETE FROM custom_test_templates WHERE user_id = @u",
		"DELETE FROM custom_test_requests WHERE user_id = @u",
		"DELETE FROM student_question_states WHERE user_id = @u",
		"DELETE FROM flashcard_states WHERE user_id = @u",
		"DELETE FROM video_notes WHERE user_id = @u",
		"DELETE FROM push_tokens WHERE user_id = @u",
		"DELETE FROM notifications WHERE user_id = @u",
	}
	for _, s := range stmts {
		if err := tx.Exec(s, map[string]interface{}{"u": userID}).Error; err != nil {
			return err
		}
	}
	return nil
}
