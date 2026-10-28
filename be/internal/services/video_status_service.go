package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"codon-backend/internal/bunny"
	"codon-backend/internal/jobs"
	"codon-backend/internal/models"

	"gorm.io/gorm"
)

type VideoStatusService struct {
	DB *gorm.DB
}

func NewVideoStatusService(db *gorm.DB) *VideoStatusService {
	return &VideoStatusService{DB: db}
}

// Deprecated aliases for backwards compatibility
type StreamStatusService = VideoStatusService

func NewStreamStatusService(db *gorm.DB) *VideoStatusService {
	return NewVideoStatusService(db)
}

// HandleExhausted marks a ContentItem as VideoFailed once its
// video_status_check job has permanently run out of retries without
// Bunny ever reporting the video finished.
func (s *VideoStatusService) HandleExhausted(ctx context.Context, payload string) {
	var p jobs.VideoStatusCheckPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return
	}
	vs := models.VideoFailed
	s.DB.WithContext(ctx).Model(&models.ContentItem{}).
		Where("id = ?", p.ContentItemID).
		Updates(map[string]interface{}{
			"video_status": vs,
			"updated_at":   time.Now(),
		})
}

// HandleVideoStatusCheck polls Bunny Stream for a video's transcode status.
// It returns an error while the video is still processing so the job queue
// retries with backoff, and returns nil once the video is ready (or permanently failed).
func (s *VideoStatusService) HandleVideoStatusCheck(ctx context.Context, payload string) error {
	var p jobs.VideoStatusCheckPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("invalid payload: %w", err)
	}

	var item models.ContentItem
	if err := s.DB.WithContext(ctx).Where("id = ?", p.ContentItemID).First(&item).Error; err != nil {
		return fmt.Errorf("content item not found: %w", err)
	}

	guid := p.GUID()
	if guid == "" {
		return fmt.Errorf("missing video guid in payload")
	}

	details, err := bunny.GetVideoStatus(ctx, guid)
	if err != nil {
		return fmt.Errorf("checking bunny video status for %s: %w", guid, err)
	}

	switch details.Status {
	case bunny.StatusFinished:
		vs := models.VideoReady
		hlsURL := bunny.PlaybackURL(guid)
		log.Printf("[VideoStatus] Video %s ready on Bunny Stream; HLS: %s", guid, hlsURL)
		return s.DB.WithContext(ctx).Model(&item).Updates(map[string]interface{}{
			"video_status":     vs,
			"hls_playlist_url": hlsURL,
			"updated_at":       time.Now(),
		}).Error

	case bunny.StatusError, bunny.StatusUploadFailed:
		vs := models.VideoFailed
		log.Printf("[VideoStatus] Video %s failed on Bunny Stream (status %d): %s", guid, details.Status, details.ErrorMessage)
		return s.DB.WithContext(ctx).Model(&item).Updates(map[string]interface{}{
			"video_status": vs,
			"updated_at":   time.Now(),
		}).Error

	default:
		// 0: Created, 1: Uploaded, 2: Processing, 3: Transcoding
		log.Printf("[VideoStatus] Video %s still processing on Bunny Stream (status %d, progress %d%%)", guid, details.Status, details.EncodeProgress)
		return fmt.Errorf("video %s still processing (status %d)", guid, details.Status)
	}
}

// HandleStreamStatusCheck is an alias for HandleVideoStatusCheck
func (s *VideoStatusService) HandleStreamStatusCheck(ctx context.Context, payload string) error {
	return s.HandleVideoStatusCheck(ctx, payload)
}

