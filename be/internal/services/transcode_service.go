package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"codon-backend/internal/jobs"
	"codon-backend/internal/models"

	"gorm.io/gorm"
)

type TranscodeService struct {
	DB *gorm.DB
}

func NewTranscodeService(db *gorm.DB) *TranscodeService {
	return &TranscodeService{DB: db}
}

// HandleTranscode is the background job handler for video transcoding.
func (s *TranscodeService) HandleTranscode(ctx context.Context, payload string) error {
	var p jobs.TranscodePayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("invalid payload: %w", err)
	}

	var item models.ContentItem
	if err := s.DB.WithContext(ctx).Where("id = ?", p.ContentItemID).First(&item).Error; err != nil {
		return fmt.Errorf("content item not found: %w", err)
	}

	// Update status to transcoding
	vs := models.VideoTranscoding
	s.DB.WithContext(ctx).Model(&item).Updates(map[string]interface{}{
		"video_status": vs,
		"updated_at":   time.Now(),
	})

	// In a real deployment:
	// 1. Download file from S3 using file_key to a temp dir
	// 2. Run ffmpeg to produce HLS segments
	// 3. Upload HLS playlist + segments back to S3
	// 4. Update hls_playlist_url and video_status=ready
	//
	// Stub implementation below checks if ffmpeg is available and logs the command.

	outputKey := strings.TrimSuffix(p.FileKey, filepath.Ext(p.FileKey)) + "/hls/playlist.m3u8"

	if _, err := exec.LookPath("ffmpeg"); err != nil {
		log.Printf("[Transcode] ffmpeg not found — marking stub ready for item %s", p.ContentItemID)
		// Stub: mark ready with a placeholder
		vReady := models.VideoReady
		hlsURL := fmt.Sprintf("s3://%s", outputKey)
		s.DB.WithContext(ctx).Model(&item).Updates(map[string]interface{}{
			"video_status":     vReady,
			"hls_playlist_url": hlsURL,
			"updated_at":       time.Now(),
		})
		return nil
	}

	// Real ffmpeg transcode command (requires local file path — needs S3 download first)
	log.Printf("[Transcode] Would run: ffmpeg -i <input> -codec:v libx264 -hls_time 10 -hls_list_size 0 -f hls <output>")
	log.Printf("[Transcode] Input key: %s, Output key: %s", p.FileKey, outputKey)

	// Mark as ready (in a real impl, this would run after ffmpeg + re-upload succeeds)
	vReady := models.VideoReady
	hlsURL := outputKey
	return s.DB.WithContext(ctx).Model(&item).Updates(map[string]interface{}{
		"video_status":     vReady,
		"hls_playlist_url": hlsURL,
		"updated_at":       time.Now(),
	}).Error
}
