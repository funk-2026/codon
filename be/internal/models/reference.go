package models

import (
	"time"

	"github.com/google/uuid"
)

// Reference document kinds. A "howto" PDF belongs to a feature (slug); the board-paper kinds belong to a class,
// board and subject, and the paper kinds also to a year; "schema" is the NEET-UG schema PDF.
const (
	RefHowTo     = "howto"
	RefPattern   = "pattern"
	RefPastPaper = "past_paper"
	RefPractice  = "practice_paper"
	RefWeightage = "weightage"
	RefSchema    = "schema"
	// RefPolicy is a help or policy PDF (FAQ, device policy, video troubleshooting, piracy reporting), found by slug.
	RefPolicy = "policy"
)

// ReferenceDoc is one uploaded PDF students can read in the app: a how-to guide, a board paper, a paper pattern, a
// weightage chart or the Schema PDF. Admins upload them; nothing is authored by the app.
type ReferenceDoc struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Kind      string    `gorm:"type:text;not null;index" json:"kind"`
	Title     string    `gorm:"type:text;not null" json:"title"`
	Class     string    `gorm:"type:text;not null;default:''" json:"class,omitempty"`
	Board     string    `gorm:"type:text;not null;default:''" json:"board,omitempty"`
	Subject   string    `gorm:"type:text;not null;default:''" json:"subject,omitempty"`
	Year      *int      `json:"year,omitempty"`
	Slug      string    `gorm:"type:text;not null;default:''" json:"slug,omitempty"`
	Language  string    `gorm:"type:text;not null;default:''" json:"language,omitempty"`
	FileKey   string    `gorm:"type:text;not null" json:"-"`
	FileName  string    `gorm:"type:text;not null;default:''" json:"file_name,omitempty"`
	SizeBytes int64     `gorm:"not null;default:0" json:"size_bytes"`
	IsActive  bool      `gorm:"not null" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// FacultyMember is a person shown under "Our team and faculty". Only what an admin enters is shown.
type FacultyMember struct {
	ID         uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name       string     `gorm:"type:text;not null" json:"name"`
	Title      string     `gorm:"type:text;not null;default:''" json:"title,omitempty"`
	Summary    string     `gorm:"type:text;not null;default:''" json:"summary,omitempty"`
	About      string     `gorm:"type:text;not null;default:''" json:"about,omitempty"`
	MediaID    *uuid.UUID `gorm:"type:uuid" json:"media_id,omitempty"`
	OrderIndex int        `gorm:"not null;default:0" json:"order_index"`
	IsActive   bool       `gorm:"not null" json:"is_active"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}
