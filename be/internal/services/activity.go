package services

import (
	"context"
	"time"

	"codon-backend/internal/clock"
	"codon-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// RecordDailyActivity marks the app-day of `at` as active (drives the streak).
func RecordDailyActivity(db *gorm.DB, userID uuid.UUID, at time.Time) error {
	return db.Clauses(clause.OnConflict{DoNothing: true}).
		Create(&models.DailyActivity{UserID: userID, Date: clock.AppDay(at), CreatedAt: at}).Error
}

// ActiveDays returns the set of app-days (YYYY-MM-DD) on which the user was
// active during the last `days` days, in one query.
func ActiveDays(ctx context.Context, db *gorm.DB, userID uuid.UUID, now time.Time, days int) (map[string]bool, error) {
	from := clock.AppDay(now).AddDate(0, 0, -days)
	var dates []time.Time
	if err := db.WithContext(ctx).Model(&models.DailyActivity{}).
		Where("user_id = ? AND date >= ?", userID, from).Pluck("date", &dates).Error; err != nil {
		return nil, err
	}
	out := make(map[string]bool, len(dates))
	for _, d := range dates {
		out[d.Format("2006-01-02")] = true
	}
	return out, nil
}

// Streak counts consecutive active app-days ending today. A day without
// activity today does not break the streak until the day is over.
func Streak(active map[string]bool, now time.Time) int {
	today := clock.AppDay(now)
	n := 0
	for i := 0; i < 400; i++ {
		if active[today.AddDate(0, 0, -i).Format("2006-01-02")] {
			n++
		} else if i > 0 {
			break
		}
	}
	return n
}

// Last7 reports activity for the 7 app-days ending today (oldest first).
func Last7(active map[string]bool, now time.Time) []bool {
	today := clock.AppDay(now)
	out := make([]bool, 7)
	for i := 0; i < 7; i++ {
		out[6-i] = active[today.AddDate(0, 0, -i).Format("2006-01-02")]
	}
	return out
}
