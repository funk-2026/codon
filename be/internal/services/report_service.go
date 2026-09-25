package services

import (
	"context"
	"errors"
	"net/http"
	"time"

	"codon-backend/internal/items"
	"codon-backend/internal/models"
	"codon-backend/internal/settings"
	"codon-backend/internal/validate"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ReportReasonKeys = []string{"wrong_answer", "typo_unclear", "duplicate", "outdated", "image_issue", "other"}

type ReportService struct{ DB *gorm.DB }

func NewReportService(db *gorm.DB) *ReportService { return &ReportService{DB: db} }

type ReportInput struct {
	ItemType  string
	ItemID    uuid.UUID
	Reason    string
	Note      string
	Context   string
	AttemptID *uuid.UUID
}

// Create files a report. Reporting the same item twice while the first is still
// open is idempotent (returns the existing report, created=false).
func (s *ReportService) Create(ctx context.Context, user *models.User, in ReportInput) (*models.ContentReport, bool, error) {
	if !validate.OneOf(in.Reason, ReportReasonKeys) {
		return nil, false, Coded(http.StatusBadRequest, "invalid_reason", "unknown report reason")
	}
	if len([]rune(in.Note)) > 300 {
		return nil, false, Coded(http.StatusBadRequest, "note_too_long", "note must be at most 300 characters")
	}
	if in.Context != "" && !validate.OneOf(in.Context, []string{"runtime", "review", "tutor"}) {
		return nil, false, Coded(http.StatusBadRequest, "invalid_context", "context must be runtime, review or tutor")
	}
	if !items.Known(in.ItemType) {
		return nil, false, Coded(http.StatusBadRequest, "invalid_item_type", "unsupported item type")
	}
	it, ok := items.Resolve(ctx, s.DB, in.ItemType, in.ItemID)
	if !ok {
		return nil, false, NotFound("item_not_found", "item not found")
	}
	if !items.Exposed(ctx, s.DB, user.ID, in.ItemType, in.ItemID) {
		return nil, false, Forbidden("not_exposed", "you can only report questions you have seen")
	}
	// existing open report by this user → idempotent
	var existing models.ContentReport
	if s.DB.WithContext(ctx).Where("reporter_id = ? AND item_type = ? AND item_id = ? AND status = ?", user.ID, in.ItemType, in.ItemID, models.ReportOpen).
		First(&existing).Error == nil {
		return &existing, false, nil
	}
	var today int64
	s.DB.WithContext(ctx).Model(&models.ContentReport{}).Where("reporter_id = ? AND created_at > ?", user.ID, time.Now().Add(-24*time.Hour)).Count(&today)
	if int(today) >= settings.Int("reports.rate_per_day") {
		return nil, false, Coded(http.StatusTooManyRequests, "rate_limited", "you've reached today's report limit")
	}
	r := models.ContentReport{ReporterID: user.ID, ItemType: in.ItemType, ItemID: in.ItemID, ItemVersion: it.Version,
		Reason: in.Reason, Context: in.Context, AttemptID: in.AttemptID, Status: models.ReportOpen}
	if in.Note != "" {
		n := in.Note
		r.Note = &n
	}
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if in.ItemType == items.Question {
			// serialise concurrent reports of the same question so the threshold can't be skipped
			var q models.Question
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&q, "id = ?", in.ItemID).Error; err != nil {
				return err
			}
		}
		if err := tx.Create(&r).Error; err != nil {
			return err
		}
		if in.ItemType == items.Question {
			if err := RecomputeQuestionStats(ctx, tx, in.ItemID); err != nil {
				return err
			}
			return AutoHoldCheck(tx, in.ItemID)
		}
		return nil
	})
	if err != nil {
		// lost a race against the partial-unique index: return the winner
		if s.DB.WithContext(ctx).Where("reporter_id = ? AND item_type = ? AND item_id = ? AND status = ?", user.ID, in.ItemType, in.ItemID, models.ReportOpen).First(&existing).Error == nil {
			return &existing, false, nil
		}
		return nil, false, err
	}
	if it.OwnerID != nil {
		Notify(s.DB, *it.OwnerID, "question_reported", "A student reported one of your questions", in.Reason,
			map[string]interface{}{"report_id": r.ID, "item_type": in.ItemType, "item_id": in.ItemID})
	}
	return &r, true, nil
}

// AutoHoldCheck flips a question to under_review when enough DISTINCT students
// reported it for a hold reason, and back to active when the open reports fall
// below the threshold. Held questions are excluded from custom-test generation;
// existing published tests keep working.
func AutoHoldCheck(tx *gorm.DB, questionID uuid.UUID) error {
	reasons := settings.List("reports.auto_hold_reasons")
	threshold := settings.Int("reports.auto_hold_threshold")
	var n int64
	if err := tx.Model(&models.ContentReport{}).
		Where("item_type = 'question' AND item_id = ? AND status = ? AND reason IN ?", questionID, models.ReportOpen, reasons).
		Distinct("reporter_id").Count(&n).Error; err != nil {
		return err
	}
	var q models.Question
	if err := tx.First(&q, "id = ?", questionID).Error; err != nil {
		return err
	}
	switch {
	case int(n) >= threshold && q.FlagStatus == models.FlagActive:
		return tx.Model(&q).UpdateColumn("flag_status", models.FlagUnderReview).Error
	case int(n) < threshold && q.FlagStatus == models.FlagUnderReview:
		return tx.Model(&q).UpdateColumn("flag_status", models.FlagActive).Error
	}
	return nil
}

// Resolve closes a report as fixed / no_change / dismissed.
func (s *ReportService) Resolve(ctx context.Context, actor *models.User, id uuid.UUID, status, note string) (*models.ContentReport, error) {
	if !validate.OneOf(status, []string{models.ReportFixed, models.ReportNoChange, models.ReportDismissed}) {
		return nil, Coded(http.StatusBadRequest, "invalid_status", "status must be fixed, no_change or dismissed")
	}
	var r models.ContentReport
	if err := s.DB.WithContext(ctx).First(&r, "id = ?", id).Error; err != nil {
		return nil, NotFound("report_not_found", "report not found")
	}
	it, _ := items.Resolve(ctx, s.DB, r.ItemType, r.ItemID)
	if actor.Role != models.RoleAdmin && !actor.CanManageAllContent && (it.OwnerID == nil || *it.OwnerID != actor.ID) {
		return nil, NotFound("report_not_found", "report not found")
	}
	if r.Status != models.ReportOpen {
		return nil, Conflict("already_resolved", "this report was already resolved")
	}
	now := time.Now()
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&r).Updates(map[string]interface{}{"status": status, "resolved_by": actor.ID, "resolved_at": now, "resolution_note": note}).Error; err != nil {
			return err
		}
		if r.ItemType == items.Question {
			if err := AutoHoldCheck(tx, r.ItemID); err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	msg := note
	if msg == "" {
		msg = "Thanks for helping us improve the questions."
	}
	Notify(s.DB, r.ReporterID, "report_resolved", "Your report was reviewed", msg, map[string]interface{}{"report_id": r.ID, "status": status})
	s.DB.WithContext(ctx).First(&r, "id = ?", id)
	return &r, nil
}
