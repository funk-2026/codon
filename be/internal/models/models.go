package models

import (
	"database/sql/driver"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ─── Enum types ────────────────────────────────────────────────────────────────

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

type SubscriptionStatus string

const (
	SubPendingPayment SubscriptionStatus = "pending_payment"
	SubActive         SubscriptionStatus = "active"
	SubExpired        SubscriptionStatus = "expired"
	SubCancelled      SubscriptionStatus = "cancelled"
)

type PaymentStatus string

const (
	PayCreated   PaymentStatus = "created"
	PayCaptured  PaymentStatus = "captured"
	PayFailed    PaymentStatus = "failed"
	PayRefunded  PaymentStatus = "refunded"
)

type ModuleType string

const (
	ModuleQBank      ModuleType = "qbank"
	ModuleTestSeries ModuleType = "test_series"
	ModulePractice   ModuleType = "practice"
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

type IDType string

const (
	IDTypeAadhaar IDType = "aadhaar"
	IDTypePAN     IDType = "pan"
)

type WellnessCategory string

const (
	WellnessGuidance          WellnessCategory = "guidance"
	WellnessMotivation        WellnessCategory = "motivation"
	WellnessReflectionPrompt  WellnessCategory = "reflection_prompt"
)

type ImportStatus string

const (
	ImportProcessing          ImportStatus = "processing"
	ImportCompleted           ImportStatus = "completed"
	ImportCompletedWithErrors ImportStatus = "completed_with_errors"
	ImportFailed              ImportStatus = "failed"
)

type JobStatus string

const (
	JobPending    JobStatus = "pending"
	JobProcessing JobStatus = "processing"
	JobDone       JobStatus = "done"
	JobFailed     JobStatus = "failed"
)

// ─── UUID Base Model ──────────────────────────────────────────────────────────

type BaseModel struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (b *BaseModel) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}

// ─── Models ───────────────────────────────────────────────────────────────────

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
}

type OTPRequest struct {
	ID          uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	PhoneNumber string     `gorm:"type:text;not null;index"`
	OTPCodeHash string     `gorm:"type:text;not null"`
	ExpiresAt   time.Time  `gorm:"not null"`
	Attempts    int        `gorm:"not null;default:0"`
	ConsumedAt  *time.Time
	CreatedAt   time.Time
}

type Session struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey"` // also the JWT jti
	UserID     uuid.UUID  `gorm:"type:uuid;not null;index"`
	User       User       `gorm:"foreignKey:UserID"`
	DeviceID   string     `gorm:"type:text;not null"`
	DeviceInfo *string    `gorm:"type:text"`
	CreatedAt  time.Time
	LastUsedAt time.Time
	ExpiresAt  time.Time  `gorm:"not null;index"`
	RevokedAt  *time.Time
}

type Course struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name        string    `gorm:"type:text;not null" json:"name"`
	Slug        string    `gorm:"type:text;uniqueIndex;not null" json:"slug"`
	Description *string   `gorm:"type:text" json:"description,omitempty"`
	IsActive    bool      `gorm:"not null;default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type SubscriptionPlan struct {
	ID           uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name         string     `gorm:"type:text;not null" json:"name"`
	CourseID     uuid.UUID  `gorm:"type:uuid;not null" json:"course_id"`
	Course       Course     `gorm:"foreignKey:CourseID" json:"course,omitempty"`
	DurationDays int        `gorm:"not null" json:"duration_days"`
	PricePaise   int64      `gorm:"not null" json:"price_paise"`
	Currency     string     `gorm:"type:text;not null;default:'INR'" json:"currency"`
	Benefits     []string   `gorm:"type:text[];serializer:json" json:"benefits,omitempty"`
	IsActive     bool       `gorm:"not null;default:true" json:"is_active"`
	CreatedBy    uuid.UUID  `gorm:"type:uuid;not null" json:"created_by"`
	Creator      User       `gorm:"foreignKey:CreatedBy" json:"-"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type Subscription struct {
	ID        uuid.UUID          `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID    uuid.UUID          `gorm:"type:uuid;not null;index" json:"user_id"`
	User      User               `gorm:"foreignKey:UserID" json:"-"`
	PlanID    uuid.UUID          `gorm:"type:uuid;not null" json:"plan_id"`
	Plan      SubscriptionPlan   `gorm:"foreignKey:PlanID" json:"plan,omitempty"`
	CourseID  uuid.UUID          `gorm:"type:uuid;not null" json:"course_id"`
	Course    Course             `gorm:"foreignKey:CourseID" json:"course,omitempty"`
	Status    SubscriptionStatus `gorm:"type:text;not null" json:"status"`
	StartDate *time.Time         `json:"start_date,omitempty"`
	EndDate   *time.Time         `json:"end_date,omitempty"`
	AutoRenew bool               `gorm:"not null;default:false" json:"auto_renew"`
	CreatedAt time.Time          `json:"created_at"`
	UpdatedAt time.Time          `json:"updated_at"`
}

type PaymentRecord struct {
	ID                 uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID             uuid.UUID     `gorm:"type:uuid;not null;index" json:"user_id"`
	User               User          `gorm:"foreignKey:UserID" json:"-"`
	SubscriptionID     *uuid.UUID    `gorm:"type:uuid" json:"subscription_id,omitempty"`
	Subscription       *Subscription `gorm:"foreignKey:SubscriptionID" json:"-"`
	RazorpayOrderID    string        `gorm:"type:text;uniqueIndex;not null" json:"razorpay_order_id"`
	RazorpayPaymentID  *string       `gorm:"type:text" json:"razorpay_payment_id,omitempty"`
	RazorpaySignature  *string       `gorm:"type:text" json:"-"`
	AmountPaise        int64         `gorm:"not null" json:"amount_paise"`
	Currency           string        `gorm:"type:text;not null" json:"currency"`
	Status             PaymentStatus `gorm:"type:text;not null" json:"status"`
	FailureReason      *string       `gorm:"type:text" json:"failure_reason,omitempty"`
	RefundedAt         *time.Time    `json:"refunded_at,omitempty"`
	RefundReason       *string       `gorm:"type:text" json:"refund_reason,omitempty"`
	CreatedAt          time.Time     `json:"created_at"`
	UpdatedAt          time.Time     `json:"updated_at"`
}

type Test struct {
	ID                  uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Title               string        `gorm:"type:text;not null" json:"title"`
	CourseID            uuid.UUID     `gorm:"type:uuid;not null;index" json:"course_id"`
	Course              Course        `gorm:"foreignKey:CourseID" json:"course,omitempty"`
	ModuleType          ModuleType    `gorm:"type:text;not null" json:"module_type"`
	RequiresSubscription bool         `gorm:"not null;default:true" json:"requires_subscription"`
	Topic               *string       `gorm:"type:text" json:"topic,omitempty"`
	CreatedBy           uuid.UUID     `gorm:"type:uuid;not null" json:"created_by"`
	Creator             User          `gorm:"foreignKey:CreatedBy" json:"-"`
	TotalQuestions      int           `gorm:"not null;default:0" json:"total_questions"`
	DurationMinutes     *int          `json:"duration_minutes,omitempty"`
	MarksPerCorrect     float64       `gorm:"type:numeric(5,2);not null;default:4" json:"marks_per_correct"`
	MarksPerWrong       float64       `gorm:"type:numeric(5,2);not null;default:-1" json:"marks_per_wrong"`
	Status              ContentStatus `gorm:"type:text;not null;default:'draft'" json:"status"`
	ReviewedBy          *uuid.UUID    `gorm:"type:uuid" json:"reviewed_by,omitempty"`
	Reviewer            *User         `gorm:"foreignKey:ReviewedBy" json:"-"`
	ReviewedAt          *time.Time    `json:"reviewed_at,omitempty"`
	RejectionReason     *string       `gorm:"type:text" json:"rejection_reason,omitempty"`
	CreatedAt           time.Time     `json:"created_at"`
	UpdatedAt           time.Time     `json:"updated_at"`
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
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
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
	CreatedAt        time.Time     `json:"created_at"`
}

type AttemptAnswer struct {
	ID             uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	AttemptID      uuid.UUID     `gorm:"type:uuid;not null;index:idx_attempt_question,unique" json:"attempt_id"`
	Attempt        StudentAttempt `gorm:"foreignKey:AttemptID" json:"-"`
	QuestionID     uuid.UUID     `gorm:"type:uuid;not null;index:idx_attempt_question,unique" json:"question_id"`
	Question       Question      `gorm:"foreignKey:QuestionID" json:"question,omitempty"`
	SelectedOption *CorrectOption `gorm:"type:text" json:"selected_option,omitempty"`
	IsCorrect      *bool         `json:"is_correct,omitempty"`
	MarksAwarded   *float64      `gorm:"type:numeric(5,2)" json:"marks_awarded,omitempty"`
	AnsweredAt     *time.Time    `json:"answered_at,omitempty"`
}

type ContentItem struct {
	ID                   uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Title                string        `gorm:"type:text;not null" json:"title"`
	CourseID             uuid.UUID     `gorm:"type:uuid;not null;index" json:"course_id"`
	Course               Course        `gorm:"foreignKey:CourseID" json:"course,omitempty"`
	ContentType          ContentType   `gorm:"type:text;not null" json:"content_type"`
	RequiresSubscription bool          `gorm:"not null;default:true" json:"requires_subscription"`
	Topic                *string       `gorm:"type:text" json:"topic,omitempty"`
	UploadedBy           uuid.UUID     `gorm:"type:uuid;not null" json:"uploaded_by"`
	Uploader             User          `gorm:"foreignKey:UploadedBy" json:"-"`
	FileKey              string        `gorm:"type:text;not null" json:"file_key"`
	VideoStatus          *VideoStatus  `gorm:"type:text" json:"video_status,omitempty"`
	HLSPlaylistURL       *string       `gorm:"type:text" json:"hls_playlist_url,omitempty"`
	Status               ContentStatus `gorm:"type:text;not null;default:'draft'" json:"status"`
	ReviewedBy           *uuid.UUID    `gorm:"type:uuid" json:"reviewed_by,omitempty"`
	Reviewer             *User         `gorm:"foreignKey:ReviewedBy" json:"-"`
	ReviewedAt           *time.Time    `json:"reviewed_at,omitempty"`
	RejectionReason      *string       `gorm:"type:text" json:"rejection_reason,omitempty"`
	CreatedAt            time.Time     `json:"created_at"`
	UpdatedAt            time.Time     `json:"updated_at"`
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
}

type CSVImportRowError struct {
	ID           uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	BatchID      uuid.UUID `gorm:"type:uuid;not null;index" json:"batch_id"`
	Batch        CSVImportBatch `gorm:"foreignKey:BatchID" json:"-"`
	RowNumber    int       `json:"row_number"`
	ErrorMessage string    `gorm:"type:text" json:"error_message"`
	RawRowData   string    `gorm:"type:jsonb" json:"raw_row_data"`
}

type KYCRecord struct {
	ID              uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID          uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	User            User       `gorm:"foreignKey:UserID" json:"-"`
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

type WellnessContent struct {
	ID        uuid.UUID        `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Title     string           `gorm:"type:text;not null" json:"title"`
	Category  WellnessCategory `gorm:"type:text;not null" json:"category"`
	BodyText  string           `gorm:"type:text;not null" json:"body_text"`
	MediaURL  *string          `gorm:"type:text" json:"media_url,omitempty"`
	IsActive  bool             `gorm:"not null;default:true" json:"is_active"`
	CreatedBy uuid.UUID        `gorm:"type:uuid;not null" json:"created_by"`
	Creator   User             `gorm:"foreignKey:CreatedBy" json:"-"`
	CreatedAt time.Time        `json:"created_at"`
	UpdatedAt time.Time        `json:"updated_at"`
}

type PlatformSetting struct {
	Key       string     `gorm:"type:text;primaryKey" json:"key"`
	Value     string     `gorm:"type:text;not null" json:"value"`
	UpdatedAt time.Time  `json:"updated_at"`
	UpdatedBy *uuid.UUID `gorm:"type:uuid" json:"updated_by,omitempty"`
	Updater   *User      `gorm:"foreignKey:UpdatedBy" json:"-"`
}

type BackgroundJob struct {
	ID         uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Type       string     `gorm:"type:text;not null;index" json:"type"`
	Payload    string     `gorm:"type:jsonb;not null" json:"payload"`
	Status     JobStatus  `gorm:"type:text;not null;default:'pending';index" json:"status"`
	Attempts   int        `gorm:"not null;default:0" json:"attempts"`
	RunAfter   time.Time  `gorm:"not null;index" json:"run_after"`
	LastError  *string    `gorm:"type:text" json:"last_error,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// Validate UserRole
func ValidateUserRole(r string) error {
	switch UserRole(r) {
	case RoleStudent, RoleTeacher, RoleAdmin:
		return nil
	}
	return fmt.Errorf("invalid role: %s", r)
}
