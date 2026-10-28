package router_test

import (
	"testing"
	"time"

	"codon-backend/internal/models"
	"codon-backend/internal/services"
)

func startAttempt(e *env, test models.Test) (attemptID string, out map[string]interface{}) {
	out = e.mustDo(200, "POST", "/tests/"+test.ID.String()+"/attempts", &e.w.Student, nil)
	return str(out, "attempt", "id"), out
}

func TestStartAttemptContract(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModulePractice, 3, true)
	id, out := startAttempt(e, test)
	if id == "" {
		t.Fatalf("no attempt id: %v", out)
	}
	if str(out, "attempt", "test", "id") != test.ID.String() {
		t.Fatalf("attempt.test must be preloaded (the app reads duration from it): %v", out)
	}
	if str(out, "attempt", "expires_at") == "" || str(out, "server_now") == "" {
		t.Fatalf("timed test must carry expires_at + server_now: %v", out)
	}
	if _, ok := out["answers"].([]interface{}); !ok {
		t.Fatalf("answers must be an array: %v", out)
	}
	// resume returns the same attempt; only one in-progress attempt can exist
	id2, _ := startAttempt(e, test)
	if id2 != id {
		t.Fatalf("second start must resume: %s vs %s", id2, id)
	}
	var n int64
	e.db.Model(&models.StudentAttempt{}).Where("test_id = ?", test.ID).Count(&n)
	if n != 1 {
		t.Fatalf("want 1 attempt row, got %d", n)
	}
}

func TestAnswerLifecycleAndScoring(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModuleQBank, 3, true) // correct option is B for every question
	qs, _ := services.LoadTestQuestions(nil2(), e.db, test.ID)
	attemptID, _ := startAttempt(e, test)
	put := func(qid string, body map[string]interface{}) (int, map[string]interface{}) {
		return e.do("PUT", "/attempts/"+attemptID+"/answers/"+qid, &e.w.Student, body)
	}

	// answer Q1 correctly, Q2 wrongly, leave Q3
	e.mustDo(200, "PUT", "/attempts/"+attemptID+"/answers/"+qs[0].ID.String(), &e.w.Student, map[string]interface{}{"selected_option": "B", "time_spent_seconds": 12})
	put(qs[1].ID.String(), map[string]interface{}{"selected_option": "A"})

	// marking for review must NOT wipe the answer (partial update)
	e.mustDo(200, "PUT", "/attempts/"+attemptID+"/answers/"+qs[1].ID.String(), &e.w.Student, map[string]interface{}{"marked_for_review": true})
	var a models.AttemptAnswer
	e.db.First(&a, "attempt_id = ? AND question_id = ?", attemptID, qs[1].ID)
	if a.SelectedOption == nil || *a.SelectedOption != "A" || !a.MarkedForReview {
		t.Fatalf("mark-for-review lost the answer: %+v", a)
	}
	// explicit null clears
	e.mustDo(200, "PUT", "/attempts/"+attemptID+"/answers/"+qs[1].ID.String(), &e.w.Student, map[string]interface{}{"selected_option": nil})
	a = models.AttemptAnswer{} // gorm First() ANDs the primary key of a reused struct
	e.db.First(&a, "attempt_id = ? AND question_id = ?", attemptID, qs[1].ID)
	if a.SelectedOption != nil {
		t.Fatalf("null must clear the answer, got %v", *a.SelectedOption)
	}
	put(qs[1].ID.String(), map[string]interface{}{"selected_option": "A"})

	// legacy field name from older builds still stores time
	put(qs[0].ID.String(), map[string]interface{}{"time_taken_seconds": 30})
	a = models.AttemptAnswer{}
	e.db.First(&a, "attempt_id = ? AND question_id = ?", attemptID, qs[0].ID)
	if a.TimeSpentSeconds == nil || *a.TimeSpentSeconds != 30 {
		t.Fatalf("time not stored: %+v", a.TimeSpentSeconds)
	}

	// invalid option / foreign question
	if code, _ := put(qs[0].ID.String(), map[string]interface{}{"selected_option": "Z"}); code != 400 {
		t.Fatalf("bad option → %d", code)
	}
	other := e.w.Test(t, models.ModulePractice, 1, true)
	oq, _ := services.LoadTestQuestions(nil2(), e.db, other.ID)
	code, body := put(oq[0].ID.String(), map[string]interface{}{"selected_option": "B"})
	if code != 422 || str(body, "code") != "invalid_question" {
		t.Fatalf("foreign question must be rejected (A10): %d %v", code, body)
	}

	// submit → +4 -1 = 3, one unattempted
	res := e.mustDo(200, "POST", "/attempts/"+attemptID+"/submit", &e.w.Student, nil)
	if num(res, "score") != 3 || num(res, "correct_count") != 1 || num(res, "wrong_count") != 1 || num(res, "unattempted_count") != 1 {
		t.Fatalf("scoring wrong: %v", res)
	}
	// result carries a breakdown by question-level metadata
	result := e.mustDo(200, "GET", "/attempts/"+attemptID+"/result", &e.w.Student, nil)
	subs := result["breakdown"].(map[string]interface{})["subjects"].([]interface{})
	if len(subs) != 1 || subs[0].(map[string]interface{})["name"] != "Physics" || num(subs[0].(map[string]interface{}), "attempted") != 2 {
		t.Fatalf("breakdown wrong: %v", subs)
	}

	// review is ordered by position, filterable, and leaks no foreign question (A10/A11)
	rev := e.mustDo(200, "GET", "/attempts/"+attemptID+"/review", &e.w.Student, nil)
	items := rev["review"].([]interface{})
	if len(items) != 3 {
		t.Fatalf("review must contain exactly the test's 3 questions, got %d", len(items))
	}
	for i, it := range items {
		if int(num(it.(map[string]interface{}), "position")) != i+1 {
			t.Fatalf("review not in position order: %v", items)
		}
	}
	wrong := e.mustDo(200, "GET", "/attempts/"+attemptID+"/review?filter=wrong", &e.w.Student, nil)
	if len(wrong["review"].([]interface{})) != 1 {
		t.Fatalf("wrong filter: %v", wrong)
	}
	page := e.mustDo(200, "GET", "/attempts/"+attemptID+"/review?limit=2", &e.w.Student, nil)
	if len(page["review"].([]interface{})) != 2 || page["next_cursor"] == nil {
		t.Fatalf("pagination: %v", page)
	}

	// per-student question state is updated at submit (drives status filters)
	var st models.StudentQuestionState
	e.db.First(&st, "user_id = ? AND question_id = ?", e.w.Student.ID, qs[0].ID)
	if st.TimesAnswered != 1 || st.TimesCorrect != 1 || st.LastResult != "correct" {
		t.Fatalf("question state: %+v", st)
	}
	st = models.StudentQuestionState{}
	e.db.First(&st, "user_id = ? AND question_id = ?", e.w.Student.ID, qs[2].ID)
	if st.TimesSeen != 1 || st.TimesAnswered != 0 || st.LastResult != "unattempted" {
		t.Fatalf("unattempted state: %+v", st)
	}
	// and the day counts toward the streak
	var days int64
	e.db.Model(&models.DailyActivity{}).Where("user_id = ?", e.w.Student.ID).Count(&days)
	if days != 1 {
		t.Fatalf("daily activity not recorded")
	}
}

func TestServerEnforcedDeadlineAndAutoSubmit(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModulePractice, 2, true)
	qs, _ := services.LoadTestQuestions(nil2(), e.db, test.ID)
	attemptID, _ := startAttempt(e, test)
	e.mustDo(200, "PUT", "/attempts/"+attemptID+"/answers/"+qs[0].ID.String(), &e.w.Student, map[string]interface{}{"selected_option": "B"})

	// push the deadline into the past (beyond the grace period)
	past := time.Now().Add(-5 * time.Minute)
	e.db.Model(&models.StudentAttempt{}).Where("id = ?", attemptID).Update("expires_at", past)

	code, body := e.do("PUT", "/attempts/"+attemptID+"/answers/"+qs[1].ID.String(), &e.w.Student, map[string]interface{}{"selected_option": "B"})
	if code != 409 || str(body, "code") != "attempt_expired" {
		t.Fatalf("late answer must be refused: %d %v", code, body)
	}
	var a models.StudentAttempt
	e.db.First(&a, "id = ?", attemptID)
	if a.Status != models.AttemptSubmitted || !a.AutoSubmitted || a.Score == nil || *a.Score != 4 {
		t.Fatalf("expired attempt must be auto-submitted from saved answers: %+v", a)
	}
	// the late answer must not have been saved
	var n int64
	e.db.Model(&models.AttemptAnswer{}).Where("attempt_id = ? AND question_id = ? AND selected_option IS NOT NULL", attemptID, qs[1].ID).Count(&n)
	if n != 0 {
		t.Fatal("answer after the deadline was stored")
	}
}

func TestSweeperSubmitsAbandonedTimedAttempts(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModulePractice, 2, true)
	attemptID, _ := startAttempt(e, test)
	e.db.Model(&models.StudentAttempt{}).Where("id = ?", attemptID).Update("expires_at", time.Now().Add(-time.Hour))
	n, err := e.d.Scoring.AutoSubmitExpired(nil2(), 50)
	if err != nil || n != 1 {
		t.Fatalf("sweeper: n=%d err=%v", n, err)
	}
	if n2, _ := e.d.Scoring.AutoSubmitExpired(nil2(), 50); n2 != 0 {
		t.Fatalf("sweeper must be idempotent, second run submitted %d", n2)
	}
	// starting the test again after expiry-with-in-progress returns attempt_expired only while in progress;
	e2 := e.w.Test(t, models.ModulePractice, 1, true)
	id2, _ := startAttempt(e, e2)
	e.db.Model(&models.StudentAttempt{}).Where("id = ?", id2).Update("expires_at", time.Now().Add(-time.Hour))
	code, body := e.do("POST", "/tests/"+e2.ID.String()+"/attempts", &e.w.Student, nil)
	if code != 409 || str(body, "code") != "attempt_expired" {
		t.Fatalf("resuming an expired attempt: %d %v", code, body)
	}
}

func TestTutorRevealRules(t *testing.T) {
	e := newEnv(t)
	tutor := e.w.Test(t, models.ModulePractice, 2, true)
	e.db.Model(&models.Test{}).Where("id = ?", tutor.ID).Update("mode", "tutor")
	qs, _ := services.LoadTestQuestions(nil2(), e.db, tutor.ID)
	att, _ := startAttempt(e, tutor)

	// can't reveal before answering
	if code, body := e.do("POST", "/attempts/"+att+"/answers/"+qs[0].ID.String()+"/reveal", &e.w.Student, nil); code != 409 || str(body, "code") != "answer_required" {
		t.Fatalf("reveal without answer: %d %v", code, body)
	}
	e.mustDo(200, "PUT", "/attempts/"+att+"/answers/"+qs[0].ID.String(), &e.w.Student, map[string]interface{}{"selected_option": "A"})
	rev := e.mustDo(200, "POST", "/attempts/"+att+"/answers/"+qs[0].ID.String()+"/reveal", &e.w.Student, nil)
	if str(rev, "correct_option") != "B" || rev["is_correct"] != false {
		t.Fatalf("reveal payload: %v", rev)
	}
	// the answer is now locked
	if code, body := e.do("PUT", "/attempts/"+att+"/answers/"+qs[0].ID.String(), &e.w.Student, map[string]interface{}{"selected_option": "B"}); code != 409 || str(body, "code") != "answer_locked" {
		t.Fatalf("locked answer: %d %v", code, body)
	}
	// exam-mode attempts can never reveal
	exam := e.w.Test(t, models.ModulePractice, 1, true)
	eq, _ := services.LoadTestQuestions(nil2(), e.db, exam.ID)
	att2, _ := startAttempt(e, exam)
	e.mustDo(200, "PUT", "/attempts/"+att2+"/answers/"+eq[0].ID.String(), &e.w.Student, map[string]interface{}{"selected_option": "B"})
	if code, body := e.do("POST", "/attempts/"+att2+"/answers/"+eq[0].ID.String()+"/reveal", &e.w.Student, nil); code != 403 || str(body, "code") != "not_tutor_mode" {
		t.Fatalf("exam reveal: %d %v", code, body)
	}
}

func TestBatchSyncLastWriteWins(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModulePractice, 2, true)
	qs, _ := services.LoadTestQuestions(nil2(), e.db, test.ID)
	att, _ := startAttempt(e, test)
	newer := time.Now().Format(time.RFC3339Nano)
	older := time.Now().Add(-time.Hour).Format(time.RFC3339Nano)
	e.mustDo(200, "PUT", "/attempts/"+att+"/answers/"+qs[0].ID.String(), &e.w.Student, map[string]interface{}{"selected_option": "C", "answered_at": newer})
	out := e.mustDo(200, "PUT", "/attempts/"+att+"/answers", &e.w.Student, map[string]interface{}{"answers": []map[string]interface{}{
		{"question_id": qs[0].ID.String(), "selected_option": "A", "answered_at": older}, // stale → ignored
		{"question_id": qs[1].ID.String(), "selected_option": "D"},
		{"question_id": "11111111-1111-1111-1111-111111111111", "selected_option": "A"}, // foreign → per-item error
	}})
	res := out["results"].([]interface{})
	if res[0].(map[string]interface{})["ok"] != true || res[1].(map[string]interface{})["ok"] != true || res[2].(map[string]interface{})["ok"] != false {
		t.Fatalf("batch results: %v", res)
	}
	var a models.AttemptAnswer
	e.db.First(&a, "attempt_id = ? AND question_id = ?", att, qs[0].ID)
	if *a.SelectedOption != "C" {
		t.Fatalf("stale write overwrote newer answer: %s", *a.SelectedOption)
	}
}

func TestGetTestReportsActiveAttemptForResume(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModulePractice, 3, true)
	id := test.ID.String()

	out := e.mustDo(200, "GET", "/tests/"+id, &e.w.Student, nil)
	if _, has := out["active_attempt"]; has {
		t.Fatalf("no attempt yet, active_attempt must be absent: %v", out)
	}

	attemptID, _ := startAttempt(e, test)
	qs, _ := services.LoadTestQuestions(nil2(), e.db, test.ID)
	e.mustDo(200, "PUT", "/attempts/"+attemptID+"/answers/"+qs[0].ID.String(), &e.w.Student, map[string]interface{}{"selected_option": "A"})
	// a mark-only row must not count as answered
	e.mustDo(200, "PUT", "/attempts/"+attemptID+"/answers/"+qs[1].ID.String(), &e.w.Student, map[string]interface{}{"marked_for_review": true})

	out = e.mustDo(200, "GET", "/tests/"+id, &e.w.Student, nil)
	if str(out, "active_attempt", "id") != attemptID {
		t.Fatalf("active_attempt.id: %v", out)
	}
	aa, _ := out["active_attempt"].(map[string]interface{})
	if aa["answered"].(float64) != 1 || aa["total"].(float64) != 3 {
		t.Fatalf("progress wrong: %v", aa)
	}

	e.mustDo(200, "POST", "/attempts/"+attemptID+"/submit", &e.w.Student, nil)
	out = e.mustDo(200, "GET", "/tests/"+id, &e.w.Student, nil)
	if _, has := out["active_attempt"]; has {
		t.Fatalf("submitted attempt must not be reported as active: %v", out)
	}
}
