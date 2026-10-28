package router_test

import (
	"testing"
	"time"

	"codon-backend/internal/models"
	"codon-backend/internal/services"

	"github.com/google/uuid"
)

// answerAll starts an attempt as `u` and answers every question with `opt`, then submits.
func (e *env) answerAll(u *models.User, testID string, opt string) string {
	e.t.Helper()
	att := str(e.mustDo(200, "POST", "/tests/"+testID+"/attempts", u, nil), "attempt", "id")
	for _, q := range e.testQuestions(testID) {
		e.mustDo(200, "PUT", "/attempts/"+att+"/answers/"+q.ID.String(), u, map[string]interface{}{"selected_option": opt, "time_spent_seconds": 10})
	}
	e.mustDo(200, "POST", "/attempts/"+att+"/submit", u, nil)
	return att
}

func TestSpacedRepetitionSchedulesAndRanksDueFirst(t *testing.T) {
	e := newEnv(t)
	p := e.buildPool(0, 12, 0, 0)
	s := &e.w.Student
	e.answerAll(s, p.physics.ID.String(), "B") // all correct → interval 1 day
	var st models.StudentQuestionState
	e.db.First(&st, "user_id = ?", s.ID)
	if st.SRSInterval != 1 || st.SRSDueAt == nil || st.SRSDueAt.Before(time.Now().Add(23*time.Hour)) {
		t.Fatalf("first correct answer → due in 1 day: %+v", st)
	}
	// answer again correctly (pretend the day passed) → interval doubles
	e.db.Model(&models.StudentQuestionState{}).Where("user_id = ?", s.ID).UpdateColumn("srs_due_at", time.Now().Add(-time.Hour))
	e.answerAll(s, p.physics.ID.String(), "B")
	st = models.StudentQuestionState{}
	e.db.First(&st, "user_id = ?", s.ID)
	if st.SRSInterval != 2 {
		t.Fatalf("correct again doubles the interval: %+v", st)
	}
	// a wrong answer resets it to 1 day
	e.db.Model(&models.StudentQuestionState{}).Where("user_id = ?", s.ID).UpdateColumn("srs_due_at", time.Now().Add(-time.Hour))
	e.answerAll(s, p.physics.ID.String(), "A")
	st = models.StudentQuestionState{}
	e.db.First(&st, "user_id = ?", s.ID)
	if st.SRSInterval != 1 {
		t.Fatalf("wrong resets to 1 day: %+v", st)
	}

	// spaced strategy: due questions come first
	qs := e.testQuestions(p.physics.ID.String())
	dueIDs := map[uuid.UUID]bool{}
	for i, q := range qs {
		if i < 4 {
			e.db.Model(&models.StudentQuestionState{}).Where("user_id = ? AND question_id = ?", s.ID, q.ID).UpdateColumn("srs_due_at", time.Now().Add(-time.Hour))
			dueIDs[q.ID] = true
		} else {
			e.db.Model(&models.StudentQuestionState{}).Where("user_id = ? AND question_id = ?", s.ID, q.ID).UpdateColumn("srs_due_at", time.Now().Add(48*time.Hour))
		}
	}
	out := e.generate(s, bp(e, map[string]interface{}{"count": 5, "strategy": "spaced"}))
	hit := 0
	for _, q := range e.testQuestions(str(out, "test", "id")) {
		if dueIDs[q.ID] {
			hit++
		}
	}
	if hit != 4 {
		t.Fatalf("all 4 due questions must be selected, got %d", hit)
	}
	rec := e.mustDo(200, "GET", "/me/recommendations", s, nil)
	codes := map[string]bool{}
	for _, r := range rec["recommendations"].([]interface{}) {
		codes[str(r.(map[string]interface{}), "code")] = true
	}
	if !codes["due_for_revision"] {
		t.Fatalf("due questions must be recommended: %v", rec)
	}
}

func TestWeakFirstAndUnseenFirstStrategiesAndAnalytics(t *testing.T) {
	e := newEnv(t)
	p := e.buildPool(0, 12, 0, 12)
	s := &e.w.Student
	e.set("analytics.min_answers", "5")
	// Physics: all wrong (weak). Chemistry: all right (strong).
	e.answerAll(s, p.physics.ID.String(), "A")
	e.answerAll(s, p.chem.ID.String(), "B")

	m := e.mustDo(200, "GET", "/me/analytics/mastery", s, nil)["chapters"].([]interface{})
	buckets := map[string]string{}
	for _, x := range m {
		row := x.(map[string]interface{})
		buckets[str(row, "chapter")] = str(row, "bucket")
	}
	if buckets["Thermodynamics"] != "weak" || buckets["Acids"] != "strong" {
		t.Fatalf("mastery buckets: %v", buckets)
	}
	wk := e.mustDo(200, "GET", "/me/analytics/weak-areas", s, nil)["weak_areas"].([]interface{})
	if len(wk) != 1 || str(wk[0].(map[string]interface{}), "chapter") != "Thermodynamics" {
		t.Fatalf("weak areas: %v", wk)
	}
	patch := wk[0].(map[string]interface{})["suggestion"].(map[string]interface{})["patch"].(map[string]interface{})
	if patch["strategy"] != "weak_first" {
		t.Fatalf("suggestion patch: %v", patch)
	}
	// the suggested blueprint is itself valid & produces a physics-only test
	patch["course_id"] = e.w.Course.ID.String()
	gen := e.generate(s, patch)
	for _, q := range e.testQuestions(str(gen, "test", "id")) {
		if *q.SubjectID != e.w.Subject.ID {
			t.Fatal("weak-area suggestion should target the weak chapter")
		}
	}
	// weak_first across both chapters: the weak chapter fills the test first
	wf := e.generate(s, bp(e, map[string]interface{}{"count": 8, "strategy": "weak_first"}))
	for _, q := range e.testQuestions(str(wf, "test", "id")) {
		if *q.SubjectID != e.w.Subject.ID {
			t.Fatalf("weak_first must prefer the weak chapter")
		}
	}
	// coverage: 24 answered of 24 eligible... plus test_series excluded
	cov := e.mustDo(200, "GET", "/me/analytics/coverage?course_id="+e.w.Course.ID.String(), s, nil)
	if num(cov, "seen") != 24 || num(cov, "available") != 24 || num(cov, "pct") != 1 {
		t.Fatalf("coverage: %v", cov)
	}
	// unseen_first: a fresh Physics test's questions are preferred over answered ones
	extra := e.w.Test(t, models.ModuleQBank, 6, true)
	uf := e.generate(s, bp(e, map[string]interface{}{"count": 6, "strategy": "unseen_first"}))
	got := 0
	for _, q := range e.testQuestions(str(uf, "test", "id")) {
		if q.TestID == extra.ID {
			got++
		}
	}
	if got != 6 {
		t.Fatalf("unseen_first must pick the 6 unseen questions, got %d", got)
	}
	// trend points are percentages, oldest first
	tr := e.mustDo(200, "GET", "/me/analytics/trend?module=practice", s, nil)["points"].([]interface{})
	if len(tr) != 1 || num(tr[0].(map[string]interface{}), "pct") != 100 {
		t.Fatalf("trend: %v", tr)
	}
	// a brand-new student gets a "start fresh" recommendation and no weak chapter
	newbie := e.newStudent()
	rec := e.mustDo(200, "GET", "/me/recommendations", newbie, nil)["recommendations"].([]interface{})
	if len(rec) != 1 || str(rec[0].(map[string]interface{}), "code") != "start_fresh" {
		t.Fatalf("new student: %v", rec)
	}
}

func TestQuestionStatsCohortAndTeacherView(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModulePractice, 2, true)
	qs := e.testQuestions(test.ID.String())
	e.set("analytics.cohort_min_attempts", "3")
	// 4 students answer Q1: 3 wrong 1 right; time 10s each
	for i := 0; i < 4; i++ {
		u := e.newStudent()
		opt := "A"
		if i == 0 {
			opt = "B"
		}
		att := str(e.mustDo(200, "POST", "/tests/"+test.ID.String()+"/attempts", u, nil), "attempt", "id")
		e.mustDo(200, "PUT", "/attempts/"+att+"/answers/"+qs[0].ID.String(), u, map[string]interface{}{"selected_option": opt, "time_spent_seconds": 10})
		e.mustDo(200, "POST", "/attempts/"+att+"/submit", u, nil)
	}
	st := e.mustDo(200, "GET", "/teacher/questions/"+qs[0].ID.String()+"/stats", &e.w.Teacher, nil)
	if num(st, "attempts") != 4 || num(st, "correct") != 1 || num(st, "accuracy") != 0.25 || num(st, "avg_time_seconds") != 10 || st["empirical_difficulty"] != "hard" || st["sufficient_data"] != true {
		t.Fatalf("stats: %v", st)
	}
	// too little data → no numbers shown (no tiny-sample signals)
	e.set("analytics.cohort_min_attempts", "30")
	few := e.mustDo(200, "GET", "/teacher/questions/"+qs[0].ID.String()+"/stats", &e.w.Teacher, nil)
	if few["sufficient_data"] != false || few["accuracy"] != nil {
		t.Fatalf("insufficient data must hide accuracy: %v", few)
	}
	other := e.w.User(t, models.RoleTeacher)
	if code, _ := e.do("GET", "/teacher/questions/"+qs[0].ID.String()+"/stats", &other, nil); code != 404 {
		t.Fatal("only the owner sees stats")
	}
	// review shows the cohort % once there's enough data, never per-person data
	e.set("analytics.cohort_min_attempts", "3")
	att := str(e.mustDo(200, "POST", "/tests/"+test.ID.String()+"/attempts", &e.w.Student, nil), "attempt", "id")
	e.mustDo(200, "PUT", "/attempts/"+att+"/answers/"+qs[0].ID.String(), &e.w.Student, map[string]interface{}{"selected_option": "B"})
	e.mustDo(200, "POST", "/attempts/"+att+"/submit", &e.w.Student, nil)
	rev := e.mustDo(200, "GET", "/attempts/"+att+"/review", &e.w.Student, nil)["review"].([]interface{})
	if pctv := num(rev[0].(map[string]interface{}), "cohort_correct_pct"); pctv != 40 { // 2 right of 5
		t.Fatalf("cohort pct: %v", pctv)
	}
	// the rebuild from raw data agrees with the incremental counters
	var before models.QuestionStats
	e.db.First(&before, "question_id = ?", qs[0].ID)
	if err := services.RecomputeQuestionStats(nil2(), e.db, qs[0].ID); err != nil {
		t.Fatal(err)
	}
	var after models.QuestionStats
	e.db.First(&after, "question_id = ?", qs[0].ID)
	if before.Attempts != after.Attempts || before.Correct != after.Correct {
		t.Fatalf("incremental %v vs rebuilt %v", before, after)
	}
	// outlier flag: low accuracy with n>=50
	e.db.Model(&models.QuestionStats{}).Where("question_id = ?", qs[0].ID).Updates(map[string]interface{}{"attempts": 60, "correct": 5})
	fl := e.mustDo(200, "GET", "/teacher/questions/"+qs[0].ID.String()+"/stats", &e.w.Teacher, nil)
	if f := fl["flags"].([]interface{}); len(f) != 1 || f[0] != "low_accuracy" {
		t.Fatalf("flags: %v", fl["flags"])
	}
}

func TestPoolHealthInventoryAndNotes(t *testing.T) {
	e := newEnv(t)
	e.buildPool(3, 3, 3, 4)
	e.set("pool.low_inventory_floor", "10")
	ph := e.mustDo(200, "GET", "/admin/pool-health?course_id="+e.w.Course.ID.String(), &e.w.Admin, nil)
	rows := ph["chapters"].([]interface{})
	if len(rows) != 2 || num(rows[0].(map[string]interface{}), "eligible") != 9 || num(rows[0].(map[string]interface{}), "easy") != 3 || rows[0].(map[string]interface{})["low_inventory"] != true {
		t.Fatalf("pool health: %v", rows)
	}
	if num(rows[1].(map[string]interface{}), "eligible") != 4 || num(ph, "totals", "eligible") != 13 || num(ph, "totals", "low_inventory_chapters") != 2 {
		t.Fatalf("totals: %v", ph["totals"])
	}
	// test_series questions never count as eligible
	if num(rows[0].(map[string]interface{}), "missing_topic") != 9 {
		t.Fatalf("completeness columns: %v", rows[0])
	}
	inv := e.mustDo(200, "GET", "/teacher/inventory", &e.w.Teacher, nil)["low_inventory"].([]interface{})
	if len(inv) != 2 || str(inv[0].(map[string]interface{}), "chapter") != "Acids" || num(inv[0].(map[string]interface{}), "needed") != 6 {
		t.Fatalf("inventory (fewest first): %v", inv)
	}
	if code, _ := e.do("GET", "/admin/pool-health", &e.w.Teacher, nil); code != 403 {
		t.Fatal("admin only")
	}

	// notes: only for seen questions, private, shown in review
	s := &e.w.Student
	test := e.w.Test(t, models.ModulePractice, 1, true)
	q := e.testQuestions(test.ID.String())[0]
	if code, o := e.do("PUT", "/me/question-notes/"+q.ID.String(), s, map[string]interface{}{"body": "remember!"}); code != 403 || str(o, "code") != "not_exposed" {
		t.Fatalf("unseen: %d %v", code, o)
	}
	att := e.answerAll(s, test.ID.String(), "B")
	e.mustDo(200, "PUT", "/me/question-notes/"+q.ID.String(), s, map[string]interface{}{"body": "Use the first law here"})
	e.mustDo(200, "PUT", "/me/question-notes/"+q.ID.String(), s, map[string]interface{}{"body": "Edited note"})
	if code, _ := e.do("PUT", "/me/question-notes/"+q.ID.String(), s, map[string]interface{}{"body": "![x](media:11111111-1111-1111-1111-111111111111)"}); code != 400 {
		t.Fatal("images in notes not supported yet")
	}
	rev := e.mustDo(200, "GET", "/attempts/"+att+"/review", s, nil)["review"].([]interface{})
	if str(rev[0].(map[string]interface{}), "my_note") != "Edited note" {
		t.Fatalf("review note: %v", rev[0])
	}
	if l := e.mustDo(200, "GET", "/me/question-notes", e.newStudent(), nil)["notes"].([]interface{}); len(l) != 0 {
		t.Fatal("notes are private")
	}
	e.mustDo(200, "DELETE", "/me/question-notes/"+q.ID.String(), s, nil)
}

func TestMultiDeviceLockAndTakeover(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModulePractice, 2, true)
	qs := e.testQuestions(test.ID.String())
	s := &e.w.Student
	phoneA, phoneB := uuid.NewString(), uuid.NewString()
	hd := func(sess string) map[string]string { return map[string]string{"X-Test-Session": sess} }

	code, out := e.doHeader("POST", "/tests/"+test.ID.String()+"/attempts", s, nil, hd(phoneA))
	att := str(out, "attempt", "id")
	if code != 200 || out["active_elsewhere"] != false {
		t.Fatalf("device A: %d %v", code, out)
	}
	e.doHeader("PUT", "/attempts/"+att+"/answers/"+qs[0].ID.String(), s, map[string]interface{}{"selected_option": "B"}, hd(phoneA))

	// device B resumes: told it's active elsewhere, and its writes are refused
	code, out = e.doHeader("POST", "/tests/"+test.ID.String()+"/attempts", s, nil, hd(phoneB))
	if code != 200 || out["active_elsewhere"] != true {
		t.Fatalf("device B resume: %d %v", code, out)
	}
	code, out = e.doHeader("PUT", "/attempts/"+att+"/answers/"+qs[1].ID.String(), s, map[string]interface{}{"selected_option": "B"}, hd(phoneB))
	if code != 409 || str(out, "code") != "attempt_active_elsewhere" {
		t.Fatalf("device B write must be refused: %d %v", code, out)
	}
	if code, out = e.doHeader("POST", "/attempts/"+att+"/submit", s, nil, hd(phoneB)); code != 409 {
		t.Fatalf("device B submit must be refused: %d %v", code, out)
	}
	// takeover moves it; then A is locked out
	if code, _ = e.doHeader("POST", "/attempts/"+att+"/takeover", s, nil, hd(phoneB)); code != 200 {
		t.Fatal("takeover")
	}
	if code, _ = e.doHeader("PUT", "/attempts/"+att+"/answers/"+qs[1].ID.String(), s, map[string]interface{}{"selected_option": "B"}, hd(phoneB)); code != 200 {
		t.Fatal("B can write after takeover")
	}
	if code, out = e.doHeader("PUT", "/attempts/"+att+"/answers/"+qs[1].ID.String(), s, map[string]interface{}{"selected_option": "A"}, hd(phoneA)); code != 409 {
		t.Fatalf("A is now locked out: %d %v", code, out)
	}
	// the time-out sweeper is never blocked by the lock
	e.db.Model(&models.StudentAttempt{}).Where("id = ?", att).Update("expires_at", time.Now().Add(-time.Hour))
	if n, _ := e.d.Scoring.AutoSubmitExpired(nil2(), 10); n != 1 {
		t.Fatal("auto-submit must ignore the device lock")
	}
}

func TestRetentionAndPersonalDataPurge(t *testing.T) {
	e := newEnv(t)
	e.buildPool(0, 10, 0, 0)
	s := &e.w.Student
	old := e.generate(s, bp(e, nil))
	started := e.generate(s, bp(e, nil))
	e.mustDo(200, "POST", "/tests/"+str(started, "test", "id")+"/attempts", s, nil)
	past := time.Now().Add(-time.Hour)
	e.db.Model(&models.Test{}).Where("origin = 'generated'").Update("expires_at", past)
	services.RetentionSweep(nil2(), e.db)
	var archivedOld, archivedStarted models.Test
	e.db.First(&archivedOld, "id = ?", str(old, "test", "id"))
	e.db.First(&archivedStarted, "id = ?", str(started, "test", "id"))
	if archivedOld.ArchivedAt == nil || archivedStarted.ArchivedAt != nil {
		t.Fatalf("only expired NEVER-started tests are archived: old=%v started=%v", archivedOld.ArchivedAt, archivedStarted.ArchivedAt)
	}
	// purge personal data
	att := e.answerAll(s, e.testQuestions(str(started, "test", "id"))[0].TestID.String(), "B")
	_ = att
	e.mustDo(200, "PUT", "/me/bookmarks", s, map[string]interface{}{"item_type": "question", "item_id": e.testQuestions(str(started, "test", "id"))[0].ID.String()})
	e.mustDo(200, "POST", "/admin/users/"+s.ID.String()+"/purge-personal-data", &e.w.Admin, nil)
	var n int64
	for _, tbl := range []string{"bookmarks", "student_question_states", "custom_test_requests"} {
		e.db.Table(tbl).Where("user_id = ?", s.ID).Count(&n)
		if n != 0 {
			t.Fatalf("%s not purged", tbl)
		}
	}
	e.db.Model(&models.Test{}).Where("owner_user_id = ? AND origin = 'generated'", s.ID).Count(&n)
	if n != 0 {
		t.Fatal("generated tests not purged")
	}
	var u models.User
	if e.db.First(&u, "id = ?", s.ID).Error != nil {
		t.Fatal("the account itself must remain")
	}
	if code, _ := e.do("POST", "/admin/users/"+s.ID.String()+"/purge-personal-data", &e.w.Teacher, nil); code != 403 {
		t.Fatal("admin only")
	}
}
