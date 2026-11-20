package models

import (
	"time"

	"github.com/google/uuid"
)

// Schema statuses a student sets on a topic. A topic with no row counts as yet_to_read.
const (
	SchemaYetToRead   = "yet_to_read"
	SchemaYetToRevise = "yet_to_revise"
	SchemaConfident   = "confident"
)

// SchemaTopic is one syllabus topic under a chapter, with the questions asked on it by year.
type SchemaTopic struct {
	ID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CourseID   uuid.UUID `gorm:"type:uuid;not null;index" json:"course_id"`
	SubjectID  uuid.UUID `gorm:"type:uuid;not null;index" json:"subject_id"`
	ChapterID  uuid.UUID `gorm:"type:uuid;not null;index" json:"chapter_id"`
	Name       string    `gorm:"type:text;not null" json:"name"`
	OrderIndex int       `gorm:"not null;default:0" json:"order_index"`
	CreatedAt  time.Time `json:"created_at"`
}

// SchemaYear is one row of the "Year | Subtopic | Qs" table. An empty Subtopic is the topic itself.
type SchemaYear struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TopicID   uuid.UUID `gorm:"type:uuid;not null;index" json:"topic_id"`
	Year      int       `gorm:"not null" json:"year"`
	ReExam    bool      `gorm:"not null" json:"re_exam"`
	Subtopic  string    `gorm:"type:text;not null;default:''" json:"subtopic"`
	Questions int       `gorm:"not null;default:0" json:"questions"`
}

// SchemaStatus is one student's status on one topic. ConfidentAt is set when the topic became Confident and cleared when it
// moves away, so the analytics counts what is Confident on each day.
type SchemaStatus struct {
	UserID      uuid.UUID  `gorm:"type:uuid;primaryKey" json:"user_id"`
	TopicID     uuid.UUID  `gorm:"type:uuid;primaryKey" json:"topic_id"`
	Status      string     `gorm:"type:text;not null" json:"status"`
	ConfidentAt *time.Time `json:"confident_at,omitempty"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// PulseItem is a one-minute revision item shown under its chapter.
type PulseItem struct {
	ID         uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CourseID   uuid.UUID  `gorm:"type:uuid;not null;index" json:"course_id"`
	SubjectID  uuid.UUID  `gorm:"type:uuid;not null;index" json:"subject_id"`
	ChapterID  uuid.UUID  `gorm:"type:uuid;not null;index" json:"chapter_id"`
	Title      string     `gorm:"type:text;not null" json:"title"`
	Body       string     `gorm:"type:text;not null;default:''" json:"body"`
	AuthorID   *uuid.UUID `gorm:"type:uuid" json:"author_id,omitempty"`
	OrderIndex int        `gorm:"not null;default:0" json:"order_index"`
	IsActive   bool       `gorm:"not null" json:"is_active"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// PulseRead remembers the first time a student read an item, for the Pulse graph.
type PulseRead struct {
	UserID uuid.UUID `gorm:"type:uuid;primaryKey" json:"user_id"`
	ItemID uuid.UUID `gorm:"type:uuid;primaryKey" json:"item_id"`
	ReadAt time.Time `json:"read_at"`
}
