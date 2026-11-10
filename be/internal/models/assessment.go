package models

import (
	"time"

	"github.com/google/uuid"
)

type ModuleType string

const (
	ModuleQBank      ModuleType = "qbank"
	ModuleTestSeries ModuleType = "test_series"
	ModulePractice   ModuleType = "practice"
	ModuleCustom     ModuleType = "custom"
)

type CorrectOption string

const (
	OptionA CorrectOption = "A"
	OptionB CorrectOption = "B"
	OptionC CorrectOption = "C"
	OptionD CorrectOption = "D"
)

type AttemptStatus string

const (
	AttemptInProgress AttemptStatus = "in_progress"
	AttemptSubmitted  AttemptStatus = "submitted"
)

type ImportStatus string

const (
	ImportProcessing          ImportStatus = "processing"
	ImportCompleted           ImportStatus = "completed"
	ImportCompletedWithErrors ImportStatus = "completed_with_errors"
	ImportFailed              ImportStatus = "failed"
)

type Test struct {
	ID                   uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Title                string        `gorm:"type:text;not null" json:"title"`
	Description          *string       `gorm:"type:text" json:"description,omitempty"`
	CourseID             uuid.UUID     `gorm:"type:uuid;not null;index" json:"course_id"`
	Course               Course        `gorm:"foreignKey:CourseID" json:"course,omitempty"`
	ModuleType           ModuleType    `gorm:"type:text;not null" json:"module_type"`
	RequiresSubscription bool          `gorm:"not null" json:"requires_subscription"`
	SubjectID            *uuid.UUID    `gorm:"type:uuid;index" json:"subject_id,omitempty"`
	Subject              *Subject      `gorm:"foreignKey:SubjectID" json:"subject,omitempty"`
	ChapterID            *uuid.UUID    `gorm:"type:uuid;index" json:"chapter_id,omitempty"`
	Chapter              *Chapter      `gorm:"foreignKey:ChapterID" json:"chapter,omitempty"`
	CreatedBy            uuid.UUID     `gorm:"type:uuid;not null" json:"created_by"`
	Creator              User          `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
	TotalQuestions       int           `gorm:"not null;default:0" json:"total_questions"`
	DurationMinutes      *int          `json:"duration_minutes,omitempty"`
	MarksPerCorrect      float64       `gorm:"type:numeric(5,2);not null" json:"marks_per_correct"`
	MarksPerWrong        float64       `gorm:"type:numeric(5,2);not null" json:"marks_per_wrong"`
	Status               ContentStatus `gorm:"type:text;not null;default:'draft'" json:"status"`
	ReviewedBy           *uuid.UUID    `gorm:"type:uuid" json:"reviewed_by,omitempty"`
	Reviewer             *User         `gorm:"foreignKey:ReviewedBy" json:"-"`
	ReviewedAt           *time.Time    `json:"reviewed_at,omitempty"`
	RejectionReason      *string       `gorm:"type:text" json:"rejection_reason,omitempty"`

	// Custom-test module: authored tests are public; generated tests are private
	// to their owner and never appear in shared lists.
	Origin                 string     `gorm:"type:text;not null;default:'authored';index" json:"origin"`
	OwnerUserID            *uuid.UUID `gorm:"type:uuid;index" json:"owner_user_id,omitempty"`
	Visibility             string     `gorm:"type:text;not null;default:'public'" json:"visibility"`
	Blueprint              JSONB      `gorm:"type:jsonb" json:"blueprint,omitempty"`
	BlueprintSchemaVersion *int       `json:"blueprint_schema_version,omitempty"`
	Mode                   string     `gorm:"type:text;not null;default:'exam'" json:"mode"`
	ExpiresAt              *time.Time `json:"expires_at,omitempty"`
	ArchivedAt             *time.Time `gorm:"index" json:"archived_at,omitempty"`
	RatingAvg              float64    `gorm:"type:numeric(3,2);not null;default:0" json:"rating_avg"`
	RatingCount            int        `gorm:"not null;default:0" json:"rating_count"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Question struct {
	ID            uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TestID        uuid.UUID     `gorm:"type:uuid;not null;index" json:"test_id"`
	Test          Test          `gorm:"foreignKey:TestID" json:"-"`
	QuestionText  string        `gorm:"type:text;not null" json:"question_text"`
	OptionA       string        `gorm:"type:text;not null" json:"option_a"`
	OptionB       string        `gorm:"type:text;not null" json:"option_b"`
	OptionC       string        `gorm:"type:text;not null" json:"option_c"`
	OptionD       string        `gorm:"type:text;not null" json:"option_d"`
	CorrectOption CorrectOption `gorm:"type:text;not null" json:"correct_option"`
	Explanation   *string       `gorm:"type:text" json:"explanation,omitempty"`
	OrderIndex    int           `gorm:"not null" json:"order_index"`

	// Rich-content + metadata (custom test module). All optional/defaulted so
	// legacy rows keep working exactly as before.
	ContentFormat  string     `gorm:"type:text;not null;default:'plain'" json:"content_format"`
	SubjectID      *uuid.UUID `gorm:"type:uuid;index" json:"subject_id,omitempty"`
	ChapterID      *uuid.UUID `gorm:"type:uuid;index" json:"chapter_id,omitempty"`
	TopicID        *uuid.UUID `gorm:"type:uuid" json:"topic_id,omitempty"`
	Difficulty     *string    `gorm:"type:text" json:"difficulty,omitempty"`
	NCERTClass     *int       `json:"ncert_class,omitempty"`
	NCERTPage      *int       `json:"ncert_page,omitempty"`
	SourceType     string     `gorm:"type:text;not null;default:'qbank'" json:"source_type"`
	SourceYear     *int       `json:"source_year,omitempty"`
	SourceLabel    *string    `gorm:"type:text" json:"source_label,omitempty"`
	CustomEligible bool       `gorm:"not null" json:"custom_eligible"`
	ContentHash    string     `gorm:"type:text;index" json:"-"`
	QuestionType   string     `gorm:"type:text;not null;default:'mcq_single'" json:"question_type"`
	Version        int        `gorm:"not null;default:1" json:"version"`
	Lang           string     `gorm:"type:text;not null;default:'en'" json:"lang"`
	FlagStatus     string     `gorm:"type:text;not null;default:'active'" json:"flag_status"`
	Tags           []Tag      `gorm:"-" json:"tags,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type StudentAttempt struct {
	ID               uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID           uuid.UUID     `gorm:"type:uuid;not null;index" json:"user_id"`
	User             User          `gorm:"foreignKey:UserID" json:"-"`
	TestID           uuid.UUID     `gorm:"type:uuid;not null;index" json:"test_id"`
	Test             Test          `gorm:"foreignKey:TestID" json:"test,omitempty"`
	Status           AttemptStatus `gorm:"type:text;not null" json:"status"`
	StartedAt        time.Time     `gorm:"not null" json:"started_at"`
	SubmittedAt      *time.Time    `json:"submitted_at,omitempty"`
	TimeTakenSeconds *int          `json:"time_taken_seconds,omitempty"`
	Score            *float64      `gorm:"type:numeric(6,2)" json:"score,omitempty"`
	TotalMarks       *float64      `gorm:"type:numeric(6,2)" json:"total_marks,omitempty"`
	CorrectCount     *int          `json:"correct_count,omitempty"`
	WrongCount       *int          `json:"wrong_count,omitempty"`
	UnattemptedCount *int          `json:"unattempted_count,omitempty"`

	Mode            string     `gorm:"type:text;not null;default:'exam'" json:"mode"`
	ExpiresAt       *time.Time `json:"expires_at,omitempty"`
	ConfigSnapshot  JSONB      `gorm:"type:jsonb" json:"config_snapshot,omitempty"`
	AttemptNo       int        `gorm:"not null;default:1" json:"attempt_no"`
	AutoSubmitted   bool       `gorm:"not null;default:false" json:"auto_submitted"`
	ActiveSessionID *uuid.UUID `gorm:"type:uuid" json:"-"`

	CreatedAt time.Time `json:"created_at"`
}

type AttemptAnswer struct {
	ID             uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	AttemptID      uuid.UUID      `gorm:"type:uuid;not null;index:idx_attempt_question,unique" json:"attempt_id"`
	Attempt        StudentAttempt `gorm:"foreignKey:AttemptID" json:"-"`
	QuestionID     uuid.UUID      `gorm:"type:uuid;not null;index:idx_attempt_question,unique" json:"question_id"`
	Question       Question       `gorm:"foreignKey:QuestionID" json:"question,omitempty"`
	SelectedOption *CorrectOption `gorm:"type:text" json:"selected_option,omitempty"`
	IsCorrect      *bool          `json:"is_correct,omitempty"`
	MarksAwarded   *float64       `gorm:"type:numeric(5,2)" json:"marks_awarded,omitempty"`
	AnsweredAt     *time.Time     `json:"answered_at,omitempty"`

	Position         int        `gorm:"not null;default:0" json:"position"`
	MarkedForReview  bool       `gorm:"not null;default:false" json:"marked_for_review"`
	TimeSpentSeconds *int       `json:"time_spent_seconds,omitempty"`
	Confidence       *string    `gorm:"type:text" json:"confidence,omitempty"`
	RevealedAt       *time.Time `json:"revealed_at,omitempty"`
}

type CSVImportBatch struct {
	ID          uuid.UUID    `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TeacherID   uuid.UUID    `gorm:"type:uuid;not null" json:"teacher_id"`
	Teacher     User         `gorm:"foreignKey:TeacherID" json:"-"`
	TestID      uuid.UUID    `gorm:"type:uuid;not null" json:"test_id"`
	Test        Test         `gorm:"foreignKey:TestID" json:"test,omitempty"`
	FileKey     string       `gorm:"type:text;not null" json:"file_key"`
	TotalRows   int          `json:"total_rows"`
	SuccessRows int          `json:"success_rows"`
	ErrorRows   int          `json:"error_rows"`
	Status      ImportStatus `gorm:"type:text;not null" json:"status"`
	CreatedAt   time.Time    `json:"created_at"`
	CompletedAt *time.Time   `json:"completed_at,omitempty"`

	Mode               string     `gorm:"type:text;not null;default:'commit'" json:"mode"`
	TemplateVersion    int        `gorm:"not null;default:1" json:"template_version"`
	BundleKey          *string    `gorm:"type:text" json:"bundle_key,omitempty"`
	FileSHA256         string     `gorm:"type:text" json:"file_sha256,omitempty"`
	WarningRows        int        `gorm:"not null;default:0" json:"warning_rows"`
	Applied            bool       `gorm:"not null;default:false" json:"applied"`
	Summary            JSONB      `gorm:"type:jsonb" json:"summary,omitempty"`
	ParentBatchID      *uuid.UUID `gorm:"type:uuid" json:"parent_batch_id,omitempty"`
	AllowContentUpdate bool       `gorm:"not null;default:false" json:"allow_content_update"`
}

type CSVImportRowError struct {
	ID           uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	BatchID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"batch_id"`
	Batch        CSVImportBatch `gorm:"foreignKey:BatchID" json:"-"`
	RowNumber    int            `json:"row_number"`
	ErrorMessage string         `gorm:"type:text" json:"error_message"`
	RawRowData   string         `gorm:"type:jsonb" json:"raw_row_data"`
	Code         string         `gorm:"type:text" json:"code,omitempty"`
	Field        string         `gorm:"type:text" json:"field,omitempty"`
	Severity     string         `gorm:"type:text;not null;default:'error'" json:"severity"`
}

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

type QuestionTag struct {
	QuestionID uuid.UUID `gorm:"type:uuid;primaryKey" json:"question_id"`
	TagID      uuid.UUID `gorm:"type:uuid;primaryKey;index" json:"tag_id"`
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

type CustomTestPreset struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CourseID    uuid.UUID `gorm:"type:uuid;not null;index" json:"course_id"`
	Title       string    `gorm:"type:text;not null" json:"title"`
	Description string    `gorm:"type:text" json:"description"`
	Blueprint   JSONB     `gorm:"type:jsonb;not null" json:"blueprint"`
	OrderIndex  int       `gorm:"not null;default:0" json:"order_index"`
	IsActive    bool      `gorm:"not null" json:"is_active"`
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
