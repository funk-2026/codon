package models

import (
	"database/sql/driver"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type UserRole string

const (
	RoleStudent UserRole = "student"
	RoleTeacher UserRole = "teacher"
	RoleAdmin   UserRole = "admin"
)

func (r UserRole) Value() (driver.Value, error) { return string(r), nil }

func (r *UserRole) Scan(value interface{}) error {
	switch v := value.(type) {
	case string:
		*r = UserRole(v)
	case []byte:
		*r = UserRole(v)
	}
	return nil
}

type KYCStatus string

const (
	KYCNotRequired KYCStatus = "not_required"
	KYCPending     KYCStatus = "pending"
	KYCApproved    KYCStatus = "approved"
	KYCRejected    KYCStatus = "rejected"
)

type IDType string

const (
	IDTypeAadhaar IDType = "aadhaar"
	IDTypePAN     IDType = "pan"
)

type User struct {
	ID                  uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	PhoneNumber         string     `gorm:"type:text;uniqueIndex;not null" json:"phone_number"`
	Name                *string    `gorm:"type:text" json:"name"`
	Role                UserRole   `gorm:"type:text;not null;default:'student'" json:"role"`
	ProfilePhotoKey     *string    `gorm:"type:text" json:"profile_photo_key,omitempty"`
	SelectedCourseID    *uuid.UUID `gorm:"type:uuid" json:"selected_course_id,omitempty"`
	SelectedCourse      *Course    `gorm:"foreignKey:SelectedCourseID" json:"selected_course,omitempty"`
	CanManageAllContent bool       `gorm:"not null;default:false" json:"can_manage_all_content"`
	KYCStatus           KYCStatus  `gorm:"type:text;not null;default:'not_required'" json:"kyc_status"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
	LastLoginAt         *time.Time `json:"last_login_at,omitempty"`
	// SuspendedAt is set by an admin; a suspended user cannot sign in and every session is ended.
	SuspendedAt     *time.Time `json:"suspended_at,omitempty"`
	SuspendedReason *string    `gorm:"type:text" json:"suspended_reason,omitempty"`
}

type OTPRequest struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	PhoneNumber string    `gorm:"type:text;not null;index"`
	OTPCodeHash string    `gorm:"type:text;not null"`
	ExpiresAt   time.Time `gorm:"not null"`
	Attempts    int       `gorm:"not null;default:0"`
	ConsumedAt  *time.Time
	CreatedAt   time.Time
}

type Session struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"` // also the JWT jti
	UserID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	User       User       `gorm:"foreignKey:UserID" json:"-"`
	DeviceID   string     `gorm:"type:text;not null" json:"device_id"`
	DeviceInfo *string    `gorm:"type:text" json:"device_info"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt time.Time  `json:"last_used_at"`
	ExpiresAt  time.Time  `gorm:"not null;index" json:"expires_at"`
	RevokedAt  *time.Time `json:"revoked_at"`
}

type KYCRecord struct {
	ID              uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID          uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	User            User       `gorm:"foreignKey:UserID" json:"user,omitempty"`
	IDType          IDType     `gorm:"type:text;not null" json:"id_type"`
	IDNumber        string     `gorm:"type:text;not null" json:"id_number"`
	DocumentFileKey string     `gorm:"type:text;not null" json:"document_file_key"`
	Status          KYCStatus  `gorm:"type:text;not null;default:'pending'" json:"status"`
	ReviewedBy      *uuid.UUID `gorm:"type:uuid" json:"reviewed_by,omitempty"`
	Reviewer        *User      `gorm:"foreignKey:ReviewedBy" json:"-"`
	ReviewedAt      *time.Time `json:"reviewed_at,omitempty"`
	RejectionReason *string    `gorm:"type:text" json:"rejection_reason,omitempty"`
	SubmittedAt     time.Time  `gorm:"not null" json:"submitted_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type UserFeedback struct {
	ID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID     uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	User       User      `gorm:"foreignKey:UserID" json:"-"`
	Category   string    `gorm:"type:text;not null" json:"category"`
	Message    string    `gorm:"type:text;not null" json:"message"`
	AppVersion *string   `gorm:"type:text" json:"app_version,omitempty"`
	DeviceOS   *string   `gorm:"type:text" json:"device_os,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	// Triage by an admin: new → in_progress → resolved.
	Status     string     `gorm:"type:text;not null;default:'new'" json:"status"`
	AdminNote  *string    `gorm:"type:text" json:"admin_note,omitempty"`
	ResolvedAt *time.Time `json:"resolved_at,omitempty"`
	ResolvedBy *uuid.UUID `gorm:"type:uuid" json:"resolved_by,omitempty"`
}

// Validate UserRole
func ValidateUserRole(r string) error {
	switch UserRole(r) {
	case RoleStudent, RoleTeacher, RoleAdmin:
		return nil
	}
	return fmt.Errorf("invalid role: %s", r)
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

// NotificationPref holds a user's push/notification opt-ins (all default on).
type NotificationPref struct {
	UserID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"user_id"`
	PushEnabled   bool      `gorm:"not null" json:"push_enabled"`
	StreakNudges  bool      `gorm:"not null" json:"streak_nudges"`
	ReportUpdates bool      `gorm:"not null" json:"report_updates"`
	UpdatedAt     time.Time `json:"updated_at"`
}
