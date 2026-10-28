// Package settings wraps the platform_settings key/value table with typed,
// cached getters and a registry of defaults, so every tunable in the custom
// test module can be changed by an admin without a release.
package settings

import (
	"strconv"
	"strings"
	"sync"
	"time"

	"codon-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Defaults is the registry of every tunable and its default value. A key that
// is absent from the table falls back to this value. Feature flags default to
// "false" so nothing ships live until an admin turns it on.
var Defaults = map[string]string{
	"kyc_required": "false",

	// Rollback switch for reading test membership via test_questions (D1-B).
	"test_questions.read_via_join": "true",

	// Feature flags
	"custom_test.enabled":        "false",
	"custom_test.tutor_mode":     "false",
	"custom_test.status_filters": "false",
	"bookmarks.enabled":          "false",
	"reports.enabled":            "false",
	"ratings.enabled":            "false",
	"rich_content.math":          "false",

	// Custom test limits
	"custom_test.min_questions":          "5",
	"custom_test.max_questions":          "90",
	"custom_test.min_duration_minutes":   "5",
	"custom_test.max_duration_minutes":   "180",
	"custom_test.eligible_sources":       "qbank,practice,pyq",
	"custom_test.free_max_questions":     "10",
	"custom_test.free_daily_generations": "3",
	"custom_test.max_active_generated":   "50",
	"custom_test.generated_ttl_days":     "30",
	"custom_test.max_templates":          "30",
	"custom_test.count_rate_per_minute":  "60",
	"custom_test.generate_rate_per_hour": "60",

	// Attempts
	"attempt.answer_grace_seconds": "10",

	// Media
	"media.max_bytes":               "5242880",
	"media.max_dimension":           "4096",
	"media.allowed_mimes":           "image/jpeg,image/png,image/webp",
	"media.max_images_per_question": "6",
	"media.max_images_per_field":    "2",
	"media.teacher_quota_bytes":     "2147483648",
	"media.presign_rate_per_hour":   "200",
	"media.url_ttl_minutes":         "120",

	// Import
	"import.max_rows":         "2000",
	"import.max_bundle_bytes": "104857600",
	"import.max_bundle_files": "1000",

	// Rich text
	"richtext.max_stem_chars":        "4000",
	"richtext.max_option_chars":      "1000",
	"richtext.max_explanation_chars": "6000",

	// Reports
	"reports.auto_hold_threshold": "3",
	"reports.auto_hold_reasons":   "wrong_answer,image_issue",
	"reports.rate_per_day":        "30",

	// Analytics
	"analytics.weak_accuracy_threshold": "0.5",
	"analytics.min_answers":             "10",
	"analytics.cohort_min_attempts":     "30",
	"pool.low_inventory_floor":          "30",

	// Ratings
	"ratings.min_watch_seconds": "60",
	"ratings.min_count_display": "5",
}

type entry struct {
	value   string
	found   bool
	expires time.Time
}

// Store is a cached reader/writer for platform settings.
type Store struct {
	DB  *gorm.DB
	TTL time.Duration

	mu    sync.RWMutex
	cache map[string]entry
}

func New(db *gorm.DB) *Store {
	return &Store{DB: db, TTL: 30 * time.Second, cache: map[string]entry{}}
}

// Default is the process-wide store, set by Init at boot (and by tests).
var Default *Store

func Init(db *gorm.DB) { Default = New(db) }

func (s *Store) Invalidate() {
	s.mu.Lock()
	s.cache = map[string]entry{}
	s.mu.Unlock()
}

func (s *Store) raw(key string) string {
	now := time.Now()
	s.mu.RLock()
	e, ok := s.cache[key]
	s.mu.RUnlock()
	if ok && now.Before(e.expires) {
		if e.found {
			return e.value
		}
		return Defaults[key]
	}
	var row models.PlatformSetting
	found := false
	if s.DB != nil {
		if err := s.DB.Where("key = ?", key).First(&row).Error; err == nil {
			found = true
		}
	}
	s.mu.Lock()
	s.cache[key] = entry{value: row.Value, found: found, expires: now.Add(s.TTL)}
	s.mu.Unlock()
	if found {
		return row.Value
	}
	return Defaults[key]
}

func (s *Store) String(key string) string { return s.raw(key) }

func (s *Store) Bool(key string) bool {
	v := strings.ToLower(strings.TrimSpace(s.raw(key)))
	return v == "true" || v == "1" || v == "yes" || v == "on"
}

func (s *Store) Int(key string) int {
	v, err := strconv.Atoi(strings.TrimSpace(s.raw(key)))
	if err != nil {
		d, _ := strconv.Atoi(Defaults[key])
		return d
	}
	return v
}

func (s *Store) Int64(key string) int64 {
	v, err := strconv.ParseInt(strings.TrimSpace(s.raw(key)), 10, 64)
	if err != nil {
		d, _ := strconv.ParseInt(Defaults[key], 10, 64)
		return d
	}
	return v
}

func (s *Store) Float(key string) float64 {
	v, err := strconv.ParseFloat(strings.TrimSpace(s.raw(key)), 64)
	if err != nil {
		d, _ := strconv.ParseFloat(Defaults[key], 64)
		return d
	}
	return v
}

func (s *Store) List(key string) []string {
	var out []string
	for _, p := range strings.Split(s.raw(key), ",") {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

// Set upserts a setting and invalidates the cache. Unknown keys are rejected
// so a typo can't silently create a dead setting.
func (s *Store) Set(key, value string, updatedBy *uuid.UUID) error {
	if _, ok := Defaults[key]; !ok {
		return ErrUnknownKey
	}
	row := models.PlatformSetting{Key: key, Value: value, UpdatedBy: updatedBy, UpdatedAt: time.Now()}
	err := s.DB.Save(&row).Error
	s.Invalidate()
	return err
}

type settingsError string

func (e settingsError) Error() string { return string(e) }

const ErrUnknownKey = settingsError("unknown setting key")

// Package-level conveniences over Default.
func String(key string) string { return Default.String(key) }
func Bool(key string) bool     { return Default.Bool(key) }
func Int(key string) int       { return Default.Int(key) }
func Int64(key string) int64   { return Default.Int64(key) }
func Float(key string) float64 { return Default.Float(key) }
func List(key string) []string { return Default.List(key) }
