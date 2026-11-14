package models

import (
	"time"

	"github.com/google/uuid"
)

// Exam styles decide how a test looks and behaves; kinds say what it covers; delivery says how it is run.
const (
	ExamStyleNEET   = "neet"
	ExamStyleSchool = "school"

	KindChapter = "chapter"
	KindSubject = "subject"
	KindPart    = "part"
	KindFull    = "full"
	KindPYQ     = "pyq"

	DeliveryAnytime = "anytime"
	DeliveryLive    = "live"

	RankEveryone    = "everyone"
	RankSubscribers = "subscribers"
)

// ExamFields are the extra columns on a test that make it an exam: style, kind, a live schedule,
// result release and who may see the rank. Anytime tests ignore the schedule.
type ExamFields struct {
	ExamStyle string `gorm:"type:text;not null;default:'school'" json:"exam_style"`
	Kind      string `gorm:"type:text;not null;default:'chapter'" json:"kind"`
	Delivery  string `gorm:"type:text;not null;default:'anytime'" json:"delivery"`
	// OpensAt is when a live test starts for everyone. LateEntryMinutes is how long after that a student may still start.
	OpensAt          *time.Time `gorm:"index" json:"opens_at,omitempty"`
	LateEntryMinutes int        `gorm:"not null;default:15" json:"late_entry_minutes"`
	// ExtraMinutes is time an admin added to the window after an outage.
	ExtraMinutes int `gorm:"not null;default:0" json:"extra_minutes"`
	// ResultsAt is when scores, ranks and answers open for a live test.
	ResultsAt      *time.Time `json:"results_at,omitempty"`
	RankVisibility string     `gorm:"type:text;not null;default:'everyone'" json:"rank_visibility"`
	SeriesID       *uuid.UUID `gorm:"type:uuid;index" json:"series_id,omitempty"`
	ExamYear       *int       `json:"exam_year,omitempty"`

	// Bookkeeping for the worker: which reminders went out (bit 1 = a day, 2 = an hour, 4 = ten minutes) and when results were announced.
	RemindersSent     int        `gorm:"not null;default:0" json:"-"`
	ResultsNotifiedAt *time.Time `json:"-"`
}

// TestSeries groups tests under a course ("NEET 2027 Mock Series").
type TestSeries struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CourseID    uuid.UUID `gorm:"type:uuid;not null;index" json:"course_id"`
	Title       string    `gorm:"type:text;not null" json:"title"`
	Description *string   `gorm:"type:text" json:"description,omitempty"`
	CreatedBy   uuid.UUID `gorm:"type:uuid;not null" json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// TestRegistration is a student's "remind me" for a live test.
type TestRegistration struct {
	TestID    uuid.UUID `gorm:"type:uuid;primaryKey" json:"test_id"`
	UserID    uuid.UUID `gorm:"type:uuid;primaryKey;index" json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}
