package services

import (
	"context"
	"sort"
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

// teacherInboxRoute is where a tap on an author notification opens in the app.
const teacherInboxRoute = "/(teacher)/notifications"

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
	return s.SubmitWithNote(ctx, actor, r, id, gate, "")
}

// SubmitWithNote is Submit plus a message for the reviewer ("fixed the answer key in Q4").
func (s *ReviewService) SubmitWithNote(ctx context.Context, actor *models.User, r Reviewable, id uuid.UUID, gate Gate, note string) error {
	note = strings.TrimSpace(note)
	if len([]rune(note)) > 500 {
		return Coded(400, "note_too_long", "the note to the reviewer can be at most 500 characters")
	}
	return s.ownerTransition(ctx, actor, r, id, fromEditable, models.StatusPendingReview, "in draft/rejected state", gate, note)
}

// Publish: approved → published (owner).
func (s *ReviewService) Publish(ctx context.Context, actor *models.User, r Reviewable, id uuid.UUID, gate Gate) error {
	return s.ownerTransition(ctx, actor, r, id, fromApproved, models.StatusPublished, "approved", gate, "")
}

// Schedule: an approved item goes live at `at` instead of now. A nil `at` cancels the schedule.
// The worker's PublishDue does the actual publishing.
func (s *ReviewService) Schedule(ctx context.Context, actor *models.User, r Reviewable, id uuid.UUID, gate Gate, at *time.Time) error {
	if at != nil && !at.After(time.Now().Add(time.Minute)) {
		return Coded(400, "invalid_publish_at", "choose a time in the future")
	}
	db := s.DB.WithContext(ctx)
	q := ownerScope(db.Table(r.Table).Where("id = ? AND status IN ?", id, fromApproved), r, actor)
	var n int64
	if err := q.Count(&n).Error; err != nil {
		return err
	}
	if n == 0 {
		return r.notFound("approved")
	}
	if at != nil && gate != nil {
		if err := gate(ctx, id); err != nil {
			return err
		}
	}
	return ownerScope(db.Table(r.Table).Where("id = ? AND status IN ?", id, fromApproved), r, actor).
		Updates(map[string]interface{}{"publish_at": at, "updated_at": time.Now()}).Error
}

// PublishDue publishes every approved item whose scheduled time has come and tells its author.
// Content videos still transcoding wait for the next run.
func (s *ReviewService) PublishDue(ctx context.Context, now time.Time) int {
	total := 0
	for _, r := range []Reviewable{ReviewTest, ReviewContent, ReviewHack, ReviewDeck} {
		cond := "status = ? AND publish_at IS NOT NULL AND publish_at <= ?"
		if r.Table == "content_items" {
			cond += " AND (content_type <> 'video' OR video_status = 'ready')"
		}
		var rows []struct {
			ID    uuid.UUID
			Owner uuid.UUID
			Title string
		}
		if err := s.DB.WithContext(ctx).Table(r.Table).Select("id, "+r.OwnerCol+" AS owner, title").
			Where(cond, models.StatusApproved, now).Limit(200).Scan(&rows).Error; err != nil {
			continue
		}
		for _, row := range rows {
			res := s.DB.WithContext(ctx).Table(r.Table).Where("id = ? AND status = ?", row.ID, models.StatusApproved).
				Updates(map[string]interface{}{"status": models.StatusPublished, "publish_at": nil, "updated_at": now})
			if res.Error != nil || res.RowsAffected == 0 {
				continue
			}
			total++
			Notify(s.DB.WithContext(ctx), row.Owner, r.NotifyKey+"_published", "Your "+r.Label+" is live", row.Title, map[string]interface{}{"id": row.ID, "route": teacherInboxRoute})
		}
	}
	return total
}

// ReviewStats tells an author how long review currently takes: the median wait over the last 30 days
// (submitted → decided) and how many items are queued now.
type ReviewStats struct {
	Queued       int64    `json:"queued"`
	MedianHours  *float64 `json:"median_hours,omitempty"`
	SampleSize   int64    `json:"sample_size"`
}

func (s *ReviewService) Stats(ctx context.Context, now time.Time) ReviewStats {
	var out ReviewStats
	since := now.AddDate(0, 0, -30)
	for _, r := range []Reviewable{ReviewTest, ReviewContent, ReviewHack, ReviewDeck} {
		var n int64
		s.DB.WithContext(ctx).Table(r.Table).Where("status = ?", models.StatusPendingReview).Count(&n)
		out.Queued += n
	}
	var hours []float64
	for _, r := range []Reviewable{ReviewTest, ReviewContent, ReviewHack, ReviewDeck} {
		var part []float64
		s.DB.WithContext(ctx).Table(r.Table).
			Where("submitted_at IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_at >= ? AND reviewed_at > submitted_at", since).
			Pluck("EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) / 3600.0", &part)
		hours = append(hours, part...)
	}
	out.SampleSize = int64(len(hours))
	if len(hours) >= 3 {
		sort.Float64s(hours)
		m := hours[len(hours)/2]
		out.MedianHours = &m
	}
	return out
}

func (s *ReviewService) ownerTransition(ctx context.Context, actor *models.User, r Reviewable, id uuid.UUID,
	from []models.ContentStatus, to models.ContentStatus, state string, gate Gate, note string) error {
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
		Updates(transitionFields(to, note))
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return r.notFound(state)
	}
	if to == models.StatusPendingReview {
		s.notifyAdmins(db, r, id)
	}
	return nil
}

func transitionFields(to models.ContentStatus, note string) map[string]interface{} {
	now := time.Now()
	f := map[string]interface{}{"status": to, "updated_at": now}
	switch to {
	case models.StatusPendingReview:
		f["submitted_at"] = now
		f["publish_at"] = nil
		if note == "" {
			f["submit_note"] = nil
		} else {
			f["submit_note"] = note
		}
	case models.StatusPublished:
		f["publish_at"] = nil
	}
	return f
}

// notifyAdmins tells every active admin that something is waiting for review. Best effort: a failure
// to notify never blocks the author's submission. Push delivery picks the rows up like any other.
func (s *ReviewService) notifyAdmins(db *gorm.DB, r Reviewable, id uuid.UUID) {
	var titles []string
	if err := db.Table(r.Table).Where("id = ?", id).Pluck("title", &titles).Error; err != nil || len(titles) == 0 {
		return
	}
	title := titles[0]
	var admins []uuid.UUID
	if err := db.Model(&models.User{}).Where("role = ? AND suspended_at IS NULL", models.RoleAdmin).Pluck("id", &admins).Error; err != nil {
		return
	}
	for _, a := range admins {
		Notify(db, a, "review_waiting", "A "+r.Label+" is waiting for review", title,
			map[string]interface{}{"id": id, "route": "/(admin)/(tabs)/review"})
	}
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
		verb := "rejected"
		if to == models.StatusApproved {
			verb = "approved"
		}
		if err := tx.Create(&models.AdminAuditLog{ActorID: admin.ID, Action: "review." + r.NotifyKey + "." + verb, Target: r.Table + ":" + id.String()}).Error; err != nil {
			return err
		}
		if to == models.StatusApproved {
			Notify(tx, row.Owner, r.NotifyKey+"_approved", "Your "+r.Label+" was approved", row.Title, map[string]interface{}{"id": id, "route": teacherInboxRoute})
		} else {
			body := row.Title
			if reason != "" {
				body = reason
			}
			Notify(tx, row.Owner, r.NotifyKey+"_rejected", "Your "+r.Label+" needs changes", body, map[string]interface{}{"id": id, "route": teacherInboxRoute})
		}
		return nil
	})
}
