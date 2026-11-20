package router_test

import (
	"testing"

	"codon-backend/internal/models"
)

func TestSubjectVideosCompleteAndRelatedQBank(t *testing.T) {
	e := newEnv(t)
	s := &e.w.Student
	vs := models.VideoReady
	item := models.ContentItem{
		Title: "Cell lecture", CourseID: e.w.Course.ID, ContentType: models.ContentVideo, ChapterID: e.w.Chapter.ID,
		UploadedBy: e.w.Teacher.ID, FileKey: "bunny:x", Status: models.StatusPublished, VideoStatus: &vs,
	}
	if err := e.db.Create(&item).Error; err != nil {
		t.Fatal(err)
	}
	id := item.ID.String()

	list := e.mustDo(200, "GET", "/subjects/"+e.w.Subject.ID.String()+"/videos", s, nil)["videos"].([]interface{})
	if len(list) != 1 || list[0].(map[string]interface{})["is_completed"] != false || num(list[0].(map[string]interface{}), "progress_seconds") != 0 {
		t.Fatalf("unstarted lecture: %v", list)
	}

	// the player reports the length once, and progress
	e.mustDo(200, "POST", "/content/"+id+"/heartbeat", s, map[string]interface{}{"progress_seconds": 30, "duration_seconds": 600})
	e.mustDo(200, "POST", "/content/"+id+"/heartbeat", s, map[string]interface{}{"progress_seconds": 40, "duration_seconds": 999})
	list = e.mustDo(200, "GET", "/subjects/"+e.w.Subject.ID.String()+"/videos", s, nil)["videos"].([]interface{})
	row := list[0].(map[string]interface{})
	if num(row, "duration_seconds") != 600 || num(row, "progress_seconds") != 40 {
		t.Fatalf("paused at 40 of 600: %v", row)
	}

	// mark complete, then not complete
	e.mustDo(200, "POST", "/content/"+id+"/complete", s, map[string]interface{}{"completed": true})
	if c := e.mustDo(200, "GET", "/me/video-completions", s, nil)["completions"].([]interface{}); len(c) != 1 {
		t.Fatalf("one completion: %v", c)
	}
	if got := e.mustDo(200, "GET", "/content/"+id, s, nil); got["is_completed"] != true || str(got, "subject_name") == "" || str(got, "chapter_name") == "" {
		t.Fatalf("the lecture knows where it sits and that it is done: %v", got)
	}
	e.mustDo(200, "POST", "/content/"+id+"/complete", s, map[string]interface{}{"completed": false})
	if c := e.mustDo(200, "GET", "/me/video-completions", s, nil)["completions"].([]interface{}); len(c) != 0 {
		t.Fatalf("no longer complete: %v", c)
	}

	// the QBank module of the same chapter is linked by chapter id
	qb := e.w.Test(t, models.ModuleQBank, 1, true)
	e.db.Model(&models.Test{}).Where("id = ?", qb.ID).Update("chapter_id", e.w.Chapter.ID)
	if got := e.mustDo(200, "GET", "/content/"+id, s, nil); str(got, "related_qbank_test_id") != qb.ID.String() {
		t.Fatalf("related QBank: %v", got)
	}
}

func TestLectureCarriesFourPDFTypes(t *testing.T) {
	e := newEnv(t)
	tch := &e.w.Teacher
	if code, _ := e.do("POST", "/teacher/content", tch, map[string]interface{}{
		"title": "x", "course_id": e.w.Course.ID.String(), "content_type": "video", "chapter_id": e.w.Chapter.ID.String(),
		"file_key": "bunny:abc", "fourth_book_pdf_key": "kyc_document/x.pdf"}); code != 400 {
		t.Fatalf("a PDF must come from lecture_pdf uploads: %d", code)
	}
}

func TestChapterCoverAndFreeVideos(t *testing.T) {
	e := newEnv(t)
	s, a := &e.w.Student, &e.w.Admin
	vs := models.VideoReady
	free := models.ContentItem{Title: "Free lecture", CourseID: e.w.Course.ID, ContentType: models.ContentVideo, ChapterID: e.w.Chapter.ID, UploadedBy: e.w.Teacher.ID, FileKey: "bunny:y", Status: models.StatusPublished, VideoStatus: &vs}
	paid := models.ContentItem{Title: "Paid lecture", CourseID: e.w.Course.ID, ContentType: models.ContentVideo, ChapterID: e.w.Chapter.ID, UploadedBy: e.w.Teacher.ID, FileKey: "bunny:z", Status: models.StatusPublished, VideoStatus: &vs, RequiresSubscription: true}
	if err := e.db.Create(&free).Error; err != nil {
		t.Fatal(err)
	}
	if err := e.db.Create(&paid).Error; err != nil {
		t.Fatal(err)
	}
	list := e.mustDo(200, "GET", "/videos/free", s, nil)["videos"].([]interface{})
	if len(list) != 1 || str(list[0].(map[string]interface{}), "title") != "Free lecture" {
		t.Fatalf("only free lectures: %v", list)
	}
	// a bad cover id is refused; clearing is fine
	if code, _ := e.do("PATCH", "/admin/chapters/"+e.w.Chapter.ID.String(), a, map[string]interface{}{"cover_media_id": "nope"}); code != 400 {
		t.Fatalf("bad cover id: %d", code)
	}
	e.mustDo(200, "PATCH", "/admin/chapters/"+e.w.Chapter.ID.String(), a, map[string]interface{}{"cover_media_id": ""})
	out := e.mustDo(200, "GET", "/subjects/"+e.w.Subject.ID.String()+"/videos", s, nil)
	if _, ok := out["covers"]; !ok {
		t.Fatalf("covers map present: %v", out)
	}
}
