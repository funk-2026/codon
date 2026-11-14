package router_test

import (
	"testing"
	"time"

	"codon-backend/internal/models"
	"codon-backend/internal/services"
)

// An approved test can be scheduled; the worker publishes it once its time has come, and the author is told.
func TestScheduledPublish(t *testing.T) {
	e := newEnv(t)
	tch := &e.w.Teacher
	test := e.w.Test(t, models.ModuleQBank, 1, true)
	e.db.Model(&test).Update("status", models.StatusApproved)

	later := time.Now().Add(2 * time.Hour).UTC().Format(time.RFC3339)
	e.mustDo(200, "POST", "/teacher/tests/"+test.ID.String()+"/schedule", tch, map[string]interface{}{"publish_at": later})
	if code, out := e.do("POST", "/teacher/tests/"+test.ID.String()+"/schedule", tch, map[string]interface{}{"publish_at": time.Now().Add(-time.Hour).UTC().Format(time.RFC3339)}); code != 400 || str(out, "code") != "invalid_publish_at" {
		t.Fatalf("a time in the past must be refused: %d %v", code, out)
	}

	rs := services.NewReviewService(e.db)
	if n := rs.PublishDue(nil2(), time.Now()); n != 0 {
		t.Fatalf("nothing is due yet, published %d", n)
	}
	if n := rs.PublishDue(nil2(), time.Now().Add(3*time.Hour)); n != 1 {
		t.Fatalf("one item is due, published %d", n)
	}
	var got models.Test
	e.db.First(&got, "id = ?", test.ID)
	if got.Status != models.StatusPublished || got.PublishAt != nil {
		t.Fatalf("test should be published with no schedule left: %v %v", got.Status, got.PublishAt)
	}
	var n int64
	e.db.Model(&models.Notification{}).Where("user_id = ? AND type = ?", tch.ID, "test_published").Count(&n)
	if n != 1 {
		t.Fatalf("the author should be told the test is live, got %d notifications", n)
	}
}

// Submitting with a note stores it with a timestamp; review stats count the queue.
func TestSubmitNoteAndReviewStats(t *testing.T) {
	e := newEnv(t)
	tch := &e.w.Teacher
	test := e.w.Test(t, models.ModuleQBank, 1, true)
	e.db.Model(&test).Update("status", models.StatusDraft)
	e.mustDo(200, "POST", "/teacher/tests/"+test.ID.String()+"/submit-for-review", tch, map[string]interface{}{"note": "fixed the key in Q4"})
	var got models.Test
	e.db.First(&got, "id = ?", test.ID)
	if got.SubmitNote == nil || *got.SubmitNote != "fixed the key in Q4" || got.SubmittedAt == nil {
		t.Fatalf("note/timestamp not stored: %+v", got.ReviewMeta)
	}
	out := e.mustDo(200, "GET", "/teacher/review-stats", tch, nil)
	if out["queued"].(float64) < 1 {
		t.Fatalf("the submitted test should count as queued: %v", out)
	}
}

// Cloning copies the questions into a new draft owned by the caller.
func TestCloneTest(t *testing.T) {
	e := newEnv(t)
	tch := &e.w.Teacher
	src := e.w.Test(t, models.ModuleTestSeries, 3, false)
	out := e.mustDo(201, "POST", "/teacher/tests/"+src.ID.String()+"/clone", tch, nil)
	if str(out, "status") != "draft" {
		t.Fatalf("a clone starts as a draft: %v", out)
	}
	id := str(out, "id")
	var n int64
	e.db.Model(&models.TestQuestion{}).Where("test_id = ?", id).Count(&n)
	if n != 3 {
		t.Fatalf("clone should carry 3 questions, got %d", n)
	}
	var orig int64
	e.db.Model(&models.TestQuestion{}).Where("test_id = ?", src.ID).Count(&orig)
	if orig != 3 {
		t.Fatalf("the source must be untouched, has %d", orig)
	}
	other := e.w.User(t, models.RoleTeacher)
	if code, _ := e.do("POST", "/teacher/tests/"+src.ID.String()+"/clone", &other, nil); code != 404 {
		t.Fatalf("another teacher cannot clone it: %d", code)
	}
}

// Hand-over moves ownership to an active teacher and tells them.
func TestTransferTest(t *testing.T) {
	e := newEnv(t)
	tch := &e.w.Teacher
	test := e.w.Test(t, models.ModuleQBank, 1, true)
	to := e.w.User(t, models.RoleTeacher)
	if code, out := e.do("POST", "/teacher/tests/"+test.ID.String()+"/transfer", tch, map[string]interface{}{"phone_number": "+910000000000"}); code != 404 || str(out, "code") != "teacher_not_found" {
		t.Fatalf("unknown teacher: %d %v", code, out)
	}
	e.mustDo(200, "POST", "/teacher/tests/"+test.ID.String()+"/transfer", tch, map[string]interface{}{"phone_number": to.PhoneNumber})
	var got models.Test
	e.db.First(&got, "id = ?", test.ID)
	if got.CreatedBy != to.ID {
		t.Fatal("ownership should have moved")
	}
	if code, _ := e.do("POST", "/teacher/tests/"+test.ID.String()+"/transfer", tch, map[string]interface{}{"phone_number": to.PhoneNumber}); code != 404 {
		t.Fatalf("the old owner no longer owns it: %d", code)
	}
}

// A teacher can delete a draft lesson but not one that is approved or live.
func TestDeleteContent(t *testing.T) {
	e := newEnv(t)
	tch := &e.w.Teacher
	item := models.ContentItem{Title: "L", CourseID: e.w.Course.ID, ContentType: models.ContentDocument, ChapterID: e.w.Chapter.ID,
		UploadedBy: tch.ID, FileKey: "text:inline", Status: models.StatusDraft}
	e.db.Create(&item)
	e.mustDo(200, "DELETE", "/teacher/content/"+item.ID.String(), tch, nil)
	var n int64
	e.db.Model(&models.ContentItem{}).Where("id = ?", item.ID).Count(&n)
	if n != 0 {
		t.Fatal("draft lesson should be gone")
	}
	live := models.ContentItem{Title: "L2", CourseID: e.w.Course.ID, ContentType: models.ContentDocument, ChapterID: e.w.Chapter.ID,
		UploadedBy: tch.ID, FileKey: "text:inline", Status: models.StatusPublished}
	e.db.Create(&live)
	if code, _ := e.do("DELETE", "/teacher/content/"+live.ID.String(), tch, nil); code != 409 {
		t.Fatalf("a published lesson cannot be deleted: %d", code)
	}
}

// A document lesson can be written in the app; students get the text only through the detail call.
func TestTextLesson(t *testing.T) {
	e := newEnv(t)
	tch := &e.w.Teacher
	out := e.mustDo(201, "POST", "/teacher/content", tch, map[string]interface{}{
		"title": "Notes", "course_id": e.w.Course.ID.String(), "chapter_id": e.w.Chapter.ID.String(),
		"content_type": "document", "body_text": "Mitochondria are the powerhouse.", "requires_subscription": false,
	})
	if str(out, "body_text") != "Mitochondria are the powerhouse." {
		t.Fatalf("text not stored: %v", out)
	}
	if code, _ := e.do("POST", "/teacher/content", tch, map[string]interface{}{
		"title": "Empty", "course_id": e.w.Course.ID.String(), "chapter_id": e.w.Chapter.ID.String(), "content_type": "document",
	}); code != 400 {
		t.Fatalf("a lesson with neither file nor text is refused: %d", code)
	}
}

// Impact and per-test stats count only submitted student attempts on the teacher's own tests.
func TestTeacherImpactAndTestStats(t *testing.T) {
	e := newEnv(t)
	tch := &e.w.Teacher
	test := e.w.Test(t, models.ModuleQBank, 1, true)
	s := e.w.Student
	submitAs(e, test, &s, "B")
	st := e.mustDo(200, "GET", "/teacher/tests/"+test.ID.String()+"/stats", tch, nil)
	if st["submitted"].(float64) != 1 || st["students"].(float64) != 1 {
		t.Fatalf("stats wrong: %v", st)
	}
	imp := e.mustDo(200, "GET", "/teacher/impact", tch, nil)
	if imp["test_attempts"].(float64) != 1 || imp["published_tests"].(float64) < 1 {
		t.Fatalf("impact wrong: %v", imp)
	}
	other := e.w.User(t, models.RoleTeacher)
	if code, _ := e.do("GET", "/teacher/tests/"+test.ID.String()+"/stats", &other, nil); code != 404 {
		t.Fatalf("another teacher must not see these stats: %d", code)
	}
}

// One account that can open the Admin, Teacher and Student views sees only that view's notifications.
func TestNotificationsAreScopedByView(t *testing.T) {
	e := newEnv(t)
	u := &e.w.Admin
	for _, typ := range []string{"review_waiting", "test_approved", "content_taken_down", "report_resolved", "streak_nudge", "announcement"} {
		services.Notify(e.db, u.ID, typ, typ, "x", nil)
	}
	count := func(aud string) int {
		out := e.mustDo(200, "GET", "/me/notifications?audience="+aud, u, nil)
		return len(out["items"].([]interface{}))
	}
	if n := count("admin"); n != 1 {
		t.Fatalf("admin view should see only review_waiting, saw %d", n)
	}
	if n := count("teacher"); n != 3 { // test_approved, content_taken_down, announcement
		t.Fatalf("teacher view saw %d, want 3", n)
	}
	if n := count("student"); n != 3 { // report_resolved, streak_nudge, announcement
		t.Fatalf("student view saw %d, want 3", n)
	}
	if n := count(""); n != 6 {
		t.Fatalf("no audience keeps the old behaviour, saw %d", n)
	}
	e.mustDo(200, "POST", "/me/notifications/read", u, map[string]interface{}{"all": true, "audience": "admin"})
	out := e.mustDo(200, "GET", "/me/notifications?audience=student", u, nil)
	if out["unread_count"].(float64) != 3 {
		t.Fatalf("marking the admin view read must not touch the student view: %v", out["unread_count"])
	}
}
