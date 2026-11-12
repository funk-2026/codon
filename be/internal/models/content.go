package models

import (
	"time"

	"github.com/google/uuid"
)

type ContentStatus string

const (
	StatusDraft         ContentStatus = "draft"
	StatusPendingReview ContentStatus = "pending_review"
	StatusApproved      ContentStatus = "approved"
	StatusRejected      ContentStatus = "rejected"
	StatusPublished     ContentStatus = "published"
)

type ContentType string

const (
	ContentVideo    ContentType = "video"
	ContentDocument ContentType = "document"
)

type VideoStatus string

const (
	VideoQueued      VideoStatus = "queued"
	VideoTranscoding VideoStatus = "transcoding"
	VideoReady       VideoStatus = "ready"
	VideoFailed      VideoStatus = "failed"
)

type WellnessCategory string

const (
	WellnessGuidance         WellnessCategory = "guidance"
	WellnessMotivation       WellnessCategory = "motivation"
	WellnessReflectionPrompt WellnessCategory = "reflection_prompt"
)

type ContentItem struct {
	ID                   uuid.UUID   `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Title                string      `gorm:"type:text;not null" json:"title"`
	CourseID             uuid.UUID   `gorm:"type:uuid;not null;index" json:"course_id"`
	Course               Course      `gorm:"foreignKey:CourseID" json:"course,omitempty"`
	ContentType          ContentType `gorm:"type:text;not null" json:"content_type"`
	RequiresSubscription bool        `gorm:"not null" json:"requires_subscription"`
	ChapterID            uuid.UUID   `gorm:"type:uuid;not null;index" json:"chapter_id"`
	Chapter              Chapter     `gorm:"foreignKey:ChapterID" json:"chapter,omitempty"`
	UploadedBy           uuid.UUID   `gorm:"type:uuid;not null" json:"uploaded_by"`
	Uploader             User        `gorm:"foreignKey:UploadedBy" json:"uploader,omitempty"`
	FileKey              string      `gorm:"type:text;not null" json:"file_key"`
	// Lecture PDFs (videos): plain notes, and the annotated PDF of what was taught —
	// students get the annotated one only after watching the lecture.
	NotesPDFKey     *string       `gorm:"type:text" json:"notes_pdf_key,omitempty"`
	AnnotatedPDFKey *string       `gorm:"type:text" json:"annotated_pdf_key,omitempty"`
	VideoStatus     *VideoStatus  `gorm:"type:text" json:"video_status,omitempty"`
	HLSPlaylistURL  *string       `gorm:"type:text" json:"hls_playlist_url,omitempty"`
	Status          ContentStatus `gorm:"type:text;not null;default:'draft'" json:"status"`
	ReviewedBy      *uuid.UUID    `gorm:"type:uuid" json:"reviewed_by,omitempty"`
	Reviewer        *User         `gorm:"foreignKey:ReviewedBy" json:"-"`
	ReviewedAt      *time.Time    `json:"reviewed_at,omitempty"`
	RejectionReason *string       `gorm:"type:text" json:"rejection_reason,omitempty"`
	RatingAvg       float64       `gorm:"type:numeric(3,2);not null;default:0" json:"rating_avg"`
	RatingCount     int           `gorm:"not null;default:0" json:"rating_count"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

type WellnessContent struct {
	ID       uuid.UUID        `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Title    string           `gorm:"type:text;not null" json:"title"`
	Category WellnessCategory `gorm:"type:text;not null" json:"category"`
	BodyText string           `gorm:"type:text;not null" json:"body_text"`
	MediaURL *string          `gorm:"type:text" json:"media_url,omitempty"`
	// Rich body + optional cover image (media asset). Legacy rows stay `plain`.
	ContentFormat string     `gorm:"type:text;not null;default:'plain'" json:"content_format"`
	MediaID       *uuid.UUID `gorm:"type:uuid" json:"media_id,omitempty"`
	IsActive      bool       `gorm:"not null" json:"is_active"`
	CreatedBy     uuid.UUID  `gorm:"type:uuid;not null" json:"created_by"`
	Creator       User       `gorm:"foreignKey:CreatedBy" json:"-"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type UserWatchHistory struct {
	ID              uuid.UUID   `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID          uuid.UUID   `gorm:"type:uuid;not null;index" json:"user_id"`
	User            User        `gorm:"foreignKey:UserID" json:"-"`
	ContentItemID   uuid.UUID   `gorm:"type:uuid;not null;index" json:"content_item_id"`
	ContentItem     ContentItem `gorm:"foreignKey:ContentItemID" json:"content_item,omitempty"`
	ProgressSeconds int         `gorm:"not null;default:0" json:"progress_seconds"`
	IsCompleted     bool        `gorm:"not null;default:false" json:"is_completed"`
	LastWatchedAt   time.Time   `gorm:"not null" json:"last_watched_at"`
}

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
	RequiresSubscription bool          `gorm:"not null" json:"requires_subscription"`
	RejectionReason      *string       `gorm:"type:text" json:"rejection_reason,omitempty"`
	ReviewedBy           *uuid.UUID    `gorm:"type:uuid" json:"reviewed_by,omitempty"`
	ReviewedAt           *time.Time    `json:"reviewed_at,omitempty"`
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

type HomeUpdate struct {
	ID         uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Title      string     `gorm:"type:text;not null" json:"title"`
	Body       string     `gorm:"type:text" json:"body"`
	CTALabel   string     `gorm:"type:text" json:"cta_label,omitempty"`
	CTARoute   string     `gorm:"type:text" json:"cta_route,omitempty"`
	MediaID    *uuid.UUID `gorm:"type:uuid" json:"media_id,omitempty"`
	OrderIndex int        `gorm:"not null;default:0" json:"order_index"`
	IsActive   bool       `gorm:"not null" json:"is_active"`
	StartsAt   *time.Time `json:"starts_at,omitempty"`
	EndsAt     *time.Time `json:"ends_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}
