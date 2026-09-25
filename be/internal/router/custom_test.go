package router_test

import (
	"fmt"
	"testing"
	"time"

	"codon-backend/internal/models"
	"codon-backend/internal/services"
)

func bp(e *env, extra map[string]interface{}) map[string]interface{} {
	b := map[string]interface{}{"schema_version": 1, "course_id": e.w.Course.ID.String(), "count": 10, "timing": map[string]interface{}{"timed": false}}
	for k, v := range extra {
		b[k] = v
	}
	return b
}

// pool builds: Physics/Thermo qbank test (easy/medium/hard × n), Chemistry/Acids qbank test, a
// test_series test (must never be drawn), all free.
type poolIDs struct {
	physics, chem, series models.Test
	chemSub               models.Subject
	chemCh                models.Chapter
}

func (e *env) buildPool(easy, med, hard, chem int) poolIDs {
	e.t.Helper()
	e.set("custom_test.enabled", "true")
	e.set("custom_test.free_daily_generations", "1000")
	e.w.Subscribe(e.t, e.w.Student) // the default student is a paying subscriber; free-tier tests use a fresh user
	p := poolIDs{}
	p.physics = e.w.Test(e.t, models.ModuleQBank, 0, true)
	pos := 0
	add := func(n int, d string) {
		for i := 0; i < n; i++ {
			pos++
			e.w.Question(e.t, p.physics, pos, d)
		}
	}
	add(easy, "easy")
	add(med, "medium")
	add(hard, "hard")
	p.chemSub, p.chemCh = e.w.Chemistry(e.t)
	p.chem = e.w.Test(e.t, models.ModulePractice, 0, true)
	for i := 1; i <= chem; i++ {
		e.w.QuestionIn(e.t, p.chem, i, "medium", p.chemSub, p.chemCh)
	}
	p.series = e.w.Test(e.t, models.ModuleTestSeries, 15, true)
	return p
}

func ids(items interface{}) []string {
	var out []string
	for _, x := range items.([]interface{}) {
		out = append(out, str(x.(map[string]interface{}), "id"))
	}
	return out
}

func (e *env) generate(user *models.User, b map[string]interface{}) map[string]interface{} {
	e.t.Helper()
	return e.mustDo(201, "POST", "/custom-tests", user, b)
}

func (e *env) testQuestions(testID string) []models.Question {
	var out []models.Question
	e.db.Table("questions").Joins("JOIN test_questions tq ON tq.question_id = questions.id").Where("tq.test_id = ?", testID).Order("tq.position").Find(&out)
	return out
}

func TestFeatureFlagGatesTheModule(t *testing.T) {
	e := newEnv(t)
	if code, out := e.do("POST", "/custom-tests/count", &e.w.Student, bp(e, nil)); code != 403 || str(out, "code") != "feature_disabled" {
		t.Fatalf("flag off: %d %v", code, out)
	}
	e.buildPool(5, 5, 5, 5)
	e.mustDo(200, "POST", "/custom-tests/count", &e.w.Student, bp(e, nil))
	e.set("custom_test.enabled", "false")
	e.mustDo(200, "POST", "/custom-tests/count", &e.w.Admin, bp(e, nil)) // admins can test before launch
}

func TestGenerationCreatesAPrivateFrozenTest(t *testing.T) {
	e := newEnv(t)
	p := e.buildPool(10, 10, 10, 10)
	s := &e.w.Student

	out := e.generate(s, bp(e, map[string]interface{}{"count": 12, "timing": map[string]interface{}{"timed": true, "duration_minutes": 20}, "marking": map[string]interface{}{"preset": "no_negative"}}))
	test := out["test"].(map[string]interface{})
	if test["module_type"] != "custom" || test["origin"] != "generated" || test["visibility"] != "private" || num(test, "total_questions") != 12 ||
		num(test, "duration_minutes") != 20 || num(test, "marks_per_correct") != 1 || num(test, "marks_per_wrong") != 0 || test["requires_subscription"] != false {
		t.Fatalf("test: %v", test)
	}
	id := str(test, "id")
	qs := e.testQuestions(id)
	if len(qs) != 12 {
		t.Fatalf("questions: %d", len(qs))
	}
	for _, q := range qs {
		if q.SourceType == "test_series" || q.TestID == p.series.ID {
			t.Fatal("test-series questions must never be drawn (D2)")
		}
	}

	// private: invisible to everybody else, everywhere
	other := e.newStudent()
	if code, _ := e.do("GET", "/custom-tests/"+id, other, nil); code != 404 {
		t.Fatal("other students get 404 (not 403)")
	}
	if code, _ := e.do("GET", "/tests/"+id, other, nil); code != 404 {
		t.Fatal("public test endpoint must hide generated tests")
	}
	if code, _ := e.do("POST", "/tests/"+id+"/attempts", other, nil); code != 404 {
		t.Fatal("others can't start an attempt on it")
	}
	for _, path := range []string{"/tests", "/tests?module_type=custom"} {
		for _, it := range e.mustDo(200, "GET", path, s, nil)["tests"].([]interface{}) {
			if str(it.(map[string]interface{}), "id") == id {
				t.Fatalf("generated test leaked into %s", path)
			}
		}
	}
	for _, it := range e.mustDo(200, "GET", "/teacher/tests", &e.w.Teacher, nil)["tests"].([]interface{}) {
		if str(it.(map[string]interface{}), "id") == id {
			t.Fatal("generated test leaked into the teacher list")
		}
	}

	// it runs through the ordinary attempt pipeline with a server deadline and its own marking
	att := e.mustDo(200, "POST", "/tests/"+id+"/attempts", s, nil)
	if str(att, "attempt", "expires_at") == "" || att["attempt"].(map[string]interface{})["attempt_no"] != float64(1) {
		t.Fatalf("attempt: %v", att)
	}
	first := qs[0]
	e.mustDo(200, "PUT", "/attempts/"+str(att, "attempt", "id")+"/answers/"+first.ID.String(), s, map[string]interface{}{"selected_option": "B"})
	res := e.mustDo(200, "POST", "/attempts/"+str(att, "attempt", "id")+"/submit", s, nil)
	if num(res, "score") != 1 || num(res, "total_marks") != 12 {
		t.Fatalf("no-negative marking scheme: %v", res)
	}
	q := e.mustDo(200, "GET", "/custom-tests/"+id, s, nil)
	if len(q["attempts"].([]interface{})) != 1 {
		t.Fatalf("detail: %v", q)
	}
	// generation never mutates the pool's home tests
	var tc int64
	e.db.Model(&models.TestQuestion{}).Where("test_id = ?", p.physics.ID).Count(&tc)
	if tc != 30 {
		t.Fatalf("physics home test membership changed: %d", tc)
	}
}

func TestSeedIsDeterministicAndMixIsHonoured(t *testing.T) {
	e := newEnv(t)
	e.buildPool(10, 10, 10, 0)
	s := &e.w.Student
	a := e.generate(s, bp(e, map[string]interface{}{"seed": 7, "count": 9}))
	b := e.generate(s, bp(e, map[string]interface{}{"seed": 7, "count": 9}))
	c := e.generate(s, bp(e, map[string]interface{}{"seed": 8, "count": 9}))
	qa, qb, qc := e.testQuestions(str(a, "test", "id")), e.testQuestions(str(b, "test", "id")), e.testQuestions(str(c, "test", "id"))
	same, diff := true, false
	for i := range qa {
		if qa[i].ID != qb[i].ID {
			same = false
		}
		if qa[i].ID != qc[i].ID {
			diff = true
		}
	}
	if !same || !diff {
		t.Fatalf("same seed must reproduce, different seed must differ (same=%v diff=%v)", same, diff)
	}
	// stored blueprint records the seed so "why this test?" is answerable
	if num(a["test"].(map[string]interface{}), "blueprint", "seed") != 7 {
		t.Fatalf("blueprint seed: %v", a["test"].(map[string]interface{})["blueprint"])
	}

	// difficulty mix 20/50/30 of 10 → 2/5/3
	m := e.generate(s, bp(e, map[string]interface{}{"count": 10, "difficulty_mix": map[string]float64{"easy": 0.2, "medium": 0.5, "hard": 0.3}}))
	got := map[string]int{}
	for _, q := range e.testQuestions(str(m, "test", "id")) {
		got[*q.Difficulty]++
	}
	if got["easy"] != 2 || got["medium"] != 5 || got["hard"] != 3 {
		t.Fatalf("mix: %v", got)
	}
	if len(m["relaxations"].([]interface{})) != 0 {
		t.Fatalf("no relaxation expected: %v", m["relaxations"])
	}
}

func TestShortBucketsAreBorrowedAndReportedNeverSilent(t *testing.T) {
	e := newEnv(t)
	e.buildPool(2, 20, 0, 0)
	out := e.generate(&e.w.Student, bp(e, map[string]interface{}{"count": 10, "difficulty_mix": map[string]float64{"easy": 0.6, "medium": 0.4}}))
	got := map[string]int{}
	for _, q := range e.testQuestions(str(out, "test", "id")) {
		got[*q.Difficulty]++
	}
	if got["easy"] != 2 || got["medium"] != 8 {
		t.Fatalf("only 2 easy exist; the rest must be borrowed: %v", got)
	}
	rel := out["relaxations"].([]interface{})
	if len(rel) != 1 || str(rel[0].(map[string]interface{}), "code") != "difficulty_borrowed" {
		t.Fatalf("relaxation must be reported: %v", rel)
	}
	// fewer than requested is also reported
	e2 := e.generate(&e.w.Student, bp(e, map[string]interface{}{"count": 50}))
	codes := map[string]bool{}
	for _, r := range e2["relaxations"].([]interface{}) {
		codes[str(r.(map[string]interface{}), "code")] = true
	}
	if num(e2["test"].(map[string]interface{}), "total_questions") != 22 || !codes["fewer_than_requested"] {
		t.Fatalf("fewer: %v", e2)
	}
}

func TestSubjectWeightingAndDedupe(t *testing.T) {
	e := newEnv(t)
	p := e.buildPool(0, 20, 0, 20)
	s := &e.w.Student
	countBy := func(id string) map[string]int {
		m := map[string]int{}
		for _, q := range e.testQuestions(id) {
			if *q.SubjectID == p.chemSub.ID {
				m["chem"]++
			} else {
				m["phys"]++
			}
		}
		return m
	}
	even := countBy(str(e.generate(s, bp(e, map[string]interface{}{"count": 10, "subject_weights": "even"})), "test", "id"))
	if even["chem"] != 5 || even["phys"] != 5 {
		t.Fatalf("even: %v", even)
	}
	custom := countBy(str(e.generate(s, bp(e, map[string]interface{}{"count": 10, "subject_weights": map[string]float64{e.w.Subject.ID.String(): 0.8, p.chemSub.ID.String(): 0.2}})), "test", "id"))
	if custom["phys"] != 8 || custom["chem"] != 2 {
		t.Fatalf("custom weights: %v", custom)
	}

	// duplicates (same content hash) can appear only once
	e.db.Exec("UPDATE questions SET content_hash = 'same' WHERE test_id = ?", p.chem.ID)
	e.db.Exec("UPDATE questions SET flag_status = 'retired' WHERE test_id = ?", p.physics.ID)
	cnt := e.mustDo(200, "POST", "/custom-tests/count", s, bp(e, map[string]interface{}{"count": 10}))
	if num(cnt, "available") != 1 {
		t.Fatalf("20 questions sharing one content hash count once, and retired ones never: %v", cnt["available"])
	}
	// the generator itself also dedupes: 1 < min → pool_too_small rather than 10 copies
	if code, _ := e.do("POST", "/custom-tests", s, bp(e, nil)); code != 422 {
		t.Fatal("duplicates must not be repeated to reach the count")
	}
}

func TestPoolTooSmallExplainsAndSuggests(t *testing.T) {
	e := newEnv(t)
	e.buildPool(0, 12, 3, 0)
	s := &e.w.Student
	req := bp(e, map[string]interface{}{"count": 10, "filters": map[string]interface{}{"difficulty": []string{"hard"}}})
	code, out := e.do("POST", "/custom-tests", s, req)
	if code != 422 || str(out, "code") != "pool_too_small" {
		t.Fatalf("pool: %d %v", code, out)
	}
	det := out["details"].(map[string]interface{})
	if num(det, "available") != 3 {
		t.Fatalf("details: %v", det)
	}
	if det["bottleneck"] == nil || str(det["bottleneck"].(map[string]interface{}), "filter") != "difficulty" {
		t.Fatalf("difficulty is the bottleneck: %v", det["bottleneck"])
	}
	// every suggestion, when applied, must really help
	cnt := e.mustDo(200, "POST", "/custom-tests/count", s, req)
	if num(cnt, "available") != 3 || num(cnt, "feasible_count") != 3 || len(cnt["suggestions"].([]interface{})) == 0 {
		t.Fatalf("count: %v", cnt)
	}
	for _, sg := range cnt["suggestions"].([]interface{}) {
		m := sg.(map[string]interface{})
		if str(m, "code") == "use_available" {
			continue
		}
		if num(m, "gain") <= 0 {
			t.Fatalf("suggestion without gain: %v", m)
		}
	}
	// applying the "relax difficulty" patch works
	relaxed := bp(e, map[string]interface{}{"count": 10, "filters": map[string]interface{}{"difficulty": []string{}}})
	e.generate(s, relaxed)
	// invalid blueprints name the field
	code, out = e.do("POST", "/custom-tests", s, bp(e, map[string]interface{}{"count": 1, "filters": map[string]interface{}{"colour": "red"}}))
	if code != 422 || str(out, "code") != "invalid_blueprint" {
		t.Fatalf("invalid: %d %v", code, out)
	}
	if code, _ := e.do("POST", "/custom-tests/count", s, bp(e, map[string]interface{}{"count": 500})); code != 422 {
		t.Fatal("count must validate too")
	}
}

func TestFreeTierClampQuotaAndPaidPool(t *testing.T) {
	e := newEnv(t)
	p := e.buildPool(10, 10, 10, 0)
	// make the physics test paid → free students can't see it
	e.db.Model(&models.Test{}).Where("id = ?", p.physics.ID).UpdateColumn("requires_subscription", true)
	free := e.w.Test(t, models.ModulePractice, 0, true)
	for i := 1; i <= 14; i++ {
		e.w.Question(t, free, i, "medium")
	}
	e.set("custom_test.free_daily_generations", "3")
	s := e.newStudent() // not subscribed → free tier
	cnt := e.mustDo(200, "POST", "/custom-tests/count", s, bp(e, map[string]interface{}{"count": 30}))
	if num(cnt, "available") != 14 || num(cnt, "clamped_to") != 10 || str(cnt, "entitlement", "tier") != "free" {
		t.Fatalf("free pool must exclude paid questions and clamp: %v", cnt)
	}
	out := e.generate(s, bp(e, map[string]interface{}{"count": 30}))
	if num(out["test"].(map[string]interface{}), "total_questions") != 10 {
		t.Fatalf("clamp: %v", out["test"])
	}
	found := false
	for _, r := range out["relaxations"].([]interface{}) {
		if str(r.(map[string]interface{}), "code") == "free_tier_clamp" {
			found = true
		}
	}
	if !found {
		t.Fatal("clamp must be reported")
	}
	for _, q := range e.testQuestions(str(out, "test", "id")) {
		if q.TestID == p.physics.ID {
			t.Fatal("paid question leaked to a free user")
		}
	}
	// daily quota (3): two more succeed, the fourth is refused with a reset time
	e.generate(s, bp(e, nil))
	e.generate(s, bp(e, nil))
	code, o := e.do("POST", "/custom-tests", s, bp(e, nil))
	if code != 403 || str(o, "code") != "quota_exceeded" || o["details"].(map[string]interface{})["resets_at"] == nil {
		t.Fatalf("quota: %d %v", code, o)
	}
	cfg := e.mustDo(200, "GET", "/custom-tests/builder-config?course_id="+e.w.Course.ID.String(), s, nil)
	if num(cfg, "entitlement", "daily_generations_left") != 0 {
		t.Fatalf("builder-config must show the remaining free quota: %v", cfg["entitlement"])
	}

	// a subscriber sees the paid tests and is not limited
	paid := e.newStudent()
	e.w.Subscribe(t, *paid)
	pc := e.mustDo(200, "POST", "/custom-tests/count", paid, bp(e, map[string]interface{}{"count": 30}))
	if num(pc, "available") != 44 || str(pc, "entitlement", "tier") != "paid" || pc["clamped_to"] != nil {
		t.Fatalf("paid: %v", pc)
	}
	e.generate(paid, bp(e, map[string]interface{}{"count": 30}))
}

func TestStatusFiltersUseStudentHistoryAndBookmarks(t *testing.T) {
	e := newEnv(t)
	p := e.buildPool(0, 12, 0, 0)
	s := &e.w.Student
	if code, o := e.do("POST", "/custom-tests/count", s, bp(e, map[string]interface{}{"filters": map[string]interface{}{"status": []string{"incorrect"}}})); code != 422 {
		t.Fatalf("status filters are flag-gated: %d %v", code, o)
	}
	e.set("custom_test.status_filters", "true")

	qs := e.testQuestions(p.physics.ID.String())
	att := str(e.mustDo(200, "POST", "/tests/"+p.physics.ID.String()+"/attempts", s, nil), "attempt", "id")
	for i, q := range qs[:6] {
		opt := "B" // correct
		if i%2 == 1 {
			opt = "A" // wrong
		}
		e.mustDo(200, "PUT", "/attempts/"+att+"/answers/"+q.ID.String(), s, map[string]interface{}{"selected_option": opt})
	}
	e.mustDo(200, "POST", "/attempts/"+att+"/submit", s, nil)

	count := func(status ...string) float64 {
		return num(e.mustDo(200, "POST", "/custom-tests/count", s, bp(e, map[string]interface{}{"count": 5, "filters": map[string]interface{}{"status": status}})), "available")
	}
	if count("incorrect") != 3 || count("correct") != 3 || count("unattempted") != 6 || count("incorrect", "unattempted") != 9 {
		t.Fatalf("status counts: inc=%v cor=%v un=%v union=%v", count("incorrect"), count("correct"), count("unattempted"), count("incorrect", "unattempted"))
	}
	// bookmarked
	e.mustDo(200, "PUT", "/me/bookmarks", s, map[string]interface{}{"item_type": "question", "item_id": qs[0].ID.String()})
	if count("bookmarked") != 1 {
		t.Fatalf("bookmarked: %v", count("bookmarked"))
	}
	// "skip what I attempted in the last 7 days"
	fresh := num(e.mustDo(200, "POST", "/custom-tests/count", s, bp(e, map[string]interface{}{"count": 5, "filters": map[string]interface{}{"exclude_attempted_within_days": 7}})), "available")
	if fresh != 6 {
		t.Fatalf("recent exclusion: %v", fresh)
	}
	// practise the mistakes: wrong (3) + unattempted (6) → a test of those questions only
	fa := e.mustDo(201, "POST", "/custom-tests/from-attempt/"+att, s, map[string]interface{}{"include": "wrong"})
	fq := e.testQuestions(str(fa, "test", "id"))
	if len(fq) != 3 {
		t.Fatalf("from-attempt wrong: %d", len(fq))
	}
	for _, q := range fq {
		var st models.StudentQuestionState
		e.db.First(&st, "user_id = ? AND question_id = ?", s.ID, q.ID)
		if st.LastResult != "incorrect" {
			t.Fatal("from-attempt must contain only the wrong questions")
		}
	}
	both := e.mustDo(201, "POST", "/custom-tests/from-attempt/"+att, s, map[string]interface{}{"include": "both"})
	if len(e.testQuestions(str(both, "test", "id"))) != 9 {
		t.Fatal("wrong + unattempted = 9")
	}
	// a held question is skipped
	e.db.Model(&models.Question{}).Where("id = ?", fq[0].ID).UpdateColumn("flag_status", "under_review")
	again := e.mustDo(201, "POST", "/custom-tests/from-attempt/"+att, s, map[string]interface{}{"include": "wrong"})
	if len(e.testQuestions(str(again, "test", "id"))) != 2 {
		t.Fatal("questions under review must be excluded from generation")
	}
	// ineligible questions are never drawn
	e.db.Model(&models.Question{}).Where("test_id = ?", p.physics.ID).UpdateColumn("custom_eligible", false)
	if code, o := e.do("POST", "/custom-tests", s, bp(e, nil)); code != 422 || str(o, "code") != "pool_too_small" {
		t.Fatalf("custom_eligible=false: %d %v", code, o)
	}
}

func TestIdempotencyRegenerateListRenameAndArchive(t *testing.T) {
	e := newEnv(t)
	e.buildPool(10, 10, 10, 0)
	s := &e.w.Student
	call := func(key string) (int, map[string]interface{}) {
		body := bp(e, map[string]interface{}{"seed": 3})
		return e.doHeader("POST", "/custom-tests", s, body, map[string]string{"Idempotency-Key": key})
	}
	c1, o1 := call("abc")
	c2, o2 := call("abc")
	if c1 != 201 || c2 != 200 || str(o1, "test", "id") != str(o2, "test", "id") || o2["replayed"] != true {
		t.Fatalf("idempotency: %d/%d %v %v", c1, c2, o1, o2)
	}
	var n int64
	e.db.Model(&models.Test{}).Where("origin = 'generated'").Count(&n)
	if n != 1 {
		t.Fatalf("retry created %d tests", n)
	}
	id := str(o1, "test", "id")

	// new set = same blueprint, fresh questions
	rg := e.mustDo(201, "POST", "/custom-tests/"+id+"/regenerate", s, nil)
	if str(rg, "test", "id") == id {
		t.Fatal("regenerate must create a new test")
	}
	// states + filters + pagination
	att := e.mustDo(200, "POST", "/tests/"+id+"/attempts", s, nil)
	list := e.mustDo(200, "GET", "/custom-tests", s, nil)["items"].([]interface{})
	states := map[string]string{}
	for _, it := range list {
		m := it.(map[string]interface{})
		states[str(m, "test", "id")] = str(m, "state")
	}
	if states[id] != "in_progress" || states[str(rg, "test", "id")] != "not_started" {
		t.Fatalf("states: %v", states)
	}
	if got := e.mustDo(200, "GET", "/custom-tests?state=not_started", s, nil)["items"].([]interface{}); len(got) != 1 {
		t.Fatalf("filter: %v", got)
	}
	e.mustDo(200, "POST", "/attempts/"+str(att, "attempt", "id")+"/submit", s, nil)
	if got := e.mustDo(200, "GET", "/custom-tests?state=completed", s, nil)["items"].([]interface{}); len(got) != 1 {
		t.Fatalf("completed: %v", got)
	}
	p1 := e.mustDo(200, "GET", "/custom-tests?limit=1", s, nil)
	if len(p1["items"].([]interface{})) != 1 || p1["next_cursor"] == nil {
		t.Fatal("pagination")
	}
	// retake = another attempt on the same test, numbered
	att2 := e.mustDo(200, "POST", "/tests/"+id+"/attempts", s, nil)
	if num(att2, "attempt", "attempt_no") != 2 {
		t.Fatalf("attempt_no: %v", att2["attempt"])
	}
	e.mustDo(200, "PATCH", "/custom-tests/"+id, s, map[string]interface{}{"title": "My sprint"})
	if code, _ := e.do("PATCH", "/custom-tests/"+id, s, map[string]interface{}{"title": ""}); code != 400 {
		t.Fatal("title validation")
	}
	// delete = archive: hidden, but attempts and analytics survive; the open attempt was finalised
	e.mustDo(200, "DELETE", "/custom-tests/"+id, s, nil)
	if code, _ := e.do("GET", "/custom-tests/"+id, s, nil); code != 404 {
		t.Fatal("archived tests are hidden")
	}
	var attempts int64
	e.db.Model(&models.StudentAttempt{}).Where("test_id = ?", id).Count(&attempts)
	var open int64
	e.db.Model(&models.StudentAttempt{}).Where("test_id = ? AND status = 'in_progress'", id).Count(&open)
	if attempts != 2 || open != 0 {
		t.Fatalf("attempts=%d open=%d", attempts, open)
	}
	if code, _ := e.do("POST", "/tests/"+id+"/attempts", s, nil); code != 404 {
		t.Fatal("can't start attempts on an archived test")
	}
}

func TestBuilderConfigTemplatesAndAdminPresets(t *testing.T) {
	e := newEnv(t)
	p := e.buildPool(5, 5, 5, 6)
	s := &e.w.Student
	e.db.Create(&models.Topic{ChapterID: e.w.Chapter.ID, Name: "Laws"})
	cfg := e.mustDo(200, "GET", "/custom-tests/builder-config?course_id="+e.w.Course.ID.String(), s, nil)
	subs := cfg["subjects"].([]interface{})
	if len(subs) != 2 || num(subs[0].(map[string]interface{}), "available") != 15 || num(subs[1].(map[string]interface{}), "available") != 6 {
		t.Fatalf("subjects: %v", subs)
	}
	ch := subs[0].(map[string]interface{})["chapters"].([]interface{})[0].(map[string]interface{})
	if num(ch, "available") != 15 || len(ch["topics"].([]interface{})) != 1 {
		t.Fatalf("chapters/topics: %v", ch)
	}
	if num(cfg, "total_available") != 21 || num(cfg, "limits", "max_questions") != 90 || cfg["schema_version"] != float64(1) {
		t.Fatalf("cfg: %v", cfg)
	}
	if len(cfg["presets"].([]interface{})) != 6 {
		t.Fatalf("NEET course seeds 6 presets: %d", len(cfg["presets"].([]interface{})))
	}
	if modes := cfg["modes"].([]interface{}); len(modes) != 1 {
		t.Fatalf("tutor is off by default: %v", modes)
	}
	// every seeded preset is itself a valid, generatable blueprint
	for _, pr := range cfg["presets"].([]interface{}) {
		bpj := pr.(map[string]interface{})["blueprint"].(map[string]interface{})
		bpj["count"] = 5
		e.mustDo(200, "POST", "/custom-tests/count", s, bpj)
	}
	// templates: CRUD, validation, cap
	t1 := e.mustDo(201, "POST", "/custom-tests/templates", s, map[string]interface{}{"title": "Mine", "blueprint": bp(e, nil)})
	if code, _ := e.do("POST", "/custom-tests/templates", s, map[string]interface{}{"title": "Bad", "blueprint": bp(e, map[string]interface{}{"count": 1})}); code != 422 {
		t.Fatal("templates are validated")
	}
	e.mustDo(200, "PATCH", "/custom-tests/templates/"+str(t1, "id"), s, map[string]interface{}{"title": "Renamed", "blueprint": bp(e, map[string]interface{}{"count": 20})})
	if l := e.mustDo(200, "GET", "/custom-tests/templates", s, nil)["templates"].([]interface{}); len(l) != 1 || str(l[0].(map[string]interface{}), "title") != "Renamed" {
		t.Fatalf("templates: %v", l)
	}
	e.set("custom_test.max_templates", "1")
	if code, o := e.do("POST", "/custom-tests/templates", s, map[string]interface{}{"title": "Two", "blueprint": bp(e, nil)}); code != 409 || str(o, "code") != "too_many_templates" {
		t.Fatalf("cap: %d %v", code, o)
	}
	other := e.newStudent()
	if code, _ := e.do("PATCH", "/custom-tests/templates/"+str(t1, "id"), other, map[string]interface{}{"title": "x"}); code != 404 {
		t.Fatal("templates are private")
	}
	e.mustDo(200, "DELETE", "/custom-tests/templates/"+str(t1, "id"), s, nil)

	// admin presets are data; validated; visible in builder-config immediately (cache invalidated)
	pr := e.mustDo(201, "POST", "/admin/custom-test/presets", &e.w.Admin, map[string]interface{}{"course_id": e.w.Course.ID.String(), "title": "Hard mode", "blueprint": map[string]interface{}{"count": 10, "filters": map[string]interface{}{"difficulty": []string{"hard"}}}})
	cfg = e.mustDo(200, "GET", "/custom-tests/builder-config?course_id="+e.w.Course.ID.String(), s, nil)
	if len(cfg["presets"].([]interface{})) != 7 {
		t.Fatal("new preset not visible")
	}
	if code, _ := e.do("POST", "/admin/custom-test/presets", &e.w.Admin, map[string]interface{}{"course_id": e.w.Course.ID.String(), "title": "Bad", "blueprint": map[string]interface{}{"count": 1000}}); code != 422 {
		t.Fatal("preset blueprints are validated")
	}
	e.mustDo(200, "PATCH", "/admin/custom-test/presets/"+str(pr, "id"), &e.w.Admin, map[string]interface{}{"is_active": false})
	e.mustDo(200, "DELETE", "/admin/custom-test/presets/"+str(pr, "id"), &e.w.Admin, nil)
	if code, _ := e.do("POST", "/admin/custom-test/presets", s, nil); code != 403 {
		t.Fatal("admin only")
	}
	m := e.mustDo(200, "GET", "/admin/custom-test/metrics", &e.w.Admin, nil)
	if m["process"] == nil || m["last_24h"] == nil {
		t.Fatalf("metrics: %v", m)
	}
	_ = p
}

func TestProgressBreakdownUsesQuestionSubjectsAndNeverFabricates(t *testing.T) {
	e := newEnv(t)
	p := e.buildPool(0, 10, 0, 10)
	s := &e.w.Student
	empty := e.mustDo(200, "GET", "/me/progress/breakdown", s, nil)
	if len(empty["subjects"].([]interface{})) != 0 || len(empty["trend"].([]interface{})) != 0 {
		t.Fatalf("no fake Physics/Chemistry/Botany/Zoology or zero trend: %v", empty)
	}
	// one cross-subject custom test: 5 physics (all right) + 5 chemistry (all wrong)
	out := e.generate(s, bp(e, map[string]interface{}{"count": 10, "subject_weights": "even"}))
	tid := str(out, "test", "id")
	att := str(e.mustDo(200, "POST", "/tests/"+tid+"/attempts", s, nil), "attempt", "id")
	for _, q := range e.testQuestions(tid) {
		opt := "B"
		if *q.SubjectID == p.chemSub.ID {
			opt = "A"
		}
		e.mustDo(200, "PUT", "/attempts/"+att+"/answers/"+q.ID.String(), s, map[string]interface{}{"selected_option": opt})
	}
	e.mustDo(200, "POST", "/attempts/"+att+"/submit", s, nil)
	pb := e.mustDo(200, "GET", "/me/progress/breakdown", s, nil)
	acc := map[string]float64{}
	for _, x := range pb["subjects"].([]interface{}) {
		acc[str(x.(map[string]interface{}), "name")] = num(x.(map[string]interface{}), "accuracy")
	}
	if acc["Physics"] != 100 || acc["Chemistry"] != 0 || len(acc) != 2 {
		t.Fatalf("a cross-subject test must count toward each subject: %v", acc)
	}
	if got := e.mustDo(200, "GET", "/me/progress/breakdown?module=qbank", s, nil)["subjects"].([]interface{}); len(got) != 0 {
		t.Fatalf("module segmentation: %v", got)
	}
	if got := e.mustDo(200, "GET", "/me/progress/breakdown?module=custom", s, nil)["subjects"].([]interface{}); len(got) != 2 {
		t.Fatalf("custom segment: %v", got)
	}
	// trend keeps the LAST 10 scores, oldest first
	for i := 0; i < 11; i++ {
		tt := e.w.Test(t, models.ModulePractice, 1, true)
		a := str(e.mustDo(200, "POST", "/tests/"+tt.ID.String()+"/attempts", s, nil), "attempt", "id")
		qq, _ := services.LoadTestQuestions(nil2(), e.db, tt.ID)
		if i == 10 {
			e.mustDo(200, "PUT", "/attempts/"+a+"/answers/"+qq[0].ID.String(), s, map[string]interface{}{"selected_option": "B"})
		}
		e.mustDo(200, "POST", "/attempts/"+a+"/submit", s, nil)
		time.Sleep(2 * time.Millisecond)
	}
	tr := e.mustDo(200, "GET", "/me/progress/breakdown", s, nil)["trend"].([]interface{})
	if len(tr) != 10 || tr[9].(float64) != 4 || tr[0].(float64) != 0 {
		t.Fatalf("trend must be the latest 10, newest last: %v", tr)
	}
	_ = fmt.Sprint
}
