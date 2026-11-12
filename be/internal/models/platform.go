package models

import (
	"database/sql/driver"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type JobStatus string

const (
	JobPending    JobStatus = "pending"
	JobProcessing JobStatus = "processing"
	JobDone       JobStatus = "done"
	JobFailed     JobStatus = "failed"
)

type PlatformSetting struct {
	Key       string     `gorm:"type:text;primaryKey" json:"key"`
	Value     string     `gorm:"type:text;not null" json:"value"`
	UpdatedAt time.Time  `json:"updated_at"`
	UpdatedBy *uuid.UUID `gorm:"type:uuid" json:"updated_by,omitempty"`
	Updater   *User      `gorm:"foreignKey:UpdatedBy" json:"-"`
}

type BackgroundJob struct {
	ID        uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Type      string     `gorm:"type:text;not null;index" json:"type"`
	Payload   string     `gorm:"type:jsonb;not null" json:"payload"`
	Status    JobStatus  `gorm:"type:text;not null;default:'pending';index" json:"status"`
	Attempts  int        `gorm:"not null;default:0" json:"attempts"`
	RunAfter  time.Time  `gorm:"not null;index" json:"run_after"`
	LockedAt  *time.Time `json:"locked_at,omitempty"`
	LastError *string    `gorm:"type:text" json:"last_error,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

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

type AdminAuditLog struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ActorID   uuid.UUID `gorm:"type:uuid;not null;index" json:"actor_id"`
	Action    string    `gorm:"type:text;not null;index" json:"action"`
	Target    string    `gorm:"type:text" json:"target"`
	Before    JSONB     `gorm:"type:jsonb" json:"before,omitempty"`
	After     JSONB     `gorm:"type:jsonb" json:"after,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// RateEvent is one hit against a named rate limit (see package ratelimit).
type RateEvent struct {
	ID  int64     `gorm:"primaryKey;autoIncrement"`
	Key string    `gorm:"type:text;not null;index:idx_rate_key_at"`
	At  time.Time `gorm:"not null;index:idx_rate_key_at"`
}
