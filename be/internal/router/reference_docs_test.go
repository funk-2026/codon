package router_test

import (
	"fmt"
	"testing"

	"codon-backend/internal/models"
)

// An admin uploads a PDF and adds it; students browse and open it; a paper pattern is read-only.
func TestReferenceDocs(t *testing.T) {
	e := newEnv(t)
	a, s := &e.w.Admin, &e.w.Student
	pdf := func(name string) string {
		pre := e.mustDo(200, "POST", "/uploads/presign", a, map[string]interface{}{"file_name": name, "content_type": "application/pdf", "purpose": "reference_pdf"})
		key := str(pre, "file_key")
		e.mem.Put(key, "application/pdf", []byte("%PDF-1.4 test"))
		return key
	}
	// only admins upload reference PDFs
	if code, _ := e.do("POST", "/uploads/presign", &e.w.Teacher, map[string]interface{}{"file_name": "a.pdf", "content_type": "application/pdf", "purpose": "reference_pdf"}); code != 403 {
		t.Fatalf("teachers cannot upload reference PDFs: %d", code)
	}
	if code, _ := e.do("POST", "/admin/reference-docs", s, map[string]interface{}{"kind": "weightage", "title": "x", "file_key": "reference_pdf/x.pdf"}); code != 403 {
		t.Fatalf("students cannot add documents: %d", code)
	}

	// validation
	if code, _ := e.do("POST", "/admin/reference-docs", a, map[string]interface{}{"kind": "past_paper", "title": "No year", "file_key": pdf("a.pdf")}); code != 400 {
		t.Fatalf("a past paper needs a year: %d", code)
	}
	if code, _ := e.do("POST", "/admin/reference-docs", a, map[string]interface{}{"kind": "weightage", "title": "Bad key", "file_key": "kyc_document/x.pdf"}); code != 400 {
		t.Fatalf("the file must come from reference_pdf uploads: %d", code)
	}
	if code, _ := e.do("POST", "/admin/reference-docs", a, map[string]interface{}{"kind": "howto", "title": "No slug", "file_key": pdf("a.pdf")}); code != 400 {
		t.Fatalf("a how-to needs its feature: %d", code)
	}

	paper := e.mustDo(201, "POST", "/admin/reference-docs", a, map[string]interface{}{
		"kind": "past_paper", "title": "Maths 2025", "class": "10", "board": "Maharashtra", "subject": "Mathematics", "year": 2025, "file_key": pdf("m.pdf")})
	pattern := e.mustDo(201, "POST", "/admin/reference-docs", a, map[string]interface{}{
		"kind": "pattern", "title": "CBSE pattern", "class": "10", "board": "CBSE", "subject": "Physics", "file_key": pdf("p.pdf")})
	hidden := e.mustDo(201, "POST", "/admin/reference-docs", a, map[string]interface{}{
		"kind": "weightage", "title": "Off", "class": "10", "board": "CBSE", "subject": "Physics", "file_key": pdf("w.pdf"), "is_active": false})
	_ = hidden

	list := e.mustDo(200, "GET", "/reference-docs?kind=past_paper&class=10&board=Maharashtra", s, nil)["docs"].([]interface{})
	if len(list) != 1 || str(list[0].(map[string]interface{}), "id") != str(paper, "id") {
		t.Fatalf("students browse by filters: %v", list)
	}
	if _, leaked := list[0].(map[string]interface{})["file_key"]; leaked {
		t.Fatal("the storage key never reaches students")
	}
	if all := e.mustDo(200, "GET", "/reference-docs?class=10", s, nil)["docs"].([]interface{}); len(all) != 2 {
		t.Fatalf("switched-off documents are hidden from students: %d", len(all))
	}
	open := e.mustDo(200, "GET", fmt.Sprintf("/reference-docs/%s", str(paper, "id")), s, nil)
	if str(open, "url") == "" || open["can_download"] != true {
		t.Fatalf("a paper opens with a link and can be downloaded: %v", open)
	}
	pOpen := e.mustDo(200, "GET", "/reference-docs/"+str(pattern, "id"), s, nil)
	if pOpen["can_download"] != false {
		t.Fatalf("a paper pattern is view-only: %v", pOpen)
	}
	if code, _ := e.do("GET", "/reference-docs/"+str(hidden, "id"), s, nil); code != 404 {
		t.Fatalf("a switched-off document cannot be opened: %d", code)
	}
	// edit + switch off
	e.mustDo(200, "PATCH", "/admin/reference-docs/"+str(paper, "id"), a, map[string]interface{}{"is_active": false})
	if list := e.mustDo(200, "GET", "/reference-docs?kind=past_paper", s, nil)["docs"].([]interface{}); len(list) != 0 {
		t.Fatalf("switched off: %v", list)
	}
	e.mustDo(200, "DELETE", "/admin/reference-docs/"+str(paper, "id"), a, nil)
	var n int64
	e.db.Model(&models.ReferenceDoc{}).Where("id = ?", str(paper, "id")).Count(&n)
	if n != 0 {
		t.Fatal("deleted")
	}
}

func TestFacultyRoster(t *testing.T) {
	e := newEnv(t)
	a, s := &e.w.Admin, &e.w.Student
	if out := e.mustDo(200, "GET", "/faculty", s, nil); len(out["faculty"].([]interface{})) != 0 {
		t.Fatalf("empty until an admin adds people: %v", out)
	}
	if code, _ := e.do("POST", "/admin/faculty", s, map[string]interface{}{"name": "Dr. X"}); code != 403 {
		t.Fatalf("admin only: %d", code)
	}
	p := e.mustDo(201, "POST", "/admin/faculty", a, map[string]interface{}{"name": "Dr. Example", "title": "Biology", "summary": "Short line", "about": "Longer text"})
	e.mustDo(201, "POST", "/admin/faculty", a, map[string]interface{}{"name": "Dr. Off", "is_active": false})
	got := e.mustDo(200, "GET", "/faculty", s, nil)["faculty"].([]interface{})
	if len(got) != 1 || str(got[0].(map[string]interface{}), "name") != "Dr. Example" {
		t.Fatalf("students see active people only: %v", got)
	}
	if all := e.mustDo(200, "GET", "/admin/faculty", a, nil)["faculty"].([]interface{}); len(all) != 2 {
		t.Fatalf("admin sees everyone: %v", all)
	}
	e.mustDo(200, "PATCH", "/admin/faculty/"+str(p, "id"), a, map[string]interface{}{"summary": "New line"})
	e.mustDo(200, "DELETE", "/admin/faculty/"+str(p, "id"), a, nil)
	if got := e.mustDo(200, "GET", "/faculty", s, nil)["faculty"].([]interface{}); len(got) != 0 {
		t.Fatalf("removed: %v", got)
	}
}

func TestPublicConfigCarriesLinks(t *testing.T) {
	e := newEnv(t)
	e.set("social.instagram_url", "https://instagram.com/codon")
	e.set("support.contact_name", "Dr. Test")
	out := e.mustDo(200, "GET", "/public-config", nil, nil)
	if str(out, "social", "instagram") != "https://instagram.com/codon" || str(out, "support", "contact_name") != "Dr. Test" {
		t.Fatalf("links reach the app: %v", out)
	}
}
