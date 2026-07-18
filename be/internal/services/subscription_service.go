package services

import (
	"context"
	"fmt"
	"time"

	"codon-backend/internal/models"
	rzp "codon-backend/internal/razorpay"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SubscriptionService struct {
	DB *gorm.DB
}

func NewSubscriptionService(db *gorm.DB) *SubscriptionService {
	return &SubscriptionService{DB: db}
}

// GetActiveSubscription returns the student's active subscription for a course (if any).
func (s *SubscriptionService) GetActiveSubscription(ctx context.Context, userID, courseID uuid.UUID) (*models.Subscription, error) {
	var sub models.Subscription
	err := s.DB.WithContext(ctx).
		Where("user_id = ? AND course_id = ? AND status = ? AND end_date >= ?",
			userID, courseID, models.SubActive, time.Now()).
		Preload("Plan").
		Preload("Course").
		First(&sub).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &sub, nil
}

// CheckAccess verifies if a user can access an item with requires_subscription and course_id.
// Also checks KYC if the platform setting requires it.
func (s *SubscriptionService) CheckAccess(ctx context.Context, user *models.User, requiresSubscription bool, courseID uuid.UUID, kycRequired bool) error {
	if !requiresSubscription {
		return nil // free content, always accessible
	}

	sub, err := s.GetActiveSubscription(ctx, user.ID, courseID)
	if err != nil {
		return fmt.Errorf("checking subscription: %w", err)
	}
	if sub == nil {
		return fmt.Errorf("active subscription required")
	}

	// Check KYC if feature flag is on
	if kycRequired && user.KYCStatus != models.KYCApproved {
		return fmt.Errorf("KYC verification required — please submit and get your identity approved")
	}

	return nil
}

type CheckoutResult struct {
	RazorpayOrderID string
	AmountPaise     int64
	Currency        string
	KeyID           string
}

// Checkout creates a Razorpay order and pending subscription.
func (s *SubscriptionService) Checkout(ctx context.Context, user *models.User, planID uuid.UUID) (*CheckoutResult, error) {
	var plan models.SubscriptionPlan
	if err := s.DB.WithContext(ctx).Where("id = ? AND is_active = ?", planID, true).First(&plan).Error; err != nil {
		return nil, fmt.Errorf("plan not found or inactive")
	}

	// Create Razorpay order
	order, err := rzp.DefaultClient.CreateOrder(rzp.CreateOrderRequest{
		Amount:   plan.PricePaise,
		Currency: plan.Currency,
		Receipt:  fmt.Sprintf("user_%s_plan_%s", user.ID, plan.ID),
	})
	if err != nil {
		return nil, fmt.Errorf("creating Razorpay order: %w", err)
	}

	// Create pending subscription
	sub := models.Subscription{
		UserID:   user.ID,
		PlanID:   plan.ID,
		CourseID: plan.CourseID,
		Status:   models.SubPendingPayment,
	}
	if err := s.DB.WithContext(ctx).Create(&sub).Error; err != nil {
		return nil, fmt.Errorf("creating subscription record: %w", err)
	}

	// Create payment record
	subID := sub.ID
	payment := models.PaymentRecord{
		UserID:          user.ID,
		SubscriptionID:  &subID,
		RazorpayOrderID: order.ID,
		AmountPaise:     order.Amount,
		Currency:        order.Currency,
		Status:          models.PayCreated,
	}
	if err := s.DB.WithContext(ctx).Create(&payment).Error; err != nil {
		return nil, fmt.Errorf("creating payment record: %w", err)
	}

	return &CheckoutResult{
		RazorpayOrderID: order.ID,
		AmountPaise:     order.Amount,
		Currency:        order.Currency,
		KeyID:           rzp.DefaultClient.KeyID(),
	}, nil
}

// ActivateSubscription activates the subscription tied to an order after payment capture.
// Idempotent — safe to call multiple times for the same order.
func (s *SubscriptionService) ActivateSubscription(ctx context.Context, razorpayOrderID, razorpayPaymentID, signature string) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var payment models.PaymentRecord
		if err := tx.Where("razorpay_order_id = ?", razorpayOrderID).First(&payment).Error; err != nil {
			return fmt.Errorf("payment record not found for order %s", razorpayOrderID)
		}

		// Idempotency: already captured
		if payment.Status == models.PayCaptured {
			return nil
		}

		// Update payment record
		now := time.Now()
		payment.Status = models.PayCaptured
		payment.RazorpayPaymentID = &razorpayPaymentID
		payment.RazorpaySignature = &signature
		payment.UpdatedAt = now
		if err := tx.Save(&payment).Error; err != nil {
			return fmt.Errorf("updating payment: %w", err)
		}

		if payment.SubscriptionID == nil {
			return nil // no subscription linked
		}

		// Activate subscription
		var sub models.Subscription
		if err := tx.Preload("Plan").Where("id = ?", *payment.SubscriptionID).First(&sub).Error; err != nil {
			return fmt.Errorf("subscription not found: %w", err)
		}

		startDate := now
		endDate := now.AddDate(0, 0, sub.Plan.DurationDays)
		sub.Status = models.SubActive
		sub.StartDate = &startDate
		sub.EndDate = &endDate
		sub.UpdatedAt = now
		return tx.Save(&sub).Error
	})
}

// MarkPaymentFailed marks the payment record as failed.
func (s *SubscriptionService) MarkPaymentFailed(ctx context.Context, razorpayOrderID, reason string) error {
	return s.DB.WithContext(ctx).Model(&models.PaymentRecord{}).
		Where("razorpay_order_id = ?", razorpayOrderID).
		Updates(map[string]interface{}{
			"status":         models.PayFailed,
			"failure_reason": reason,
			"updated_at":     time.Now(),
		}).Error
}
