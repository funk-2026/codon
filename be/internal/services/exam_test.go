package services

import (
	"testing"
	"time"

	"codon-backend/internal/models"
)

func liveTest(opens time.Time) *models.Test {
	dur := 180
	return &models.Test{ExamFields: models.ExamFields{Delivery: models.DeliveryLive, OpensAt: &opens, LateEntryMinutes: 15}, DurationMinutes: &dur}
}

func TestPhaseAndStartRules(t *testing.T) {
	opens := time.Date(2027, 5, 2, 14, 0, 0, 0, time.UTC)
	tt := liveTest(opens)

	if PhaseOf(tt, opens.Add(-time.Hour)) != PhaseUpcoming || PhaseOf(tt, opens.Add(time.Minute)) != PhaseLive || PhaseOf(tt, opens.Add(4*time.Hour)) != PhaseEnded {
		t.Fatal("phases wrong")
	}
	if _, err := DecideStart(tt, opens.Add(-time.Minute), true); err == nil || err.Code != "not_started" {
		t.Fatalf("an early start must be refused: %v", err)
	}
	d, err := DecideStart(tt, opens.Add(5*time.Minute), true)
	if err != nil || !d.Official || d.Source != "live" || !d.ExpiresAt.Equal(opens.Add(180*time.Minute)) {
		t.Fatalf("a late starter has less time, not more: %+v %v", d, err)
	}
	if _, err := DecideStart(tt, opens.Add(20*time.Minute), true); err == nil || err.Code != "late_entry_closed" {
		t.Fatalf("late entry must close: %v", err)
	}
	d, err = DecideStart(tt, opens.Add(5*time.Hour), true)
	if err != nil || d.Official || d.Source != "anytime" || !d.ExpiresAt.Equal(opens.Add(5*time.Hour+180*time.Minute)) {
		t.Fatalf("after the event a start is practice with full time: %+v %v", d, err)
	}
	// An admin extension moves late entry and the end together.
	tt.ExtraMinutes = 10
	if _, err := DecideStart(tt, opens.Add(20*time.Minute), true); err != nil {
		t.Fatalf("extended late entry should allow a start at 20 minutes: %v", err)
	}
	// A second attempt inside the window is not official.
	if d, _ := DecideStart(tt, opens.Add(2*time.Minute), false); d.Official {
		t.Fatal("only the first attempt is official")
	}
}

func TestResultsRelease(t *testing.T) {
	opens := time.Date(2027, 5, 2, 14, 0, 0, 0, time.UTC)
	tt := liveTest(opens)
	end := opens.Add(180 * time.Minute)
	if ResultsReleased(tt, end.Add(time.Minute)) {
		t.Fatal("results must wait for the minimum gap after the window")
	}
	if !ResultsReleased(tt, end.Add(16*time.Minute)) {
		t.Fatal("results open after the default gap")
	}
	later := end.Add(3 * time.Hour)
	tt.ResultsAt = &later
	if ResultsReleased(tt, end.Add(time.Hour)) || !ResultsReleased(tt, later) {
		t.Fatal("a later results time wins")
	}
	early := end.Add(time.Minute)
	tt.ResultsAt = &early
	if ResultsReleased(tt, end.Add(2*time.Minute)) {
		t.Fatal("a results time earlier than the minimum gap is not honoured")
	}
	if !ResultsReleased(&models.Test{}, time.Now()) {
		t.Fatal("anytime tests show results right away")
	}
}
