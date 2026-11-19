package router_test

import "testing"

// The reported flow: a teacher imports cards from a CSV (bulk add), an admin approves, the teacher publishes, and the
// student must see the deck in the list the app uses (filtered by the student's course) and be able to study it.
func TestCsvImportedDeckReachesStudents(t *testing.T) {
	e := newEnv(t)
	deck := e.mustDo(201, "POST", "/teacher/flashcard-decks", &e.w.Teacher, map[string]interface{}{
		"title": "From CSV", "course_id": e.w.Course.ID.String(), "requires_subscription": false})
	did := str(deck, "id")
	e.mustDo(201, "POST", "/teacher/flashcard-decks/"+did+"/cards/bulk", &e.w.Teacher, map[string]interface{}{"cards": []map[string]string{
		{"front": "Powerhouse of the cell", "back": "Mitochondria"},
		{"front": "Unit of force", "back": "Newton"},
	}})
	e.mustDo(200, "POST", "/teacher/flashcard-decks/"+did+"/submit-for-review", &e.w.Teacher, nil)
	e.mustDo(200, "POST", "/admin/flashcard-decks/"+did+"/approve", &e.w.Admin, nil)
	e.mustDo(200, "POST", "/teacher/flashcard-decks/"+did+"/publish", &e.w.Teacher, nil)

	s := &e.w.Student
	list := e.mustDo(200, "GET", "/flashcards/decks?course_id="+e.w.Course.ID.String(), s, nil)["decks"].([]interface{})
	if len(list) != 1 || num(list[0].(map[string]interface{}), "card_count") != 2 {
		t.Fatalf("student list: %v", list)
	}
	study := e.mustDo(200, "GET", "/flashcards/decks/"+did+"/study", s, nil)
	if len(study["cards"].([]interface{})) != 2 {
		t.Fatalf("study: %v", study)
	}
}
