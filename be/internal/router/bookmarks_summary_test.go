package router_test

import (
	"testing"

	"codon-backend/internal/models"
	"codon-backend/internal/services"
)

func TestBookmarkSummaryFiltersAndRecheck(t *testing.T) {
	e := newEnv(t)
	s := &e.w.Student
	q := e.w.Test(t, models.ModuleQBank, 1, true) // the right answer is B
	submitAs(e, q, s, "B")
	qs, _ := services.LoadTestQuestions(nil2(), e.db, q.ID)
	qid := qs[0].ID.String()

	cols := e.mustDo(200, "GET", "/me/bookmark-collections", s, nil)["collections"].([]interface{})
	doubts := ""
	for _, c := range cols {
		if str(c.(map[string]interface{}), "key") == "doubts" {
			doubts = str(c.(map[string]interface{}), "id")
		}
	}
	e.mustDo(200, "PUT", "/me/bookmarks", s, map[string]interface{}{"item_type": "question", "item_id": qid, "collection_id": doubts})

	sum := e.mustDo(200, "GET", "/me/bookmarks/summary?item_type=question", s, nil)
	if num(sum, "total") != 1 {
		t.Fatalf("total: %v", sum)
	}
	by := sum["by_collection"].([]interface{})
	if len(by) != 1 || str(by[0].(map[string]interface{}), "collection_id") != doubts {
		t.Fatalf("by type: %v", by)
	}
	if _, ok := sum["by_subject"].([]interface{}); !ok {
		t.Fatalf("subjects listed: %v", sum)
	}
	if code, _ := e.do("GET", "/me/bookmarks/summary?item_type=bogus", s, nil); code != 400 {
		t.Fatalf("bad item type: %d", code)
	}

	// several bookmark types at once, and a type with nothing in it
	other := ""
	for _, c := range cols {
		if str(c.(map[string]interface{}), "key") == "important" {
			other = str(c.(map[string]interface{}), "id")
		}
	}
	both := e.mustDo(200, "GET", "/me/bookmarks?item_type=question&collection_ids="+doubts+","+other, s, nil)["items"].([]interface{})
	onlyOther := e.mustDo(200, "GET", "/me/bookmarks?item_type=question&collection_ids="+other, s, nil)["items"].([]interface{})
	if len(both) != 1 || len(onlyOther) != 0 {
		t.Fatalf("multi-select type filter: both=%d other=%d", len(both), len(onlyOther))
	}

	// re-attempt: right and wrong answers are checked, and nothing is saved
	var before, answersBefore int64
	e.db.Raw("SELECT count(*) FROM student_attempts WHERE user_id = ?", s.ID).Scan(&before)
	e.db.Raw("SELECT count(*) FROM attempt_answers aa JOIN student_attempts a ON a.id = aa.attempt_id WHERE a.user_id = ?", s.ID).Scan(&answersBefore)
	right := e.mustDo(200, "POST", "/me/bookmarks/questions/"+qid+"/check", s, map[string]interface{}{"option": "B"})
	wrong := e.mustDo(200, "POST", "/me/bookmarks/questions/"+qid+"/check", s, map[string]interface{}{"option": "A"})
	if right["is_correct"] != true || wrong["is_correct"] != false || str(wrong, "correct_option") != "B" {
		t.Fatalf("check: right=%v wrong=%v", right, wrong)
	}
	var after, answersAfter int64
	e.db.Raw("SELECT count(*) FROM student_attempts WHERE user_id = ?", s.ID).Scan(&after)
	e.db.Raw("SELECT count(*) FROM attempt_answers aa JOIN student_attempts a ON a.id = aa.attempt_id WHERE a.user_id = ?", s.ID).Scan(&answersAfter)
	if before != after || answersBefore != answersAfter {
		t.Fatalf("a re-attempt writes nothing: attempts %d->%d answers %d->%d", before, after, answersBefore, answersAfter)
	}
	if code, _ := e.do("POST", "/me/bookmarks/questions/"+qid+"/check", s, map[string]interface{}{"option": "Z"}); code != 400 {
		t.Fatalf("bad option: %d", code)
	}
	// only a bookmarked question can be checked
	if code, _ := e.do("POST", "/me/bookmarks/questions/"+qid+"/check", e.newStudent(), map[string]interface{}{"option": "A"}); code != 404 {
		t.Fatalf("someone else's question: %d", code)
	}
}

// The tag chip and the References block reach every place a question is shown.
func TestQuestionTagsAndReferencesTravel(t *testing.T) {
	e := newEnv(t)
	s := &e.w.Student
	q := e.w.Test(t, models.ModuleQBank, 1, true)
	qs, _ := services.LoadTestQuestions(nil2(), e.db, q.ID)
	qid := qs[0].ID.String()

	e.mustDo(200, "PATCH", "/teacher/questions/"+qid, &e.w.Teacher, map[string]interface{}{
		"ref_book": "Sample Textbook", "ref_edition": "8th", "ref_pages": "142-144", "tags": []string{"ImageBased"}})
	if code, _ := e.do("PATCH", "/teacher/questions/"+qid, &e.w.Teacher, map[string]interface{}{"ref_book": string(make([]byte, 200))}); code != 400 {
		t.Fatalf("a reference field is capped: %d", code)
	}

	att := e.mustDo(200, "POST", "/tests/"+q.ID.String()+"/attempts", s, nil)
	list := e.mustDo(200, "GET", "/tests/"+q.ID.String()+"/questions", s, nil)["questions"].([]interface{})
	tags, _ := list[0].(map[string]interface{})["tags"].([]interface{})
	tagLabel := ""
	if len(tags) == 1 {
		tagLabel, _ = tags[0].(string)
	}
	if len(tags) != 1 || tagLabel == "" {
		t.Fatalf("tags on the question screen: %v", list[0])
	}
	if _, leaked := list[0].(map[string]interface{})["ref_book"]; leaked {
		t.Fatal("references are shown after answering, not before")
	}
	id := str(att, "attempt", "id")
	e.mustDo(200, "PUT", "/attempts/"+id+"/answers/"+qid, s, map[string]interface{}{"selected_option": "B"})
	e.mustDo(200, "POST", "/attempts/"+id+"/submit", s, nil)
	rev := e.mustDo(200, "GET", "/attempts/"+id+"/review", s, nil)["review"].([]interface{})
	meta := rev[0].(map[string]interface{})["question_meta"].(map[string]interface{})
	if str(meta, "ref_book") != "Sample Textbook" || str(meta, "ref_pages") != "142-144" || meta["tags"].([]interface{})[0] != tagLabel {
		t.Fatalf("review carries tags and references: %v", meta)
	}

	e.mustDo(200, "PUT", "/me/bookmarks", s, map[string]interface{}{"item_type": "question", "item_id": qid})
	chk := e.mustDo(200, "POST", "/me/bookmarks/questions/"+qid+"/check", s, map[string]interface{}{"option": ""})
	if chk["is_correct"] != false || str(chk, "correct_option") != "B" || str(chk, "ref_edition") != "8th" {
		t.Fatalf("no answer shows the answer and references: %v", chk)
	}
}
