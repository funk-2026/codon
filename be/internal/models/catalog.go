package models

import (
	"time"

	"github.com/google/uuid"
)

type Course struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name        string    `gorm:"type:text;not null" json:"name"`
	Slug        string    `gorm:"type:text;uniqueIndex;not null" json:"slug"`
	Description *string   `gorm:"type:text" json:"description,omitempty"`
	IsActive    bool      `gorm:"not null" json:"is_active"`
	// Content created in this course is paid unless the author says otherwise.
	DefaultRequiresSubscription bool      `gorm:"not null;default:false" json:"-"`
	CreatedAt                   time.Time `json:"created_at"`
	UpdatedAt                   time.Time `json:"updated_at"`
}

type Subject struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CourseID    uuid.UUID `gorm:"type:uuid;not null;index" json:"course_id"`
	Course      Course    `gorm:"foreignKey:CourseID" json:"-"`
	Name        string    `gorm:"type:text;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description,omitempty"`
	OrderIndex  int       `gorm:"not null;default:0" json:"order_index"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Chapter struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	SubjectID   uuid.UUID `gorm:"type:uuid;not null;index" json:"subject_id"`
	Subject     Subject   `gorm:"foreignKey:SubjectID" json:"-"`
	Name        string    `gorm:"type:text;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description,omitempty"`
	OrderIndex  int       `gorm:"not null;default:0" json:"order_index"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

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
