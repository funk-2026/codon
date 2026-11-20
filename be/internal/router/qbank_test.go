package router_test

import (
	"testing"

	"codon-backend/internal/models"
)

func TestQBankOverviewAndSolveOnce(t *testing.T) {
	e := newEnv(t)
	s := &e.w.Student
	qb := e.w.Test(t, models.ModuleQBank, 1, true) // the right answer is B
	e.db.Model(&models.Test{}).Where("id = ?", qb.ID).Update("chapter_id", e.w.Chapter.ID)
	e.db.Model(&models.User{}).Where("id = ?", s.ID).Update("selected_course_id", e.w.Course.ID)
	s.SelectedCourseID = &e.w.Course.ID

	find := func() map[string]interface{} {
		subs := e.mustDo(200, "GET", "/qbank/overview", s, nil)["subjects"].([]interface{})
		for _, sj := range subs {
			for _, m := range sj.(map[string]interface{})["modules"].([]interface{}) {
				if str(m.(map[string]interface{}), "test_id") == qb.ID.String() {
					return sj.(map[string]interface{})
				}
			}
		}
		t.Fatalf("module missing from the overview: %v", subs)
		return nil
	}
	sj := find()
	if num(sj, "total") != 1 || num(sj, "completed") != 0 || str(sj["modules"].([]interface{})[0].(map[string]interface{}), "state") != "unattempted" {
		t.Fatalf("fresh: %v", sj)
	}

	att := e.mustDo(200, "POST", "/tests/"+qb.ID.String()+"/attempts", s, nil)
	if m := find()["modules"].([]interface{})[0].(map[string]interface{}); str(m, "state") != "paused" {
		t.Fatalf("in progress shows as paused: %v", m)
	}
	id := str(att, "attempt", "id")
	e.mustDo(200, "POST", "/attempts/"+id+"/submit", s, nil)
	sj = find()
	m := sj["modules"].([]interface{})[0].(map[string]interface{})
	if str(m, "state") != "completed" || m["solved_at"] == nil || num(sj, "completed") != 1 || str(m, "attempt_id") != id {
		t.Fatalf("solved: %v", m)
	}

	// solved once: a second start is refused until the QBank is reset
	if code, body := e.do("POST", "/tests/"+qb.ID.String()+"/attempts", s, nil); code != 409 || str(body, "code") != "already_solved" {
		t.Fatalf("second solve: %d %v", code, body)
	}
	e.mustDo(200, "POST", "/me/resets/qbank", s, nil)
	if m := find()["modules"].([]interface{})[0].(map[string]interface{}); str(m, "state") != "unattempted" {
		t.Fatalf("reset clears the result on the chapter: %v", m)
	}
	e.mustDo(200, "POST", "/tests/"+qb.ID.String()+"/attempts", s, nil)
}
