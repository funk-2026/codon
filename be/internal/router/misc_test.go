package router_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"codon-backend/internal/media"
	"codon-backend/internal/models"
	"codon-backend/internal/services"
	"codon-backend/internal/validate"
	"time"
)

func TestAppConfigFlagsDefaultOffAndEtag(t *testing.T) {
	e := newEnv(t)
	cfg := e.mustDo(200, "GET", "/app-config", &e.w.Student, nil)
	flags := cfg["flags"].(map[string]interface{})
	for k, v := range flags {
		if v != false {
			t.Fatalf("flag %s must default off, got %v", k, v)
		}
	}
	if len(cfg["report_reasons"].([]interface{})) != 6 || len(cfg["bookmark_collections"].([]interface{})) != 3 {
		t.Fatalf("config lists: %v", cfg)
	}
	// an admin flips a flag → visible without a release; ETag changes; 304 on repeat
	req := httptest.NewRequest("GET", "/api/v1/app-config", nil)
	req.Header.Set("X-Test-User", e.w.Student.ID.String())
	rec := httptest.NewRecorder()
	e.r.ServeHTTP(rec, req)
	etag := rec.Header().Get("ETag")
	req2 := httptest.NewRequest("GET", "/api/v1/app-config", nil)
	req2.Header.Set("X-Test-User", e.w.Student.ID.String())
	req2.Header.Set("If-None-Match", etag)
	rec2 := httptest.NewRecorder()
	e.r.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusNotModified {
		t.Fatalf("etag: %d", rec2.Code)
	}
	e.mustDo(200, "PATCH", "/admin/settings/custom-test", &e.w.Admin, map[string]interface{}{"values": map[string]string{"custom_test.enabled": "true"}})
	cfg = e.mustDo(200, "GET", "/app-config", &e.w.Student, nil)
	if cfg["flags"].(map[string]interface{})["custom_test.enabled"] != true {
		t.Fatal("flag flip not visible")
	}
	// validation + audit + auth
	if code, _ := e.do("PATCH", "/admin/settings/custom-test", &e.w.Admin, map[string]interface{}{"values": map[string]string{"custom_test.max_questions": "lots"}}); code != 400 {
		t.Fatal("non-numeric value must be rejected")
	}
	if code, _ := e.do("PATCH", "/admin/settings/custom-test", &e.w.Admin, map[string]interface{}{"values": map[string]string{"kyc_required": "true"}}); code != 400 {
		t.Fatal("only tunables are editable through this endpoint")
	}
	if code, _ := e.do("PATCH", "/admin/settings/custom-test", &e.w.Teacher, map[string]interface{}{"values": map[string]string{"custom_test.enabled": "false"}}); code != 403 {
		t.Fatal("admin only")
	}
	var n int64
	e.db.Model(&models.AdminAuditLog{}).Where("action = 'setting.update'").Count(&n)
	if n != 1 {
		t.Fatalf("audit rows: %d", n)
	}
}

func TestTagsAndTopicsTaxonomy(t *testing.T) {
	e := newEnv(t)
	testID := e.createTest("qbank", nil)
	for _, tags := range [][]string{{"#NEET  Bio"}, {"neet-bio", "cell"}, {"Cell"}} {
		e.mustDo(201, "POST", "/teacher/tests/"+testID+"/questions", &e.w.Teacher, q("Q "+tags[0], map[string]interface{}{"tags": tags}))
	}
	out := e.mustDo(200, "GET", "/tags?q=neet", &e.w.Student, nil)
	list := out["tags"].([]interface{})
	if len(list) != 1 || str(list[0].(map[string]interface{}), "slug") != "neet-bio" || num(list[0].(map[string]interface{}), "uses") != 2 {
		t.Fatalf("autocomplete: %v", list)
	}
	// merge: "cell" into "neet-bio" → source becomes an alias; future input resolves to the target
	all := e.mustDo(200, "GET", "/admin/tags", &e.w.Admin, nil)["tags"].([]interface{})
	var cellID, neetID string
	for _, x := range all {
		m := x.(map[string]interface{})
		if m["slug"] == "cell" {
			cellID = str(m, "id")
		}
		if m["slug"] == "neet-bio" {
			neetID = str(m, "id")
		}
	}
	e.mustDo(200, "POST", "/admin/tags/"+cellID+"/merge", &e.w.Admin, map[string]interface{}{"into_id": neetID})
	nq := e.mustDo(201, "POST", "/teacher/tests/"+testID+"/questions", &e.w.Teacher, q("Fresh", map[string]interface{}{"tags": []string{"Cell"}}))
	tags := nq["tags"].([]interface{})
	if len(tags) != 1 || str(tags[0].(map[string]interface{}), "slug") != "neet-bio" {
		t.Fatalf("alias must resolve to canonical tag: %v", tags)
	}
	if code, o := e.do("DELETE", "/admin/tags/"+neetID, &e.w.Admin, nil); code != 409 || str(o, "code") != "tag_in_use" {
		t.Fatalf("delete in-use tag: %d %v", code, o)
	}
	// topics
	tp := e.mustDo(201, "POST", "/teacher/chapters/"+e.w.Chapter.ID.String()+"/topics", &e.w.Teacher, map[string]interface{}{"name": "Laws"})
	lst := e.mustDo(200, "GET", "/courses/"+e.w.Course.ID.String()+"/topics?chapter_id="+e.w.Chapter.ID.String(), &e.w.Student, nil)
	if len(lst["topics"].([]interface{})) != 1 {
		t.Fatal("topics list")
	}
	e.mustDo(201, "POST", "/teacher/tests/"+testID+"/questions", &e.w.Teacher, q("With topic", map[string]interface{}{"topic_id": str(tp, "id")}))
	if code, o := e.do("DELETE", "/admin/topics/"+str(tp, "id"), &e.w.Admin, nil); code != 409 || str(o, "code") != "topic_in_use" {
		t.Fatalf("delete used topic: %d %v", code, o)
	}
}

func TestContentHashBackfillAndMediaGC(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModulePractice, 3, true)
	e.db.Model(&models.Question{}).Where("test_id = ?", test.ID).UpdateColumn("content_hash", "")
	n, err := services.BackfillContentHashes(nil2(), e.db, 2)
	if err != nil || n != 2 {
		t.Fatalf("chunk: %d %v", n, err)
	}
	services.BackfillAllContentHashes(nil2(), e.db)
	var empty int64
	e.db.Model(&models.Question{}).Where("content_hash = ''").Count(&empty)
	if empty != 0 {
		t.Fatalf("%d hashes still empty", empty)
	}

	// GC: stale pending upload + unreferenced old ready asset are removed; referenced/recent ones stay
	old := time.Now().Add(-48 * time.Hour)
	older := time.Now().Add(-10 * 24 * time.Hour)
	stalePending := models.MediaAsset{OwnerID: e.w.Teacher.ID, Purpose: "question_image", StorageKey: "k/a", Status: "pending", CreatedAt: old}
	orphan := models.MediaAsset{OwnerID: e.w.Teacher.ID, Purpose: "question_image", StorageKey: "k/b", Status: "ready", CreatedAt: older}
	used := models.MediaAsset{OwnerID: e.w.Teacher.ID, Purpose: "question_image", StorageKey: "k/c", Status: "ready", CreatedAt: older}
	recent := models.MediaAsset{OwnerID: e.w.Teacher.ID, Purpose: "question_image", StorageKey: "k/d", Status: "pending", CreatedAt: time.Now()}
	for _, m := range []*models.MediaAsset{&stalePending, &orphan, &used, &recent} {
		e.db.Create(m)
		e.db.Model(m).UpdateColumn("created_at", m.CreatedAt)
	}
	e.db.Create(&models.MediaRef{MediaID: used.ID, OwnerType: "question", OwnerID: test.ID, Field: "question_text"})
	svc := media.NewService(e.db)
	if n, _ := svc.GCOrphans(nil2(), true); n != 2 {
		t.Fatalf("dry run should report 2, got %d", n)
	}
	svc.GCOrphans(nil2(), false)
	var left int64
	e.db.Model(&models.MediaAsset{}).Count(&left)
	if left != 2 {
		t.Fatalf("GC left %d assets, want 2 (used + recent)", left)
	}
}

func TestValidateAndPaginationHelpers(t *testing.T) {
	if !validate.OneOf("qbank", validate.ModuleTypes) || validate.OneOf("x", validate.ModuleTypes) {
		t.Fatal("OneOf")
	}
	if _, err := validate.UUIDs("ids", []string{"nope"}, 5); err == nil {
		t.Fatal("bad uuid must fail")
	}
	if _, err := validate.UUIDs("ids", make([]string, 6), 5); err == nil {
		t.Fatal("list bound must be enforced")
	}
	if err := validate.MaxLen("f", "ééé", 2); err == nil {
		t.Fatal("rune-based length")
	}
}
