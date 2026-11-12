package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"codon-backend/internal/models"
	rzp "codon-backend/internal/razorpay"
	"codon-backend/internal/settings"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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
		Order("end_date DESC").
		First(&sub).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &sub, nil
}

// ActiveAny returns the user's current subscription across all courses (the one
// that ends last), or nil. One definition for /me, /me/subscription and admin.
func (s *SubscriptionService) ActiveAny(ctx context.Context, userID uuid.UUID) (*models.Subscription, error) {
	var sub models.Subscription
	err := s.DB.WithContext(ctx).
		Where("user_id = ? AND status = ? AND end_date >= ?", userID, models.SubActive, time.Now()).
		Preload("Plan").Preload("Course").
		Order("end_date DESC").First(&sub).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

// ActiveAll returns the user's current subscription for every course (the one
// ending last per course), so clients with several courses can show each.
func (s *SubscriptionService) ActiveAll(ctx context.Context, userID uuid.UUID) ([]models.Subscription, error) {
	var subs []models.Subscription
	err := s.DB.WithContext(ctx).
		Where("user_id = ? AND status = ? AND end_date >= ?", userID, models.SubActive, time.Now()).
		Preload("Plan").Preload("Course").
		Order("end_date DESC").Find(&subs).Error
	if err != nil {
		return nil, err
	}
	seen := map[uuid.UUID]bool{}
	out := subs[:0]
	for _, sub := range subs {
		if !seen[sub.CourseID] {
			seen[sub.CourseID] = true
			out = append(out, sub)
		}
	}
	return out, nil
}

// KYCRequired reports the platform flag (setting "kyc_required").
func (s *SubscriptionService) KYCRequired() bool {
	return settings.Default != nil && settings.Bool("kyc_required")
}

// Allow is CheckAccess with the platform KYC flag applied.
func (s *SubscriptionService) Allow(ctx context.Context, user *models.User, requiresSubscription bool, courseID uuid.UUID) error {
	return s.CheckAccess(ctx, user, requiresSubscription, courseID, s.KYCRequired())
}

// Access answers many "can this user open item X?" questions with a single
// subscription query — use it when checking every row of a list.
type Access struct {
	user  *models.User
	kyc   bool
	owned map[uuid.UUID]bool
}

// AccessFor loads the courses the user currently has an active subscription for.
func (s *SubscriptionService) AccessFor(ctx context.Context, user *models.User) (*Access, error) {
	a := &Access{user: user, kyc: s.KYCRequired(), owned: map[uuid.UUID]bool{}}
	if user.Role == models.RoleAdmin {
		return a, nil
	}
	var ids []uuid.UUID
	if err := s.DB.WithContext(ctx).Model(&models.Subscription{}).
		Where("user_id = ? AND status = ? AND end_date >= ?", user.ID, models.SubActive, time.Now()).
		Distinct().Pluck("course_id", &ids).Error; err != nil {
		return nil, err
	}
	for _, id := range ids {
		a.owned[id] = true
	}
	return a, nil
}

// Allow mirrors SubscriptionService.CheckAccess.
func (a *Access) Allow(requiresSubscription bool, courseID uuid.UUID) error {
	if a.user.Role == models.RoleAdmin || !requiresSubscription {
		return nil
	}
	if !a.owned[courseID] {
		return fmt.Errorf("active subscription required")
	}
	if a.kyc && a.user.KYCStatus != models.KYCApproved {
		return fmt.Errorf("KYC verification required — please submit and get your identity approved")
	}
	return nil
}

// CheckAccess verifies if a user can access an item with requires_subscription and course_id.
// Also checks KYC if the platform setting requires it.
func (s *SubscriptionService) CheckAccess(ctx context.Context, user *models.User, requiresSubscription bool, courseID uuid.UUID, kycRequired bool) error {
	if user != nil && user.Role == models.RoleAdmin {
		return nil // Admin has full access to all course content and tests
	}

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
		return nil, NotFound("plan_not_found", "plan not found or inactive")
	}

	// Create Razorpay order (outside the DB transaction: it is a remote call)
	order, err := rzp.DefaultClient.CreateOrder(ctx, rzp.CreateOrderRequest{
		Amount:   plan.PricePaise,
		Currency: plan.Currency,
		Receipt:  fmt.Sprintf("u_%s_p_%s", user.ID.String()[:8], plan.ID.String()[:8]),
	})
	if err != nil {
		return nil, fmt.Errorf("creating Razorpay order: %w", err)
	}

	// Pending subscription + payment record are created together or not at all.
	err = s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		sub := models.Subscription{
			UserID:   user.ID,
			PlanID:   plan.ID,
			CourseID: plan.CourseID,
			Status:   models.SubPendingPayment,
		}
		if err := tx.Create(&sub).Error; err != nil {
			return fmt.Errorf("creating subscription record: %w", err)
		}
		subID := sub.ID
		payment := models.PaymentRecord{
			UserID:          user.ID,
			SubscriptionID:  &subID,
			RazorpayOrderID: order.ID,
			AmountPaise:     order.Amount,
			Currency:        order.Currency,
			Status:          models.PayCreated,
		}
		if err := tx.Create(&payment).Error; err != nil {
			return fmt.Errorf("creating payment record: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &CheckoutResult{
		RazorpayOrderID: order.ID,
		AmountPaise:     order.Amount,
		Currency:        order.Currency,
		KeyID:           rzp.DefaultClient.KeyID(),
	}, nil
}

// OrderBelongsTo reports whether the Razorpay order was created by userID.
func (s *SubscriptionService) OrderBelongsTo(ctx context.Context, razorpayOrderID string, userID uuid.UUID) bool {
	var n int64
	s.DB.WithContext(ctx).Model(&models.PaymentRecord{}).
		Where("razorpay_order_id = ? AND user_id = ?", razorpayOrderID, userID).Count(&n)
	return n > 0
}

// ActivateSubscription activates the subscription tied to an order after payment capture.
// Idempotent and safe against the webhook and the client verify call racing:
// the payment row is locked for the duration. If the student already has an
// active subscription for the course, the new period starts when it ends
// (renewals extend, they never overlap or lose remaining days).
// signature may be empty (webhook path) — it is then not stored.
func (s *SubscriptionService) ActivateSubscription(ctx context.Context, razorpayOrderID, razorpayPaymentID, signature string) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var payment models.PaymentRecord
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("razorpay_order_id = ?", razorpayOrderID).First(&payment).Error; err != nil {
			return fmt.Errorf("payment record not found for order %s", razorpayOrderID)
		}

		// Idempotency: already captured
		if payment.Status == models.PayCaptured {
			return nil
		}

		now := time.Now()
		payment.Status = models.PayCaptured
		payment.FailureReason = nil
		payment.RazorpayPaymentID = &razorpayPaymentID
		if signature != "" {
			payment.RazorpaySignature = &signature
		}
		payment.UpdatedAt = now
		if err := tx.Save(&payment).Error; err != nil {
			return fmt.Errorf("updating payment: %w", err)
		}

		if payment.SubscriptionID == nil {
			return nil // no subscription linked
		}

		var sub models.Subscription
		if err := tx.Preload("Plan").Where("id = ?", *payment.SubscriptionID).First(&sub).Error; err != nil {
			return fmt.Errorf("subscription not found: %w", err)
		}

		// Renewal: start after the current active period, if any.
		start := now
		var current models.Subscription
		if err := tx.Where("user_id = ? AND course_id = ? AND status = ? AND end_date > ? AND id <> ?",
			sub.UserID, sub.CourseID, models.SubActive, now, sub.ID).
			Order("end_date DESC").First(&current).Error; err == nil && current.EndDate != nil {
			start = *current.EndDate
		}
		end := start.AddDate(0, 0, sub.Plan.DurationDays)
		sub.Status = models.SubActive
		sub.StartDate = &start
		sub.EndDate = &end
		sub.UpdatedAt = now
		return tx.Save(&sub).Error
	})
}

// MarkPaymentFailed marks a still-open payment as failed. A payment that was
// already captured is never downgraded (webhooks can arrive out of order).
func (s *SubscriptionService) MarkPaymentFailed(ctx context.Context, razorpayOrderID, reason string) error {
	return s.DB.WithContext(ctx).Model(&models.PaymentRecord{}).
		Where("razorpay_order_id = ? AND status = ?", razorpayOrderID, models.PayCreated).
		Updates(map[string]interface{}{
			"status":         models.PayFailed,
			"failure_reason": reason,
			"updated_at":     time.Now(),
		}).Error
}
