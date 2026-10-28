package router_test

import (
	"fmt"
	"testing"

	"codon-backend/internal/models"
	"codon-backend/internal/services"
)

func (e *env) createTest(module string, extra map[string]interface{}) string {
	e.t.Helper()
	body := map[string]interface{}{"title": "Draft " + module, "course_id": e.w.Course.ID.String(), "module_type": module,
		"chapter_id": e.w.Chapter.ID.String(), "subject_id": e.w.Subject.ID.String()}
	for k, v := range extra {
		body[k] = v
	}
	out := e.mustDo(201, "POST", "/teacher/tests", &e.w.Teacher, body)
	return str(out, "id")
}

func q(text string, extra map[string]interface{}) map[string]interface{} {
	b := map[string]interface{}{"question_text": text, "option_a": "One", "option_b": "Two", "option_c": "Three", "option_d": "Four", "correct_option": "B"}
	for k, v := range extra {
		b[k] = v
	}
	return b
}

func TestCreateTestValidationAndFreeFlag(t *testing.T) {
	e := newEnv(t)
	body := map[string]interface{}{"title": "x", "course_id": e.w.Course.ID.String(), "module_type": "custom"}
	if code, out := e.do("POST", "/teacher/tests", &e.w.Teacher, body); code != 400 || str(out, "code") != "invalid_module_type" {
		t.Fatalf("teachers can't author custom tests: %d %v", code, out)
	}
	body["module_type"] = "banana"
	if code, _ := e.do("POST", "/teacher/tests", &e.w.Teacher, body); code != 400 {
		t.Fatal("unknown module type must be rejected")
	}
	// regression: requires_subscription=false used to be stored as true (GORM default:true)
	id := e.createTest("qbank", map[string]interface{}{"requires_subscription": false})
	var test models.Test
	e.db.First(&test, "id = ?", id)
	if test.RequiresSubscription {
		t.Fatal("a free test was stored as paid")
	}
}

func TestQuestionAuthoringWithImagesAndMetadata(t *testing.T) {
	e := newEnv(t)
	testID := e.createTest("qbank", nil)
	_, up := e.uploadImage(&e.w.Teacher, "question_image", "image/png", pngBytes(300, 200, false))
	mid := str(up["media"].(map[string]interface{}), "id")

	out := e.mustDo(201, "POST", "/teacher/tests/"+testID+"/questions", &e.w.Teacher, q("Identify the part.\n\n![Diagram](media:"+mid+")", map[string]interface{}{
		"option_a": "![](media:" + mid + ")", "difficulty": "hard", "ncert_class": 11, "ncert_page": 132, "source_type": "pyq", "source_year": 2021,
		"tags": []string{"#NEET Bio", "neet-bio", "Cell"}, "explanation": "H~2~O and x^2^",
	}))
	if out["content_format"] != "rich_v1" || out["difficulty"] != "hard" || num(out, "ncert_page") != 132 {
		t.Fatalf("question: %v", out)
	}
	if str(out, "subject_id") != e.w.Subject.ID.String() || str(out, "chapter_id") != e.w.Chapter.ID.String() {
		t.Fatalf("subject/chapter must be inherited from the test: %v", out)
	}
	if tags := out["tags"].([]interface{}); len(tags) != 2 {
		t.Fatalf("#NEET Bio and neet-bio must collapse into one tag: %v", tags)
	}
	if _, ok := out["media"].(map[string]interface{})[mid]; !ok {
		t.Fatalf("response must carry the resolved media map: %v", out["media"])
	}
	var refs int64
	e.db.Model(&models.MediaRef{}).Where("media_id = ?", mid).Count(&refs)
	if refs != 2 {
		t.Fatalf("stem + option A reference the image: %d refs", refs)
	}
	var tq int64
	e.db.Model(&models.TestQuestion{}).Where("test_id = ?", testID).Count(&tq)
	if tq != 1 {
		t.Fatal("dual-write to test_questions missing")
	}

	// another teacher cannot use my media; unknown ids are refused
	other := e.w.User(t, models.RoleTeacher)
	otherTest := e.mustDo(201, "POST", "/teacher/tests", &other, map[string]interface{}{"title": "t", "course_id": e.w.Course.ID.String(), "module_type": "qbank"})
	code, body := e.do("POST", "/teacher/tests/"+str(otherTest, "id")+"/questions", &other, q("Stem ![](media:"+mid+")", nil))
	if code != 422 || str(body, "code") != "invalid_media_ref" {
		t.Fatalf("foreign media: %d %v", code, body)
	}
	code, body = e.do("POST", "/teacher/tests/"+testID+"/questions", &e.w.Teacher, q("Stem ![](media:99999999-9999-9999-9999-999999999999)", nil))
	if code != 422 || str(body, "code") != "invalid_media_ref" {
		t.Fatalf("unknown media: %d %v", code, body)
	}
	// markup abuse and structural problems
	for name, tc := range map[string]struct {
		body map[string]interface{}
		code string
	}{
		"html":      {q("<script>alert(1)</script>", nil), "invalid_content"},
		"external":  {q("![x](https://evil.example/a.png)", nil), "invalid_content"},
		"emptyopt":  {q("Stem", map[string]interface{}{"option_c": "   "}), "missing_content"},
		"badkey":    {q("Stem", map[string]interface{}{"correct_option": "E"}), "invalid_option"},
		"baddiff":   {q("Stem", map[string]interface{}{"difficulty": "extreme"}), "invalid_difficulty"},
		"toolong":   {q(string(make([]byte, 0))+fmt.Sprintf("%04001d", 0), nil), "invalid_content"},
		"badsource": {q("Stem", map[string]interface{}{"source_type": "blog"}), "invalid_source_type"},
	} {
		code, out := e.do("POST", "/teacher/tests/"+testID+"/questions", &e.w.Teacher, tc.body)
		if str(out, "code") != tc.code {
			t.Errorf("%s: got %d %v, want code %s", name, code, out, tc.code)
		}
	}
	// duplicate detection is warn-only
	d1 := e.mustDo(201, "POST", "/teacher/tests/"+testID+"/questions", &e.w.Teacher, q("A unique stem about mitochondria", nil))
	d2 := e.mustDo(201, "POST", "/teacher/tests/"+testID+"/questions", &e.w.Teacher, q("a UNIQUE   stem about **mitochondria**", nil))
	if len(d1["warnings"].([]interface{})) != 0 || len(d2["warnings"].([]interface{})) != 1 {
		t.Fatalf("duplicate warnings: %v / %v", d1["warnings"], d2["warnings"])
	}
	chk := e.mustDo(200, "POST", "/teacher/questions/check-duplicate", &e.w.Teacher, map[string]interface{}{
		"question_text": "A unique stem about mitochondria", "option_a": "One", "option_b": "Two", "option_c": "Three", "option_d": "Four"})
	if len(chk["duplicates"].([]interface{})) < 1 {
		t.Fatalf("check-duplicate: %v", chk)
	}
}

func TestPublishGateAndLiveQuestionRules(t *testing.T) {
	e := newEnv(t)
	testID := e.createTest("practice", nil)
	q1 := e.mustDo(201, "POST", "/teacher/tests/"+testID+"/questions", &e.w.Teacher, q("Needs a difficulty", nil))
	e.mustDo(201, "POST", "/teacher/tests/"+testID+"/questions", &e.w.Teacher, q("Has one", map[string]interface{}{"difficulty": "easy"}))

	code, out := e.do("POST", "/teacher/tests/"+testID+"/submit-for-review", &e.w.Teacher, nil)
	if code != 422 || str(out, "code") != "incomplete_questions" {
		t.Fatalf("gate: %d %v", code, out)
	}
	missing := out["details"].(map[string]interface{})["missing"].([]interface{})
	if len(missing) != 1 || str(missing[0].(map[string]interface{}), "question_id") != str(q1, "id") {
		t.Fatalf("gate must name the exact question: %v", missing)
	}
	e.mustDo(200, "PATCH", "/teacher/questions/"+str(q1, "id"), &e.w.Teacher, map[string]interface{}{"difficulty": "medium"})
	e.mustDo(200, "POST", "/teacher/tests/"+testID+"/submit-for-review", &e.w.Teacher, nil)
	e.mustDo(200, "POST", "/admin/tests/"+testID+"/approve", &e.w.Admin, nil)
	e.mustDo(200, "POST", "/teacher/tests/"+testID+"/publish", &e.w.Teacher, nil)

	// live: content edits are locked (must use a correction), metadata edits are allowed + audited
	code, out = e.do("PATCH", "/teacher/questions/"+str(q1, "id"), &e.w.Teacher, map[string]interface{}{"question_text": "changed"})
	if code != 409 || str(out, "code") != "question_locked" {
		t.Fatalf("live content edit: %d %v", code, out)
	}
	e.mustDo(200, "PATCH", "/teacher/questions/"+str(q1, "id"), &e.w.Teacher, map[string]interface{}{"difficulty": "hard"})
	var audits int64
	e.db.Model(&models.AdminAuditLog{}).Where("action = ?", "question.metadata_update").Count(&audits)
	if audits != 1 {
		t.Fatalf("metadata edit on a live question must be audited, got %d", audits)
	}
	if code, _ := e.do("DELETE", "/teacher/questions/"+str(q1, "id"), &e.w.Teacher, nil); code != 409 {
		t.Fatal("live questions can't be deleted")
	}
}

func TestStudentQuestionPayloadHidesAnswersAndResolvesMedia(t *testing.T) {
	e := newEnv(t)
	testID := e.createTest("practice", map[string]interface{}{"requires_subscription": false})
	_, up := e.uploadImage(&e.w.Teacher, "question_image", "image/png", pngBytes(120, 80, false))
	mid := str(up["media"].(map[string]interface{}), "id")
	e.mustDo(201, "POST", "/teacher/tests/"+testID+"/questions", &e.w.Teacher, q("See ![fig](media:"+mid+")", map[string]interface{}{"difficulty": "easy", "explanation": "Because."}))
	// a legacy plain-text question containing markup characters must stay literal
	var test models.Test
	e.db.First(&test, "id = ?", testID)
	legacy := e.w.Question(t, test, 2, "easy")
	e.db.Model(&models.Question{}).Where("id = ?", legacy.ID).Updates(map[string]interface{}{"question_text": "Costs $5 and *x* <b>y</b>", "content_format": "plain"})
	e.mustDo(200, "POST", "/teacher/tests/"+testID+"/submit-for-review", &e.w.Teacher, nil)
	e.mustDo(200, "POST", "/admin/tests/"+testID+"/approve", &e.w.Admin, nil)
	e.mustDo(200, "POST", "/teacher/tests/"+testID+"/publish", &e.w.Teacher, nil)

	// no attempt → no questions
	if code, _ := e.do("GET", "/tests/"+testID+"/questions", &e.w.Student, nil); code != 403 {
		t.Fatal("questions require an active attempt")
	}
	e.mustDo(200, "POST", "/tests/"+testID+"/attempts", &e.w.Student, nil)
	out := e.mustDo(200, "GET", "/tests/"+testID+"/questions", &e.w.Student, nil)
	qs := out["questions"].([]interface{})
	if len(qs) != 2 {
		t.Fatalf("questions: %v", out)
	}
	for _, it := range qs {
		m := it.(map[string]interface{})
		if _, leaked := m["correct_option"]; leaked {
			t.Fatal("correct_option leaked to the student")
		}
		if _, leaked := m["explanation"]; leaked {
			t.Fatal("explanation leaked to the student")
		}
	}
	if _, ok := out["media"].(map[string]interface{})[mid]; !ok {
		t.Fatalf("media map missing: %v", out["media"])
	}
	first, second := qs[0].(map[string]interface{}), qs[1].(map[string]interface{})
	if first["content_format"] != "rich_v1" || second["content_format"] != "plain" || second["question_text"] != "Costs $5 and *x* <b>y</b>" {
		t.Fatalf("formats: %v %v", first["content_format"], second)
	}
	// the legacy question contributes NO media refs even though it is plain
	if v := out["media"].(map[string]interface{}); len(v) != 1 {
		t.Fatalf("plain questions must not resolve media: %v", v)
	}
}

func TestTeacherBrowseFiltersCompletenessAndBulkUpdate(t *testing.T) {
	e := newEnv(t)
	testID := e.createTest("qbank", nil)
	var ids []string
	for i := 0; i < 4; i++ {
		extra := map[string]interface{}{}
		if i%2 == 0 {
			extra["difficulty"] = "easy"
		}
		ids = append(ids, str(e.mustDo(201, "POST", "/teacher/tests/"+testID+"/questions", &e.w.Teacher, q(fmt.Sprintf("Question number %d text", i), extra)), "id"))
	}
	list := e.mustDo(200, "GET", "/teacher/questions?missing=difficulty", &e.w.Teacher, nil)
	if n := len(list["items"].([]interface{})); n != 2 {
		t.Fatalf("missing=difficulty: %d", n)
	}
	comp := e.mustDo(200, "GET", "/teacher/questions/completeness?course_id="+e.w.Course.ID.String(), &e.w.Teacher, nil)
	if num(comp, "totals", "missing_difficulty") != 2 || num(comp, "totals", "total") != 4 {
		t.Fatalf("completeness must match the list filter: %v", comp["totals"])
	}
	// text search + pagination
	if s := e.mustDo(200, "GET", "/teacher/questions?q=number%202", &e.w.Teacher, nil); len(s["items"].([]interface{})) != 1 {
		t.Fatalf("search: %v", s)
	}
	p1 := e.mustDo(200, "GET", "/teacher/questions?limit=3", &e.w.Teacher, nil)
	p2 := e.mustDo(200, "GET", "/teacher/questions?limit=3&cursor="+str(p1, "next_cursor"), &e.w.Teacher, nil)
	if len(p1["items"].([]interface{})) != 3 || len(p2["items"].([]interface{})) != 1 || p2["next_cursor"] != nil {
		t.Fatalf("cursor pagination: %v / %v", p1["next_cursor"], p2)
	}
	// another teacher sees none of it
	other := e.w.User(t, models.RoleTeacher)
	if o := e.mustDo(200, "GET", "/teacher/questions", &other, nil); len(o["items"].([]interface{})) != 0 {
		t.Fatal("teachers only see their own questions")
	}
	// bulk update: tags + difficulty applied to all
	e.mustDo(200, "POST", "/teacher/questions/bulk-update", &e.w.Teacher, map[string]interface{}{
		"ids": ids, "patch": map[string]interface{}{"difficulty": "hard", "tags_add": []string{"#Bulk"}}})
	var hard int64
	e.db.Model(&models.Question{}).Where("test_id = ? AND difficulty = 'hard'", testID).Count(&hard)
	if hard != 4 {
		t.Fatalf("bulk difficulty: %d", hard)
	}
	// all-or-nothing: one foreign id blocks the whole request
	foreign := e.w.Test(t, models.ModulePractice, 1, true)
	fq, _ := services.LoadTestQuestions(nil2(), e.db, foreign.ID)
	code, out := e.do("POST", "/teacher/questions/bulk-update", &other, map[string]interface{}{"ids": []string{ids[0], fq[0].ID.String()}, "patch": map[string]interface{}{"difficulty": "easy"}})
	if code != 403 || str(out, "code") != "not_owner" {
		t.Fatalf("foreign ids: %d %v", code, out)
	}
	e.db.Model(&models.Question{}).Where("id = ?", ids[0]).Select("difficulty").Scan(&struct{ D string }{})
	// remove tag + move to another draft test
	dest := e.createTest("qbank", nil)
	e.mustDo(200, "POST", "/teacher/questions/bulk-update", &e.w.Teacher, map[string]interface{}{"ids": ids[:2], "patch": map[string]interface{}{"tags_remove": []string{"bulk"}, "move_to_test_id": dest}})
	var moved, destTotal int64
	e.db.Model(&models.TestQuestion{}).Where("test_id = ?", dest).Count(&moved)
	var dt models.Test
	e.db.First(&dt, "id = ?", dest)
	destTotal = int64(dt.TotalQuestions)
	if moved != 2 || destTotal != 2 {
		t.Fatalf("move: join=%d total=%d", moved, destTotal)
	}
}

func TestReadSwitchAndParity(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModulePractice, 5, true)
	a, _ := services.LoadTestQuestions(nil2(), e.db, test.ID)
	e.set("test_questions.read_via_join", "false")
	b, _ := services.LoadTestQuestions(nil2(), e.db, test.ID)
	e.set("test_questions.read_via_join", "true")
	if len(a) != 5 || len(b) != 5 {
		t.Fatalf("lengths %d %d", len(a), len(b))
	}
	for i := range a {
		if a[i].ID != b[i].ID || a[i].Position != b[i].Position {
			t.Fatalf("join and legacy reads disagree at %d", i)
		}
	}
	rep, err := services.CheckTestQuestionParity(nil2(), e.db)
	if err != nil || rep.MissingInJoin != 0 || rep.OrphanJoinRows != 0 || rep.CountMismatches != 0 {
		t.Fatalf("parity: %+v %v", rep, err)
	}
}
