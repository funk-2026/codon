package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/settings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AppConfigHandler serves runtime configuration (flags, limits, option lists)
// so the app can change behaviour without a release.
type AppConfigHandler struct{ DB *gorm.DB }

func NewAppConfigHandler(db *gorm.DB) *AppConfigHandler { return &AppConfigHandler{DB: db} }

// ReportReasons is the list of report reasons offered by the app (data, so a
// new reason needs no app release).
var ReportReasons = []gin.H{
	{"key": "wrong_answer", "label": "Wrong answer marked"},
	{"key": "typo_unclear", "label": "Typo / unclear wording"},
	{"key": "duplicate", "label": "Duplicate"},
	{"key": "outdated", "label": "Outdated"},
	{"key": "image_issue", "label": "Image missing or unreadable"},
	{"key": "other", "label": "Other"},
}

// RatingRules describes which rating UX applies to each item type (D20).
var RatingRules = gin.H{
	"test": gin.H{"type": "stars", "min": 1, "max": 5}, "content": gin.H{"type": "stars", "min": 1, "max": 5},
	"brain_hack": gin.H{"type": "stars", "min": 1, "max": 5}, "flashcard_deck": gin.H{"type": "stars", "min": 1, "max": 5},
	"question": gin.H{"type": "thumbs", "values": []int{-1, 1}},
}

// Get godoc
//
//	@Summary		App configuration
//	@Description	Feature flags (default off), limits, report reasons, rating rules and bookmark collection labels. Sent with an ETag; send `If-None-Match` to get 304.
//	@Tags			Config
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Success		304
//	@Router			/api/v1/app-config [get]
func (h *AppConfigHandler) Get(c *gin.Context) {
	s := settings.Default
	flags := gin.H{}
	for _, k := range []string{"custom_test.enabled", "custom_test.tutor_mode", "custom_test.status_filters", "bookmarks.enabled", "reports.enabled", "ratings.enabled", "rich_content.math"} {
		flags[k] = s.Bool(k)
	}
	var cols []models.BookmarkCollection
	h.DB.Where("owner_id IS NULL AND is_active = true").Order("order_index ASC").Find(&cols)
	colOut := make([]gin.H, len(cols))
	for i, col := range cols {
		colOut[i] = gin.H{"id": col.ID, "key": col.Key, "label": col.Label}
	}
	cfg := gin.H{
		"version": 1,
		"flags":   flags,
		"limits": gin.H{
			"media": gin.H{"max_bytes": s.Int64("media.max_bytes"), "max_dimension": s.Int("media.max_dimension"), "allowed_mimes": s.List("media.allowed_mimes"),
				"max_images_per_question": s.Int("media.max_images_per_question"), "max_images_per_field": s.Int("media.max_images_per_field")},
			"rich_text": gin.H{"max_stem_chars": s.Int("richtext.max_stem_chars"), "max_option_chars": s.Int("richtext.max_option_chars"), "max_explanation_chars": s.Int("richtext.max_explanation_chars")},
			"import":    gin.H{"max_rows": s.Int("import.max_rows"), "max_bundle_bytes": s.Int64("import.max_bundle_bytes")},
			"custom_test": gin.H{"min_questions": s.Int("custom_test.min_questions"), "max_questions": s.Int("custom_test.max_questions"),
				"min_duration_minutes": s.Int("custom_test.min_duration_minutes"), "max_duration_minutes": s.Int("custom_test.max_duration_minutes")},
			"ratings": gin.H{"min_count_display": s.Int("ratings.min_count_display")},
		},
		"report_reasons":       ReportReasons,
		"rating_rules":         RatingRules,
		"bookmark_collections": colOut,
	}
	raw, _ := json.Marshal(cfg)
	sum := sha256.Sum256(raw)
	etag := `"` + hex.EncodeToString(sum[:8]) + `"`
	c.Header("ETag", etag)
	if c.GetHeader("If-None-Match") == etag {
		c.Status(http.StatusNotModified)
		return
	}
	c.Data(http.StatusOK, "application/json; charset=utf-8", raw)
}

var adminSettingPrefixes = []string{"custom_test.", "reports.", "media.", "import.", "richtext.", "analytics.", "pool.", "ratings.", "bookmarks.", "attempt.", "rich_content.", "test_questions."}

func isAdminSetting(key string) bool {
	for _, p := range adminSettingPrefixes {
		if strings.HasPrefix(key, p) {
			return true
		}
	}
	return false
}

// GetSettings godoc
//
//	@Summary		List tunable settings with current + default values (Admin)
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/admin/settings/custom-test [get]
func (h *AppConfigHandler) GetSettings(c *gin.Context) {
	keys := make([]string, 0)
	for k := range settings.Defaults {
		if isAdminSetting(k) {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	out := make([]gin.H, len(keys))
	for i, k := range keys {
		out[i] = gin.H{"key": k, "value": settings.Default.String(k), "default": settings.Defaults[k]}
	}
	c.JSON(http.StatusOK, gin.H{"settings": out})
}

type patchSettingsRequest struct {
	Values map[string]string `json:"values"`
}

// PatchSettings godoc
//
//	@Summary		Change tunable settings (Admin)
//	@Description	Unknown keys and values that don't parse as the setting's type are rejected; every change is written to the admin audit log.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		patchSettingsRequest	true	"key → value"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/admin/settings/custom-test [patch]
func (h *AppConfigHandler) PatchSettings(c *gin.Context) {
	admin := middleware.GetUser(c)
	var req patchSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Values) == 0 {
		respondErr(c, http.StatusBadRequest, "bad_request", "values is required")
		return
	}
	for k, v := range req.Values {
		def, ok := settings.Defaults[k]
		if !ok || !isAdminSetting(k) {
			respondErr(c, http.StatusBadRequest, "unknown_setting", "unknown setting: "+k)
			return
		}
		switch {
		case def == "true" || def == "false":
			if v != "true" && v != "false" {
				respondErr(c, http.StatusBadRequest, "invalid_value", k+" must be true or false")
				return
			}
		case isNumeric(def):
			if _, err := strconv.ParseFloat(v, 64); err != nil {
				respondErr(c, http.StatusBadRequest, "invalid_value", k+" must be a number")
				return
			}
		}
	}
	for k, v := range req.Values {
		before := settings.Default.String(k)
		if err := settings.Default.Set(k, v, &admin.ID); err != nil {
			respondErr(c, http.StatusInternalServerError, "internal", "failed to save "+k)
			return
		}
		b, _ := json.Marshal(before)
		a, _ := json.Marshal(v)
		h.DB.Create(&models.AdminAuditLog{ActorID: admin.ID, Action: "setting.update", Target: k, Before: b, After: a})
	}
	h.GetSettings(c)
}

func isNumeric(s string) bool {
	_, err := strconv.ParseFloat(s, 64)
	return err == nil
}
