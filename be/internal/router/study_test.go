package router_test

import (
	"testing"

	"codon-backend/internal/models"
)

func TestSchemaImportStatusAndAnalytics(t *testing.T) {
	e := newEnv(t)
	s, a := &e.w.Student, &e.w.Admin
	rows := []map[string]interface{}{
		{"subject": e.w.Subject.Name, "chapter": "Optics", "topic": "Lenses", "year": "2022", "subtopic": "", "questions": 2},
		{"subject": e.w.Subject.Name, "chapter": "Optics", "topic": "Lenses", "year": "2022 Re", "subtopic": "Thin lens", "questions": 1},
		{"subject": e.w.Subject.Name, "chapter": "Optics", "topic": "Mirrors", "year": "2021", "subtopic": "", "questions": 3},
	}
	if code, _ := e.do("POST", "/admin/schema/import", s, map[string]interface{}{"course_id": e.w.Course.ID, "rows": rows}); code != 403 {
		t.Fatalf("students cannot import: %d", code)
	}
	if code, body := e.do("POST", "/admin/schema/import", a, map[string]interface{}{"course_id": e.w.Course.ID, "rows": []map[string]interface{}{{"subject": "Nope", "chapter": "x", "topic": "y", "year": "20x", "questions": 1}}}); code != 422 {
		t.Fatalf("bad rows are refused: %d %v", code, body)
	}
	out := e.mustDo(200, "POST", "/admin/schema/import", a, map[string]interface{}{"course_id": e.w.Course.ID, "rows": rows})
	if num(out, "topics") != 2 || num(out, "new_topics") != 2 {
		t.Fatalf("import: %v", out)
	}
	// uploading again replaces the year rows instead of doubling them
	e.mustDo(200, "POST", "/admin/schema/import", a, map[string]interface{}{"course_id": e.w.Course.ID, "rows": rows})

	ov := e.mustDo(200, "GET", "/schema?course_id="+e.w.Course.ID.String(), s, nil)
	sj := ov["subjects"].([]interface{})[0].(map[string]interface{})
	topics := sj["chapters"].([]interface{})[0].(map[string]interface{})["topics"].([]interface{})
	var lenses map[string]interface{}
	for _, tp := range topics {
		if str(tp.(map[string]interface{}), "name") == "Lenses" {
			lenses = tp.(map[string]interface{})
		}
	}
	if num(lenses, "total") != 3 || str(lenses, "status") != "yet_to_read" || len(ov["years"].([]interface{})) != 3 {
		t.Fatalf("overview: %v", ov)
	}
	id := str(lenses, "id")
	det := e.mustDo(200, "GET", "/schema/topics/"+id, s, nil)
	if num(det, "total") != 3 || len(det["rows"].([]interface{})) != 2 || str(det["rows"].([]interface{})[0].(map[string]interface{}), "year") != "2022" {
		t.Fatalf("detail: %v", det)
	}

	if code, _ := e.do("PUT", "/schema/topics/"+id+"/status", s, map[string]interface{}{"status": "nope"}); code != 400 {
		t.Fatalf("bad status: %d", code)
	}
	e.mustDo(200, "PUT", "/schema/topics/"+id+"/status", s, map[string]interface{}{"status": "confident"})
	if n := len(e.mustDo(200, "GET", "/me/schema/completions", s, nil)["items"].([]interface{})); n != 1 {
		t.Fatalf("one completion: %d", n)
	}
	e.mustDo(200, "PUT", "/schema/topics/"+id+"/status", s, map[string]interface{}{"status": "yet_to_revise"})
	if n := len(e.mustDo(200, "GET", "/me/schema/completions", s, nil)["items"].([]interface{})); n != 0 {
		t.Fatalf("moving away from Confident removes it: %d", n)
	}
}

func TestPulseTeacherCreateReadAndReset(t *testing.T) {
	e := newEnv(t)
	s, tr := &e.w.Student, &e.w.Teacher
	body := map[string]interface{}{"course_id": e.w.Course.ID, "subject_id": e.w.Subject.ID, "chapter_id": e.w.Chapter.ID, "title": "Mitochondria", "body": "Powerhouse of the cell"}
	if code, _ := e.do("POST", "/teacher/pulse", s, body); code != 403 {
		t.Fatalf("students cannot create: %d", code)
	}
	item := e.mustDo(201, "POST", "/teacher/pulse", tr, body)
	list := e.mustDo(200, "GET", "/pulse?course_id="+e.w.Course.ID.String(), s, nil)["items"].([]interface{})
	if len(list) != 1 || list[0].(map[string]interface{})["read"] != false {
		t.Fatalf("list: %v", list)
	}
	e.mustDo(200, "POST", "/pulse/"+str(item, "id")+"/read", s, nil)
	e.mustDo(200, "POST", "/pulse/"+str(item, "id")+"/read", s, nil)
	if n := len(e.mustDo(200, "GET", "/me/pulse/reads", s, nil)["items"].([]interface{})); n != 1 {
		t.Fatalf("a repeat read counts once: %d", n)
	}
	e.mustDo(200, "POST", "/me/resets/pulse", s, nil)
	if n := len(e.mustDo(200, "GET", "/me/pulse/reads", s, nil)["items"].([]interface{})); n != 0 {
		t.Fatalf("reset clears reads: %d", n)
	}
	var left int64
	e.db.Model(&models.PulseItem{}).Count(&left)
	if left != 1 {
		t.Fatalf("reset keeps the content: %d", left)
	}
}

func TestSchemaAndPulseManagement(t *testing.T) {
	e := newEnv(t)
	tr, s := &e.w.Teacher, &e.w.Student
	base := map[string]interface{}{"course_id": e.w.Course.ID, "subject_id": e.w.Subject.ID, "chapter_id": e.w.Chapter.ID}
	if code, _ := e.do("POST", "/teacher/schema/topics", s, map[string]interface{}{"name": "x"}); code != 403 {
		t.Fatalf("students cannot manage: %d", code)
	}
	body := map[string]interface{}{"course_id": base["course_id"], "subject_id": base["subject_id"], "chapter_id": base["chapter_id"], "name": "Entropy"}
	topic := e.mustDo(201, "POST", "/teacher/schema/topics", tr, body)
	id := str(topic, "id")
	e.mustDo(200, "PATCH", "/teacher/schema/topics/"+id, tr, map[string]interface{}{"name": "Entropy and heat"})
	if code, _ := e.do("PUT", "/teacher/schema/topics/"+id+"/years", tr, map[string]interface{}{"rows": []map[string]interface{}{{"year": "abc", "questions": 1}}}); code != 422 {
		t.Fatalf("bad year: %d", code)
	}
	e.mustDo(200, "PUT", "/teacher/schema/topics/"+id+"/years", tr, map[string]interface{}{"rows": []map[string]interface{}{{"year": "2023", "subtopic": "", "questions": 4}, {"year": "2022 Re", "subtopic": "Heat", "questions": 1}}})
	list := e.mustDo(200, "GET", "/teacher/schema/topics?course_id="+e.w.Course.ID.String(), tr, nil)["topics"].([]interface{})
	row := list[0].(map[string]interface{})
	if len(list) != 1 || str(row, "name") != "Entropy and heat" || num(row, "total") != 5 || num(row, "rows") != 2 {
		t.Fatalf("list: %v", list)
	}
	e.mustDo(200, "DELETE", "/teacher/schema/topics/"+id, tr, nil)
	if n := len(e.mustDo(200, "GET", "/teacher/schema/topics", tr, nil)["topics"].([]interface{})); n != 0 {
		t.Fatalf("deleted: %d", n)
	}

	// pulse: edit and reorder
	pb := map[string]interface{}{"course_id": base["course_id"], "subject_id": base["subject_id"], "chapter_id": base["chapter_id"], "title": "One", "body": "first item body"}
	a := e.mustDo(201, "POST", "/teacher/pulse", tr, pb)
	pb["title"] = "Two"
	b := e.mustDo(201, "POST", "/teacher/pulse", tr, pb)
	e.mustDo(200, "PATCH", "/teacher/pulse/"+str(a, "id"), tr, map[string]interface{}{"title": "One edited"})
	e.mustDo(200, "POST", "/teacher/pulse/"+str(b, "id")+"/move", tr, map[string]interface{}{"direction": "up"})
	items := e.mustDo(200, "GET", "/pulse", s, nil)["items"].([]interface{})
	if len(items) != 2 || str(items[0].(map[string]interface{}), "title") != "Two" || str(items[1].(map[string]interface{}), "title") != "One edited" {
		t.Fatalf("order after move: %v", items)
	}
}
