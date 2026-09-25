package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"codon-backend/internal/models"
	"codon-backend/internal/settings"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ScoringService struct {
	DB *gorm.DB
}

func NewScoringService(db *gorm.DB) *ScoringService {
	return &ScoringService{DB: db}
}

// StartResult is what POST /tests/:id/attempts returns.
type StartResult struct {
	Attempt   *models.StudentAttempt `json:"attempt"`
	Answers   []models.AttemptAnswer `json:"answers"`
	ServerNow time.Time              `json:"server_now"`
	// ActiveElsewhere is true when the attempt is open on another device: this
	// device should show it read-only and offer takeover.
	ActiveElsewhere bool `json:"active_elsewhere"`
}

type sessionKey struct{}

// WithSession tags a context with the caller's login session so the service
// can enforce "one active device per attempt". A context without a session
// (workers, tests) is never locked out.
func WithSession(ctx context.Context, id *uuid.UUID) context.Context {
	if id == nil {
		return ctx
	}
	return context.WithValue(ctx, sessionKey{}, *id)
}

func sessionFrom(ctx context.Context) (uuid.UUID, bool) {
	v, ok := ctx.Value(sessionKey{}).(uuid.UUID)
	return v, ok
}

// checkDevice refuses writes from a different session than the one that owns
// the attempt (409 attempt_active_elsewhere) — use Takeover to move it.
func checkDevice(ctx context.Context, a *models.StudentAttempt) error {
	sid, ok := sessionFrom(ctx)
	if !ok || a.ActiveSessionID == nil || *a.ActiveSessionID == sid {
		return nil
	}
	return Coded(http.StatusConflict, "attempt_active_elsewhere", "this test is open on another device",
		map[string]interface{}{"attempt_id": a.ID})
}

// Takeover moves an in-progress attempt to the caller's session.
func (s *ScoringService) Takeover(ctx context.Context, userID, attemptID uuid.UUID) error {
	sid, ok := sessionFrom(ctx)
	if !ok {
		return nil
	}
	res := s.DB.WithContext(ctx).Model(&models.StudentAttempt{}).
		Where("id = ? AND user_id = ? AND status = ?", attemptID, userID, models.AttemptInProgress).Update("active_session_id", sid)
	if res.RowsAffected == 0 {
		return Forbidden("attempt_not_active", "attempt not found or not in progress")
	}
	return nil
}

func graceSeconds() int {
	if settings.Default == nil {
		return 10
	}
	return settings.Default.Int("attempt.answer_grace_seconds")
}

// expired reports whether a timed attempt is past its deadline (+grace).
func expired(a *models.StudentAttempt, now time.Time) bool {
	return a.ExpiresAt != nil && now.After(a.ExpiresAt.Add(time.Duration(graceSeconds())*time.Second))
}

type attemptSnapshot struct {
	MarksPerCorrect float64 `json:"marks_per_correct"`
	MarksPerWrong   float64 `json:"marks_per_wrong"`
	DurationMinutes *int    `json:"duration_minutes,omitempty"`
	Mode            string  `json:"mode"`
	QuestionCount   int64   `json:"question_count"`
	ModuleType      string  `json:"module_type"`
}

// StartAttempt starts a new attempt or resumes the in-progress one.
//
//   - Timed tests get a server-side deadline (expires_at) — the client's clock
//     is never trusted for enforcement.
//   - If a resumed attempt is already past its deadline it is auto-submitted and
//     a 409 attempt_expired (with the attempt id) is returned so the client can
//     show the result instead of re-opening the test.
func (s *ScoringService) StartAttempt(ctx context.Context, userID uuid.UUID, test *models.Test) (*StartResult, error) {
	now := time.Now()

	var existing models.StudentAttempt
	err := s.DB.WithContext(ctx).
		Where("user_id = ? AND test_id = ? AND status = ?", userID, test.ID, models.AttemptInProgress).
		First(&existing).Error
	if err == nil {
		if expired(&existing, now) {
			if _, serr := s.submit(ctx, existing.ID, userID, nil, true); serr != nil {
				return nil, serr
			}
			return nil, Coded(http.StatusConflict, "attempt_expired", "the previous attempt ran out of time and was submitted",
				map[string]interface{}{"attempt_id": existing.ID})
		}
		res, lerr := s.loadStartResult(ctx, existing.ID)
		if lerr == nil {
			if sid, ok := sessionFrom(ctx); ok {
				switch {
				case existing.ActiveSessionID == nil:
					s.DB.WithContext(ctx).Model(&models.StudentAttempt{}).Where("id = ?", existing.ID).Update("active_session_id", sid)
				case *existing.ActiveSessionID != sid:
					res.ActiveElsewhere = true
				}
			}
		}
		return res, lerr
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("checking existing attempt: %w", err)
	}

	var prior int64
	s.DB.WithContext(ctx).Model(&models.StudentAttempt{}).Where("user_id = ? AND test_id = ?", userID, test.ID).Count(&prior)
	qcount, _ := TestQuestionCount(ctx, s.DB, test.ID)

	mode := test.Mode
	if mode == "" {
		mode = models.ModeExam
	}
	snap, _ := json.Marshal(attemptSnapshot{
		MarksPerCorrect: test.MarksPerCorrect, MarksPerWrong: test.MarksPerWrong,
		DurationMinutes: test.DurationMinutes, Mode: mode, QuestionCount: qcount, ModuleType: string(test.ModuleType),
	})
	attempt := models.StudentAttempt{
		UserID: userID, TestID: test.ID, Status: models.AttemptInProgress, StartedAt: now,
		Mode: mode, AttemptNo: int(prior) + 1, ConfigSnapshot: snap,
	}
	if sid, ok := sessionFrom(ctx); ok {
		attempt.ActiveSessionID = &sid
	}
	if test.DurationMinutes != nil && *test.DurationMinutes > 0 {
		exp := now.Add(time.Duration(*test.DurationMinutes) * time.Minute)
		attempt.ExpiresAt = &exp
	}
	if err := s.DB.WithContext(ctx).Create(&attempt).Error; err != nil {
		// Lost a race against a concurrent start (uq_attempt_in_progress): resume theirs.
		var again models.StudentAttempt
		if e2 := s.DB.WithContext(ctx).
			Where("user_id = ? AND test_id = ? AND status = ?", userID, test.ID, models.AttemptInProgress).
			First(&again).Error; e2 == nil {
			return s.loadStartResult(ctx, again.ID)
		}
		return nil, fmt.Errorf("creating attempt: %w", err)
	}
	return s.loadStartResult(ctx, attempt.ID)
}

func (s *ScoringService) loadStartResult(ctx context.Context, attemptID uuid.UUID) (*StartResult, error) {
	var attempt models.StudentAttempt
	if err := s.DB.WithContext(ctx).Preload("Test").First(&attempt, "id = ?", attemptID).Error; err != nil {
		return nil, err
	}
	var answers []models.AttemptAnswer
	s.DB.WithContext(ctx).Where("attempt_id = ?", attemptID).Order("position ASC").Find(&answers)
	if answers == nil {
		answers = []models.AttemptAnswer{}
	}
	return &StartResult{Attempt: &attempt, Answers: answers, ServerNow: time.Now()}, nil
}

// GetOrCreateAttempt is kept for callers that only need the attempt row.
func (s *ScoringService) GetOrCreateAttempt(ctx context.Context, userID, testID uuid.UUID) (*models.StudentAttempt, error) {
	var test models.Test
	if err := s.DB.WithContext(ctx).First(&test, "id = ?", testID).Error; err != nil {
		return nil, err
	}
	res, err := s.StartAttempt(ctx, userID, &test)
	if err != nil {
		return nil, err
	}
	return res.Attempt, nil
}

// ── Answers ───────────────────────────────────────────────────────────────────

// AnswerInput is a partial update of one answer. Fields that are not "set"
// are left untouched, so marking a question for review never wipes the answer.
type AnswerInput struct {
	SelectedSet bool
	Selected    *string // nil (with SelectedSet) clears the answer
	TimeSpent   *int
	Marked      *bool
	Confidence  *string    // "" clears
	AnsweredAt  *time.Time // client timestamp, for last-write-wins in batch sync
}

func validOption(o string) bool { return o == "A" || o == "B" || o == "C" || o == "D" }

func (s *ScoringService) activeAttempt(ctx context.Context, userID, attemptID uuid.UUID) (*models.StudentAttempt, error) {
	var attempt models.StudentAttempt
	if err := s.DB.WithContext(ctx).
		Where("id = ? AND user_id = ? AND status = ?", attemptID, userID, models.AttemptInProgress).
		First(&attempt).Error; err != nil {
		return nil, Forbidden("attempt_not_active", "attempt not found or not in progress")
	}
	if expired(&attempt, time.Now()) {
		// Deadline passed: finalise it now rather than waiting for the sweeper.
		_, _ = s.submit(ctx, attempt.ID, userID, nil, true)
		return nil, Coded(http.StatusConflict, "attempt_expired", "time is up — this attempt was submitted",
			map[string]interface{}{"attempt_id": attempt.ID})
	}
	if err := checkDevice(ctx, &attempt); err != nil {
		return nil, err
	}
	return &attempt, nil
}

// UpsertAnswer saves one answer. Safe to call repeatedly.
func (s *ScoringService) UpsertAnswer(ctx context.Context, userID, attemptID, questionID uuid.UUID, in AnswerInput) error {
	attempt, err := s.activeAttempt(ctx, userID, attemptID)
	if err != nil {
		return err
	}
	return s.upsertAnswer(ctx, s.DB, attempt, questionID, in)
}

func (s *ScoringService) upsertAnswer(ctx context.Context, db *gorm.DB, attempt *models.StudentAttempt, questionID uuid.UUID, in AnswerInput) error {
	if in.SelectedSet && in.Selected != nil && !validOption(*in.Selected) {
		return Coded(http.StatusBadRequest, "invalid_option", "selected_option must be A, B, C, or D")
	}
	if in.Confidence != nil && *in.Confidence != "" {
		c := *in.Confidence
		if c != "sure" && c != "unsure" && c != "guess" {
			return Coded(http.StatusBadRequest, "invalid_confidence", "confidence must be sure, unsure or guess")
		}
	}
	pos, ok := QuestionInTest(ctx, db, attempt.TestID, questionID)
	if !ok {
		return Invalid("invalid_question", "question does not belong to this test")
	}

	var ans models.AttemptAnswer
	err := db.WithContext(ctx).Where("attempt_id = ? AND question_id = ?", attempt.ID, questionID).First(&ans).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		ans = models.AttemptAnswer{AttemptID: attempt.ID, QuestionID: questionID, Position: pos}
		if err := db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&ans).Error; err != nil {
			return err
		}
		// Re-read (another request may have won the insert).
		if err := db.WithContext(ctx).Where("attempt_id = ? AND question_id = ?", attempt.ID, questionID).First(&ans).Error; err != nil {
			return err
		}
	} else if err != nil {
		return err
	}
	if ans.RevealedAt != nil {
		return Conflict("answer_locked", "this answer was already revealed and can't be changed")
	}
	// Last-write-wins for offline batch sync.
	if in.AnsweredAt != nil && ans.AnsweredAt != nil && in.AnsweredAt.Before(*ans.AnsweredAt) {
		return nil
	}

	updates := map[string]interface{}{}
	if in.SelectedSet {
		if in.Selected == nil {
			updates["selected_option"] = nil
			updates["answered_at"] = nil
		} else {
			t := time.Now()
			if in.AnsweredAt != nil {
				t = *in.AnsweredAt
			}
			updates["selected_option"] = *in.Selected
			updates["answered_at"] = t
		}
	}
	if in.TimeSpent != nil {
		if *in.TimeSpent < 0 {
			return Coded(http.StatusBadRequest, "invalid_time", "time_spent_seconds must be >= 0")
		}
		updates["time_spent_seconds"] = *in.TimeSpent
	}
	if in.Marked != nil {
		updates["marked_for_review"] = *in.Marked
	}
	if in.Confidence != nil {
		if *in.Confidence == "" {
			updates["confidence"] = nil
		} else {
			updates["confidence"] = *in.Confidence
		}
	}
	if len(updates) == 0 {
		return nil
	}
	return db.WithContext(ctx).Model(&models.AttemptAnswer{}).Where("id = ?", ans.ID).Updates(updates).Error
}

// BatchItem / BatchResult support offline recovery (PUT /attempts/:id/answers).
type BatchItem struct {
	QuestionID uuid.UUID
	Input      AnswerInput
}
type BatchResult struct {
	QuestionID uuid.UUID `json:"question_id"`
	OK         bool      `json:"ok"`
	Code       string    `json:"code,omitempty"`
	Error      string    `json:"error,omitempty"`
}

func (s *ScoringService) BatchUpsert(ctx context.Context, userID, attemptID uuid.UUID, items []BatchItem) ([]BatchResult, error) {
	attempt, err := s.activeAttempt(ctx, userID, attemptID)
	if err != nil {
		return nil, err
	}
	out := make([]BatchResult, 0, len(items))
	for _, it := range items {
		r := BatchResult{QuestionID: it.QuestionID, OK: true}
		if e := s.upsertAnswer(ctx, s.DB, attempt, it.QuestionID, it.Input); e != nil {
			r.OK = false
			var ce *CodedError
			if errors.As(e, &ce) {
				r.Code, r.Error = ce.Code, ce.Msg
			} else {
				r.Code, r.Error = "internal", e.Error()
			}
		}
		out = append(out, r)
	}
	return out, nil
}

// RevealResult is returned by tutor-mode reveal.
type RevealResult struct {
	QuestionID    uuid.UUID        `json:"question_id"`
	CorrectOption string           `json:"correct_option"`
	Explanation   *string          `json:"explanation"`
	IsCorrect     bool             `json:"is_correct"`
	Marks         float64          `json:"marks"`
	Question      *models.Question `json:"-"`
}

// Reveal (tutor mode) locks the student's answer and discloses the key +
// explanation for that one question. Exam-mode attempts can never reveal.
func (s *ScoringService) Reveal(ctx context.Context, userID, attemptID, questionID uuid.UUID) (*RevealResult, error) {
	attempt, err := s.activeAttempt(ctx, userID, attemptID)
	if err != nil {
		return nil, err
	}
	if attempt.Mode != models.ModeTutor {
		return nil, Forbidden("not_tutor_mode", "answers can only be revealed in tutor mode")
	}
	if _, ok := QuestionInTest(ctx, s.DB, attempt.TestID, questionID); !ok {
		return nil, Invalid("invalid_question", "question does not belong to this test")
	}
	var ans models.AttemptAnswer
	if err := s.DB.WithContext(ctx).Where("attempt_id = ? AND question_id = ?", attemptID, questionID).First(&ans).Error; err != nil || ans.SelectedOption == nil {
		return nil, Conflict("answer_required", "select an answer before revealing")
	}
	var q models.Question
	if err := s.DB.WithContext(ctx).First(&q, "id = ?", questionID).Error; err != nil {
		return nil, NotFound("question_not_found", "question not found")
	}
	var test models.Test
	s.DB.WithContext(ctx).First(&test, "id = ?", attempt.TestID)

	correct := *ans.SelectedOption == q.CorrectOption
	marks := test.MarksPerWrong
	if correct {
		marks = test.MarksPerCorrect
	}
	now := time.Now()
	if ans.RevealedAt == nil {
		s.DB.WithContext(ctx).Model(&models.AttemptAnswer{}).Where("id = ?", ans.ID).Updates(map[string]interface{}{
			"revealed_at": now, "is_correct": correct, "marks_awarded": marks,
		})
	}
	return &RevealResult{QuestionID: q.ID, CorrectOption: string(q.CorrectOption), Explanation: q.Explanation,
		IsCorrect: correct, Marks: marks, Question: &q}, nil
}

// ── Submit / scoring ──────────────────────────────────────────────────────────

// SubmitAttempt finalises the attempt and computes the score server-side.
func (s *ScoringService) SubmitAttempt(ctx context.Context, attemptID, userID uuid.UUID, timeTakenSeconds *int) (*models.StudentAttempt, error) {
	return s.submit(ctx, attemptID, userID, timeTakenSeconds, false)
}

func (s *ScoringService) submit(ctx context.Context, attemptID, userID uuid.UUID, timeTaken *int, auto bool) (*models.StudentAttempt, error) {
	var result *models.StudentAttempt
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var attempt models.StudentAttempt
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ? AND status = ?", attemptID, userID, models.AttemptInProgress).
			First(&attempt).Error; err != nil {
			return fmt.Errorf("attempt not found or not in progress")
		}
		if !auto {
			if err := checkDevice(ctx, &attempt); err != nil {
				return err
			}
		}
		var test models.Test
		if err := tx.Where("id = ?", attempt.TestID).First(&test).Error; err != nil {
			return fmt.Errorf("loading test: %w", err)
		}
		questions, err := LoadTestQuestions(ctx, tx, test.ID)
		if err != nil {
			return err
		}
		var answers []models.AttemptAnswer
		tx.Where("attempt_id = ?", attempt.ID).Find(&answers)
		byQ := make(map[uuid.UUID]*models.AttemptAnswer, len(answers))
		for i := range answers {
			byQ[answers[i].QuestionID] = &answers[i]
		}

		var score float64
		var correctN, wrongN, unattemptedN int
		total := float64(len(questions)) * test.MarksPerCorrect
		now := time.Now()

		type stateUpd struct {
			qid      uuid.UUID
			answered bool
			correct  bool
			timeSec  *int
		}
		states := make([]stateUpd, 0, len(questions))

		for _, q := range questions {
			ans := byQ[q.ID]
			if ans == nil {
				a := models.AttemptAnswer{AttemptID: attempt.ID, QuestionID: q.ID, Position: q.Position}
				if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&a).Error; err != nil {
					return err
				}
				unattemptedN++
				states = append(states, stateUpd{q.ID, false, false, nil})
				continue
			}
			if ans.SelectedOption == nil {
				unattemptedN++
				tx.Model(&models.AttemptAnswer{}).Where("id = ?", ans.ID).Updates(map[string]interface{}{
					"position": q.Position, "is_correct": nil, "marks_awarded": nil,
				})
				states = append(states, stateUpd{q.ID, false, false, nil})
				continue
			}
			isCorrect := *ans.SelectedOption == q.CorrectOption
			marks := test.MarksPerWrong
			if isCorrect {
				marks = test.MarksPerCorrect
				correctN++
			} else {
				wrongN++
			}
			score += marks
			tx.Model(&models.AttemptAnswer{}).Where("id = ?", ans.ID).Updates(map[string]interface{}{
				"is_correct": isCorrect, "marks_awarded": marks, "position": q.Position,
			})
			states = append(states, stateUpd{q.ID, true, isCorrect, ans.TimeSpentSeconds})
		}

		taken := int(now.Sub(attempt.StartedAt).Seconds())
		if timeTaken != nil {
			taken = *timeTaken
		}
		if test.DurationMinutes != nil && *test.DurationMinutes > 0 {
			if max := *test.DurationMinutes * 60; taken > max {
				taken = max
			}
		}
		if taken < 0 {
			taken = 0
		}

		attempt.Status = models.AttemptSubmitted
		attempt.SubmittedAt = &now
		attempt.TimeTakenSeconds = &taken
		attempt.Score = &score
		attempt.TotalMarks = &total
		attempt.CorrectCount = &correctN
		attempt.WrongCount = &wrongN
		attempt.UnattemptedCount = &unattemptedN
		attempt.AutoSubmitted = auto
		if err := tx.Save(&attempt).Error; err != nil {
			return fmt.Errorf("saving attempt: %w", err)
		}

		// Per-student question state (drives status filters + weak areas).
		for _, st := range states {
			res, corr, ans := "unattempted", 0, 0
			var answeredAt *time.Time
			if st.answered {
				answeredAt = &now
				ans = 1
				res = "incorrect"
				if st.correct {
					res, corr = "correct", 1
				}
			}
			if err := tx.Exec(`
				INSERT INTO student_question_states
					(user_id, question_id, times_seen, times_answered, times_correct, last_result, first_seen_at, last_seen_at, last_answered_at, srs_interval)
				VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, 0)
				ON CONFLICT (user_id, question_id) DO UPDATE SET
					times_seen     = student_question_states.times_seen + 1,
					times_answered = student_question_states.times_answered + EXCLUDED.times_answered,
					times_correct  = student_question_states.times_correct + EXCLUDED.times_correct,
					last_result    = CASE WHEN EXCLUDED.last_result = 'unattempted'
					                      THEN student_question_states.last_result ELSE EXCLUDED.last_result END,
					last_seen_at   = EXCLUDED.last_seen_at,
					last_answered_at = COALESCE(EXCLUDED.last_answered_at, student_question_states.last_answered_at),
					-- spaced repetition: a correct answer doubles the interval (cap 60 d), a wrong one resets it to 1 d
					srs_interval = CASE EXCLUDED.last_result
					                 WHEN 'correct'   THEN LEAST(GREATEST(student_question_states.srs_interval * 2, 1), 60)
					                 WHEN 'incorrect' THEN 1
					                 ELSE student_question_states.srs_interval END,
					srs_due_at = CASE EXCLUDED.last_result
					               WHEN 'correct'   THEN EXCLUDED.last_seen_at + LEAST(GREATEST(student_question_states.srs_interval * 2, 1), 60) * interval '1 day'
					               WHEN 'incorrect' THEN EXCLUDED.last_seen_at + interval '1 day'
					               ELSE student_question_states.srs_due_at END`,
				userID, st.qid, ans, corr, res, now, now, answeredAt).Error; err != nil {
				return err
			}
			// first-time SRS schedule for rows just inserted by the statement above
			if err := tx.Exec(`UPDATE student_question_states SET srs_interval = 1, srs_due_at = last_seen_at + interval '1 day'
				WHERE user_id = ? AND question_id = ? AND srs_due_at IS NULL AND last_result IN ('correct','incorrect')`, userID, st.qid).Error; err != nil {
				return err
			}
			if st.answered {
				ts := 0
				timed := 0
				if st.timeSec != nil {
					ts, timed = *st.timeSec, 1
				}
				if err := tx.Exec(`INSERT INTO question_stats (question_id, attempts, correct, total_time_seconds, timed_answers, report_count, updated_at)
					VALUES (?, 1, ?, ?, ?, 0, now())
					ON CONFLICT (question_id) DO UPDATE SET attempts = question_stats.attempts + 1,
						correct = question_stats.correct + EXCLUDED.correct,
						total_time_seconds = question_stats.total_time_seconds + EXCLUDED.total_time_seconds,
						timed_answers = question_stats.timed_answers + EXCLUDED.timed_answers, updated_at = now()`,
					st.qid, corr, ts, timed).Error; err != nil {
					return err
				}
			}
		}

		if err := RecordDailyActivity(tx, userID, now); err != nil {
			return err
		}
		result = &attempt
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// RecordDailyActivity marks the day as active (drives the streak).
func RecordDailyActivity(db *gorm.DB, userID uuid.UUID, at time.Time) error {
	day := at.Truncate(24 * time.Hour)
	return db.Clauses(clause.OnConflict{DoNothing: true}).
		Create(&models.DailyActivity{UserID: userID, Date: day, CreatedAt: at}).Error
}

// AutoSubmitExpired finalises in-progress attempts whose deadline (+grace) has
// passed. Safe to run from several workers at once (row locks + SKIP LOCKED).
func (s *ScoringService) AutoSubmitExpired(ctx context.Context, limit int) (int, error) {
	cutoff := time.Now().Add(-time.Duration(graceSeconds()) * time.Second)
	var rows []struct {
		ID     uuid.UUID
		UserID uuid.UUID
	}
	if err := s.DB.WithContext(ctx).Raw(`
		SELECT id, user_id FROM student_attempts
		WHERE status = 'in_progress' AND expires_at IS NOT NULL AND expires_at < ?
		ORDER BY expires_at ASC LIMIT ?`, cutoff, limit).Scan(&rows).Error; err != nil {
		return 0, err
	}
	n := 0
	for _, r := range rows {
		if _, err := s.submit(ctx, r.ID, r.UserID, nil, true); err == nil {
			n++
		}
	}
	return n, nil
}

// ── Result breakdown ──────────────────────────────────────────────────────────

type BreakdownRow struct {
	ID        *uuid.UUID `json:"id,omitempty"`
	Name      string     `json:"name"`
	Total     int        `json:"total"`
	Attempted int        `json:"attempted"`
	Correct   int        `json:"correct"`
	Wrong     int        `json:"wrong"`
	Accuracy  float64    `json:"accuracy"` // correct ÷ attempted (0 when nothing attempted)
	Marks     float64    `json:"marks"`
}

type Breakdown struct {
	Subjects   []BreakdownRow `json:"subjects"`
	Chapters   []BreakdownRow `json:"chapters"`
	Difficulty []BreakdownRow `json:"difficulty"`
}

func (s *ScoringService) Breakdown(ctx context.Context, attemptID uuid.UUID) (*Breakdown, error) {
	run := func(idCol, joinSQL, nameExpr string) ([]BreakdownRow, error) {
		var rows []BreakdownRow
		q := fmt.Sprintf(`
			SELECT %s AS id, %s AS name,
			       count(*)::int AS total,
			       count(*) FILTER (WHERE aa.selected_option IS NOT NULL)::int AS attempted,
			       count(*) FILTER (WHERE aa.is_correct IS TRUE)::int AS correct,
			       count(*) FILTER (WHERE aa.selected_option IS NOT NULL AND aa.is_correct IS NOT TRUE)::int AS wrong,
			       COALESCE(sum(aa.marks_awarded), 0)::float8 AS marks
			FROM attempt_answers aa
			JOIN questions q ON q.id = aa.question_id
			%s
			WHERE aa.attempt_id = ?
			GROUP BY 1, 2
			ORDER BY name ASC`, idCol, nameExpr, joinSQL)
		if err := s.DB.WithContext(ctx).Raw(q, attemptID).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for i := range rows {
			if rows[i].Attempted > 0 {
				rows[i].Accuracy = float64(rows[i].Correct) / float64(rows[i].Attempted)
			}
		}
		if rows == nil {
			rows = []BreakdownRow{}
		}
		return rows, nil
	}
	subs, err := run("s.id", "LEFT JOIN subjects s ON s.id = q.subject_id", "COALESCE(s.name, 'Unspecified')")
	if err != nil {
		return nil, err
	}
	chs, err := run("c.id", "LEFT JOIN chapters c ON c.id = q.chapter_id", "COALESCE(c.name, 'Unspecified')")
	if err != nil {
		return nil, err
	}
	diffs, err := run("NULL::uuid", "", "COALESCE(q.difficulty, 'unspecified')")
	if err != nil {
		return nil, err
	}
	return &Breakdown{Subjects: subs, Chapters: chs, Difficulty: diffs}, nil
}
