package router_test

import (
	"archive/zip"
	"bytes"
	"strings"
	"testing"

	"codon-backend/internal/media"
	"codon-backend/internal/models"
	"codon-backend/internal/services"
)

func zipOf(files map[string][]byte) []byte {
	var b bytes.Buffer
	zw := zip.NewWriter(&b)
	for name, data := range files {
		w, _ := zw.Create(name)
		w.Write(data)
	}
	zw.Close()
	return b.Bytes()
}

// runImport executes the queued import job synchronously (as the worker would).
func (e *env) runImport(batchID string) models.CSVImportBatch {
	e.t.Helper()
	svc := services.NewCSVImportService(e.db)
	svc.Images = media.NewService(e.db)
	svc.QS.RefSaver = media.QuestionRefSaver
	var job models.BackgroundJob
	e.db.Where("type = ? AND payload::text LIKE ?", "csv_import", "%"+batchID+"%").First(&job)
	if job.ID.String() == "00000000-0000-0000-0000-000000000000" {
		e.t.Fatalf("no job queued for batch %s", batchID)
	}
	if err := svc.HandleCSVImport(nil2(), job.Payload); err != nil {
		e.t.Fatalf("job: %v", err)
	}
	var b models.CSVImportBatch
	e.db.First(&b, "id = ?", batchID)
	return b
}

func (e *env) importReq(testID string, body map[string]interface{}) string {
	e.t.Helper()
	return str(e.mustDo(202, "POST", "/teacher/tests/"+testID+"/csv-import", &e.w.Teacher, body), "batch_id")
}

func (e *env) key(kind, name string) string { return kind + "/" + e.w.Teacher.ID.String() + "/" + name }

func TestCSVv1LegacyImportStaysPlainText(t *testing.T) {
	e := newEnv(t)
	testID := e.createTest("qbank", nil)
	csv := "question_text,option_a,option_b,option_c,option_d,correct_option,explanation\n" +
		"Costs $5 and *x*?,a,b,c,d,b,why\n" +
		"Bad key,a,b,c,d,Z,\n" +
		",a,b,c,d,A,\n"
	k := e.key("csv", "v1.csv")
	e.mem.Put(k, "text/csv", []byte(csv))
	b := e.runImport(e.importReq(testID, map[string]interface{}{"file_key": k}))
	if b.SuccessRows != 1 || b.ErrorRows != 2 || b.Status != models.ImportCompletedWithErrors || b.TemplateVersion != 1 {
		t.Fatalf("batch: %+v", b)
	}
	var qs []models.Question
	e.db.Where("test_id = ?", testID).Find(&qs)
	if len(qs) != 1 || qs[0].ContentFormat != "plain" || qs[0].QuestionText != "Costs $5 and *x*?" {
		t.Fatalf("v1 rows must stay plain text: %+v", qs)
	}
	var tq int64
	e.db.Model(&models.TestQuestion{}).Where("test_id = ?", testID).Count(&tq)
	var test models.Test
	e.db.First(&test, "id = ?", testID)
	if tq != 1 || test.TotalQuestions != 1 {
		t.Fatalf("join=%d total=%d", tq, test.TotalQuestions)
	}
	det := e.mustDo(200, "GET", "/teacher/csv-imports/"+b.ID.String(), &e.w.Teacher, nil)
	errs := det["errors"].([]interface{})
	codes := map[string]bool{}
	for _, x := range errs {
		codes[str(x.(map[string]interface{}), "code")] = true
	}
	if !codes["BAD_ENUM"] || !codes["MISSING_FIELD"] {
		t.Fatalf("row error codes: %v", codes)
	}
}

func TestCSVv2ZipPreflightThenCommit(t *testing.T) {
	e := newEnv(t)
	testID := e.createTest("qbank", nil)
	img := pngBytes(64, 48, false)
	csv := "question_text,option_a,option_b,option_c,option_d,correct_option,explanation,difficulty,tags,ncert_page,question_image,question_image_alt,option_a_image\n" +
		"Identify the organelle,x,y,z,w,B,because,medium,cell|organelle,44,cell.png,A cell,opt.png\n" +
		"Missing image row,x,y,z,w,A,,easy,,,ghost.png,,\n" +
		"Plain **bold** one,x,y,z,w,C,,hard,,,,,\n"
	zipKey := e.key("import_bundle", "b.zip")
	e.mem.Put(zipKey, "application/zip", zipOf(map[string][]byte{"questions.csv": []byte(csv), "images/cell.png": img, "images/opt.png": pngBytes(30, 30, false), "images/unused.png": img}))

	// preflight: nothing is inserted, problems are itemised
	v := e.runImport(e.importReq(testID, map[string]interface{}{"bundle_key": zipKey, "mode": "validate"}))
	if v.Applied || v.SuccessRows != 2 || v.ErrorRows != 1 {
		t.Fatalf("validate batch: %+v", v)
	}
	var n int64
	e.db.Model(&models.Question{}).Where("test_id = ?", testID).Count(&n)
	var assets int64
	e.db.Model(&models.MediaAsset{}).Count(&assets)
	if n != 0 || assets != 0 {
		t.Fatalf("validate must not write anything: %d questions, %d assets", n, assets)
	}
	det := e.mustDo(200, "GET", "/teacher/csv-imports/"+v.ID.String(), &e.w.Teacher, nil)
	sum := det["batch"].(map[string]interface{})["summary"].(map[string]interface{})
	if miss := sum["images_missing"].([]interface{}); len(miss) != 1 || miss[0] != "ghost.png" {
		t.Fatalf("missing images must be listed by name: %v", sum)
	}
	if un := sum["unreferenced_images"].([]interface{}); len(un) != 1 || un[0] != "unused.png" {
		t.Fatalf("unused images: %v", sum)
	}

	// commit is a new child batch; replaying returns the same one (idempotent)
	c1 := e.mustDo(202, "POST", "/teacher/csv-imports/"+v.ID.String()+"/commit", &e.w.Teacher, nil)
	c2 := e.mustDo(202, "POST", "/teacher/csv-imports/"+v.ID.String()+"/commit", &e.w.Teacher, nil)
	if str(c1, "batch_id") != str(c2, "batch_id") {
		t.Fatal("commit must be idempotent")
	}
	c := e.runImport(str(c1, "batch_id"))
	if !c.Applied || c.SuccessRows != 2 || c.ErrorRows != 1 {
		t.Fatalf("commit batch: %+v", c)
	}
	var qs []models.Question
	e.db.Where("test_id = ?", testID).Order("order_index").Find(&qs)
	if len(qs) != 2 || qs[0].ContentFormat != "rich_v1" || !strings.Contains(qs[0].QuestionText, "![A cell](media:") || !strings.Contains(qs[0].OptionA, "![](media:") {
		t.Fatalf("questions: %+v", qs)
	}
	if qs[0].Difficulty == nil || *qs[0].Difficulty != "medium" || qs[0].NCERTPage == nil || *qs[0].NCERTPage != 44 {
		t.Fatalf("metadata: %+v", qs[0])
	}
	e.db.Model(&models.MediaAsset{}).Where("owner_id = ? AND status = 'ready'", e.w.Teacher.ID).Count(&assets)
	var refs int64
	e.db.Model(&models.MediaRef{}).Where("owner_type = 'question'").Count(&refs)
	if assets != 2 || refs != 2 {
		t.Fatalf("assets=%d refs=%d (unused.png must not be created)", assets, refs)
	}
	var tags int64
	e.db.Model(&models.QuestionTag{}).Where("question_id = ?", qs[0].ID).Count(&tags)
	if tags != 2 {
		t.Fatalf("tags: %d", tags)
	}
}

func TestCSVCommitRefusesChangedFile(t *testing.T) {
	e := newEnv(t)
	testID := e.createTest("qbank", nil)
	k := e.key("csv", "f.csv")
	head := "question_text,option_a,option_b,option_c,option_d,correct_option,difficulty\n"
	e.mem.Put(k, "text/csv", []byte(head+"Q one,a,b,c,d,A,easy\n"))
	v := e.runImport(e.importReq(testID, map[string]interface{}{"file_key": k, "mode": "validate"}))
	e.mem.Put(k, "text/csv", []byte(head+"Q one edited after validation,a,b,c,d,A,easy\n"))
	c := e.mustDo(202, "POST", "/teacher/csv-imports/"+v.ID.String()+"/commit", &e.w.Teacher, nil)
	b := e.runImport(str(c, "batch_id"))
	if b.Status != models.ImportFailed {
		t.Fatalf("a file that changed since validation must not commit: %+v", b)
	}
	var n int64
	e.db.Model(&models.Question{}).Where("test_id = ?", testID).Count(&n)
	if n != 0 {
		t.Fatal("nothing may be inserted")
	}
}

func TestCSVUpdateModeBackfillsMetadataOnly(t *testing.T) {
	e := newEnv(t)
	testID := e.createTest("qbank", nil)
	q1 := e.mustDo(201, "POST", "/teacher/tests/"+testID+"/questions", &e.w.Teacher, q("Original text one", nil))
	k := e.key("csv", "u.csv")
	e.mem.Put(k, "text/csv", []byte("question_id,difficulty,ncert_page,tags,question_text\n"+str(q1, "id")+",hard,77,backfill,SHOULD NOT CHANGE\n"+"11111111-1111-1111-1111-111111111111,easy,,,\n"))
	b := e.runImport(e.importReq(testID, map[string]interface{}{"file_key": k, "mode": "update"}))
	if b.SuccessRows != 1 || b.ErrorRows != 1 {
		t.Fatalf("update batch: %+v", b)
	}
	var got models.Question
	e.db.First(&got, "id = ?", str(q1, "id"))
	if got.QuestionText != "Original text one" || got.Difficulty == nil || *got.Difficulty != "hard" || *got.NCERTPage != 77 {
		t.Fatalf("metadata only: %+v", got)
	}
}

func TestCSVRejectsMaliciousZipAndForeignFiles(t *testing.T) {
	e := newEnv(t)
	testID := e.createTest("qbank", nil)
	evil := e.key("import_bundle", "evil.zip")
	e.mem.Put(evil, "application/zip", zipOf(map[string][]byte{"../../etc/passwd.png": []byte("x"), "questions.csv": []byte("question_text\n")}))
	b := e.runImport(e.importReq(testID, map[string]interface{}{"bundle_key": evil, "mode": "validate"}))
	if b.Status != models.ImportFailed {
		t.Fatalf("zip-slip bundle must fail: %+v", b)
	}
	// a file key that isn't under the caller's own prefix is refused (no reading others' uploads)
	code, out := e.do("POST", "/teacher/tests/"+testID+"/csv-import", &e.w.Teacher, map[string]interface{}{"file_key": "csv/" + e.w.Admin.ID.String() + "/theirs.csv"})
	if code != 403 || str(out, "code") != "foreign_file" {
		t.Fatalf("foreign key: %d %v", code, out)
	}
	// another teacher can't import into my test (previously unchecked)
	other := e.w.User(t, models.RoleTeacher)
	k := "csv/" + other.ID.String() + "/x.csv"
	code, out = e.do("POST", "/teacher/tests/"+testID+"/csv-import", &other, map[string]interface{}{"file_key": k})
	if code != 404 {
		t.Fatalf("import into someone else's test: %d %v", code, out)
	}
	// template endpoint documents the columns
	tpl := e.mustDo(200, "GET", "/teacher/csv-template?version=2", &e.w.Teacher, nil)
	if num(tpl, "version") != 2 || len(tpl["columns"].([]interface{})) < 15 {
		t.Fatalf("template: %v", tpl)
	}
}
