package handlers

import (
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"codon-backend/internal/bunny"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
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
	"lecture_pdf":   {"application/pdf"}, // notes / annotated PDFs attached to a lecture
}

// Presign godoc
//
//	@Summary		Generate presigned upload URL
//	@Description	Returns a presigned S3 PUT URL (for Cloudflare R2 files) or Bunny Stream TUS upload credentials (for videos) valid for 15 minutes. The client uses this URL/credentials to upload the file directly without routing through backend. After upload, use the returned file_key when referencing the file in other API calls.
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

	// 1. Bunny Stream for Videos (TUS upload)
	if req.Purpose == "video" {
		if user.Role != models.RoleTeacher && user.Role != models.RoleAdmin {
			respondErr(c, http.StatusForbidden, "forbidden", "only teachers or admins may upload videos")
			return
		}

		if !bunny.IsConfigured() {
			log.Printf("[Presign] Bunny Stream not configured (BUNNY_STREAM_LIBRARY_ID/BUNNY_STREAM_API_KEY blank) — returning stub")
			stubGUID := uuid.New().String()
			c.JSON(http.StatusOK, presignResponse{
				UploadURL: "https://video.bunnycdn.com/tusupload",
				FileKey:   "bunny:" + stubGUID,
				TUSAuth: &bunny.TUSAuth{
					Signature: "stub",
					Expires:   time.Now().Add(2 * time.Hour).Unix(),
					LibraryID: "stub",
					VideoID:   stubGUID,
				},
			})
			return
		}

		title := req.FileName
		if title == "" {
			title = "Untitled Video"
		}
		videoGUID, err := bunny.CreateVideo(c.Request.Context(), title)
		if err != nil {
			log.Printf("[Presign] Bunny Stream CreateVideo failed: %v", err)
			c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to initialize video upload with Bunny Stream"})
			return
		}

		auth := bunny.GenerateTUSAuth(videoGUID, 2*time.Hour)
		c.JSON(http.StatusOK, presignResponse{
			UploadURL: "https://video.bunnycdn.com/tusupload",
			FileKey:   "bunny:" + videoGUID,
			TUSAuth:   &auth,
		})
		return
	}

	// 2. Cloudflare R2 / S3 for generic files (CSV, docs, KYC, profile photos, lecture PDFs)
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
	// Purpose must be one of: kyc_document, video, csv, profile_photo, lecture_pdf
	Purpose string `json:"purpose" example:"video" enums:"kyc_document,video,csv,profile_photo,lecture_pdf"`
}

type presignResponse struct {
	UploadURL string         `json:"upload_url" example:"https://s3.amazonaws.com/codon/video/...?X-Amz-Signature=..."`
	FileKey   string         `json:"file_key"   example:"bunny:657bb740-a71b-4529-a012-528021c31a92"`
	TUSAuth   *bunny.TUSAuth `json:"tus_auth,omitempty"`
}
