package services

import (
	"context"
	"strings"
	"time"

	"codon-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Reviewable describes one kind of item that goes through the shared
// draft → pending_review → approved/rejected → published workflow.
// Adding a new reviewable entity means adding one value here, not four handlers.
type Reviewable struct {
	Table        string // SQL table
	OwnerCol     string // column holding the author's user id
	Label        string // human name used in messages and notifications ("test", "flashcard deck")
	NotifyKey    string // notification type prefix ("test" → test_approved / test_rejected)
	NotFoundCode string // stable error code for "no such item"
	MinReasonLen int    // minimum length of a rejection reason (0 = optional)
}

var (
	ReviewTest    = Reviewable{"tests", "created_by", "test", "test", "test_not_found", 0}
	ReviewContent = Reviewable{"content_items", "uploaded_by", "content item", "content", "not_found", 0}
	ReviewHack    = Reviewable{"brain_hacks", "author_id", "brain hack", "brain_hack", "not_found", 3}
	ReviewDeck    = Reviewable{"flashcard_decks", "author_id", "flashcard deck", "deck", "deck_not_found", 3}
)

// Allowed transitions — the single source of truth for the workflow.
var (
	fromEditable = []models.ContentStatus{models.StatusDraft, models.StatusRejected}
	fromPending  = []models.ContentStatus{models.StatusPendingReview}
	fromApproved = []models.ContentStatus{models.StatusApproved}
)

// ReviewService applies workflow transitions atomically.
type ReviewService struct{ DB *gorm.DB }

func NewReviewService(db *gorm.DB) *ReviewService { return &ReviewService{DB: db} }

// Gate is an optional per-type precondition checked before a transition.
type Gate func(ctx context.Context, id uuid.UUID) error

func (r Reviewable) notFound(state string) error {
	return NotFound(r.NotFoundCode, r.Label+" not found or not "+state)
}

// ownerScope adds "owned by actor" unless the actor manages all content.
func ownerScope(q *gorm.DB, r Reviewable, actor *models.User) *gorm.DB {
	if actor.Role == models.RoleAdmin || actor.CanManageAllContent {
		return q
	}
	return q.Where(r.OwnerCol+" = ?", actor.ID)
}

// Submit: draft|rejected → pending_review (owner).
func (s *ReviewService) Submit(ctx context.Context, actor *models.User, r Reviewable, id uuid.UUID, gate Gate) error {
	return s.ownerTransition(ctx, actor, r, id, fromEditable, models.StatusPendingReview, "in draft/rejected state", gate)
}

// Publish: approved → published (owner).
func (s *ReviewService) Publish(ctx context.Context, actor *models.User, r Reviewable, id uuid.UUID, gate Gate) error {
	return s.ownerTransition(ctx, actor, r, id, fromApproved, models.StatusPublished, "approved", gate)
}

func (s *ReviewService) ownerTransition(ctx context.Context, actor *models.User, r Reviewable, id uuid.UUID,
	from []models.ContentStatus, to models.ContentStatus, state string, gate Gate) error {
	db := s.DB.WithContext(ctx)
	var n int64
	if err := ownerScope(db.Table(r.Table).Where("id = ? AND status IN ?", id, from), r, actor).Count(&n).Error; err != nil {
		return err
	}
	if n == 0 {
		return r.notFound(state)
	}
	if gate != nil {
		if err := gate(ctx, id); err != nil {
			return err
		}
	}
	// The guarded UPDATE re-checks the state, so two concurrent requests cannot both win.
	res := ownerScope(db.Table(r.Table).Where("id = ? AND status IN ?", id, from), r, actor).
		Updates(map[string]interface{}{"status": to, "updated_at": time.Now()})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return r.notFound(state)
	}
	return nil
}

// Approve: pending_review → approved (admin). Notifies the author.
func (s *ReviewService) Approve(ctx context.Context, admin *models.User, r Reviewable, id uuid.UUID) error {
	return s.decide(ctx, admin, r, id, models.StatusApproved, "")
}

// Reject: pending_review → rejected (admin) with a reason. Notifies the author.
func (s *ReviewService) Reject(ctx context.Context, admin *models.User, r Reviewable, id uuid.UUID, reason string) error {
	reason = strings.TrimSpace(reason)
	if len([]rune(reason)) < r.MinReasonLen {
		return Coded(400, "reason_required", "a reason is required")
	}
	return s.decide(ctx, admin, r, id, models.StatusRejected, reason)
}

func (s *ReviewService) decide(ctx context.Context, admin *models.User, r Reviewable, id uuid.UUID, to models.ContentStatus, reason string) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var row struct {
			Owner uuid.UUID
			Title string
		}
		if err := tx.Table(r.Table).Select(r.OwnerCol+" AS owner, title").
			Where("id = ? AND status IN ?", id, fromPending).Take(&row).Error; err != nil {
			return r.notFound("pending review")
		}
		upd := map[string]interface{}{"status": to, "reviewed_by": admin.ID, "reviewed_at": time.Now(), "updated_at": time.Now()}
		if to == models.StatusRejected {
			upd["rejection_reason"] = reason
		}
		res := tx.Table(r.Table).Where("id = ? AND status IN ?", id, fromPending).Updates(upd)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return r.notFound("pending review")
		}
		if to == models.StatusApproved {
			Notify(tx, row.Owner, r.NotifyKey+"_approved", "Your "+r.Label+" was approved", row.Title, map[string]interface{}{"id": id})
		} else {
			body := row.Title
			if reason != "" {
				body = reason
			}
			Notify(tx, row.Owner, r.NotifyKey+"_rejected", "Your "+r.Label+" needs changes", body, map[string]interface{}{"id": id})
		}
		return nil
	})
}
