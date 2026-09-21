package services_test

import (
	"context"
	"testing"

	"codon-backend/internal/models"
	"codon-backend/internal/services"

	"github.com/google/uuid"
)

func TestCheckAccess_AdminBypass(t *testing.T) {
	svc := &services.SubscriptionService{DB: nil}
	ctx := context.Background()

	adminUser := &models.User{
		ID:        uuid.New(),
		Role:      models.RoleAdmin,
		KYCStatus: models.KYCPending,
	}

	// Even if requiresSubscription is true and kycRequired is true, admin should bypass
	err := svc.CheckAccess(ctx, adminUser, true, uuid.New(), true)
	if err != nil {
		t.Fatalf("expected admin to bypass CheckAccess, got error: %v", err)
	}
}

func TestCheckAccess_FreeContent(t *testing.T) {
	svc := &services.SubscriptionService{DB: nil}
	ctx := context.Background()

	studentUser := &models.User{
		ID:        uuid.New(),
		Role:      models.RoleStudent,
		KYCStatus: models.KYCNotRequired,
	}

	// Free content requires no subscription
	err := svc.CheckAccess(ctx, studentUser, false, uuid.New(), false)
	if err != nil {
		t.Fatalf("expected free content to pass, got error: %v", err)
	}
}

