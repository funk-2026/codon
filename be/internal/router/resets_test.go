package router_test

import (
	"testing"
	"time"

	"codon-backend/internal/models"
	"codon-backend/internal/services"
)

func TestStateOnProfile(t *testing.T) {
	e := newEnv(t)
	s := &e.w.Student
	if code, _ := e.do("PATCH", "/me", s, map[string]interface{}{"state": "Atlantis"}); code != 400 {
		t.Fatalf("unknown state must be refused: %d", code)
	}
	out := e.mustDo(200, "PATCH", "/me", s, map[string]interface{}{"state": "Maharashtra"})
	if str(out, "state") != "Maharashtra" {
		t.Fatalf("state saved: %v", out)
	}
	out = e.mustDo(200, "PATCH", "/me", s, map[string]interface{}{"state": ""})
	if out["state"] != nil {
		t.Fatalf("state cleared: %v", out)
	}
}

func TestResetBookmarksOncePerCooldownAndArchives(t *testing.T) {
	e := newEnv(t)
	s := &e.w.Student
	q := e.w.Test(t, models.ModuleQBank, 1, true)
	submitAs(e, q, s, "B") // a question can only be bookmarked once it has been seen
	qs, _ := services.LoadTestQuestions(nil2(), e.db, q.ID)
	e.mustDo(200, "PUT", "/me/bookmarks", s, map[string]interface{}{"item_type": "question", "item_id": qs[0].ID.String()})

	st := e.mustDo(200, "GET", "/me/resets", s, nil)["resets"].([]interface{})
	if len(st) != 4 || st[0].(map[string]interface{})["can_reset"] != true {
		t.Fatalf("four scopes, all allowed at first: %v", st)
	}
	if code, _ := e.do("POST", "/me/resets/everything", s, nil); code != 400 {
		t.Fatalf("unknown scope: %d", code)
	}
	out := e.mustDo(200, "POST", "/me/resets/bookmarks", s, nil)
	if num(out, "removed") != 1 {
		t.Fatalf("one bookmark removed: %v", out)
	}
	if items := e.mustDo(200, "GET", "/me/bookmarks", s, nil)["items"].([]interface{}); len(items) != 0 {
		t.Fatalf("bookmarks cleared in the app: %v", items)
	}
	var kept int64
	e.db.Raw("SELECT count(*) FROM reset_archives WHERE user_id = ? AND scope = 'bookmarks:bookmarks'", s.ID).Scan(&kept)
	if kept != 1 {
		t.Fatalf("the old rows stay in the archive: %d", kept)
	}
	if code, body := e.do("POST", "/me/resets/bookmarks", s, nil); code != 409 {
		t.Fatalf("second reset inside the cooldown: %d %v", code, body)
	}
	// each scope has its own cooldown
	e.mustDo(200, "POST", "/me/resets/flashcards", s, nil)
	// after the cooldown it works again
	e.db.Model(&models.UserReset{}).Where("user_id = ? AND scope = ?", s.ID, "bookmarks").Update("reset_at", time.Now().AddDate(0, 0, -91))
	e.mustDo(200, "POST", "/me/resets/bookmarks", s, nil)
}

func TestResetQBankClearsAttemptsButNotTestSeries(t *testing.T) {
	e := newEnv(t)
	s := &e.w.Student
	qb := e.w.Test(t, models.ModuleQBank, 1, true)
	series := e.w.Test(t, models.ModuleTestSeries, 1, true)
	submitAs(e, qb, s, "B")
	submitAs(e, series, s, "B")
	e.mustDo(200, "POST", "/me/resets/qbank", s, nil)
	var qbAttempts, seriesAttempts int64
	e.db.Raw("SELECT count(*) FROM student_attempts WHERE user_id = ? AND test_id = ?", s.ID, qb.ID).Scan(&qbAttempts)
	e.db.Raw("SELECT count(*) FROM student_attempts WHERE user_id = ? AND test_id = ?", s.ID, series.ID).Scan(&seriesAttempts)
	if qbAttempts != 0 || seriesAttempts != 1 {
		t.Fatalf("QBank attempts cleared, Test series kept: qbank=%d series=%d", qbAttempts, seriesAttempts)
	}
	// the chapter can be solved again
	submitAs(e, qb, s, "A")
}

func TestProfilePhoto(t *testing.T) {
	e := newEnv(t)
	s := &e.w.Student
	code, up := e.uploadImage(s, "profile_photo", "image/png", pngBytes(80, 80, false))
	if code != 200 {
		t.Fatalf("a student can upload a profile photo: %d %v", code, up)
	}
	mid := str(up["media"].(map[string]interface{}), "id")
	out := e.mustDo(200, "PATCH", "/me", s, map[string]interface{}{"photo_media_id": mid})
	if str(out, "photo_media_id") != mid {
		t.Fatalf("photo saved: %v", out)
	}
	me := e.mustDo(200, "GET", "/me", s, nil)
	if me["media"].(map[string]interface{})[mid] == nil {
		t.Fatalf("GET /me carries the picture to show: %v", me["media"])
	}
	// someone else's photo cannot be used
	other := e.newStudent()
	_, theirs := e.uploadImage(other, "profile_photo", "image/png", pngBytes(80, 80, false))
	if code, _ := e.do("PATCH", "/me", s, map[string]interface{}{"photo_media_id": str(theirs["media"].(map[string]interface{}), "id")}); code != 422 && code != 400 && code != 403 {
		t.Fatalf("another student's photo is refused: %d", code)
	}
	out = e.mustDo(200, "PATCH", "/me", s, map[string]interface{}{"photo_media_id": ""})
	if out["photo_media_id"] != nil {
		t.Fatalf("photo removed: %v", out)
	}
}
