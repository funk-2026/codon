package services

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"codon-backend/internal/models"
	"codon-backend/internal/settings"
)

// Reset scopes a student can clear on their own account.
const (
	ResetBookmarks  = "bookmarks"
	ResetQBank      = "qbank"
	ResetFlashcards = "flashcards"
	ResetPulse      = "pulse"
)

var ResetScopes = []string{ResetBookmarks, ResetQBank, ResetFlashcards, ResetPulse}

func ValidResetScope(s string) bool {
	for _, x := range ResetScopes {
		if x == s {
			return true
		}
	}
	return false
}

func resetCooldown() time.Duration {
	d := settings.Int("resets.cooldown_days")
	if d <= 0 {
		d = 90
	}
	return time.Duration(d) * 24 * time.Hour
}

// ResetStatus is, per scope, when it was last reset and when it may be reset again.
type ResetStatus struct {
	Scope       string     `json:"scope"`
	LastResetAt *time.Time `json:"last_reset_at,omitempty"`
	NextAllowed *time.Time `json:"next_allowed_at,omitempty"`
	CanReset    bool       `json:"can_reset"`
}

func ResetStatuses(ctx context.Context, db *gorm.DB, userID uuid.UUID, now time.Time) []ResetStatus {
	var rows []models.UserReset
	db.WithContext(ctx).Where("user_id = ?", userID).Find(&rows)
	last := map[string]time.Time{}
	for _, r := range rows {
		last[r.Scope] = r.ResetAt
	}
	out := make([]ResetStatus, 0, len(ResetScopes))
	for _, sc := range ResetScopes {
		st := ResetStatus{Scope: sc, CanReset: true}
		if t, ok := last[sc]; ok {
			t := t
			next := t.Add(resetCooldown())
			st.LastResetAt, st.NextAllowed = &t, &next
			st.CanReset = !now.Before(next)
		}
		out = append(out, st)
	}
	return out
}

// archiveAndDelete copies the matching rows into reset_archives as JSON, then deletes them. The archive is what keeps
// "backend records stay" true without leaving the rows visible in the app.
func archiveAndDelete(tx *gorm.DB, userID uuid.UUID, scope, table, where string, args ...interface{}) (int64, error) {
	var n int64
	if err := tx.Raw("SELECT count(*) FROM "+table+" WHERE "+where, args...).Scan(&n).Error; err != nil || n == 0 {
		return 0, err
	}
	if err := tx.Exec("INSERT INTO reset_archives (id, user_id, scope, rows, created_at) SELECT gen_random_uuid(), ?, ?, COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb), now() FROM "+table+" t WHERE "+where,
		append([]interface{}{userID, scope + ":" + table}, args...)...).Error; err != nil {
		return 0, err
	}
	res := tx.Exec("DELETE FROM "+table+" WHERE "+where, args...)
	return res.RowsAffected, res.Error
}

// ResetContent clears one kind of the student's own study data, once per cooldown. It returns the rows removed.
func ResetContent(ctx context.Context, db *gorm.DB, userID uuid.UUID, scope string, now time.Time) (int64, error) {
	if !ValidResetScope(scope) {
		return 0, Coded(http.StatusBadRequest, "invalid_scope", "scope must be bookmarks, qbank, flashcards or pulse")
	}
	var removed int64
	err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var prev models.UserReset
		if tx.Where("user_id = ? AND scope = ?", userID, scope).First(&prev).Error == nil {
			if next := prev.ResetAt.Add(resetCooldown()); now.Before(next) {
				return Coded(http.StatusConflict, "reset_cooldown", "this can be reset once every three months", map[string]interface{}{"next_allowed_at": next})
			}
		}
		var err error
		switch scope {
		case ResetBookmarks:
			removed, err = archiveAndDelete(tx, userID, scope, "bookmarks", "user_id = ?", userID)
		case ResetFlashcards:
			removed, err = archiveAndDelete(tx, userID, scope, "flashcard_states", "user_id = ?", userID)
		case ResetQBank:
			const mine = "SELECT a.id FROM student_attempts a JOIN tests t ON t.id = a.test_id WHERE a.user_id = ? AND t.module_type = 'qbank' AND t.origin <> 'generated'"
			var a, b int64
			if a, err = archiveAndDelete(tx, userID, scope, "attempt_answers", "attempt_id IN ("+mine+")", userID); err != nil {
				return err
			}
			if b, err = archiveAndDelete(tx, userID, scope, "student_attempts", "id IN ("+mine+")", userID); err != nil {
				return err
			}
			var c int64
			c, err = archiveAndDelete(tx, userID, scope, "student_question_states", "user_id = ?", userID)
			removed = a + b + c
		case ResetPulse:
			var a int64
			if a, err = archiveAndDelete(tx, userID, scope, "pulse_reads", "user_id = ?", userID); err != nil {
				return err
			}
			var b int64
			b, err = archiveAndDelete(tx, userID, scope, "bookmarks", "user_id = ? AND item_type = 'pulse'", userID)
			removed = a + b
		}
		if err != nil {
			return err
		}
		return tx.Save(&models.UserReset{UserID: userID, Scope: scope, ResetAt: now}).Error
	})
	return removed, err
}
