package services

import (
	"context"
	"time"

	"codon-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// reminder points: bit, how long before the start.
var examReminderPoints = []struct {
	bit    int
	before time.Duration
	when   string
}{ // tightest first: a test registered for late gets the reminder that fits, not all three
	{4, 10 * time.Minute, "in 10 minutes"},
	{2, time.Hour, "within the hour"},
	{1, 24 * time.Hour, "tomorrow"},
}

// ExamReminders tells students who tapped "remind me" that a live test is close: a day, an hour and ten minutes before.
// Each reminder goes out once per test. Returns how many notifications were created.
func ExamReminders(ctx context.Context, db *gorm.DB, now time.Time) int {
	var tests []models.Test
	db.WithContext(ctx).Where("delivery = ? AND status = ? AND opens_at IS NOT NULL AND opens_at > ? AND opens_at <= ?",
		models.DeliveryLive, models.StatusPublished, now, now.Add(25*time.Hour)).Find(&tests)
	sent := 0
	for i := range tests {
		t := &tests[i]
		until := t.OpensAt.Sub(now)
		for _, p := range examReminderPoints {
			if t.RemindersSent&p.bit != 0 || until > p.before {
				continue
			}
			var users []uuid.UUID
			db.WithContext(ctx).Model(&models.TestRegistration{}).Where("test_id = ?", t.ID).Pluck("user_id", &users)
			for _, u := range users {
				Notify(db.WithContext(ctx), u, "exam_reminder", t.Title+" starts "+p.when, "Open the app a few minutes early to read the instructions.",
					map[string]interface{}{"id": t.ID, "route": "/(student)/test-pre-start?id=" + t.ID.String()})
				sent++
			}
			// Mark this point (and any earlier one we skipped) as done so a late-registered test does not spam.
			mask := p.bit
			for _, q := range examReminderPoints {
				if q.before >= p.before {
					mask |= q.bit
				}
			}
			db.WithContext(ctx).Model(&models.Test{}).Where("id = ?", t.ID).Update("reminders_sent", gorm.Expr("reminders_sent | ?", mask))
			break
		}
	}
	return sent
}

// ExamResultsReady announces results once their release time has passed, to everyone who submitted.
func ExamResultsReady(ctx context.Context, db *gorm.DB, now time.Time) int {
	var tests []models.Test
	db.WithContext(ctx).Where("delivery = ? AND results_notified_at IS NULL AND opens_at IS NOT NULL", models.DeliveryLive).Find(&tests)
	sent := 0
	for i := range tests {
		t := &tests[i]
		if !ResultsReleased(t, now) {
			continue
		}
		var users []uuid.UUID
		db.WithContext(ctx).Model(&models.StudentAttempt{}).Where("test_id = ? AND status = ?", t.ID, models.AttemptSubmitted).Distinct().Pluck("user_id", &users)
		for _, u := range users {
			Notify(db.WithContext(ctx), u, "exam_results", "Results are out: "+t.Title, "See your score, rank and the answers.",
				map[string]interface{}{"id": t.ID, "route": "/(student)/test-history"})
			sent++
		}
		db.WithContext(ctx).Model(&models.Test{}).Where("id = ?", t.ID).Update("results_notified_at", now)
	}
	return sent
}
