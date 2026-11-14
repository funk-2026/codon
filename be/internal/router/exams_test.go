package router_test

import (
	"testing"
	"time"

	"codon-backend/internal/models"
	"codon-backend/internal/services"
)

func ts(d time.Duration) string { return time.Now().Add(d).UTC().Format(time.RFC3339) }

// liveTest makes a published live NEET-style test that opens `opensIn` from now (negative = already open).
func (e *env) liveTest(t *testing.T, opensIn time.Duration, questions int) models.Test {
	test := e.w.Test(t, models.ModuleTestSeries, questions, true)
	at := time.Now().Add(opensIn)
	e.db.Model(&test).Updates(map[string]interface{}{"delivery": "live", "exam_style": "neet", "kind": "full", "opens_at": at, "late_entry_minutes": 15})
	e.db.First(&test, "id = ?", test.ID)
	return test
}

// A live test refuses an early start and a start after late entry closed, gives late starters less time,
// and keeps the score and the answers back until results open.
func TestLiveExamStartAndResultRelease(t *testing.T) {
	e := newEnv(t)
	s := &e.w.Student
	path := func(id string) string { return "/tests/" + id + "/attempts" }

	soon := e.liveTest(t, time.Hour, 2)
	if code, out := e.do("POST", path(soon.ID.String()), s, nil); code != 403 || str(out, "code") != "not_started" {
		t.Fatalf("an early start must be refused: %d %v", code, out)
	}
	closed := e.liveTest(t, -20*time.Minute, 2)
	if code, out := e.do("POST", path(closed.ID.String()), s, nil); code != 403 || str(out, "code") != "late_entry_closed" {
		t.Fatalf("late entry must close: %d %v", code, out)
	}

	open := e.liveTest(t, -5*time.Minute, 2)
	start := e.mustDo(200, "POST", path(open.ID.String()), s, nil)
	attemptID := str(start, "attempt", "id")
	var a models.StudentAttempt
	e.db.First(&a, "id = ?", attemptID)
	if !a.Official || a.Source != "live" {
		t.Fatalf("a start inside the window is official and live: %+v", a)
	}
	end := open.OpensAt.Add(time.Duration(*open.DurationMinutes) * time.Minute)
	if a.ExpiresAt == nil || a.ExpiresAt.Sub(end).Abs() > time.Second {
		t.Fatalf("everyone's exam ends together: expires %v want %v", a.ExpiresAt, end)
	}
	qs, _ := services.LoadTestQuestions(nil2(), e.db, open.ID)
	e.mustDo(200, "PUT", "/attempts/"+attemptID+"/answers/"+qs[0].ID.String(), s, map[string]interface{}{"selected_option": "B"})
	sub := e.mustDo(200, "POST", "/attempts/"+attemptID+"/submit", s, nil)
	if _, has := sub["score"]; has {
		t.Fatalf("the score must stay hidden until results open: %v", sub)
	}
	res := e.mustDo(200, "GET", "/attempts/"+attemptID+"/result", s, nil)
	if res["pending"] != true {
		t.Fatalf("result should be pending: %v", res)
	}
	if code, out := e.do("GET", "/attempts/"+attemptID+"/review", s, nil); code != 403 || str(out, "code") != "results_pending" {
		t.Fatalf("answers must stay closed: %d %v", code, out)
	}

	// Move the whole exam into the past: results are out, the official attempt is ranked.
	e.db.Model(&models.Test{}).Where("id = ?", open.ID).Update("opens_at", time.Now().Add(-5*time.Hour))
	res = e.mustDo(200, "GET", "/attempts/"+attemptID+"/result", s, nil)
	cohort, ok := res["cohort"].(map[string]interface{})
	if res["pending"] == true || !ok || cohort["rank"].(float64) != 1 || cohort["total"].(float64) != 1 {
		t.Fatalf("after release the result carries rank 1 of 1: %v", res)
	}
	e.mustDo(200, "GET", "/attempts/"+attemptID+"/review", s, nil)
	board := e.mustDo(200, "GET", "/tests/"+open.ID.String()+"/leaderboard", s, nil)
	if len(board["entries"].([]interface{})) != 1 {
		t.Fatalf("the board lists the one official attempt: %v", board)
	}
	an := e.mustDo(200, "GET", "/attempts/"+attemptID+"/analysis", s, nil)
	if len(an["sections"].([]interface{})) == 0 {
		t.Fatalf("analysis needs sections: %v", an)
	}

	// After the event a start is practice: full time, never ranked as official.
	again := e.mustDo(200, "POST", path(open.ID.String()), s, nil)
	var b models.StudentAttempt
	e.db.First(&b, "id = ?", str(again, "attempt", "id"))
	if b.Official || b.Source != "anytime" {
		t.Fatalf("practice after the event is not official: %+v", b)
	}
}

// Teachers can set up exams, but the combinations are checked.
func TestExamSettingsAreValidated(t *testing.T) {
	e := newEnv(t)
	tch := &e.w.Teacher
	base := func(extra map[string]interface{}) map[string]interface{} {
		m := map[string]interface{}{"title": "Mock", "course_id": e.w.Course.ID.String(), "module_type": "test_series", "duration_minutes": 180}
		for k, v := range extra {
			m[k] = v
		}
		return m
	}
	if code, out := e.do("POST", "/teacher/tests", tch, base(map[string]interface{}{"exam_style": "school", "delivery": "live", "opens_at": ts(time.Hour)})); code != 400 || str(out, "code") != "school_anytime_only" {
		t.Fatalf("school tests are anytime only: %d %v", code, out)
	}
	if code, out := e.do("POST", "/teacher/tests", tch, base(map[string]interface{}{"exam_style": "neet", "delivery": "live", "opens_at": ts(-time.Hour)})); code != 400 || str(out, "code") != "opens_at_past" {
		t.Fatalf("a start in the past is refused: %d %v", code, out)
	}
	if code, out := e.do("POST", "/teacher/tests", tch, base(map[string]interface{}{"exam_style": "neet", "delivery": "live", "opens_at": ts(24 * time.Hour), "results_at": ts(24*time.Hour + time.Minute)})); code != 400 || str(out, "code") != "results_too_early" {
		t.Fatalf("results cannot open before the minimum gap: %d %v", code, out)
	}
	ok := e.mustDo(201, "POST", "/teacher/tests", tch, base(map[string]interface{}{"exam_style": "neet", "kind": "full", "delivery": "live", "opens_at": ts(24 * time.Hour)}))
	if str(ok, "results_at") == "" || str(ok, "kind") != "full" {
		t.Fatalf("results_at defaults to the earliest allowed time: %v", ok)
	}
	if code, _ := e.do("POST", "/teacher/tests", tch, base(map[string]interface{}{"delivery": "live", "exam_style": "neet"})); code != 400 {
		t.Fatalf("a live test needs a start time: %d", code)
	}
}

// An admin can extend a live exam, which moves every attempt's deadline.
func TestExtendExam(t *testing.T) {
	e := newEnv(t)
	s := &e.w.Student
	open := e.liveTest(t, -2*time.Minute, 1)
	start := e.mustDo(200, "POST", "/tests/"+open.ID.String()+"/attempts", s, nil)
	var before models.StudentAttempt
	e.db.First(&before, "id = ?", str(start, "attempt", "id"))
	e.mustDo(200, "POST", "/admin/exams/"+open.ID.String()+"/extend", &e.w.Admin, map[string]interface{}{"minutes": 10})
	var after models.StudentAttempt
	e.db.First(&after, "id = ?", before.ID)
	if after.ExpiresAt.Sub(*before.ExpiresAt) != 10*time.Minute {
		t.Fatalf("deadline should move 10 minutes: %v -> %v", before.ExpiresAt, after.ExpiresAt)
	}
	if code, _ := e.do("POST", "/admin/exams/"+open.ID.String()+"/extend", s, map[string]interface{}{"minutes": 5}); code != 403 {
		t.Fatalf("only admins extend: %d", code)
	}
}

// A corrected answer key can be applied to every attempt, previewing first.
func TestRescoreAfterKeyChange(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModuleTestSeries, 1, true) // the key is B
	s := &e.w.Student
	id := submitAs(e, test, s, "B")
	qs, _ := services.LoadTestQuestions(nil2(), e.db, test.ID)
	e.db.Model(&models.Question{}).Where("id = ?", qs[0].ID).Update("correct_option", "C") // the key was wrong

	dry := e.mustDo(200, "POST", "/admin/exams/"+test.ID.String()+"/rescore", &e.w.Admin, map[string]interface{}{"dry_run": true})
	if dry["changed"].(float64) != 1 || dry["applied"] == true {
		t.Fatalf("the preview should find one changed score and change nothing: %v", dry)
	}
	var a models.StudentAttempt
	e.db.First(&a, "id = ?", id)
	if *a.Score != 4 {
		t.Fatalf("a preview must not write: score %v", *a.Score)
	}
	e.mustDo(200, "POST", "/admin/exams/"+test.ID.String()+"/rescore", &e.w.Admin, map[string]interface{}{})
	e.db.First(&a, "id = ?", id)
	if *a.Score != -1 {
		t.Fatalf("B is now wrong, so the score is -1: %v", *a.Score)
	}
}

// "Remind me" is idempotent and the worker reminds registered students once per point.
func TestRegisterAndReminders(t *testing.T) {
	e := newEnv(t)
	s := &e.w.Student
	soon := e.liveTest(t, 30*time.Minute, 1)
	e.mustDo(200, "POST", "/tests/"+soon.ID.String()+"/register", s, nil)
	e.mustDo(200, "POST", "/tests/"+soon.ID.String()+"/register", s, nil)
	var n int64
	e.db.Model(&models.TestRegistration{}).Where("test_id = ?", soon.ID).Count(&n)
	if n != 1 {
		t.Fatalf("registering twice stays one row, got %d", n)
	}
	if got := services.ExamReminders(nil2(), e.db, time.Now()); got != 1 {
		t.Fatalf("one reminder (the hour mark) should go out, got %d", got)
	}
	if got := services.ExamReminders(nil2(), e.db, time.Now()); got != 0 {
		t.Fatalf("the same reminder must not repeat, got %d", got)
	}
	list := e.mustDo(200, "GET", "/exams", s, nil)
	if len(list["tests"].([]interface{})) == 0 {
		t.Fatalf("the Tests tab lists the live test: %v", list)
	}
}
