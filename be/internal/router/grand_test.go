package router_test

import (
	"testing"
	"time"

	"codon-backend/internal/models"
)

func TestGrandAnalysisListsReleasedGrandTests(t *testing.T) {
	e := newEnv(t)
	s := &e.w.Student
	if n := len(e.mustDo(200, "GET", "/exams/grand-analysis", s, nil)["attempts"].([]interface{})); n != 0 {
		t.Fatalf("no tests yet: %d", n)
	}
	gt := e.w.Test(t, models.ModuleTestSeries, 2, true)
	e.db.Model(&models.Test{}).Where("id = ?", gt.ID).Updates(map[string]interface{}{"kind": "full", "exam_style": "neet", "delivery": "anytime"})
	att := e.mustDo(200, "POST", "/tests/"+gt.ID.String()+"/attempts", s, nil)
	id := str(att, "attempt", "id")
	e.mustDo(200, "POST", "/attempts/"+id+"/submit", s, nil)
	out := e.mustDo(200, "GET", "/exams/grand-analysis", s, nil)
	rows := out["attempts"].([]interface{})
	if len(rows) != 1 || str(rows[0].(map[string]interface{}), "test_id") != gt.ID.String() || num(out, "min_attempts") != 2 {
		t.Fatalf("one grand test: %v", out)
	}
	// a mini (part) test is not a Grand Test
	mini := e.w.Test(t, models.ModuleTestSeries, 1, true)
	e.db.Model(&models.Test{}).Where("id = ?", mini.ID).Update("kind", "part")
	m := e.mustDo(200, "POST", "/tests/"+mini.ID.String()+"/attempts", s, nil)
	e.mustDo(200, "POST", "/attempts/"+str(m, "attempt", "id")+"/submit", s, nil)
	if n := len(e.mustDo(200, "GET", "/exams/grand-analysis", s, nil)["attempts"].([]interface{})); n != 1 {
		t.Fatalf("minis are left out: %d", n)
	}
	_ = time.Now
}
