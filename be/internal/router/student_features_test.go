package router_test

import (
	"testing"
	"time"

	"codon-backend/internal/models"
	"codon-backend/internal/services"
)

// submitAs starts an attempt on a one-question test as `u`, answers it (option "" leaves it blank) and submits.
func submitAs(e *env, test models.Test, u *models.User, option string) string {
	out := e.mustDo(200, "POST", "/tests/"+test.ID.String()+"/attempts", u, nil)
	id := str(out, "attempt", "id")
	if option != "" {
		qs, _ := services.LoadTestQuestions(nil2(), e.db, test.ID)
		e.mustDo(200, "PUT", "/attempts/"+id+"/answers/"+qs[0].ID.String(), u, map[string]interface{}{"selected_option": option})
	}
	e.mustDo(200, "POST", "/attempts/"+id+"/submit", u, nil)
	return id
}

// A Test Series result shows rank and top percent once enough students finished; a Q Bank test never does.
func TestRankOnlyForTestSeries(t *testing.T) {
	e := newEnv(t)
	e.set("results.rank_min_attempts", "3")
	series := e.w.Test(t, models.ModuleTestSeries, 1, true) // the right answer is B
	s1, s2, s3 := e.w.Student, e.w.User(t, models.RoleStudent), e.w.User(t, models.RoleStudent)

	a1 := submitAs(e, series, &s1, "B")
	a2 := submitAs(e, series, &s2, "A")
	a3 := submitAs(e, series, &s3, "B")
	_ = a1

	out := e.mustDo(200, "GET", "/attempts/"+a2+"/result", &s2, nil)
	cohort, ok := out["cohort"].(map[string]interface{})
	if !ok {
		t.Fatalf("a test-series result must carry a cohort once 3 students finished: %v", out)
	}
	if cohort["rank"].(float64) != 3 || cohort["total"].(float64) != 3 || cohort["top_percent"].(float64) != 100 {
		t.Fatalf("wrong cohort for the lowest score: %v", cohort)
	}
	out3 := e.mustDo(200, "GET", "/attempts/"+a3+"/result", &s3, nil)
	if out3["cohort"].(map[string]interface{})["rank"].(float64) != 1 {
		t.Fatalf("a tie for first is rank 1: %v", out3["cohort"])
	}

	qbank := e.w.Test(t, models.ModuleQBank, 1, true)
	id := submitAs(e, qbank, &s1, "B")
	if _, has := e.mustDo(200, "GET", "/attempts/"+id+"/result", &s1, nil)["cohort"]; has {
		t.Fatal("a Q Bank result must not show a cohort")
	}

	e.set("results.rank_min_attempts", "50")
	if _, has := e.mustDo(200, "GET", "/attempts/"+a2+"/result", &s2, nil)["cohort"]; has {
		t.Fatal("too few students: no cohort")
	}
}

// Watching a lecture saves a position that comes back on the next open, and clears once it is finished.
func TestVideoResumePosition(t *testing.T) {
	e := newEnv(t)
	item := models.ContentItem{Title: "Cells", CourseID: e.w.Course.ID, ContentType: models.ContentVideo, ChapterID: e.w.Chapter.ID,
		UploadedBy: e.w.Teacher.ID, FileKey: "x", Status: models.StatusPublished}
	if err := e.db.Create(&item).Error; err != nil {
		t.Fatal(err)
	}
	path := "/content/" + item.ID.String()
	if _, has := e.mustDo(200, "GET", path, &e.w.Student, nil)["progress_seconds"]; has {
		t.Fatal("nothing watched yet: no position")
	}
	e.mustDo(200, "POST", path+"/heartbeat", &e.w.Student, map[string]interface{}{"progress_seconds": 125, "is_completed": false})
	if got := e.mustDo(200, "GET", path, &e.w.Student, nil)["progress_seconds"]; got != float64(125) {
		t.Fatalf("progress_seconds = %v, want 125", got)
	}
	e.mustDo(200, "POST", path+"/heartbeat", &e.w.Student, map[string]interface{}{"progress_seconds": 900, "is_completed": true})
	if _, has := e.mustDo(200, "GET", path, &e.w.Student, nil)["progress_seconds"]; has {
		t.Fatal("a finished lecture starts again from the top")
	}
}

// Students see only their own payments.
func TestMyPayments(t *testing.T) {
	e := newEnv(t)
	other := e.w.User(t, models.RoleStudent)
	mk := func(u models.User, order string) {
		if err := e.db.Create(&models.PaymentRecord{UserID: u.ID, RazorpayOrderID: order, AmountPaise: 49900, Currency: "INR", Status: "captured"}).Error; err != nil {
			t.Fatal(err)
		}
	}
	mk(e.w.Student, "order_mine")
	mk(other, "order_theirs")
	out := e.mustDo(200, "GET", "/me/payments", &e.w.Student, nil)
	list := out["payments"].([]interface{})
	if len(list) != 1 || list[0].(map[string]interface{})["order_id"] != "order_mine" {
		t.Fatalf("want only my payment, got %v", list)
	}
}

// Search finds published items for the student's course by title, ignores one-letter queries and wildcards.
func TestSearch(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModuleQBank, 1, true)
	e.db.Model(&models.Test{}).Where("id = ?", test.ID).Update("title", "Cell Biology Basics")
	draft := e.w.Test(t, models.ModuleQBank, 1, true)
	e.db.Model(&models.Test{}).Where("id = ?", draft.ID).Updates(map[string]interface{}{"title": "Cell Draft", "status": models.StatusDraft})
	e.db.Model(&models.User{}).Where("id = ?", e.w.Student.ID).Update("selected_course_id", e.w.Course.ID)

	hits := func(q string) int {
		return len(e.mustDo(200, "GET", "/search?q="+q, &e.w.Student, nil)["tests"].([]interface{}))
	}
	if hits("biology") != 1 {
		t.Fatal("a published match must be found")
	}
	if hits("cell") != 1 {
		t.Fatal("a draft must never be searchable")
	}
	if hits("c") != 0 {
		t.Fatal("one letter is too short")
	}
	if hits("%25") != 0 {
		t.Fatal("a wildcard must match nothing, not everything")
	}
}

// The exam date can be set, must be sensible, and can be cleared.
func TestExamDate(t *testing.T) {
	e := newEnv(t)
	future := time.Now().AddDate(0, 6, 0).Format("2006-01-02")
	out := e.mustDo(200, "PATCH", "/me", &e.w.Student, map[string]string{"exam_date": future})
	if out["exam_date"] == nil {
		t.Fatalf("exam_date not saved: %v", out)
	}
	if code, _ := e.do("PATCH", "/me", &e.w.Student, map[string]string{"exam_date": "2001-01-01"}); code != 400 {
		t.Fatalf("a past date must be refused, got %d", code)
	}
	if code, _ := e.do("PATCH", "/me", &e.w.Student, map[string]string{"exam_date": "soon"}); code != 400 {
		t.Fatalf("a non-date must be refused, got %d", code)
	}
	cleared := e.mustDo(200, "PATCH", "/me", &e.w.Student, map[string]string{"exam_date": ""})
	if cleared["exam_date"] != nil {
		t.Fatalf("exam_date must clear: %v", cleared)
	}
}

// Analytics events are discarded until the switch is on, and bad names are skipped.
func TestAnalyticsIntake(t *testing.T) {
	e := newEnv(t)
	body := map[string]interface{}{
		"app_version": "1.0.0", "platform": "ios",
		"events": []map[string]interface{}{{"name": "test.started", "props": map[string]interface{}{"module": "qbank"}}, {"name": "Bad Name!"}},
	}
	e.mustDo(202, "POST", "/events", &e.w.Student, body)
	var n int64
	e.db.Model(&models.AnalyticsEvent{}).Count(&n)
	if n != 0 {
		t.Fatalf("switch is off: nothing may be stored, got %d", n)
	}
	e.set("analytics.events", "true")
	e.mustDo(202, "POST", "/events", &e.w.Student, body)
	e.db.Model(&models.AnalyticsEvent{}).Count(&n)
	if n != 1 {
		t.Fatalf("one valid event must be stored, got %d", n)
	}
}

// App config exposes the support and legal links, and refuses a link that is not https.
func TestAppConfigLinks(t *testing.T) {
	e := newEnv(t)
	if code, _ := e.do("PATCH", "/admin/settings/custom-test", &e.w.Admin, map[string]interface{}{"values": map[string]string{"legal.terms_url": "http://insecure.example"}}); code != 400 {
		t.Fatalf("a non-https link must be refused, got %d", code)
	}
	e.mustDo(200, "PATCH", "/admin/settings/custom-test", &e.w.Admin, map[string]interface{}{"values": map[string]string{
		"legal.terms_url": "https://example.com/terms", "app.min_version": "1.2.0", "support.whatsapp": "919876543210"}})
	cfg := e.mustDo(200, "GET", "/app-config", &e.w.Student, nil)
	legal := cfg["legal"].(map[string]interface{})
	app := cfg["app"].(map[string]interface{})
	support := cfg["support"].(map[string]interface{})
	if legal["terms_url"] != "https://example.com/terms" || app["min_version"] != "1.2.0" || support["whatsapp"] != "919876543210" {
		t.Fatalf("config missing the links: %v", cfg)
	}
	if code, _ := e.do("PATCH", "/admin/settings/custom-test", &e.w.Admin, map[string]interface{}{"values": map[string]string{"app.min_version": "one"}}); code != 400 {
		t.Fatalf("a bad version must be refused, got %d", code)
	}
}

// The data export contains my own records only.
func TestExportMyData(t *testing.T) {
	e := newEnv(t)
	e.db.Create(&models.PaymentRecord{UserID: e.w.Student.ID, RazorpayOrderID: "order_x", AmountPaise: 100, Currency: "INR", Status: "captured"})
	out := e.mustDo(200, "GET", "/me/export", &e.w.Student, nil)
	if out["profile"] == nil || len(out["payments"].([]interface{})) != 1 {
		t.Fatalf("unexpected export: %v", out)
	}
}

// The sign-in screen can read the links without being signed in.
func TestPublicConfigNeedsNoLogin(t *testing.T) {
	e := newEnv(t)
	e.set("support.email", "help@example.com")
	cfg := e.mustDo(200, "GET", "/public-config", nil, nil)
	if cfg["support"].(map[string]interface{})["email"] != "help@example.com" {
		t.Fatalf("public config missing the support email: %v", cfg)
	}
}
