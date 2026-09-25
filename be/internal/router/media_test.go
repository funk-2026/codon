package router_test

import (
	"bytes"
	"image"
	"testing"

	"codon-backend/internal/models"
	"codon-backend/internal/storage"
	_ "image/jpeg"
	_ "image/png"
)

func decodeStored(t *testing.T, e *env, key string) image.Config {
	t.Helper()
	rc, err := e.mem.DownloadObject(nil2(), key)
	if err != nil {
		t.Fatalf("stored object %s: %v", key, err)
	}
	defer rc.Close()
	buf := new(bytes.Buffer)
	buf.ReadFrom(rc)
	cfg, _, err := image.DecodeConfig(buf)
	if err != nil {
		t.Fatalf("decode %s: %v", key, err)
	}
	return cfg
}

func TestMediaPresignRulesAndRoles(t *testing.T) {
	e := newEnv(t)
	body := map[string]interface{}{"purpose": "question_image", "file_name": "a.png", "content_type": "image/png", "bytes": 1000}
	if code, out := e.do("POST", "/media/presign", &e.w.Student, body); code != 403 || str(out, "code") != "purpose_forbidden" {
		t.Fatalf("student must not upload question images: %d %v", code, out)
	}
	if code, out := e.do("POST", "/media/presign", &e.w.Teacher, map[string]interface{}{"purpose": "nope", "content_type": "image/png", "bytes": 1}); code != 400 || str(out, "code") != "invalid_purpose" {
		t.Fatalf("unknown purpose: %d %v", code, out)
	}
	// SVG and other types are refused up-front
	if code, out := e.do("POST", "/media/presign", &e.w.Teacher, map[string]interface{}{"purpose": "question_image", "file_name": "a.svg", "content_type": "image/svg+xml", "bytes": 100}); code != 400 || str(out, "code") != "unsupported_type" {
		t.Fatalf("svg must be rejected: %d %v", code, out)
	}
	e.set("media.max_bytes", "500")
	if code, out := e.do("POST", "/media/presign", &e.w.Teacher, body); code != 400 || str(out, "code") != "too_large" {
		t.Fatalf("size cap from settings: %d %v", code, out)
	}
	e.set("media.max_bytes", "5242880")
	out := e.mustDo(200, "POST", "/media/presign", &e.w.Teacher, body)
	if str(out, "media_id") == "" || str(out, "upload_url") == "" {
		t.Fatalf("presign result: %v", out)
	}
	// students may upload note images (any role allowed for that purpose)
	e.mustDo(200, "POST", "/media/presign", &e.w.Student, map[string]interface{}{"purpose": "note_image", "file_name": "n.png", "content_type": "image/png", "bytes": 10})
	// completing before uploading is a clear conflict
	if code, o := e.do("POST", "/media/"+str(out, "media_id")+"/complete", &e.w.Teacher, nil); code != 409 || str(o, "code") != "upload_missing" {
		t.Fatalf("complete without upload: %d %v", code, o)
	}
}

func TestMediaCompleteBuildsVariantsAndStripsMetadata(t *testing.T) {
	e := newEnv(t)
	code, out := e.uploadImage(&e.w.Teacher, "question_image", "image/png", pngBytes(3000, 2000, false))
	if code != 200 {
		t.Fatalf("complete: %d %v", code, out)
	}
	m := out["media"].(map[string]interface{})
	if m["status"] != "ready" || num(m, "width") != 3000 || num(m, "height") != 2000 {
		t.Fatalf("asset: %v", m)
	}
	var a models.MediaAsset
	e.db.First(&a, "id = ?", str(m, "id"))
	if d := decodeStored(t, e, a.DisplayKey); d.Width != 1600 || d.Height < 1066 || d.Height > 1067 {
		t.Fatalf("display variant should be scaled to 1600px wide, got %dx%d", d.Width, d.Height)
	}
	if th := decodeStored(t, e, a.ThumbKey); th.Width != 400 {
		t.Fatalf("thumb width %d", th.Width)
	}
	view := out["view"].(map[string]interface{})
	if str(view, "url") == "" || str(view, "thumb_url") == "" {
		t.Fatalf("signed urls missing: %v", view)
	}

	// small images are never up-scaled; transparency is preserved (PNG stays PNG)
	_, o2 := e.uploadImage(&e.w.Teacher, "question_image", "image/png", pngBytes(200, 100, true))
	var a2 models.MediaAsset
	e.db.First(&a2, "id = ?", str(o2["media"].(map[string]interface{}), "id"))
	if d := decodeStored(t, e, a2.DisplayKey); d.Width != 200 || a2.Mime != "image/png" {
		t.Fatalf("small transparent image: %dx%d %s", d.Width, d.Height, a2.Mime)
	}
}

func TestMediaAppliesExifOrientation(t *testing.T) {
	e := newEnv(t)
	// 40 wide x 20 tall, EXIF orientation 6 (rotate 90° CW) → upright it is 20 x 40
	code, out := e.uploadImage(&e.w.Teacher, "question_image", "image/jpeg", jpegWithOrientation(40, 20, 6))
	if code != 200 {
		t.Fatalf("%d %v", code, out)
	}
	m := out["media"].(map[string]interface{})
	if num(m, "width") != 20 || num(m, "height") != 40 {
		t.Fatalf("EXIF orientation not applied: %vx%v", m["width"], m["height"])
	}
}

func TestMediaRejectsBadUploadsAndDeletesTheObject(t *testing.T) {
	e := newEnv(t)
	// a text file that claims to be a PNG (content type is never trusted)
	code, out := e.uploadImage(&e.w.Teacher, "question_image", "image/png", []byte("<script>alert(1)</script> not an image at all"))
	if code != 422 || str(out, "code") != "unsupported_type" {
		t.Fatalf("spoofed type: %d %v", code, out)
	}
	var a models.MediaAsset
	e.db.Order("created_at DESC").First(&a)
	if a.Status != models.MediaRejected || e.mem.Has(a.StorageKey) {
		t.Fatalf("rejected upload must be marked rejected and its object deleted: %+v", a)
	}
	// dimension cap
	e.set("media.max_dimension", "100")
	code, out = e.uploadImage(&e.w.Teacher, "question_image", "image/png", pngBytes(200, 50, false))
	if code != 422 || str(out, "code") != "too_large_dimensions" {
		t.Fatalf("dimension cap: %d %v", code, out)
	}
	// truncated/corrupt PNG (valid header, broken body)
	e.set("media.max_dimension", "4096")
	good := pngBytes(50, 50, false)
	code, out = e.uploadImage(&e.w.Teacher, "question_image", "image/png", good[:len(good)/2])
	if code != 422 {
		t.Fatalf("corrupt image must be rejected: %d %v", code, out)
	}
}

func TestMediaDuplicateUploadReturnsExistingAsset(t *testing.T) {
	e := newEnv(t)
	data := pngBytes(64, 64, false)
	_, o1 := e.uploadImage(&e.w.Teacher, "question_image", "image/png", data)
	_, o2 := e.uploadImage(&e.w.Teacher, "question_image", "image/png", data)
	id1, id2 := str(o1["media"].(map[string]interface{}), "id"), str(o2["media"].(map[string]interface{}), "id")
	if id1 != id2 {
		t.Fatalf("same bytes by same owner must dedupe: %s vs %s", id1, id2)
	}
	var n int64
	e.db.Model(&models.MediaAsset{}).Where("owner_id = ?", e.w.Teacher.ID).Count(&n)
	if n != 1 {
		t.Fatalf("expected a single asset row, got %d", n)
	}
	// another owner uploading the same bytes gets their own asset
	other := e.w.User(t, models.RoleTeacher)
	_, o3 := e.uploadImage(&other, "question_image", "image/png", data)
	if str(o3["media"].(map[string]interface{}), "id") == id1 {
		t.Fatal("assets must not be shared across owners")
	}
}

func TestMediaLibraryDeleteBlockedWhileReferenced(t *testing.T) {
	e := newEnv(t)
	_, out := e.uploadImage(&e.w.Teacher, "question_image", "image/png", pngBytes(32, 32, false))
	id := str(out["media"].(map[string]interface{}), "id")
	list := e.mustDo(200, "GET", "/teacher/media?unreferenced=true", &e.w.Teacher, nil)
	if len(list["items"].([]interface{})) != 1 {
		t.Fatalf("library: %v", list)
	}
	e.db.Create(&models.MediaRef{MediaID: mustUUID(id), OwnerType: "question", OwnerID: mustUUID("11111111-1111-1111-1111-111111111111"), Field: "question_text"})
	if code, o := e.do("DELETE", "/teacher/media/"+id, &e.w.Teacher, nil); code != 409 || str(o, "code") != "media_in_use" {
		t.Fatalf("delete referenced: %d %v", code, o)
	}
	e.mustDo(200, "PATCH", "/teacher/media/"+id, &e.w.Teacher, map[string]interface{}{"alt": "A nice diagram"})
	e.db.Where("media_id = ?", id).Delete(&models.MediaRef{})
	e.mustDo(200, "DELETE", "/teacher/media/"+id, &e.w.Teacher, nil)
	var a models.MediaAsset
	if e.db.First(&a, "id = ?", id).Error == nil {
		t.Fatal("asset should be gone")
	}
}

var _ = storage.ErrNotFound
