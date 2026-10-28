package models

import (
	"database/sql/driver"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// ─── JSONB helper ─────────────────────────────────────────────────────────────

// JSONB stores raw JSON in a Postgres jsonb column and marshals back to the API
// as raw JSON (not as a quoted string).
type JSONB []byte

func (j JSONB) Value() (driver.Value, error) {
	if len(j) == 0 {
		return nil, nil
	}
	return string(j), nil
}

func (j *JSONB) Scan(value interface{}) error {
	switch v := value.(type) {
	case nil:
		*j = nil
	case []byte:
		*j = append((*j)[:0], v...)
	case string:
		*j = JSONB(v)
	default:
		return fmt.Errorf("JSONB: unsupported scan type %T", value)
	}
	return nil
}

func (j JSONB) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("null"), nil
	}
	return j, nil
}

func (j *JSONB) UnmarshalJSON(b []byte) error {
	*j = append((*j)[:0], b...)
	return nil
}

func (JSONB) GormDataType() string { return "jsonb" }

// ─── Enums (string constants — columns are text) ─────────────────────────────

const (
	OriginAuthored  = "authored"
	OriginGenerated = "generated"

	VisibilityPublic  = "public"
	VisibilityPrivate = "private"

	ModeExam  = "exam"
	ModeTutor = "tutor"

	FlagActive      = "active"
	FlagUnderReview = "under_review"
	FlagRetired     = "retired"

	MediaPending    = "pending"
	MediaProcessing = "processing"
	MediaReady      = "ready"
	MediaRejected   = "rejected"

	ContentFormatPlain  = "plain"
	ContentFormatRichV1 = "rich_v1"

	ReportOpen      = "open"
	ReportFixed     = "fixed"
	ReportNoChange  = "no_change"
	ReportDismissed = "dismissed"

	RevisionPending  = "pending"
	RevisionApproved = "approved"
	RevisionRejected = "rejected"
)

// ─── Media ────────────────────────────────────────────────────────────────────

type MediaAsset struct {
	ID            uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OwnerID       uuid.UUID  `gorm:"type:uuid;not null;index" json:"owner_id"`
	Purpose       string     `gorm:"type:text;not null" json:"purpose"`
	Source        string     `gorm:"type:text;not null;default:'upload'" json:"source"`
	StorageKey    string     `gorm:"type:text;not null" json:"-"`
	DisplayKey    string     `gorm:"type:text" json:"-"`
	ThumbKey      string     `gorm:"type:text" json:"-"`
	FileName      string     `gorm:"type:text" json:"file_name,omitempty"`
	Mime          string     `gorm:"type:text" json:"mime"`
	DeclaredMime  string     `gorm:"type:text" json:"-"`
	DeclaredBytes int64      `json:"-"`
	Bytes         int64      `json:"bytes"`
	Width         int        `json:"width"`
	Height        int        `json:"height"`
	SHA256        string     `gorm:"type:text;index" json:"sha256,omitempty"`
	AltText       string     `gorm:"type:text" json:"alt"`
	Status        string     `gorm:"type:text;not null;default:'pending';index" json:"status"`
	RejectReason  string     `gorm:"type:text" json:"reject_reason,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	ReadyAt       *time.Time `json:"ready_at,omitempty"`
}

type MediaRef struct {
	MediaID   uuid.UUID `gorm:"type:uuid;primaryKey;index" json:"media_id"`
	OwnerType string    `gorm:"type:text;primaryKey" json:"owner_type"`
	OwnerID   uuid.UUID `gorm:"type:uuid;primaryKey" json:"owner_id"`
	Field     string    `gorm:"type:text;primaryKey" json:"field"`
}

// ─── Test ↔ Question membership (D1-B) ────────────────────────────────────────

type TestQuestion struct {
	TestID     uuid.UUID `gorm:"type:uuid;primaryKey" json:"test_id"`
	QuestionID uuid.UUID `gorm:"type:uuid;primaryKey;index" json:"question_id"`
	Position   int       `gorm:"not null" json:"position"`
}

type StudentQuestionState struct {
	UserID        uuid.UUID `gorm:"type:uuid;primaryKey;index:idx_sqs_user_result" json:"user_id"`
	QuestionID    uuid.UUID `gorm:"type:uuid;primaryKey" json:"question_id"`
	TimesSeen     int       `gorm:"not null;default:0" json:"times_seen"`
	TimesAnswered int       `gorm:"not null;default:0" json:"times_answered"`
	TimesCorrect  int       `gorm:"not null;default:0" json:"times_correct"`
	// LastResult is the last *answered* result (correct|incorrect), or
	// 'unattempted' if the student has never answered the question.
	LastResult  string    `gorm:"type:text;index:idx_sqs_user_result" json:"last_result"`
	FirstSeenAt time.Time `json:"first_seen_at"`
	LastSeenAt  time.Time `json:"last_seen_at"`
	// LastAnsweredAt is when the student last actually ANSWERED it (skips don't count).
	LastAnsweredAt *time.Time `json:"last_answered_at,omitempty"`
	SRSDueAt       *time.Time `json:"srs_due_at,omitempty"`
	SRSInterval    int        `gorm:"not null;default:0" json:"srs_interval_days"`
}

// ─── Taxonomy ─────────────────────────────────────────────────────────────────

type Topic struct {
	ID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ChapterID  uuid.UUID `gorm:"type:uuid;not null;index" json:"chapter_id"`
	Name       string    `gorm:"type:text;not null" json:"name"`
	OrderIndex int       `gorm:"not null;default:0" json:"order_index"`
	CreatedAt  time.Time `json:"created_at"`
}

type Tag struct {
	ID        uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Slug      string     `gorm:"type:text;uniqueIndex;not null" json:"slug"`
	Label     string     `gorm:"type:text;not null" json:"label"`
	AliasOf   *uuid.UUID `gorm:"type:uuid" json:"alias_of,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type QuestionTag struct {
	QuestionID uuid.UUID `gorm:"type:uuid;primaryKey" json:"question_id"`
	TagID      uuid.UUID `gorm:"type:uuid;primaryKey;index" json:"tag_id"`
}

// ─── Bookmarks / Reports / Ratings ────────────────────────────────────────────

type BookmarkCollection struct {
	ID         uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Key        string     `gorm:"type:text;not null;index" json:"key"`
	Label      string     `gorm:"type:text;not null" json:"label"`
	OrderIndex int        `gorm:"not null;default:0" json:"order_index"`
	OwnerID    *uuid.UUID `gorm:"type:uuid;index" json:"owner_id,omitempty"` // null = system collection
	IsActive   bool       `gorm:"not null;default:true" json:"is_active"`
	CreatedAt  time.Time  `json:"created_at"`
}

type Bookmark struct {
	ID           uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID       uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_bookmark_item" json:"user_id"`
	ItemType     string    `gorm:"type:text;not null;uniqueIndex:idx_bookmark_item" json:"item_type"`
	ItemID       uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_bookmark_item" json:"item_id"`
	CollectionID uuid.UUID `gorm:"type:uuid;not null;index" json:"collection_id"`
	Note         *string   `gorm:"type:text" json:"note,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type ContentReport struct {
	ID             uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ReporterID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"reporter_id"`
	ItemType       string     `gorm:"type:text;not null" json:"item_type"`
	ItemID         uuid.UUID  `gorm:"type:uuid;not null;index" json:"item_id"`
	ItemVersion    *int       `json:"item_version,omitempty"`
	Reason         string     `gorm:"type:text;not null" json:"reason"`
	Note           *string    `gorm:"type:text" json:"note,omitempty"`
	Context        string     `gorm:"type:text" json:"context"`
	AttemptID      *uuid.UUID `gorm:"type:uuid" json:"attempt_id,omitempty"`
	Status         string     `gorm:"type:text;not null;default:'open';index" json:"status"`
	AssigneeID     *uuid.UUID `gorm:"type:uuid;index" json:"assignee_id,omitempty"`
	ResolvedBy     *uuid.UUID `gorm:"type:uuid" json:"resolved_by,omitempty"`
	ResolvedAt     *time.Time `json:"resolved_at,omitempty"`
	ResolutionNote *string    `gorm:"type:text" json:"resolution_note,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type QuestionRevision struct {
	ID             uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	QuestionID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"question_id"`
	VersionFrom    int        `json:"version_from"`
	Proposed       JSONB      `gorm:"type:jsonb" json:"proposed"`
	SnapshotBefore JSONB      `gorm:"type:jsonb" json:"snapshot_before,omitempty"`
	Reason         string     `gorm:"type:text;not null" json:"reason"`
	Status         string     `gorm:"type:text;not null;default:'pending';index" json:"status"`
	Rescore        bool       `gorm:"not null;default:false" json:"rescore"`
	CreatedBy      uuid.UUID  `gorm:"type:uuid;not null" json:"created_by"`
	ReviewedBy     *uuid.UUID `gorm:"type:uuid" json:"reviewed_by,omitempty"`
	ReviewedAt     *time.Time `json:"reviewed_at,omitempty"`
	RejectReason   *string    `gorm:"type:text" json:"reject_reason,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type Rating struct {
	UserID    uuid.UUID      `gorm:"type:uuid;primaryKey" json:"user_id"`
	ItemType  string         `gorm:"type:text;primaryKey" json:"item_type"`
	ItemID    uuid.UUID      `gorm:"type:uuid;primaryKey;index" json:"item_id"`
	Value     int            `gorm:"not null" json:"value"`
	Tags      pq.StringArray `gorm:"type:text[]" json:"tags,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}

// ─── Custom-test support ──────────────────────────────────────────────────────

type CustomTestPreset struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CourseID    uuid.UUID `gorm:"type:uuid;not null;index" json:"course_id"`
	Title       string    `gorm:"type:text;not null" json:"title"`
	Description string    `gorm:"type:text" json:"description"`
	Blueprint   JSONB     `gorm:"type:jsonb;not null" json:"blueprint"`
	OrderIndex  int       `gorm:"not null;default:0" json:"order_index"`
	IsActive    bool      `gorm:"not null;default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CustomTestTemplate struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	Title     string    `gorm:"type:text;not null" json:"title"`
	Blueprint JSONB     `gorm:"type:jsonb;not null" json:"blueprint"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomTestRequest is the idempotency store for POST /custom-tests.
type CustomTestRequest struct {
	UserID         uuid.UUID `gorm:"type:uuid;primaryKey" json:"user_id"`
	IdempotencyKey string    `gorm:"type:text;primaryKey" json:"idempotency_key"`
	TestID         uuid.UUID `gorm:"type:uuid;not null" json:"test_id"`
	CreatedAt      time.Time `json:"created_at"`
}

type QuestionStats struct {
	QuestionID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"question_id"`
	Attempts            int       `gorm:"not null;default:0" json:"attempts"`
	Correct             int       `gorm:"not null;default:0" json:"correct"`
	TotalTimeSeconds    int64     `gorm:"not null;default:0" json:"-"`
	TimedAnswers        int       `gorm:"not null;default:0" json:"-"`
	AvgTimeSeconds      float64   `gorm:"-" json:"avg_time_seconds"`
	ReportCount         int       `gorm:"not null;default:0" json:"report_count"`
	EmpiricalDifficulty *string   `gorm:"type:text" json:"empirical_difficulty,omitempty"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type AdminAuditLog struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ActorID   uuid.UUID `gorm:"type:uuid;not null;index" json:"actor_id"`
	Action    string    `gorm:"type:text;not null;index" json:"action"`
	Target    string    `gorm:"type:text" json:"target"`
	Before    JSONB     `gorm:"type:jsonb" json:"before,omitempty"`
	After     JSONB     `gorm:"type:jsonb" json:"after,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type QuestionNote struct {
	UserID     uuid.UUID `gorm:"type:uuid;primaryKey" json:"user_id"`
	QuestionID uuid.UUID `gorm:"type:uuid;primaryKey" json:"question_id"`
	Body       string    `gorm:"type:text;not null" json:"body"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type BlueprintShare struct {
	Code      string    `gorm:"type:text;primaryKey" json:"code"`
	OwnerID   uuid.UUID `gorm:"type:uuid;not null;index" json:"owner_id"`
	Blueprint JSONB     `gorm:"type:jsonb;not null" json:"blueprint"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

// ─── Follow-on epics ──────────────────────────────────────────────────────────

type BrainHack struct {
	ID              uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Title           string        `gorm:"type:text;not null" json:"title"`
	Category        string        `gorm:"type:text;not null" json:"category"`
	Body            string        `gorm:"type:text;not null" json:"body"`
	ContentFormat   string        `gorm:"type:text;not null;default:'rich_v1'" json:"content_format"`
	CoverMediaID    *uuid.UUID    `gorm:"type:uuid" json:"cover_media_id,omitempty"`
	ReadMinutes     int           `gorm:"not null;default:2" json:"read_minutes"`
	AuthorID        uuid.UUID     `gorm:"type:uuid;not null;index" json:"author_id"`
	Status          ContentStatus `gorm:"type:text;not null;default:'draft';index" json:"status"`
	ReviewedBy      *uuid.UUID    `gorm:"type:uuid" json:"reviewed_by,omitempty"`
	ReviewedAt      *time.Time    `json:"reviewed_at,omitempty"`
	RejectionReason *string       `gorm:"type:text" json:"rejection_reason,omitempty"`
	RatingAvg       float64       `gorm:"type:numeric(3,2);not null;default:0" json:"rating_avg"`
	RatingCount     int           `gorm:"not null;default:0" json:"rating_count"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

type FlashcardDeck struct {
	ID                   uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Title                string        `gorm:"type:text;not null" json:"title"`
	Description          string        `gorm:"type:text" json:"description"`
	CourseID             uuid.UUID     `gorm:"type:uuid;not null;index" json:"course_id"`
	SubjectID            *uuid.UUID    `gorm:"type:uuid" json:"subject_id,omitempty"`
	ChapterID            *uuid.UUID    `gorm:"type:uuid;index" json:"chapter_id,omitempty"`
	AuthorID             uuid.UUID     `gorm:"type:uuid;not null" json:"author_id"`
	Status               ContentStatus `gorm:"type:text;not null;default:'draft';index" json:"status"`
	RequiresSubscription bool          `gorm:"not null;default:true" json:"requires_subscription"`
	RejectionReason      *string       `gorm:"type:text" json:"rejection_reason,omitempty"`
	CardCount            int           `gorm:"not null;default:0" json:"card_count"`
	RatingAvg            float64       `gorm:"type:numeric(3,2);not null;default:0" json:"rating_avg"`
	RatingCount          int           `gorm:"not null;default:0" json:"rating_count"`
	CreatedAt            time.Time     `json:"created_at"`
	UpdatedAt            time.Time     `json:"updated_at"`
}

type Flashcard struct {
	ID            uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	DeckID        uuid.UUID `gorm:"type:uuid;not null;index" json:"deck_id"`
	Front         string    `gorm:"type:text;not null" json:"front"`
	Back          string    `gorm:"type:text;not null" json:"back"`
	ContentFormat string    `gorm:"type:text;not null;default:'rich_v1'" json:"content_format"`
	Position      int       `gorm:"not null;default:0" json:"position"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type FlashcardState struct {
	UserID       uuid.UUID `gorm:"type:uuid;primaryKey" json:"user_id"`
	CardID       uuid.UUID `gorm:"type:uuid;primaryKey" json:"card_id"`
	Reps         int       `gorm:"not null;default:0" json:"reps"`
	IntervalDays int       `gorm:"not null;default:0" json:"interval_days"`
	DueAt        time.Time `gorm:"index" json:"due_at"`
	LastResult   string    `gorm:"type:text" json:"last_result"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type VideoNote struct {
	ID               uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID           uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	ContentItemID    uuid.UUID `gorm:"type:uuid;not null;index" json:"content_item_id"`
	TimestampSeconds int       `gorm:"not null;default:0" json:"timestamp_seconds"`
	Body             string    `gorm:"type:text;not null" json:"body"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type PushToken struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	Token     string    `gorm:"type:text;uniqueIndex;not null" json:"token"`
	Platform  string    `gorm:"type:text" json:"platform"`
	DeviceID  string    `gorm:"type:text" json:"device_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Notification struct {
	ID        uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	Type      string     `gorm:"type:text;not null" json:"type"`
	Title     string     `gorm:"type:text;not null" json:"title"`
	Body      string     `gorm:"type:text" json:"body"`
	Data      JSONB      `gorm:"type:jsonb" json:"data,omitempty"`
	ReadAt    *time.Time `json:"read_at,omitempty"`
	PushedAt  *time.Time `json:"pushed_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type HomeUpdate struct {
	ID         uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Title      string     `gorm:"type:text;not null" json:"title"`
	Body       string     `gorm:"type:text" json:"body"`
	CTALabel   string     `gorm:"type:text" json:"cta_label,omitempty"`
	CTARoute   string     `gorm:"type:text" json:"cta_route,omitempty"`
	MediaID    *uuid.UUID `gorm:"type:uuid" json:"media_id,omitempty"`
	OrderIndex int        `gorm:"not null;default:0" json:"order_index"`
	IsActive   bool       `gorm:"not null;default:true" json:"is_active"`
	StartsAt   *time.Time `json:"starts_at,omitempty"`
	EndsAt     *time.Time `json:"ends_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// NotificationPref holds a user's push/notification opt-ins (all default on).
type NotificationPref struct {
	UserID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"user_id"`
	PushEnabled   bool      `gorm:"not null;default:true" json:"push_enabled"`
	StreakNudges  bool      `gorm:"not null;default:true" json:"streak_nudges"`
	ReportUpdates bool      `gorm:"not null;default:true" json:"report_updates"`
	UpdatedAt     time.Time `json:"updated_at"`
}
