package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
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
	PayCreated  PaymentStatus = "created"
	PayCaptured PaymentStatus = "captured"
	PayFailed   PaymentStatus = "failed"
	PayRefunded PaymentStatus = "refunded"
)

type SubscriptionPlan struct {
	ID           uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name         string         `gorm:"type:text;not null" json:"name"`
	CourseID     uuid.UUID      `gorm:"type:uuid;not null" json:"course_id"`
	Course       Course         `gorm:"foreignKey:CourseID" json:"course,omitempty"`
	DurationDays int            `gorm:"not null" json:"duration_days"`
	PricePaise   int64          `gorm:"not null" json:"price_paise"`
	Currency     string         `gorm:"type:text;not null;default:'INR'" json:"currency"`
	Benefits     pq.StringArray `gorm:"type:text[]" json:"benefits,omitempty"`
	IsActive     bool           `gorm:"not null" json:"is_active"`
	CreatedBy    uuid.UUID      `gorm:"type:uuid;not null" json:"created_by"`
	Creator      User           `gorm:"foreignKey:CreatedBy" json:"-"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
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
	ID                uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID            uuid.UUID     `gorm:"type:uuid;not null;index" json:"user_id"`
	User              User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	SubscriptionID    *uuid.UUID    `gorm:"type:uuid" json:"subscription_id,omitempty"`
	Subscription      *Subscription `gorm:"foreignKey:SubscriptionID" json:"subscription,omitempty"`
	RazorpayOrderID   string        `gorm:"type:text;uniqueIndex;not null" json:"razorpay_order_id"`
	RazorpayPaymentID *string       `gorm:"type:text" json:"razorpay_payment_id,omitempty"`
	RazorpaySignature *string       `gorm:"type:text" json:"-"`
	AmountPaise       int64         `gorm:"not null" json:"amount_paise"`
	Currency          string        `gorm:"type:text;not null" json:"currency"`
	Status            PaymentStatus `gorm:"type:text;not null" json:"status"`
	FailureReason     *string       `gorm:"type:text" json:"failure_reason,omitempty"`
	RefundedAt        *time.Time    `json:"refunded_at,omitempty"`
	RefundReason      *string       `gorm:"type:text" json:"refund_reason,omitempty"`
	CreatedAt         time.Time     `json:"created_at"`
	UpdatedAt         time.Time     `json:"updated_at"`
}
