package router_test

import (
	"encoding/json"
	"testing"

	"codon-backend/internal/models"
	"codon-backend/internal/services"
)

// attempted returns a free published test, its questions, and a submitted
// attempt by `student` (answers: first question B=correct, second A=wrong).
func (e *env) attempted(student *models.User, n int) (models.Test, []services.QuestionWithPos, string) {
	e.t.Helper()
	test := e.w.Test(e.t, models.ModulePractice, n, true)
	qs, _ := services.LoadTestQuestions(nil2(), e.db, test.ID)
	out := e.mustDo(200, "POST", "/tests/"+test.ID.String()+"/attempts", student, nil)
	att := str(out, "attempt", "id")
	e.mustDo(200, "PUT", "/attempts/"+att+"/answers/"+qs[0].ID.String(), student, map[string]interface{}{"selected_option": "B"})
	if n > 1 {
		e.mustDo(200, "PUT", "/attempts/"+att+"/answers/"+qs[1].ID.String(), student, map[string]interface{}{"selected_option": "A"})
	}
	return test, qs, att
}

func (e *env) newStudent() *models.User { u := e.w.User(e.t, models.RoleStudent); return &u }

func TestBookmarksFlow(t *testing.T) {
	e := newEnv(t)
	s := &e.w.Student
	test := e.w.Test(t, models.ModulePractice, 2, true)
	qs, _ := services.LoadTestQuestions(nil2(), e.db, test.ID)

	// never seen → cannot bookmark (anti-scrape)
	if code, out := e.do("PUT", "/me/bookmarks", s, map[string]interface{}{"item_type": "question", "item_id": qs[0].ID.String()}); code != 403 || str(out, "code") != "not_exposed" {
		t.Fatalf("unseen question: %d %v", code, out)
	}
	att := str(e.mustDo(200, "POST", "/tests/"+test.ID.String()+"/attempts", s, nil), "attempt", "id")
	e.mustDo(200, "PUT", "/attempts/"+att+"/answers/"+qs[0].ID.String(), s, map[string]interface{}{"selected_option": "B"})

	cols := e.mustDo(200, "GET", "/me/bookmark-collections", s, nil)["collections"].([]interface{})
	if len(cols) != 3 {
		t.Fatalf("three system collections expected: %v", cols)
	}
	second := str(cols[1].(map[string]interface{}), "id")

	b := e.mustDo(200, "PUT", "/me/bookmarks", s, map[string]interface{}{"item_type": "question", "item_id": qs[0].ID.String()})
	if str(b, "collection_id") != str(cols[0].(map[string]interface{}), "id") {
		t.Fatalf("default collection must be the first: %v", b)
	}
	// idempotent + move to another collection
	e.mustDo(200, "PUT", "/me/bookmarks", s, map[string]interface{}{"item_type": "question", "item_id": qs[0].ID.String(), "collection_id": second, "note": "check this"})
	var n int64
	e.db.Model(&models.Bookmark{}).Where("user_id = ?", s.ID).Count(&n)
	if n != 1 {
		t.Fatalf("one bookmark expected, got %d", n)
	}
	if code, o := e.do("PUT", "/me/bookmarks", s, map[string]interface{}{"item_type": "question", "item_id": qs[0].ID.String(), "collection_id": "11111111-1111-1111-1111-111111111111"}); code != 400 || str(o, "code") != "invalid_collection" {
		t.Fatalf("bad collection: %d %v", code, o)
	}

	ids := e.mustDo(200, "GET", "/me/bookmarks/ids?item_type=question", s, nil)
	if len(ids["ids"].([]interface{})) != 1 || len(ids["by_collection"].(map[string]interface{})[second].([]interface{})) != 1 {
		t.Fatalf("ids: %v", ids)
	}

	// before submit the key must NOT be visible in the bookmark list
	list := e.mustDo(200, "GET", "/me/bookmarks?collection_id="+second, s, nil)
	item := list["items"].([]interface{})[0].(map[string]interface{})["question"].(map[string]interface{})
	if _, leaked := item["correct_option"]; leaked {
		t.Fatal("answer key leaked through bookmarks before the attempt was submitted")
	}
	e.mustDo(200, "POST", "/attempts/"+att+"/submit", s, nil)
	list = e.mustDo(200, "GET", "/me/bookmarks", s, nil)
	item = list["items"].([]interface{})[0].(map[string]interface{})["question"].(map[string]interface{})
	if item["correct_option"] != "B" {
		t.Fatalf("after submit the key is visible: %v", item)
	}
	// review knows about the bookmark and can filter on it
	rev := e.mustDo(200, "GET", "/attempts/"+att+"/review?filter=bookmarked", s, nil)
	if items := rev["review"].([]interface{}); len(items) != 1 || items[0].(map[string]interface{})["bookmarked"] != true {
		t.Fatalf("review bookmarked filter: %v", rev)
	}
	// subject/chapter filters and search
	if l := e.mustDo(200, "GET", "/me/bookmarks?chapter_id="+e.w.Chapter.ID.String()+"&q=Question", s, nil); len(l["items"].([]interface{})) != 1 {
		t.Fatalf("filters: %v", l)
	}
	// other users don't see it
	other := e.newStudent()
	if l := e.mustDo(200, "GET", "/me/bookmarks", other, nil); len(l["items"].([]interface{})) != 0 {
		t.Fatal("bookmarks are private")
	}
	e.mustDo(200, "DELETE", "/me/bookmarks/question/"+qs[0].ID.String(), s, nil)
	e.mustDo(200, "DELETE", "/me/bookmarks/question/"+qs[0].ID.String(), s, nil) // idempotent

	// admin: deactivating a collection re-homes its bookmarks; the last one can't go
	e.mustDo(200, "PUT", "/me/bookmarks", s, map[string]interface{}{"item_type": "question", "item_id": qs[0].ID.String(), "collection_id": second})
	e.mustDo(200, "PATCH", "/admin/bookmark-collections/"+second, &e.w.Admin, map[string]interface{}{"is_active": false, "label": "x"})
	var bm models.Bookmark
	e.db.First(&bm, "user_id = ?", s.ID)
	if bm.CollectionID.String() == second {
		t.Fatal("bookmark must move out of a deactivated collection")
	}
	e.mustDo(200, "PATCH", "/admin/bookmark-collections/"+str(cols[2].(map[string]interface{}), "id"), &e.w.Admin, map[string]interface{}{"label": "Renamed"})
	if code, o := e.do("PATCH", "/admin/bookmark-collections/"+str(cols[0].(map[string]interface{}), "id"), &e.w.Admin, map[string]interface{}{"is_active": false}); code != 200 {
		t.Fatalf("second-to-last deactivation should work: %d %v", code, o)
	}
	if code, o := e.do("PATCH", "/admin/bookmark-collections/"+str(cols[2].(map[string]interface{}), "id"), &e.w.Admin, map[string]interface{}{"is_active": false}); code != 409 || str(o, "code") != "last_collection" {
		t.Fatalf("last collection: %d %v", code, o)
	}
}

func TestReportsAutoHoldAndResolution(t *testing.T) {
	e := newEnv(t)
	test, qs, _ := e.attempted(&e.w.Student, 2)
	qid := qs[0].ID.String()
	rep := func(u *models.User, reason string) (int, map[string]interface{}) {
		return e.do("POST", "/reports", u, map[string]interface{}{"item_type": "question", "item_id": qid, "reason": reason, "context": "review", "note": "hmm"})
	}
	if code, o := e.do("POST", "/reports", e.newStudent(), map[string]interface{}{"item_type": "question", "item_id": qid, "reason": "wrong_answer"}); code != 403 || str(o, "code") != "not_exposed" {
		t.Fatalf("unseen: %d %v", code, o)
	}
	if code, o := rep(&e.w.Student, "made_up"); code != 400 || str(o, "code") != "invalid_reason" {
		t.Fatalf("reason: %d %v", code, o)
	}
	code, first := rep(&e.w.Student, "wrong_answer")
	if code != 201 || first["already_reported"] != false {
		t.Fatalf("create: %d %v", code, first)
	}
	code, again := rep(&e.w.Student, "typo_unclear")
	if code != 200 || again["already_reported"] != true {
		t.Fatalf("reporting twice must be idempotent: %d %v", code, again)
	}
	var open int64
	e.db.Model(&models.ContentReport{}).Where("reporter_id = ?", e.w.Student.ID).Count(&open)
	if open != 1 {
		t.Fatalf("spam guard: %d reports", open)
	}

	// two more distinct reporters with a hold reason → under review (threshold 3)
	var flag = func() string {
		var q models.Question
		e.db.First(&q, "id = ?", qid)
		return q.FlagStatus
	}
	for i := 0; i < 2; i++ {
		u := e.newStudent()
		att := str(e.mustDo(200, "POST", "/tests/"+test.ID.String()+"/attempts", u, nil), "attempt", "id")
		e.mustDo(200, "PUT", "/attempts/"+att+"/answers/"+qid, u, map[string]interface{}{"selected_option": "C"})
		if i == 0 && flag() != "active" {
			t.Fatal("2 reporters is below the threshold")
		}
		reason := "wrong_answer"
		if i == 0 {
			reason = "typo_unclear" // not a hold reason
		}
		rep(u, reason)
	}
	if flag() != "active" {
		t.Fatal("typo reports must not count towards the hold")
	}
	u3 := e.newStudent()
	att3 := str(e.mustDo(200, "POST", "/tests/"+test.ID.String()+"/attempts", u3, nil), "attempt", "id")
	e.mustDo(200, "PUT", "/attempts/"+att3+"/answers/"+qid, u3, map[string]interface{}{"selected_option": "C"})
	rep(u3, "image_issue")
	if flag() != "under_review" {
		t.Fatalf("3 distinct hold-reason reporters must hold the question, flag=%s", flag())
	}

	// teacher inbox (owner) sees them; a different teacher doesn't; admin queue sees all
	inbox := e.mustDo(200, "GET", "/teacher/reports", &e.w.Teacher, nil)
	if len(inbox["items"].([]interface{})) != 4 {
		t.Fatalf("inbox: %d", len(inbox["items"].([]interface{})))
	}
	other := e.w.User(t, models.RoleTeacher)
	if o := e.mustDo(200, "GET", "/teacher/reports", &other, nil); len(o["items"].([]interface{})) != 0 {
		t.Fatal("teachers only see reports on their own questions")
	}
	rid := str(first["report"].(map[string]interface{}), "id")
	if code, _ := e.do("POST", "/teacher/reports/"+rid+"/resolve", &other, map[string]interface{}{"status": "no_change"}); code != 404 {
		t.Fatal("non-owner must not resolve")
	}
	// resolving the wrong_answer report drops below the threshold → hold released; reporter notified
	e.mustDo(200, "POST", "/teacher/reports/"+rid+"/resolve", &e.w.Teacher, map[string]interface{}{"status": "no_change", "note": "Checked, the key is right."})
	if flag() != "active" {
		t.Fatalf("hold must lift once open hold-reason reports fall below the threshold, flag=%s", flag())
	}
	var note models.Notification
	if e.db.First(&note, "user_id = ? AND type = 'report_resolved'", e.w.Student.ID).Error != nil || note.Body != "Checked, the key is right." {
		t.Fatalf("reporter must be told: %+v", note)
	}
	if code, o := e.do("POST", "/teacher/reports/"+rid+"/resolve", &e.w.Teacher, map[string]interface{}{"status": "fixed"}); code != 409 || str(o, "code") != "already_resolved" {
		t.Fatalf("double resolve: %d %v", code, o)
	}
	mine := e.mustDo(200, "GET", "/me/reports", &e.w.Student, nil)
	if str(mine["items"].([]interface{})[0].(map[string]interface{}), "status") != "no_change" {
		t.Fatalf("reporter sees outcome: %v", mine)
	}
	adminQ := e.mustDo(200, "GET", "/admin/reports?status=all", &e.w.Admin, nil)
	if len(adminQ["items"].([]interface{})) != 4 {
		t.Fatalf("admin queue: %v", adminQ)
	}
	e.mustDo(200, "POST", "/admin/reports/"+rid[:0]+str(inbox["items"].([]interface{})[0].(map[string]interface{}), "id")+"/reassign", &e.w.Admin, map[string]interface{}{"assignee_id": other.ID.String()})
	e.mustDo(200, "POST", "/admin/reports/"+str(inbox["items"].([]interface{})[1].(map[string]interface{}), "id")+"/dismiss", &e.w.Admin, map[string]interface{}{"note": "spam"})
}

func TestReportRateLimit(t *testing.T) {
	e := newEnv(t)
	e.set("reports.rate_per_day", "2")
	test := e.w.Test(t, models.ModulePractice, 4, true)
	qs, _ := services.LoadTestQuestions(nil2(), e.db, test.ID)
	att := str(e.mustDo(200, "POST", "/tests/"+test.ID.String()+"/attempts", &e.w.Student, nil), "attempt", "id")
	for i := range qs {
		e.mustDo(200, "PUT", "/attempts/"+att+"/answers/"+qs[i].ID.String(), &e.w.Student, map[string]interface{}{"selected_option": "A"})
	}
	for i := 0; i < 2; i++ {
		e.mustDo(201, "POST", "/reports", &e.w.Student, map[string]interface{}{"item_type": "question", "item_id": qs[i].ID.String(), "reason": "other"})
	}
	if code, o := e.do("POST", "/reports", &e.w.Student, map[string]interface{}{"item_type": "question", "item_id": qs[2].ID.String(), "reason": "other"}); code != 429 || str(o, "code") != "rate_limited" {
		t.Fatalf("rate limit: %d %v", code, o)
	}
}

func liveQuestion(e *env) (models.Test, models.Question) {
	test := e.w.Test(e.t, models.ModuleQBank, 2, true)
	qs, _ := services.LoadTestQuestions(nil2(), e.db, test.ID)
	return test, qs[0].Question
}

func TestCorrectionsApplyRescoreAndResolveReports(t *testing.T) {
	e := newEnv(t)
	test, q := liveQuestion(e)
	// a student answered B (the current key) and got +4
	att := str(e.mustDo(200, "POST", "/tests/"+test.ID.String()+"/attempts", &e.w.Student, nil), "attempt", "id")
	e.mustDo(200, "PUT", "/attempts/"+att+"/answers/"+q.ID.String(), &e.w.Student, map[string]interface{}{"selected_option": "B"})
	e.mustDo(200, "POST", "/attempts/"+att+"/submit", &e.w.Student, nil)
	e.mustDo(201, "POST", "/reports", &e.w.Student, map[string]interface{}{"item_type": "question", "item_id": q.ID.String(), "reason": "wrong_answer"})

	body := func(reason string, rescore bool, key string) map[string]interface{} {
		return map[string]interface{}{"reason": reason, "rescore": rescore, "proposed": map[string]interface{}{"correct_option": key, "explanation": "Fixed explanation"}}
	}
	// validation
	if code, o := e.do("POST", "/teacher/questions/"+q.ID.String()+"/corrections", &e.w.Teacher, body("no", false, "C")); code != 400 || str(o, "code") != "reason_required" {
		t.Fatalf("reason: %d %v", code, o)
	}
	if code, o := e.do("POST", "/teacher/questions/"+q.ID.String()+"/corrections", &e.w.Teacher, map[string]interface{}{"reason": "just metadata", "proposed": map[string]interface{}{"difficulty": "hard"}}); code != 400 || str(o, "code") != "nothing_to_correct" {
		t.Fatalf("no content change: %d %v", code, o)
	}
	other := e.w.User(t, models.RoleTeacher)
	if code, _ := e.do("POST", "/teacher/questions/"+q.ID.String()+"/corrections", &other, body("valid reason", false, "C")); code != 404 {
		t.Fatal("only the owner may correct")
	}

	// teacher proposes → pending; a second one is refused
	rev := e.mustDo(201, "POST", "/teacher/questions/"+q.ID.String()+"/corrections", &e.w.Teacher, body("Key was wrong, it is C", true, "C"))
	if rev["status"] != "pending" {
		t.Fatalf("teacher corrections need review: %v", rev)
	}
	if code, o := e.do("POST", "/teacher/questions/"+q.ID.String()+"/corrections", &e.w.Teacher, body("another one", false, "D")); code != 409 || str(o, "code") != "correction_pending" {
		t.Fatalf("second pending: %d %v", code, o)
	}
	var stillOld models.Question
	e.db.First(&stillOld, "id = ?", q.ID)
	if stillOld.CorrectOption != "B" || stillOld.Version != 1 {
		t.Fatal("nothing changes before approval")
	}
	queue := e.mustDo(200, "GET", "/admin/corrections", &e.w.Admin, nil)
	if len(queue["items"].([]interface{})) != 1 {
		t.Fatalf("admin queue: %v", queue)
	}
	if code, _ := e.do("POST", "/admin/corrections/"+str(rev, "id")+"/approve", &e.w.Teacher, nil); code != 403 {
		t.Fatal("only admins approve")
	}
	e.mustDo(200, "POST", "/admin/corrections/"+str(rev, "id")+"/approve", &e.w.Admin, nil)

	var now models.Question
	e.db.First(&now, "id = ?", q.ID)
	if now.CorrectOption != "C" || now.Version != 2 || now.Explanation == nil || *now.Explanation != "Fixed explanation" {
		t.Fatalf("correction not applied: %+v", now)
	}
	var rp models.ContentReport
	e.db.First(&rp, "item_id = ?", q.ID)
	if rp.Status != "fixed" {
		t.Fatalf("open reports must be resolved as fixed, got %s", rp.Status)
	}
	var ntf int64
	e.db.Model(&models.Notification{}).Where("user_id = ? AND type = 'report_resolved'", e.w.Student.ID).Count(&ntf)
	if ntf != 1 {
		t.Fatalf("reporter notification: %d", ntf)
	}

	// rescoring runs as a job: the student's +4 becomes −1 (they chose B, key is now C)
	var a models.StudentAttempt
	e.db.First(&a, "id = ?", att)
	if *a.Score != 4 {
		t.Fatal("history must not change until the rescore job runs")
	}
	var job models.BackgroundJob
	if e.db.Where("type = 'rescore_question'").First(&job).Error != nil {
		t.Fatal("rescore job must be queued when the key changes with rescore=true")
	}
	svc := services.NewCorrectionService(e.db, services.NewQuestionService(e.db))
	for i := 0; i < 2; i++ { // idempotent
		if err := svc.HandleRescoreQuestion(nil2(), job.Payload); err != nil {
			t.Fatal(err)
		}
	}
	a = models.StudentAttempt{}
	e.db.First(&a, "id = ?", att)
	if *a.Score != -1 || *a.CorrectCount != 0 || *a.WrongCount != 1 {
		t.Fatalf("rescored attempt: score=%v c=%v w=%v", *a.Score, *a.CorrectCount, *a.WrongCount)
	}
	var st models.StudentQuestionState
	e.db.First(&st, "user_id = ? AND question_id = ?", e.w.Student.ID, q.ID)
	if st.LastResult != "incorrect" || st.TimesCorrect != 0 {
		t.Fatalf("question state after rescore: %+v", st)
	}

	// admins are applied immediately; rescore=false leaves history alone
	q2 := models.Question{}
	qs2, _ := services.LoadTestQuestions(nil2(), e.db, test.ID)
	q2 = qs2[1].Question
	att2 := str(e.mustDo(200, "POST", "/tests/"+test.ID.String()+"/attempts", e.newStudent(), nil), "attempt", "id")
	_ = att2
	applied := e.mustDo(201, "POST", "/teacher/questions/"+q2.ID.String()+"/corrections", &e.w.Admin, map[string]interface{}{"reason": "typo in option", "proposed": map[string]interface{}{"option_a": "Fixed A"}})
	if applied["status"] != "approved" {
		t.Fatalf("admin corrections auto-approve: %v", applied)
	}

	// rejection path
	q3 := e.w.Question(t, test, 3, "easy")
	pend := e.mustDo(201, "POST", "/teacher/questions/"+q3.ID.String()+"/corrections", &e.w.Teacher, map[string]interface{}{"reason": "not sure really", "proposed": map[string]interface{}{"question_text": "Changed"}})
	if code, _ := e.do("POST", "/admin/corrections/"+str(pend, "id")+"/reject", &e.w.Admin, map[string]interface{}{"reason": ""}); code != 400 {
		t.Fatal("reject needs a reason")
	}
	e.mustDo(200, "POST", "/admin/corrections/"+str(pend, "id")+"/reject", &e.w.Admin, map[string]interface{}{"reason": "Not convinced"})
	mine := e.mustDo(200, "GET", "/teacher/corrections", &e.w.Teacher, nil)
	statuses := map[string]bool{}
	for _, it := range mine["items"].([]interface{}) {
		statuses[str(it.(map[string]interface{}), "status")] = true
	}
	if !statuses["approved"] || !statuses["rejected"] {
		t.Fatalf("my corrections: %v", statuses)
	}
	// drafts are edited directly, not via corrections
	draftID := e.createTest("qbank", nil)
	dq := e.mustDo(201, "POST", "/teacher/tests/"+draftID+"/questions", &e.w.Teacher, map[string]interface{}{"question_text": "draft q", "option_a": "1", "option_b": "2", "option_c": "3", "option_d": "4", "correct_option": "B"})
	if code, o := e.do("POST", "/teacher/questions/"+str(dq, "id")+"/corrections", &e.w.Teacher, body("valid reason here", false, "A")); code != 409 || str(o, "code") != "question_editable" {
		t.Fatalf("draft: %d %v", code, o)
	}
}

func TestRatingsEligibilityAndAggregates(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModulePractice, 2, true)
	other := e.w.Test(t, models.ModulePractice, 1, true)
	s := &e.w.Student
	rate := func(u *models.User, typ, id string, v int) (int, map[string]interface{}) {
		return e.do("PUT", "/ratings", u, map[string]interface{}{"item_type": typ, "item_id": id, "value": v})
	}
	if code, o := rate(s, "test", test.ID.String(), 5); code != 403 || str(o, "code") != "not_eligible" {
		t.Fatalf("must finish first: %d %v", code, o)
	}
	qs, _ := services.LoadTestQuestions(nil2(), e.db, test.ID)
	for _, u := range []*models.User{s, e.newStudent()} {
		att := str(e.mustDo(200, "POST", "/tests/"+test.ID.String()+"/attempts", u, nil), "attempt", "id")
		e.mustDo(200, "PUT", "/attempts/"+att+"/answers/"+qs[0].ID.String(), u, map[string]interface{}{"selected_option": "B"})
		e.mustDo(200, "POST", "/attempts/"+att+"/submit", u, nil)
	}
	if code, _ := rate(s, "test", test.ID.String(), 6); code != 400 {
		t.Fatal("stars are 1-5")
	}
	if code, _ := rate(s, "test", test.ID.String(), 0); code != 400 {
		t.Fatal("0 stars invalid")
	}
	r1 := e.mustDo(200, "PUT", "/ratings", s, map[string]interface{}{"item_type": "test", "item_id": test.ID.String(), "value": 4, "tags": []string{"helpful"}})
	if num(r1, "aggregate", "rating_avg") != 4 || num(r1, "aggregate", "rating_count") != 1 {
		t.Fatalf("aggregate: %v", r1)
	}
	if code, _ := e.do("PUT", "/ratings", s, map[string]interface{}{"item_type": "test", "item_id": test.ID.String(), "value": 4, "tags": []string{"free text spam"}}); code != 400 {
		t.Fatal("tags are a closed list")
	}
	// second student rates 2; first student changes 4→5 (update, not insert)
	students := []models.User{}
	e.db.Model(&models.StudentAttempt{}).Where("test_id = ?", test.ID).Select("user_id").Find(&students)
	var second models.User
	e.db.Where("id IN (SELECT user_id FROM student_attempts WHERE test_id = ?) AND id <> ?", test.ID, s.ID).First(&second)
	rate(&second, "test", test.ID.String(), 2)
	r3 := e.mustDo(200, "PUT", "/ratings", s, map[string]interface{}{"item_type": "test", "item_id": test.ID.String(), "value": 5})
	if num(r3, "aggregate", "rating_count") != 2 || num(r3, "aggregate", "rating_avg") != 3.5 {
		t.Fatalf("avg of 5 and 2: %v", r3)
	}
	list := e.mustDo(200, "GET", "/tests?module_type=practice", s, nil)["tests"].([]interface{})
	var found map[string]interface{}
	for _, x := range list {
		if str(x.(map[string]interface{}), "id") == test.ID.String() {
			found = x.(map[string]interface{})
		}
	}
	if num(found, "rating_avg") != 3.5 || num(found, "my_rating") != 5 {
		t.Fatalf("list shows aggregate + my rating: %v", found)
	}
	// sort=rating puts the rated test first
	sorted := e.mustDo(200, "GET", "/tests?sort=rating", s, nil)["tests"].([]interface{})
	if str(sorted[0].(map[string]interface{}), "id") != test.ID.String() {
		t.Fatalf("sort=rating: first is %v (unrated %s)", str(sorted[0].(map[string]interface{}), "id"), other.ID)
	}
	e.mustDo(200, "DELETE", "/ratings/test/"+test.ID.String(), s, nil)
	one := e.mustDo(200, "GET", "/tests/"+test.ID.String(), s, nil)
	if num(one, "test", "rating_count") != 1 || num(one, "test", "rating_avg") != 2 {
		t.Fatalf("after delete: %v", one["test"])
	}
	// question feedback: thumbs only, needs exposure
	if code, _ := rate(s, "question", qs[0].ID.String(), 5); code != 400 {
		t.Fatal("questions take thumbs only")
	}
	e.mustDo(200, "PUT", "/ratings", s, map[string]interface{}{"item_type": "question", "item_id": qs[0].ID.String(), "value": 1})
	if code, o := rate(e.newStudent(), "question", qs[0].ID.String(), -1); code != 403 || str(o, "code") != "not_eligible" {
		t.Fatalf("unseen question: %d %v", code, o)
	}
	// review carries my rating for the question
	var att models.StudentAttempt
	e.db.Where("user_id = ? AND test_id = ?", s.ID, test.ID).First(&att)
	rev := e.mustDo(200, "GET", "/attempts/"+att.ID.String()+"/review", s, nil)
	if num(rev["review"].([]interface{})[0].(map[string]interface{}), "my_rating") != 1 {
		t.Fatalf("review my_rating: %v", rev["review"])
	}
	_ = json.Marshal
}
