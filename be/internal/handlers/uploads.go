package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"codon-backend/internal/config"
	"codon-backend/internal/middleware"
	"codon-backend/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UploadHandler struct{}

func NewUploadHandler() *UploadHandler { return &UploadHandler{} }

var allowedPurposes = map[string][]string{
	"kyc_document":  {"image/jpeg", "image/png", "application/pdf"},
	"video":         {"video/mp4", "video/quicktime", "video/x-msvideo"},
	"csv":           {"text/csv", "application/csv", "application/vnd.ms-excel"},
	"profile_photo": {"image/jpeg", "image/png", "image/webp"},
}

// Presign godoc
//
//	@Summary		Generate presigned upload URL
//	@Description	Returns a presigned S3 PUT URL (for Cloudflare R2 files) or Cloudflare Stream Direct Upload URL (for videos) valid for 15 minutes. The client uses this URL to upload the file directly without routing through backend. After upload, use the returned file_key when referencing the file in other API calls.
//	@Tags			Uploads
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		presignRequest	true	"Upload details"
//	@Success		200		{object}	presignResponse
//	@Failure		400		{object}	errorResponse
//	@Failure		401		{object}	errorResponse
//	@Router			/api/v1/uploads/presign [post]
func (h *UploadHandler) Presign(c *gin.Context) {
	user := middleware.GetUser(c)

	var req presignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	allowedTypes, ok := allowedPurposes[req.Purpose]
	if !ok {
		c.JSON(http.StatusBadRequest, errorResponse{Error: fmt.Sprintf("invalid purpose; allowed: %v", getKeys(allowedPurposes))})
		return
	}

	if !contains(allowedTypes, req.ContentType) {
		c.JSON(http.StatusBadRequest, errorResponse{Error: fmt.Sprintf("content_type %s not allowed for purpose %s", req.ContentType, req.Purpose)})
		return
	}

	// 1. Cloudflare Stream for Videos
	if req.Purpose == "video" {
		if config.AppConfig.CloudflareAccountID == "" || config.AppConfig.CloudflareStreamAPIToken == "" {
			log.Printf("[Presign] Cloudflare Stream not configured (CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_STREAM_API_TOKEN blank) — falling back to R2 for video upload")
		} else {
			uploadURL, videoUID, err := createCloudflareStreamDirectUpload(c.Request.Context())
			if err == nil {
				c.JSON(http.StatusOK, presignResponse{
					UploadURL: uploadURL,
					FileKey:   "stream:" + videoUID,
				})
				return
			}
			log.Printf("[Presign] Cloudflare Stream direct_upload failed, falling back to R2: %v", err)
		}
	}

	// 2. Cloudflare R2 / S3 for generic files (CSV, docs, KYC, profile photos)
	ext := filepath.Ext(req.FileName)
	key := fmt.Sprintf("%s/%s/%s%s", req.Purpose, user.ID, uuid.New().String(), ext)
	key = strings.ToLower(key)

	if storage.Client == nil {
		c.JSON(http.StatusOK, presignResponse{
			UploadURL: "https://example-s3.local/upload?stub=true",
			FileKey:   key,
		})
		return
	}

	url, err := storage.Client.PresignPut(c.Request.Context(), key, req.ContentType, 15*time.Minute)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to generate upload URL"})
		return
	}

	c.JSON(http.StatusOK, presignResponse{UploadURL: url, FileKey: key})
}

func createCloudflareStreamDirectUpload(ctx context.Context) (string, string, error) {
	apiURL := fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/stream/direct_upload", config.AppConfig.CloudflareAccountID)
	reqBody, _ := json.Marshal(map[string]interface{}{
		"maxDurationSeconds": 7200,
	})

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+config.AppConfig.CloudflareStreamAPIToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	var result struct {
		Success bool `json:"success"`
		Result  struct {
			UploadURL string `json:"uploadURL"`
			UID       string `json:"uid"`
		} `json:"result"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", err
	}

	if !result.Success || result.Result.UploadURL == "" {
		errMsg := "unknown stream error"
		if len(result.Errors) > 0 {
			errMsg = result.Errors[0].Message
		}
		return "", "", fmt.Errorf("cloudflare stream error: %s", errMsg)
	}

	return result.Result.UploadURL, result.Result.UID, nil
}

func getKeys(m map[string][]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func contains(slice []string, val string) bool {
	for _, s := range slice {
		if s == val {
			return true
		}
	}
	return false
}

// ── Request / Response types ──────────────────────────────────────────────────

type presignRequest struct {
	FileName    string `json:"file_name"    example:"lecture.mp4"`
	ContentType string `json:"content_type" example:"video/mp4"`
	// Purpose must be one of: kyc_document, video, csv, profile_photo
	Purpose string `json:"purpose" example:"video" enums:"kyc_document,video,csv,profile_photo"`
}

type presignResponse struct {
	UploadURL string `json:"upload_url" example:"https://s3.amazonaws.com/codon/video/...?X-Amz-Signature=..."`
	FileKey   string `json:"file_key"   example:"video/user-uuid/file-uuid.mp4"`
}
