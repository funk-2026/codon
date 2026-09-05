package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"codon-backend/internal/config"
	"codon-backend/internal/jobs"
	"codon-backend/internal/models"

	"gorm.io/gorm"
)

type StreamStatusService struct {
	DB *gorm.DB
}

func NewStreamStatusService(db *gorm.DB) *StreamStatusService {
	return &StreamStatusService{DB: db}
}

// HandleExhausted marks a ContentItem as VideoFailed once its
// stream_status_check job has permanently run out of retries without
// Cloudflare ever reporting the video ready — otherwise the item would sit
// at video_status "queued"/"transcoding" forever with no visible failure.
func (s *StreamStatusService) HandleExhausted(ctx context.Context, payload string) {
	var p jobs.StreamStatusCheckPayload
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

// HandleStreamStatusCheck polls Cloudflare Stream for a video's transcode
// status. It returns an error while the video is still processing so the
// job queue retries it with backoff, and returns nil once the video is
// ready (or has permanently failed) so the queue stops rechecking it.
func (s *StreamStatusService) HandleStreamStatusCheck(ctx context.Context, payload string) error {
	var p jobs.StreamStatusCheckPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("invalid payload: %w", err)
	}

	var item models.ContentItem
	if err := s.DB.WithContext(ctx).Where("id = ?", p.ContentItemID).First(&item).Error; err != nil {
		return fmt.Errorf("content item not found: %w", err)
	}

	status, err := fetchStreamVideoStatus(ctx, p.VideoUID)
	if err != nil {
		return fmt.Errorf("checking stream status: %w", err)
	}

	if status.errored {
		vs := models.VideoFailed
		return s.DB.WithContext(ctx).Model(&item).Updates(map[string]interface{}{
			"video_status": vs,
			"updated_at":   time.Now(),
		}).Error
	}

	if !status.ready {
		return fmt.Errorf("video %s still processing", p.VideoUID)
	}

	vs := models.VideoReady
	return s.DB.WithContext(ctx).Model(&item).Updates(map[string]interface{}{
		"video_status":     vs,
		"hls_playlist_url": status.hlsURL,
		"updated_at":       time.Now(),
	}).Error
}

type streamVideoStatus struct {
	ready   bool
	errored bool
	hlsURL  string
}

// fetchStreamVideoStatus calls Cloudflare Stream's "get video details" API,
// which reports transcode progress and — once done — the real HLS manifest
// URL to play the video (https://developers.cloudflare.com/stream/).
func fetchStreamVideoStatus(ctx context.Context, uid string) (streamVideoStatus, error) {
	apiURL := fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/stream/%s", config.AppConfig.CloudflareAccountID, uid)

	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return streamVideoStatus{}, err
	}
	req.Header.Set("Authorization", "Bearer "+config.AppConfig.CloudflareStreamAPIToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return streamVideoStatus{}, err
	}
	defer resp.Body.Close()

	var result struct {
		Success bool `json:"success"`
		Result  struct {
			ReadyToStream bool `json:"readyToStream"`
			Status        struct {
				State           string `json:"state"`
				ErrorReasonText string `json:"errorReasonText"`
			} `json:"status"`
			Playback struct {
				HLS string `json:"hls"`
			} `json:"playback"`
		} `json:"result"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return streamVideoStatus{}, err
	}

	if !result.Success {
		errMsg := "unknown stream error"
		if len(result.Errors) > 0 {
			errMsg = result.Errors[0].Message
		}
		return streamVideoStatus{}, fmt.Errorf("cloudflare stream error: %s", errMsg)
	}

	if result.Result.Status.State == "error" {
		return streamVideoStatus{errored: true}, nil
	}

	return streamVideoStatus{
		ready:  result.Result.ReadyToStream && result.Result.Playback.HLS != "",
		hlsURL: result.Result.Playback.HLS,
	}, nil
}
