package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"codon-backend/internal/jobs"
	"codon-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// CorrectionService handles edits to LIVE questions: a teacher proposes a
// correction with a reason, a reviewer approves it, and (optionally) past
// attempts are re-scored when the answer key changed.
type CorrectionService struct {
	DB *gorm.DB
	QS *QuestionService
}

func NewCorrectionService(db *gorm.DB, qs *QuestionService) *CorrectionService {
	return &CorrectionService{DB: db, QS: qs}
}

var errRollback = errors.New("rollback")

func canReviewAll(u *models.User) bool { return u.Role == models.RoleAdmin || u.CanManageAllContent }

// Submit records a correction. Admins / platform-wide teachers are applied
// immediately (auto-approved); everyone else's goes to review.
func (s *CorrectionService) Submit(ctx context.Context, actor *models.User, q *models.Question, test *models.Test, in QuestionInput, reason string, rescore bool) (*models.QuestionRevision, error) {
	if test.Status == models.StatusDraft || test.Status == models.StatusRejected {
		return nil, Conflict("question_editable", "this question is still a draft — edit it directly")
	}
	if len(reason) < 5 || len(reason) > 500 {
		return nil, Coded(http.StatusBadRequest, "reason_required", "explain the correction (5-500 characters)")
	}
	if !in.ContentChanged() {
		return nil, Coded(http.StatusBadRequest, "nothing_to_correct", "a correction must change the question's content or answer")
	}
	// Dry-run: the proposed result must be a valid question with valid images.
	cp := *q
	if err := s.QS.prepare(ctx, &cp, test, in); err != nil {
		return nil, err
	}
	if s.QS.RefSaver != nil {
		err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			if err := s.QS.RefSaver(ctx, tx, actor, "question", q.ID, cp.ContentFormat, s.QS.richFields(&cp)); err != nil {
				return err
			}
			return errRollback // validate only — never persist refs for a pending correction
		})
		if err != nil && !errors.Is(err, errRollback) {
			return nil, err
		}
	}
	// One pending correction per question.
	var pending int64
	s.DB.WithContext(ctx).Model(&models.QuestionRevision{}).Where("question_id = ? AND status = ?", q.ID, models.RevisionPending).Count(&pending)
	if pending > 0 {
		return nil, Conflict("correction_pending", "this question already has a correction awaiting review")
	}
	raw, _ := json.Marshal(in)
	rev := models.QuestionRevision{QuestionID: q.ID, VersionFrom: q.Version, Proposed: raw, Reason: reason,
		Status: models.RevisionPending, Rescore: rescore, CreatedBy: actor.ID}
	if err := s.DB.WithContext(ctx).Create(&rev).Error; err != nil {
		return nil, err
	}
	if canReviewAll(actor) {
		return s.Approve(ctx, actor, rev.ID)
	}
	return &rev, nil
}

// Approve applies a pending correction.
func (s *CorrectionService) Approve(ctx context.Context, reviewer *models.User, id uuid.UUID) (*models.QuestionRevision, error) {
	var rev models.QuestionRevision
	var rescoreJob bool
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&rev, "id = ? AND status = ?", id, models.RevisionPending).Error; err != nil {
			return NotFound("correction_not_found", "correction not found or already reviewed")
		}
		var q models.Question
		if err := tx.First(&q, "id = ?", rev.QuestionID).Error; err != nil {
			return NotFound("question_not_found", "question not found")
		}
		if q.Version != rev.VersionFrom {
			return Conflict("stale_correction", "the question changed since this correction was proposed")
		}
		var test models.Test
		tx.First(&test, "id = ?", q.TestID)
		var author models.User
		tx.First(&author, "id = ?", rev.CreatedBy)

		var in QuestionInput
		if err := json.Unmarshal(rev.Proposed, &in); err != nil {
			return err
		}
		before := q
		beforeKey := q.CorrectOption
		if err := s.QS.prepare(ctx, &q, &test, in); err != nil {
			return err
		}
		if s.QS.RefSaver != nil {
			// images are validated against the AUTHOR, not the reviewer
			if err := s.QS.RefSaver(ctx, tx, &author, "question", q.ID, q.ContentFormat, s.QS.richFields(&q)); err != nil {
				return err
			}
		}
		q.Version = before.Version + 1
		q.ContentHash = ContentHash(ctx, tx, &q)
		if q.FlagStatus == models.FlagUnderReview {
			q.FlagStatus = models.FlagActive
		}
		if err := tx.Save(&q).Error; err != nil {
			return err
		}
		if in.Tags != nil {
			if err := setQuestionTags(tx, q.ID, *in.Tags); err != nil {
				return err
			}
		}
		now := time.Now()
		snap, _ := json.Marshal(before)
		rev.Status, rev.ReviewedBy, rev.ReviewedAt, rev.SnapshotBefore = models.RevisionApproved, &reviewer.ID, &now, snap
		if err := tx.Save(&rev).Error; err != nil {
			return err
		}
		if err := tx.Create(&models.AdminAuditLog{ActorID: reviewer.ID, Action: "question.correction_applied",
			Target: "question:" + q.ID.String(), After: jsonBytes(map[string]interface{}{"revision": rev.ID, "reason": rev.Reason})}).Error; err != nil {
			return err
		}
		if err := ResolveOpenQuestionReports(tx, q.ID, models.ReportFixed, "The question was corrected: "+rev.Reason, reviewer.ID); err != nil {
			return err
		}
		rescoreJob = rev.Rescore && beforeKey != q.CorrectOption
		return nil
	})
	if err != nil {
		return nil, err
	}
	if rescoreJob {
		if err := jobs.EnqueueJob(s.DB, jobs.JobTypeRescoreQuestion, map[string]interface{}{"question_id": rev.QuestionID}); err != nil {
			return &rev, err
		}
	}
	Notify(s.DB, rev.CreatedBy, "correction_approved", "Your correction was applied", rev.Reason, map[string]interface{}{"question_id": rev.QuestionID})
	return &rev, nil
}

// Reject declines a pending correction.
func (s *CorrectionService) Reject(ctx context.Context, reviewer *models.User, id uuid.UUID, reason string) (*models.QuestionRevision, error) {
	var rev models.QuestionRevision
	if err := s.DB.WithContext(ctx).First(&rev, "id = ? AND status = ?", id, models.RevisionPending).Error; err != nil {
		return nil, NotFound("correction_not_found", "correction not found or already reviewed")
	}
	now := time.Now()
	rev.Status, rev.ReviewedBy, rev.ReviewedAt, rev.RejectReason = models.RevisionRejected, &reviewer.ID, &now, &reason
	if err := s.DB.WithContext(ctx).Save(&rev).Error; err != nil {
		return nil, err
	}
	Notify(s.DB, rev.CreatedBy, "correction_rejected", "Your correction was not applied", reason, map[string]interface{}{"question_id": rev.QuestionID})
	return &rev, nil
}

// ResolveOpenQuestionReports closes every open report on a question and tells
// the reporters (in-app notification).
func ResolveOpenQuestionReports(tx *gorm.DB, questionID uuid.UUID, status, note string, by uuid.UUID) error {
	var open []models.ContentReport
	if err := tx.Where("item_type = 'question' AND item_id = ? AND status = ?", questionID, models.ReportOpen).Find(&open).Error; err != nil {
		return err
	}
	now := time.Now()
	for _, r := range open {
		if err := tx.Model(&models.ContentReport{}).Where("id = ?", r.ID).Updates(map[string]interface{}{
			"status": status, "resolved_by": by, "resolved_at": now, "resolution_note": note}).Error; err != nil {
			return err
		}
		Notify(tx, r.ReporterID, "report_resolved", "Thanks — your report was reviewed", note,
			map[string]interface{}{"report_id": r.ID, "question_id": questionID, "status": status})
	}
	return nil
}

// ── Re-scoring ────────────────────────────────────────────────────────────────

// HandleRescoreQuestion is the background job: recompute every submitted
// attempt that contains the question against its current answer key. Safe to
// run repeatedly (idempotent).
func (s *CorrectionService) HandleRescoreQuestion(ctx context.Context, payload string) error {
	var p struct {
		QuestionID uuid.UUID `json:"question_id"`
	}
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return err
	}
	return s.RescoreQuestion(ctx, p.QuestionID)
}

func (s *CorrectionService) RescoreQuestion(ctx context.Context, qid uuid.UUID) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`
			UPDATE attempt_answers aa SET
				is_correct = (aa.selected_option = q.correct_option),
				marks_awarded = CASE WHEN aa.selected_option = q.correct_option THEN t.marks_per_correct ELSE t.marks_per_wrong END
			FROM questions q, student_attempts sa, tests t
			WHERE q.id = ? AND aa.question_id = q.id AND aa.attempt_id = sa.id AND sa.test_id = t.id
			  AND sa.status = 'submitted' AND aa.selected_option IS NOT NULL`, qid).Error; err != nil {
			return err
		}
		if err := tx.Exec(`
			UPDATE student_attempts sa SET score = agg.score, correct_count = agg.c, wrong_count = agg.w
			FROM (SELECT attempt_id,
			             COALESCE(sum(marks_awarded), 0) AS score,
			             (count(*) FILTER (WHERE is_correct IS TRUE))::int AS c,
			             (count(*) FILTER (WHERE selected_option IS NOT NULL AND is_correct IS NOT TRUE))::int AS w
			      FROM attempt_answers GROUP BY attempt_id) agg
			WHERE agg.attempt_id = sa.id AND sa.status = 'submitted'
			  AND sa.id IN (SELECT attempt_id FROM attempt_answers WHERE question_id = ?)`, qid).Error; err != nil {
			return err
		}
		if err := tx.Exec(`
			UPDATE student_question_states s SET times_correct = x.c, last_result = x.last
			FROM (SELECT sa.user_id,
			             (count(*) FILTER (WHERE aa.is_correct IS TRUE))::int AS c,
			             (array_agg(CASE WHEN aa.is_correct IS TRUE THEN 'correct' ELSE 'incorrect' END
			                        ORDER BY sa.submitted_at DESC NULLS LAST) FILTER (WHERE aa.selected_option IS NOT NULL))[1] AS last
			      FROM attempt_answers aa JOIN student_attempts sa ON sa.id = aa.attempt_id
			      WHERE aa.question_id = ? AND sa.status = 'submitted'
			      GROUP BY sa.user_id) x
			WHERE s.question_id = ? AND s.user_id = x.user_id AND x.last IS NOT NULL`, qid, qid).Error; err != nil {
			return err
		}
		return RecomputeQuestionStats(ctx, tx, qid)
	})
}

// RecomputeQuestionStats rebuilds the cohort aggregates of one question from
// submitted attempts.
func RecomputeQuestionStats(ctx context.Context, tx *gorm.DB, qid uuid.UUID) error {
	var reports int64
	tx.Model(&models.ContentReport{}).Where("item_type = 'question' AND item_id = ?", qid).Count(&reports)
	return tx.WithContext(ctx).Exec(fmt.Sprintf(`
		INSERT INTO question_stats (question_id, attempts, correct, total_time_seconds, timed_answers, report_count, updated_at)
		SELECT ?::uuid,
		       count(*) FILTER (WHERE aa.selected_option IS NOT NULL),
		       count(*) FILTER (WHERE aa.is_correct IS TRUE),
		       COALESCE(sum(aa.time_spent_seconds) FILTER (WHERE aa.selected_option IS NOT NULL), 0),
		       count(aa.time_spent_seconds) FILTER (WHERE aa.selected_option IS NOT NULL),
		       %d, now()
		FROM attempt_answers aa JOIN student_attempts sa ON sa.id = aa.attempt_id
		WHERE aa.question_id = ? AND sa.status = 'submitted'
		ON CONFLICT (question_id) DO UPDATE SET attempts = EXCLUDED.attempts, correct = EXCLUDED.correct,
			total_time_seconds = EXCLUDED.total_time_seconds, timed_answers = EXCLUDED.timed_answers,
			report_count = EXCLUDED.report_count, updated_at = now()`, reports), qid, qid).Error
}
