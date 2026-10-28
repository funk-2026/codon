package services

import (
	"context"
	"log"

	"codon-backend/internal/models"

	"gorm.io/gorm"
)

// BackfillContentHashes computes content_hash for questions that predate the
// column (empty hash). It is chunked and resumable: each run handles up to
// `limit` rows and returns how many it updated, so it can be called at boot
// and again until it returns 0.
func BackfillContentHashes(ctx context.Context, db *gorm.DB, limit int) (int, error) {
	var qs []models.Question
	if err := db.WithContext(ctx).Where("content_hash = '' OR content_hash IS NULL").Limit(limit).Find(&qs).Error; err != nil {
		return 0, err
	}
	for i := range qs {
		h := ContentHash(ctx, db, &qs[i])
		if err := db.WithContext(ctx).Model(&models.Question{}).Where("id = ?", qs[i].ID).UpdateColumn("content_hash", h).Error; err != nil {
			return i, err
		}
	}
	return len(qs), nil
}

// BackfillAllContentHashes loops BackfillContentHashes until nothing is left.
func BackfillAllContentHashes(ctx context.Context, db *gorm.DB) {
	total := 0
	for {
		n, err := BackfillContentHashes(ctx, db, 500)
		total += n
		if err != nil {
			log.Printf("[backfill] content hashes: %v", err)
			return
		}
		if n == 0 {
			break
		}
	}
	if total > 0 {
		log.Printf("[backfill] computed content_hash for %d questions", total)
	}
}
