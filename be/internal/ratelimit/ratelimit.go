// Package ratelimit is a small sliding-window limiter stored in Postgres, so
// the limit holds across API replicas (an in-memory map would multiply the
// limit by the number of instances and reset on every deploy).
package ratelimit

import (
	"context"
	"time"

	"codon-backend/internal/models"

	"gorm.io/gorm"
)

// Allow records one event for key and reports whether it is within `limit`
// events per `window`. A denied call records nothing.
func Allow(ctx context.Context, db *gorm.DB, key string, limit int, window time.Duration) (bool, error) {
	allowed := false
	err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// serialise concurrent checks of the same key
		if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", key).Error; err != nil {
			return err
		}
		var n int64
		if err := tx.Model(&models.RateEvent{}).Where("key = ? AND at > ?", key, time.Now().Add(-window)).Count(&n).Error; err != nil {
			return err
		}
		if int(n) >= limit {
			return nil
		}
		allowed = true
		return tx.Create(&models.RateEvent{Key: key, At: time.Now()}).Error
	})
	return allowed, err
}
