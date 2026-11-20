package router_test

import (
	"testing"
)

// An admin can author everything a teacher can, publish it directly or send it through review, and it reaches the student
// under the right Tests tab. An admin can also open the student app to preview it.
func TestAdminAuthoringReachesStudentsAndAdminCanPreview(t *testing.T) {
	e := newEnv(t)
	a, s, tr := &e.w.Admin, &e.w.Student, &e.w.Teacher

	// series and an exam created by the admin through the shared teacher endpoints
	series := e.mustDo(201, "POST", "/teacher/series", a, map[string]interface{}{"course_id": e.w.Course.ID, "title": "Admin series"})
	for _, k := range []string{"full", "subject", "part"} {
		e.mustDo(201, "POST", "/teacher/tests", a, map[string]interface{}{"title": "Admin " + k, "course_id": e.w.Course.ID.String(), "module_type": "test_series", "exam_style": "neet", "kind": k, "delivery": "anytime", "series_id": series["id"]})
	}
	e.mustDo(200, "PATCH", "/teacher/series/"+str(series, "id"), a, map[string]interface{}{"title": "Renamed series"})
	got := e.mustDo(200, "GET", "/exams?course_id="+e.w.Course.ID.String(), a, nil)
	if _, ok := got["tests"]; !ok {
		t.Fatalf("admin can open the Tests tab: %v", got)
	}
	for _, path := range []string{"/brain-hacks", "/flashcards/decks", "/qbank/overview", "/pulse", "/schema", "/exams/grand-analysis"} {
		if code, body := e.do("GET", path, a, nil); code != 200 {
			t.Fatalf("admin previewing the student app: GET %s → %d %v", path, code, body)
		}
	}

	e.mustDo(200, "DELETE", "/teacher/series/"+str(series, "id"), a, nil)
	if n := len(e.mustDo(200, "GET", "/teacher/series", a, nil)["series"].([]interface{})); n != 0 {
		t.Fatalf("series deleted: %d", n)
	}

	// teacher authors → admin reviews → student sees
	deck := e.mustDo(201, "POST", "/teacher/flashcard-decks", tr, map[string]interface{}{"title": "T deck", "course_id": e.w.Course.ID.String(), "subject_id": e.w.Subject.ID.String(), "chapter_id": e.w.Chapter.ID.String()})
	e.mustDo(201, "POST", "/teacher/flashcard-decks/"+str(deck, "id")+"/cards", tr, map[string]interface{}{"front": "f", "back": "b"})
	e.mustDo(200, "POST", "/teacher/flashcard-decks/"+str(deck, "id")+"/submit-for-review", tr, nil)
	e.mustDo(200, "POST", "/admin/flashcard-decks/"+str(deck, "id")+"/approve", a, nil)
	e.mustDo(200, "POST", "/teacher/flashcard-decks/"+str(deck, "id")+"/publish", tr, nil)
	list := e.mustDo(200, "GET", "/flashcards/decks?course_id="+e.w.Course.ID.String(), s, nil)["decks"].([]interface{})
	d0 := list[0].(map[string]interface{})
	if len(list) != 1 || str(d0, "chapter_name") != e.w.Chapter.Name || str(d0, "subject_name") != e.w.Subject.Name {
		t.Fatalf("deck carries its subject and chapter to the student: %v", list)
	}
}

func TestDiscardAttempt(t *testing.T) {
	e := newEnv(t)
	s := &e.w.Student
	tst := e.w.Test(t, "practice", 1, true)
	att := e.mustDo(200, "POST", "/tests/"+tst.ID.String()+"/attempts", s, nil)
	id := str(att, "attempt", "id")
	e.mustDo(200, "POST", "/attempts/"+id+"/discard", s, nil)
	if code, _ := e.do("POST", "/attempts/"+id+"/discard", s, nil); code != 404 {
		t.Fatalf("already gone: %d", code)
	}
	// the test can be started afresh
	att2 := e.mustDo(200, "POST", "/tests/"+tst.ID.String()+"/attempts", s, nil)
	e.mustDo(200, "POST", "/attempts/"+str(att2, "attempt", "id")+"/submit", s, nil)
	if code, body := e.do("POST", "/attempts/"+str(att2, "attempt", "id")+"/discard", s, nil); code != 409 {
		t.Fatalf("a submitted attempt can't be discarded: %d %v", code, body)
	}
}
