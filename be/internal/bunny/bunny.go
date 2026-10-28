package bunny

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"codon-backend/internal/config"
)

const (
	baseURL = "https://video.bunnycdn.com"

	// Bunny Video Status Codes
	StatusCreated     = 0
	StatusUploaded    = 1
	StatusProcessing  = 2
	StatusTranscoding = 3
	StatusFinished    = 4
	StatusError       = 5
	StatusUploadFailed = 6
)

var httpClient = &http.Client{Timeout: 15 * time.Second}

// TUSAuth represents the credentials returned to the client to perform a resumable TUS upload directly to Bunny.
type TUSAuth struct {
	Signature  string `json:"signature"`
	Expires    int64  `json:"expires"`
	LibraryID  string `json:"library_id"`
	VideoID    string `json:"video_id"`
}

// VideoDetails is the response returned by Bunny Stream when fetching video metadata.
type VideoDetails struct {
	VideoLibraryID int     `json:"videoLibraryId"`
	GUID           string  `json:"guid"`
	Title          string  `json:"title"`
	Status         int     `json:"status"` // 0..6
	EncodeProgress int     `json:"encodeProgress"`
	Length         int     `json:"length"` // duration in seconds
	Width          int     `json:"width"`
	Height         int     `json:"height"`
	ErrorMessage   string  `json:"errorMessage,omitempty"`
}

// IsConfigured returns true if Bunny Stream credentials are present.
func IsConfigured() bool {
	return config.AppConfig.BunnyStreamLibraryID != "" && config.AppConfig.BunnyStreamAPIKey != ""
}

// CreateVideo initializes a new video entry in the Bunny Stream library and returns its GUID.
func CreateVideo(ctx context.Context, title string) (string, error) {
	if !IsConfigured() {
		return "", errors.New("bunny stream is not configured")
	}

	url := fmt.Sprintf("%s/library/%s/videos", baseURL, config.AppConfig.BunnyStreamLibraryID)
	payload, err := json.Marshal(map[string]interface{}{
		"title": title,
	})
	if err != nil {
		return "", fmt.Errorf("marshalling video create payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(payload))
	if err != nil {
		return "", fmt.Errorf("creating http request: %w", err)
	}
	req.Header.Set("AccessKey", config.AppConfig.BunnyStreamAPIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("calling bunny create video api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("bunny create video api returned status %d", resp.StatusCode)
	}

	var res struct {
		GUID    string `json:"guid"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", fmt.Errorf("decoding bunny create video response: %w", err)
	}
	if res.GUID == "" {
		return "", fmt.Errorf("bunny create video did not return a guid: %s", res.Message)
	}

	return res.GUID, nil
}

// GenerateTUSAuth computes the SHA256 signature for client-side direct TUS upload.
// Formula: SHA256(library_id + api_key + expiration_time + video_id)
func GenerateTUSAuth(videoGUID string, expiry time.Duration) TUSAuth {
	expiresAt := time.Now().Add(expiry).Unix()
	libID := config.AppConfig.BunnyStreamLibraryID
	apiKey := config.AppConfig.BunnyStreamAPIKey

	raw := libID + apiKey + strconv.FormatInt(expiresAt, 10) + videoGUID
	h := sha256.Sum256([]byte(raw))
	sig := hex.EncodeToString(h[:])

	return TUSAuth{
		Signature: sig,
		Expires:   expiresAt,
		LibraryID: libID,
		VideoID:   videoGUID,
	}
}

// GetVideoStatus fetches video details and transcoding status from Bunny Stream.
func GetVideoStatus(ctx context.Context, videoGUID string) (*VideoDetails, error) {
	if !IsConfigured() {
		return nil, errors.New("bunny stream is not configured")
	}

	url := fmt.Sprintf("%s/library/%s/videos/%s", baseURL, config.AppConfig.BunnyStreamLibraryID, videoGUID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating http request: %w", err)
	}
	req.Header.Set("AccessKey", config.AppConfig.BunnyStreamAPIKey)
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("calling bunny get video status api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("bunny get video status api returned status %d", resp.StatusCode)
	}

	var details VideoDetails
	if err := json.NewDecoder(resp.Body).Decode(&details); err != nil {
		return nil, fmt.Errorf("decoding bunny video details: %w", err)
	}

	return &details, nil
}

// DeleteVideo removes a video from Bunny Stream.
func DeleteVideo(ctx context.Context, videoGUID string) error {
	if !IsConfigured() {
		return nil
	}

	url := fmt.Sprintf("%s/library/%s/videos/%s", baseURL, config.AppConfig.BunnyStreamLibraryID, videoGUID)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("creating http request: %w", err)
	}
	req.Header.Set("AccessKey", config.AppConfig.BunnyStreamAPIKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("calling bunny delete video api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusNotFound {
		return fmt.Errorf("bunny delete video api returned status %d", resp.StatusCode)
	}
	return nil
}

// PlaybackURL constructs the standard HLS playlist URL using the configured Bunny CDN Host.
func PlaybackURL(videoGUID string) string {
	cdnHost := config.AppConfig.BunnyStreamCDNHost
	if cdnHost == "" {
		// Fallback to standard bunny cdn format if cdn host is not set
		cdnHost = fmt.Sprintf("vz-%s.b-cdn.net", config.AppConfig.BunnyStreamLibraryID)
	}
	cdnHost = strings.TrimPrefix(cdnHost, "https://")
	cdnHost = strings.TrimPrefix(cdnHost, "http://")
	cdnHost = strings.TrimRight(cdnHost, "/")

	return fmt.Sprintf("https://%s/%s/playlist.m3u8", cdnHost, videoGUID)
}

