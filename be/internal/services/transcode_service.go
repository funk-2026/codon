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
	// Stub implementation below checks if ffmpeg is available and logs the
	// command, but never actually transcodes. It deliberately leaves
	// hls_playlist_url unset either way — resolveContentURL falls back to a
	// presigned R2 GET on the raw uploaded file when there's no HLS URL, so
	// the video is still watchable (just not adaptive-bitrate HLS). Setting
	// a fake hls_playlist_url here would instead break playback outright,
	// since resolveContentURL trusts an explicit HLS URL over the R2
	// fallback.

	if _, err := exec.LookPath("ffmpeg"); err != nil {
		log.Printf("[Transcode] ffmpeg not found — marking ready without real transcode for item %s (raw upload will be served directly)", p.ContentItemID)
	} else {
		outputKey := strings.TrimSuffix(p.FileKey, filepath.Ext(p.FileKey)) + "/hls/playlist.m3u8"
		log.Printf("[Transcode] Would run: ffmpeg -i <input> -codec:v libx264 -hls_time 10 -hls_list_size 0 -f hls <output>")
		log.Printf("[Transcode] Input key: %s, Output key: %s (not actually produced by this stub)", p.FileKey, outputKey)
	}

	vReady := models.VideoReady
	return s.DB.WithContext(ctx).Model(&item).Updates(map[string]interface{}{
		"video_status": vReady,
		"updated_at":   time.Now(),
	}).Error
}
