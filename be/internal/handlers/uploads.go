package handlers

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

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
//	@Description	Returns a presigned S3 PUT URL valid for 15 minutes. The client uses this URL to upload the file directly to object storage without routing it through the backend. After upload, use the returned file_key when referencing the file in other API calls.
//	@Tags			Uploads
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		presignRequest	true	"Upload details"
//	@Success		200		{object}	presignResponse
//	@Failure		400		{object}	errorResponse
//	@Failure		401		{object}	errorResponse
//	@Router			/uploads/presign [post]
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
