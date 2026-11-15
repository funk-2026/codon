package services

import (
	"net/http"
	"time"

	"codon-backend/internal/models"
	"codon-backend/internal/settings"
)

// Phases of a test, as a student sees them.
const (
	PhaseAnytime  = "anytime"  // available whenever
	PhaseUpcoming = "upcoming" // live test that has not started
	PhaseLive     = "live"     // live test inside its window
	PhaseEnded    = "ended"    // live test whose window closed; it can still be taken as practice
)

// ExamWindow is the live schedule of a test: everyone starts at Opens, may still start until LastStart,
// and the exam ends at Ends for all. An admin extension (ExtraMinutes) moves LastStart and Ends together.
type ExamWindow struct{ Opens, LastStart, Ends time.Time }

func (t examTest) window() (ExamWindow, bool) {
	if t.Delivery != models.DeliveryLive || t.OpensAt == nil || t.DurationMinutes == nil || *t.DurationMinutes <= 0 {
		return ExamWindow{}, false
	}
	extra := time.Duration(t.ExtraMinutes) * time.Minute
	return ExamWindow{
		Opens:     *t.OpensAt,
		LastStart: t.OpensAt.Add(time.Duration(t.LateEntryMinutes)*time.Minute + extra),
		Ends:      t.OpensAt.Add(time.Duration(*t.DurationMinutes)*time.Minute + extra),
	}, true
}

// examTest is the part of a test the exam rules read. It lets the rules be tested without a database.
type examTest struct {
	Delivery         string
	OpensAt          *time.Time
	DurationMinutes  *int
	LateEntryMinutes int
	ExtraMinutes     int
	ResultsAt        *time.Time
}

func examOf(t *models.Test) examTest {
	return examTest{t.Delivery, t.OpensAt, t.DurationMinutes, t.LateEntryMinutes, t.ExtraMinutes, t.ResultsAt}
}

// WindowOf returns the live window of a test, if it has one.
func WindowOf(t *models.Test) (ExamWindow, bool) { return examOf(t).window() }

// PhaseOf says where a test is right now.
func PhaseOf(t *models.Test, now time.Time) string {
	w, ok := WindowOf(t)
	if !ok {
		return PhaseAnytime
	}
	switch {
	case now.Before(w.Opens):
		return PhaseUpcoming
	case now.Before(w.Ends):
		return PhaseLive
	default:
		return PhaseEnded
	}
}

// MinResultGap is the earliest a live test's results may open after its window closes.
func MinResultGap() time.Duration {
	m := 15
	if settings.Default != nil {
		if v := settings.Default.Int("exams.min_result_gap_minutes"); v > 0 {
			m = v
		}
	}
	return time.Duration(m) * time.Minute
}

// EarliestResults is the soonest results can open for a live test.
func EarliestResults(t *models.Test) (time.Time, bool) {
	w, ok := WindowOf(t)
	if !ok {
		return time.Time{}, false
	}
	return w.Ends.Add(MinResultGap()), true
}

// ResultsReleased is whether scores, ranks and answers may be shown. Anytime tests show them right after submit.
func ResultsReleased(t *models.Test, now time.Time) bool {
	if _, ok := WindowOf(t); !ok {
		return true
	}
	at, ok := EarliestResults(t)
	if t.ResultsAt != nil && (!ok || t.ResultsAt.After(at)) {
		at = *t.ResultsAt
	}
	return !now.Before(at)
}

// StartDecision is what happens when a student tries to start (not resume) a test now.
type StartDecision struct {
	Official  bool       // counts for rank
	Source    string     // "live" or "anytime"
	ExpiresAt *time.Time // the hard end of this attempt, nil if untimed
}

// DecideStart applies the live rules. `firstAttempt` is true when the student has no earlier attempt on this test.
// Live tests refuse an early start and a start after late entry closed; once the window is over the test is taken as practice.
func DecideStart(t *models.Test, now time.Time, firstAttempt bool) (StartDecision, *CodedError) {
	d := StartDecision{Source: "anytime", Official: firstAttempt}
	var dur time.Duration
	if t.DurationMinutes != nil && *t.DurationMinutes > 0 {
		dur = time.Duration(*t.DurationMinutes) * time.Minute
	}
	w, live := WindowOf(t)
	if !live {
		if dur > 0 {
			e := now.Add(dur)
			d.ExpiresAt = &e
		}
		return d, nil
	}
	switch {
	case now.Before(w.Opens):
		return d, Coded(http.StatusForbidden, "not_started", "this test has not started yet", map[string]interface{}{"opens_at": w.Opens})
	case now.Before(w.Ends):
		if now.After(w.LastStart) {
			return d, Coded(http.StatusForbidden, "late_entry_closed", "late entry for this live test is closed. You can take it as practice once it ends.", map[string]interface{}{"ends_at": w.Ends})
		}
		// Everyone's exam ends at the same moment, so a late start has less time, never more.
		e := w.Ends
		if own := now.Add(dur); own.Before(e) {
			e = own
		}
		d.Source, d.ExpiresAt = "live", &e
	default:
		// Practice after the event: full time, not official, never ranked.
		d.Official = false
		e := now.Add(dur)
		d.ExpiresAt = &e
	}
	return d, nil
}
