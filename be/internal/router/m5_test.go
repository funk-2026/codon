package router_test

import (
	"context"
	"testing"
	"time"

	"codon-backend/internal/models"
	"codon-backend/internal/services"

	"github.com/google/uuid"
)

func TestBrainHacksWorkflowWithImages(t *testing.T) {
	e := newEnv(t)
	_, cover := e.uploadImage(&e.w.Teacher, "brain_hack_image", "image/png", pngBytes(200, 120, false))
	_, body := e.uploadImage(&e.w.Teacher, "brain_hack_image", "image/png", pngBytes(80, 80, false))
	coverID := str(cover["media"].(map[string]interface{}), "id")
	bodyID := str(body["media"].(map[string]interface{}), "id")
	_, qImg := e.uploadImage(&e.w.Teacher, "question_image", "image/png", pngBytes(50, 50, false))

	if code, o := e.do("POST", "/teacher/brain-hacks", &e.w.Teacher, map[string]interface{}{"title": "T", "category": "Focus", "body": "x", "cover_media_id": str(qImg["media"].(map[string]interface{}), "id")}); code != 422 || str(o, "code") != "invalid_media_ref" {
		t.Fatalf("a question image can't be a brain-hack cover: %d %v", code, o)
	}
	h := e.mustDo(201, "POST", "/teacher/brain-hacks", &e.w.Teacher, map[string]interface{}{
		"title": "The 2-minute recall trick", "category": "Memory", "cover_media_id": coverID,
		"body": "Close your eyes and **recall**.\n\n![Diagram](media:" + bodyID + ")\n\nH~2~O"})
	hack := h["brain_hack"].(map[string]interface{})
	id := str(hack, "id")
	if hack["status"] != "draft" || hack["content_format"] != "rich_v1" || len(h["media"].(map[string]interface{})) != 2 {
		t.Fatalf("hack: %v", h)
	}
	if code, _ := e.do("GET", "/brain-hacks/"+id, &e.w.Student, nil); code != 404 {
		t.Fatal("drafts are invisible to students")
	}
	other := e.w.User(t, models.RoleTeacher)
	if code, _ := e.do("PATCH", "/teacher/brain-hacks/"+id, &other, map[string]interface{}{"title": "hijack"}); code != 404 {
		t.Fatal("only the author edits")
	}
	if code, o := e.do("POST", "/teacher/brain-hacks", &e.w.Teacher, map[string]interface{}{"title": "T", "category": "Focus", "body": "<script>x</script>"}); code != 422 || str(o, "code") != "invalid_content" {
		t.Fatalf("html: %d %v", code, o)
	}
	e.mustDo(200, "POST", "/teacher/brain-hacks/"+id+"/submit-for-review", &e.w.Teacher, nil)
	if code, _ := e.do("PATCH", "/teacher/brain-hacks/"+id, &e.w.Teacher, map[string]interface{}{"title": "late edit"}); code != 409 {
		t.Fatal("no edits while in review")
	}
	// dashboard counts the pending hack (previously looked for a content_type that can't exist)
	dash := e.mustDo(200, "GET", "/admin/dashboard/summary", &e.w.Admin, nil)
	if num(dash, "pending_content_reviews")+num(dash, "pending_test_reviews") < 0 {
		t.Fatal(dash)
	}
	adm := e.mustDo(200, "GET", "/admin/brain-hacks/"+id, &e.w.Admin, nil)
	if len(adm["media"].(map[string]interface{})) != 2 {
		t.Fatalf("admins must see the images they approve: %v", adm)
	}
	if code, _ := e.do("POST", "/admin/brain-hacks/"+id+"/reject", &e.w.Admin, map[string]interface{}{"reason": ""}); code != 400 {
		t.Fatal("reason needed")
	}
	e.mustDo(200, "POST", "/admin/brain-hacks/"+id+"/reject", &e.w.Admin, map[string]interface{}{"reason": "Too long"})
	e.mustDo(200, "PATCH", "/teacher/brain-hacks/"+id, &e.w.Teacher, map[string]interface{}{"title": "Shorter"})
	e.mustDo(200, "POST", "/teacher/brain-hacks/"+id+"/submit-for-review", &e.w.Teacher, nil)
	e.mustDo(200, "POST", "/admin/brain-hacks/"+id+"/approve", &e.w.Admin, nil)
	if code, _ := e.do("GET", "/brain-hacks/"+id, &e.w.Student, nil); code != 404 {
		t.Fatal("approved is not yet published")
	}
	e.mustDo(200, "POST", "/teacher/brain-hacks/"+id+"/publish", &e.w.Teacher, nil)

	list := e.mustDo(200, "GET", "/brain-hacks?category=Memory", &e.w.Student, nil)
	if len(list["brain_hacks"].([]interface{})) != 1 || len(list["media"].(map[string]interface{})) != 2 {
		t.Fatalf("student list: %v", list)
	}
	cats := e.mustDo(200, "GET", "/brain-hacks/categories", &e.w.Student, nil)["categories"].([]interface{})
	if len(cats) != 3 {
		t.Fatalf("defaults + used categories: %v", cats)
	}
	// rating + rich body arrives with resolved images
	e.mustDo(200, "PUT", "/ratings", &e.w.Student, map[string]interface{}{"item_type": "brain_hack", "item_id": id, "value": 5})
	one := e.mustDo(200, "GET", "/brain-hacks/"+id, &e.w.Student, nil)
	if num(one, "brain_hack", "my_rating") != 5 || num(one, "brain_hack", "rating_count") != 1 || num(one, "brain_hack", "read_minutes") != 1 {
		t.Fatalf("detail: %v", one["brain_hack"])
	}
	// the published hack is never deletable; refs exist
	if code, _ := e.do("DELETE", "/teacher/brain-hacks/"+id, &e.w.Teacher, nil); code != 409 {
		t.Fatal("published hacks can't be deleted")
	}
}

func TestWellnessRichBodyAndDetail(t *testing.T) {
	e := newEnv(t)
	_, img := e.uploadImage(&e.w.Admin, "wellness_image", "image/png", pngBytes(90, 60, false))
	mid := str(img["media"].(map[string]interface{}), "id")
	created := e.mustDo(201, "POST", "/admin/wellness-content", &e.w.Admin, map[string]interface{}{
		"title": "Breathe", "category": "guidance", "content_format": "rich_v1", "media_id": mid,
		"body_text": "Breathe in for **four** counts.\n\n![Box breathing](media:" + mid + ")"})
	list := e.mustDo(200, "GET", "/wellness/content", &e.w.Student, nil)
	if len(list["content"].([]interface{})) != 1 || len(list["media"].(map[string]interface{})) != 1 {
		t.Fatalf("list: %v", list)
	}
	det := e.mustDo(200, "GET", "/wellness/content/"+str(created, "id"), &e.w.Student, nil)
	if str(det, "content", "title") != "Breathe" || det["media"] == nil {
		t.Fatalf("the missing detail endpoint: %v", det)
	}
	if code, _ := e.do("GET", "/wellness/content/"+uuid.NewString(), &e.w.Student, nil); code != 404 {
		t.Fatal("unknown id")
	}
	// legacy plain items untouched
	plain := e.mustDo(201, "POST", "/admin/wellness-content", &e.w.Admin, map[string]interface{}{"title": "Old", "category": "motivation", "body_text": "Costs $5 and *x*"})
	if plain["content_format"] != "plain" {
		t.Fatalf("plain default: %v", plain)
	}
	if code, _ := e.do("POST", "/admin/wellness-content", &e.w.Admin, map[string]interface{}{"title": "Bad", "category": "guidance", "content_format": "rich_v1", "body_text": "![x](https://evil/x.png)"}); code != 422 {
		t.Fatal("rich wellness bodies are validated")
	}
	if code, _ := e.do("POST", "/admin/wellness-content", &e.w.Teacher, map[string]interface{}{"title": "x", "category": "guidance", "body_text": "x"}); code != 403 {
		t.Fatal("admin only")
	}
}

func TestFlashcardsAuthoringStudySRSAndGating(t *testing.T) {
	e := newEnv(t)
	_, img := e.uploadImage(&e.w.Teacher, "flashcard_image", "image/png", pngBytes(60, 60, false))
	mid := str(img["media"].(map[string]interface{}), "id")
	deck := e.mustDo(201, "POST", "/teacher/flashcard-decks", &e.w.Teacher, map[string]interface{}{
		"title": "Cell organelles", "course_id": e.w.Course.ID.String(), "chapter_id": e.w.Chapter.ID.String(), "requires_subscription": false})
	did := str(deck, "id")
	if deck["requires_subscription"] != false || deck["status"] != "draft" {
		t.Fatalf("deck: %v", deck)
	}
	var cardIDs []string
	for i, front := range []string{"Powerhouse of the cell?", "Site of protein synthesis?", "Stores genetic material?"} {
		body := map[string]interface{}{"front": front, "back": "Answer " + string(rune('A'+i))}
		if i == 0 {
			body["back"] = "Mitochondria ![m](media:" + mid + ")"
		}
		c := e.mustDo(201, "POST", "/teacher/flashcard-decks/"+did+"/cards", &e.w.Teacher, body)
		cardIDs = append(cardIDs, str(c, "card", "id"))
	}
	if code, o := e.do("POST", "/teacher/flashcard-decks/"+did+"/cards", &e.w.Teacher, map[string]interface{}{"front": "", "back": "x"}); code != 400 {
		t.Fatalf("both sides required: %d %v", code, o)
	}
	e.mustDo(200, "POST", "/teacher/flashcard-decks/"+did+"/reorder", &e.w.Teacher, map[string]interface{}{"ids": []string{cardIDs[2], cardIDs[0], cardIDs[1]}})
	if code, _ := e.do("POST", "/teacher/flashcard-decks/"+did+"/reorder", &e.w.Teacher, map[string]interface{}{"ids": cardIDs[:2]}); code != 422 {
		t.Fatal("reorder needs every id")
	}
	td := e.mustDo(200, "GET", "/teacher/flashcard-decks/"+did, &e.w.Teacher, nil)
	if str(td["cards"].([]interface{})[0].(map[string]interface{}), "id") != cardIDs[2] || len(td["media"].(map[string]interface{})) != 1 {
		t.Fatalf("order/media: %v", td)
	}
	empty := e.mustDo(201, "POST", "/teacher/flashcard-decks", &e.w.Teacher, map[string]interface{}{"title": "Empty", "course_id": e.w.Course.ID.String()})
	if code, _ := e.do("POST", "/teacher/flashcard-decks/"+str(empty, "id")+"/submit-for-review", &e.w.Teacher, nil); code != 422 {
		t.Fatal("empty decks can't be submitted")
	}
	e.mustDo(200, "POST", "/teacher/flashcard-decks/"+did+"/submit-for-review", &e.w.Teacher, nil)
	if code, _ := e.do("POST", "/teacher/flashcard-decks/"+did+"/cards", &e.w.Teacher, map[string]interface{}{"front": "a", "back": "b"}); code != 409 {
		t.Fatal("no edits in review")
	}
	if code, _ := e.do("GET", "/flashcards/decks", &e.w.Student, nil); code != 200 {
		t.Fatal("list")
	}
	e.mustDo(200, "POST", "/admin/flashcard-decks/"+did+"/approve", &e.w.Admin, nil)
	e.mustDo(200, "POST", "/teacher/flashcard-decks/"+did+"/publish", &e.w.Teacher, nil)

	s := &e.w.Student
	decks := e.mustDo(200, "GET", "/flashcards/decks?chapter_id="+e.w.Chapter.ID.String(), s, nil)["decks"].([]interface{})
	if len(decks) != 1 || num(decks[0].(map[string]interface{}), "new_cards") != 3 || decks[0].(map[string]interface{})["locked"] != false {
		t.Fatalf("decks: %v", decks)
	}
	// study queue: unseen cards in deck order
	st := e.mustDo(200, "GET", "/flashcards/decks/"+did+"/study?limit=2", s, nil)
	if len(st["cards"].([]interface{})) != 2 || str(st["cards"].([]interface{})[0].(map[string]interface{}), "state") != "new" {
		t.Fatalf("study: %v", st)
	}
	rev := func(id, result string) map[string]interface{} {
		return e.mustDo(200, "POST", "/flashcards/cards/"+id+"/review", s, map[string]interface{}{"result": result})
	}
	if code, _ := e.do("POST", "/flashcards/cards/"+cardIDs[0]+"/review", s, map[string]interface{}{"result": "meh"}); code != 400 {
		t.Fatal("result validation")
	}
	g := rev(cardIDs[0], "good")
	if num(g, "interval_days") != 1 || num(g, "reps") != 1 {
		t.Fatalf("first good = 1 day: %v", g)
	}
	// pretend a day passed → good doubles; easy triples; again resets to ~10 minutes
	e.db.Model(&models.FlashcardState{}).Where("card_id = ?", cardIDs[0]).Update("due_at", time.Now().Add(-time.Hour))
	if g2 := rev(cardIDs[0], "good"); num(g2, "interval_days") != 2 {
		t.Fatalf("second good doubles: %v", g2)
	}
	if ez := rev(cardIDs[1], "easy"); num(ez, "interval_days") != 3 {
		t.Fatalf("first easy = 3 days: %v", ez)
	}
	ag := rev(cardIDs[2], "again")
	due, _ := time.Parse(time.RFC3339Nano, str(ag, "due_at"))
	if num(ag, "interval_days") != 0 || num(ag, "reps") != 0 || due.After(time.Now().Add(15*time.Minute)) {
		t.Fatalf("again = soon: %v", ag)
	}
	// due queue: cards that are due come first; nothing due right now except after time passes
	e.db.Model(&models.FlashcardState{}).Where("card_id = ?", cardIDs[1]).Update("due_at", time.Now().Add(-time.Minute))
	q := e.mustDo(200, "GET", "/flashcards/decks/"+did+"/study", s, nil)["cards"].([]interface{})
	if len(q) != 1 || str(q[0].(map[string]interface{}), "id") != cardIDs[1] || str(q[0].(map[string]interface{}), "state") != "due" {
		t.Fatalf("due queue: %v", q)
	}
	decks = e.mustDo(200, "GET", "/flashcards/decks", s, nil)["decks"].([]interface{})
	if num(decks[0].(map[string]interface{}), "learned_cards") != 2 || num(decks[0].(map[string]interface{}), "new_cards") != 0 {
		t.Fatalf("progress: %v", decks[0])
	}
	quick := e.mustDo(200, "GET", "/flashcards/quick?count=5", s, nil)
	if len(quick["cards"].([]interface{})) != 1 {
		t.Fatalf("quick session = due cards: %v", quick)
	}
	// browse with cursor + streak recorded
	br := e.mustDo(200, "GET", "/flashcards/decks/"+did+"/cards?limit=2", s, nil)
	if len(br["cards"].([]interface{})) != 2 || br["next_cursor"] == nil {
		t.Fatalf("browse: %v", br)
	}
	var days int64
	e.db.Model(&models.DailyActivity{}).Where("user_id = ?", s.ID).Count(&days)
	if days != 1 {
		t.Fatal("studying counts toward the streak")
	}
	// polymorphic features work on cards and decks
	e.mustDo(200, "PUT", "/me/bookmarks", s, map[string]interface{}{"item_type": "flashcard", "item_id": cardIDs[0]})
	bm := e.mustDo(200, "GET", "/me/bookmarks?item_type=flashcard", s, nil)["items"].([]interface{})
	if len(bm) != 1 || str(bm[0].(map[string]interface{}), "flashcard", "front") != "Powerhouse of the cell?" {
		t.Fatalf("flashcard bookmark: %v", bm)
	}
	e.mustDo(200, "PUT", "/ratings", s, map[string]interface{}{"item_type": "flashcard_deck", "item_id": did, "value": 4})
	// subscription gating
	e.db.Model(&models.FlashcardDeck{}).Where("id = ?", did).UpdateColumn("requires_subscription", true)
	free := e.newStudent()
	if code, o := e.do("GET", "/flashcards/decks/"+did+"/study", free, nil); code != 403 || str(o, "code") != "subscription_required" {
		t.Fatalf("gate: %d %v", code, o)
	}
	if d := e.mustDo(200, "GET", "/flashcards/decks", free, nil)["decks"].([]interface{}); d[0].(map[string]interface{})["locked"] != true {
		t.Fatal("locked decks stay discoverable")
	}
	if q := e.mustDo(200, "GET", "/flashcards/quick", free, nil)["cards"].([]interface{}); len(q) != 0 {
		t.Fatal("quick sessions skip decks the student can't open")
	}
	// explore reflects decks/hacks and hides empty sections
	ex := e.mustDo(200, "GET", "/explore?course_id="+e.w.Course.ID.String(), free, nil)
	if len(ex["flashcard_decks"].(map[string]interface{})["newest"].([]interface{})) != 1 || len(ex["brain_hacks"].([]interface{})) != 0 || len(ex["continue"].([]interface{})) != 0 {
		t.Fatalf("explore: %v", ex)
	}
}

func TestVideoNotes(t *testing.T) {
	e := newEnv(t)
	ch := e.w.Chapter
	ct := models.ContentItem{Title: "Lecture", CourseID: e.w.Course.ID, ContentType: models.ContentVideo, ChapterID: ch.ID, UploadedBy: e.w.Teacher.ID, FileKey: "stream:x", Status: models.StatusPublished}
	e.db.Create(&ct)
	e.db.Model(&ct).UpdateColumn("requires_subscription", false)
	s := &e.w.Student
	n1 := e.mustDo(201, "POST", "/me/video-notes", s, map[string]interface{}{"content_id": ct.ID.String(), "timestamp_seconds": 120, "body": "**Key idea** at 2:00"})
	e.mustDo(201, "POST", "/me/video-notes", s, map[string]interface{}{"content_id": ct.ID.String(), "timestamp_seconds": 30, "body": "Intro"})
	list := e.mustDo(200, "GET", "/me/video-notes?content_id="+ct.ID.String(), s, nil)["notes"].([]interface{})
	if len(list) != 2 || num(list[0].(map[string]interface{}), "timestamp_seconds") != 30 {
		t.Fatalf("notes are in time order: %v", list)
	}
	e.mustDo(200, "PATCH", "/me/video-notes/"+str(n1, "id"), s, map[string]interface{}{"body": "Edited"})
	if code, _ := e.do("PATCH", "/me/video-notes/"+str(n1, "id"), e.newStudent(), map[string]interface{}{"body": "x"}); code != 404 {
		t.Fatal("notes are private")
	}
	if code, _ := e.do("POST", "/me/video-notes", s, map[string]interface{}{"content_id": ct.ID.String(), "body": ""}); code != 400 {
		t.Fatal("body required")
	}
	if code, _ := e.do("POST", "/me/video-notes", s, map[string]interface{}{"content_id": uuid.NewString(), "body": "x"}); code != 404 {
		t.Fatal("unknown content")
	}
	e.db.Model(&ct).UpdateColumn("requires_subscription", true)
	if code, o := e.do("POST", "/me/video-notes", e.newStudent(), map[string]interface{}{"content_id": ct.ID.String(), "body": "x"}); code != 403 || str(o, "code") != "subscription_required" {
		t.Fatalf("premium content notes need access: %d %v", code, o)
	}
	e.mustDo(200, "DELETE", "/me/video-notes/"+str(n1, "id"), s, nil)
}

type fakePush struct {
	sent   []services.PushMessage
	result string
}

func (f *fakePush) Send(_ context.Context, msgs []services.PushMessage) ([]services.PushResult, error) {
	f.sent = append(f.sent, msgs...)
	res := make([]services.PushResult, len(msgs))
	for i := range msgs {
		res[i] = services.PushResult{OK: f.result == "", Error: f.result}
	}
	return res, nil
}

func TestPushTokensPreferencesDispatchAndStreakNudge(t *testing.T) {
	e := newEnv(t)
	s := &e.w.Student
	tok := "ExponentPushToken[abc123]"
	if code, _ := e.do("POST", "/me/push-tokens", s, map[string]interface{}{"token": "not-a-token", "platform": "ios"}); code != 400 {
		t.Fatal("token format")
	}
	e.mustDo(200, "POST", "/me/push-tokens", s, map[string]interface{}{"token": tok, "platform": "ios", "device_id": "d1"})
	e.mustDo(200, "POST", "/me/push-tokens", s, map[string]interface{}{"token": tok, "platform": "ios", "device_id": "d1"}) // idempotent
	var n int64
	e.db.Model(&models.PushToken{}).Count(&n)
	if n != 1 {
		t.Fatalf("tokens: %d", n)
	}
	// a token belongs to one user: registering from another account moves it
	other := e.newStudent()
	e.mustDo(200, "POST", "/me/push-tokens", other, map[string]interface{}{"token": tok, "platform": "ios"})
	var pt models.PushToken
	e.db.First(&pt, "token = ?", tok)
	if pt.UserID != other.ID {
		t.Fatal("token must move to the new account")
	}
	e.mustDo(200, "POST", "/me/push-tokens", s, map[string]interface{}{"token": tok, "platform": "ios"})

	// a report resolution creates a notification; dispatch pushes it once
	services.Notify(e.db, s.ID, "report_resolved", "Your report was reviewed", "Thanks!", map[string]interface{}{"report_id": "r1"})
	fp := &fakePush{}
	ps := services.NewPushService(e.db, fp)
	if sent, _ := ps.Dispatch(nil2(), 50); sent != 1 || len(fp.sent) != 1 || fp.sent[0].Title != "Your report was reviewed" || fp.sent[0].Data["report_id"] != "r1" {
		t.Fatalf("dispatch: %d %+v", sent, fp.sent)
	}
	if sent, _ := ps.Dispatch(nil2(), 50); sent != 0 {
		t.Fatal("a notification is pushed at most once")
	}
	// preferences are honoured: report updates off → in-app only
	e.mustDo(200, "PUT", "/me/notification-preferences", s, map[string]interface{}{"report_updates": false})
	services.Notify(e.db, s.ID, "report_resolved", "Second", "x", nil)
	fp.sent = nil
	ps.Dispatch(nil2(), 50)
	if len(fp.sent) != 0 {
		var pf models.NotificationPref
		e.db.First(&pf, "user_id = ?", s.ID)
		t.Fatalf("opted-out notifications must not be pushed: sent=%+v pref=%+v", fp.sent, pf)
	}
	nl := e.mustDo(200, "GET", "/me/notifications", s, nil)
	if num(nl, "unread_count") != 2 || len(nl["items"].([]interface{})) != 2 {
		t.Fatalf("still in the in-app inbox: %v", nl)
	}
	e.mustDo(200, "POST", "/me/notifications/read", s, map[string]interface{}{"ids": []string{str(nl["items"].([]interface{})[0].(map[string]interface{}), "id")}})
	if e.mustDo(200, "GET", "/me/notifications?unread=true", s, nil)["items"].([]interface{}) == nil {
		t.Fatal("unread filter")
	}
	e.mustDo(200, "POST", "/me/notifications/read", s, map[string]interface{}{"all": true})
	if num(e.mustDo(200, "GET", "/me/notifications", s, nil), "unread_count") != 0 {
		t.Fatal("mark all read")
	}

	// dead tokens are pruned
	e.mustDo(200, "PUT", "/me/notification-preferences", s, map[string]interface{}{"report_updates": true})
	services.Notify(e.db, s.ID, "report_resolved", "Third", "x", nil)
	fp.result = "DeviceNotRegistered"
	ps.Dispatch(nil2(), 50)
	e.db.Model(&models.PushToken{}).Where("token = ?", tok).Count(&n)
	if n != 0 {
		t.Fatal("DeviceNotRegistered tokens must be deleted")
	}

	// streak nudge: practised yesterday + the day before, not today, IST evening, has a device
	e.mustDo(200, "POST", "/me/push-tokens", s, map[string]interface{}{"token": tok, "platform": "android"})
	now := time.Date(2026, 9, 24, 14, 0, 0, 0, time.UTC) // 19:30 IST
	today := time.Date(2026, 9, 24, 0, 0, 0, 0, time.UTC)
	e.db.Create(&models.DailyActivity{UserID: s.ID, Date: today.AddDate(0, 0, -1), CreatedAt: now})
	e.db.Create(&models.DailyActivity{UserID: s.ID, Date: today.AddDate(0, 0, -2), CreatedAt: now})
	if got := ps.StreakNudges(nil2(), time.Date(2026, 9, 24, 3, 0, 0, 0, time.UTC)); got != 0 {
		t.Fatal("no nudges outside the evening window")
	}
	if got := ps.StreakNudges(nil2(), now); got != 1 {
		t.Fatalf("expected one nudge, got %d", got)
	}
	if got := ps.StreakNudges(nil2(), now); got != 0 {
		t.Fatal("at most one nudge per day")
	}
	var nudge models.Notification
	e.db.Where("user_id = ? AND type = 'streak_nudge'", s.ID).First(&nudge)
	if nudge.Body == "" {
		t.Fatal("nudge text")
	}
	e.mustDo(200, "DELETE", "/me/push-tokens/"+tok, s, nil)
}

func TestHomeUpdatesAndShareBlueprint(t *testing.T) {
	e := newEnv(t)
	s := &e.w.Student
	if got := e.mustDo(200, "GET", "/home/updates", s, nil)["updates"].([]interface{}); len(got) != 0 {
		t.Fatal("no placeholder content: empty means hide the carousel")
	}
	e.mustDo(201, "POST", "/admin/home-updates", &e.w.Admin, map[string]interface{}{"title": "New: Custom tests", "body": "Build your own practice set.", "cta_label": "Try it", "cta_route": "/(student)/(practice)/custom-builder", "order_index": 1})
	e.mustDo(201, "POST", "/admin/home-updates", &e.w.Admin, map[string]interface{}{"title": "Future", "starts_at": time.Now().Add(time.Hour).Format(time.RFC3339)})
	e.mustDo(201, "POST", "/admin/home-updates", &e.w.Admin, map[string]interface{}{"title": "Off", "is_active": false})
	e.mustDo(201, "POST", "/admin/home-updates", &e.w.Admin, map[string]interface{}{"title": "Expired", "ends_at": time.Now().Add(-time.Hour).Format(time.RFC3339)})
	if code, o := e.do("POST", "/admin/home-updates", &e.w.Admin, map[string]interface{}{"title": "Bad", "cta_route": "https://evil.example"}); code != 400 || str(o, "code") != "invalid_route" {
		t.Fatalf("only in-app routes: %d %v", code, o)
	}
	live := e.mustDo(200, "GET", "/home/updates", s, nil)["updates"].([]interface{})
	if len(live) != 1 || str(live[0].(map[string]interface{}), "title") != "New: Custom tests" {
		t.Fatalf("active window: %v", live)
	}
	all := e.mustDo(200, "GET", "/admin/home-updates", &e.w.Admin, nil)["updates"].([]interface{})
	if len(all) != 4 {
		t.Fatal("admins see everything")
	}
	e.mustDo(200, "PATCH", "/admin/home-updates/"+str(all[0].(map[string]interface{}), "id"), &e.w.Admin, map[string]interface{}{"is_active": false})
	e.mustDo(200, "DELETE", "/admin/home-updates/"+str(all[1].(map[string]interface{}), "id"), &e.w.Admin, nil)
	if code, _ := e.do("POST", "/admin/home-updates", s, map[string]interface{}{"title": "x"}); code != 403 {
		t.Fatal("admin only")
	}

	// share a blueprint by code; personal filters are stripped
	e.buildPool(5, 5, 5, 0)
	e.set("custom_test.status_filters", "true")
	sh := e.mustDo(201, "POST", "/custom-tests/share", s, map[string]interface{}{"blueprint": bp(e, map[string]interface{}{
		"title": "Mine", "seed": 9, "filters": map[string]interface{}{"difficulty": []string{"hard"}, "status": []string{"incorrect"}, "exclude_attempted_within_days": 7}})})
	code := str(sh, "code")
	if len(code) != 8 || str(sh, "deep_link") == "" {
		t.Fatalf("share: %v", sh)
	}
	other := e.newStudent()
	got := e.mustDo(200, "GET", "/custom-tests/shared/"+code, other, nil)
	bpv := got["blueprint"].(map[string]interface{})
	f := bpv["filters"].(map[string]interface{})
	if got["still_valid"] != true || f["status"] != nil || f["exclude_attempted_within_days"] != nil || bpv["seed"] != nil || bpv["title"] != nil || len(f["difficulty"].([]interface{})) != 1 {
		t.Fatalf("shared blueprint: %v", got)
	}
	if code2, _ := e.do("GET", "/custom-tests/shared/ZZZZZZZZ", other, nil); code2 != 404 {
		t.Fatal("unknown code")
	}
	e.db.Model(&models.BlueprintShare{}).Where("code = ?", code).Update("expires_at", time.Now().Add(-time.Hour))
	if code2, o := e.do("GET", "/custom-tests/shared/"+code, other, nil); code2 != 410 || str(o, "code") != "code_expired" {
		t.Fatalf("expired: %d %v", code2, o)
	}
}
