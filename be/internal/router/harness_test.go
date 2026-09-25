package router_test

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/google/uuid"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"net/http/httptest"
	"testing"

	"codon-backend/internal/handlers"
	"codon-backend/internal/media"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/router"
	"codon-backend/internal/services"
	"codon-backend/internal/settings"
	"codon-backend/internal/storage"
	"codon-backend/internal/testutil"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type env struct {
	t   *testing.T
	db  *gorm.DB
	w   *testutil.World
	r   *gin.Engine
	mem *storage.MemBackend
	d   *router.Deps
}

func newEnv(t *testing.T) *env {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db := testutil.DB(t)
	e := &env{t: t, db: db, w: testutil.NewWorld(t, db), mem: storage.NewMem()}
	storage.Store = e.mem
	t.Cleanup(func() { storage.Store = nil })

	auth := func(c *gin.Context) {
		id := c.GetHeader("X-Test-User")
		var u models.User
		if err := db.First(&u, "id = ?", id).Error; err != nil {
			c.AbortWithStatusJSON(401, gin.H{"error": "unauthenticated"})
			return
		}
		if sid := c.GetHeader("X-Test-Session"); sid != "" {
			c.Set(middleware.ContextSession, &models.Session{ID: uuid.MustParse(sid)})
		}
		c.Set(middleware.ContextUser, &u)
		c.Set(middleware.ContextUserID, u.ID)
		c.Next()
	}
	e.d = router.NewDeps(db, auth, services.NewSubscriptionService(db), services.NewScoringService(db), func() bool { return false })
	e.r = gin.New()
	router.Register(e.r.Group("/api/v1"), e.d)
	e.r.GET("/api/v1/me/progress/breakdown", auth, handlers.NewProfileHandler(db).GetProgressBreakdown)
	wh := handlers.NewWellnessHandler(db)
	e.r.GET("/api/v1/wellness/content", auth, wh.ListWellnessContent)
	e.r.GET("/api/v1/wellness/content/:id", auth, wh.GetWellnessContent)
	e.r.POST("/api/v1/admin/wellness-content", auth, middleware.RequireRole(models.RoleAdmin), wh.CreateWellnessContent)
	e.r.PATCH("/api/v1/admin/wellness-content/:id", auth, middleware.RequireRole(models.RoleAdmin), wh.UpdateWellnessContent)
	e.r.GET("/api/v1/admin/analytics", auth, middleware.RequireRole(models.RoleAdmin), handlers.NewAdminHandler(db, nil).AnalyticsOverview)
	e.r.GET("/api/v1/admin/dashboard/summary", auth, middleware.RequireRole(models.RoleAdmin), handlers.NewAdminHandler(db, nil).DashboardSummary)
	return e
}

// do performs a request as `user` and decodes the JSON body.
func (e *env) do(method, path string, user *models.User, body interface{}) (int, map[string]interface{}) {
	e.t.Helper()
	var rd *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	} else {
		rd = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, "/api/v1"+path, rd)
	req.Header.Set("Content-Type", "application/json")
	if user != nil {
		req.Header.Set("X-Test-User", user.ID.String())
	}
	rec := httptest.NewRecorder()
	e.r.ServeHTTP(rec, req)
	var out map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, out
}

func (e *env) mustDo(want int, method, path string, user *models.User, body interface{}) map[string]interface{} {
	e.t.Helper()
	code, out := e.do(method, path, user, body)
	if code != want {
		e.t.Fatalf("%s %s → %d, want %d: %v", method, path, code, want, out)
	}
	return out
}

func (e *env) set(key, value string) {
	e.t.Helper()
	if err := settings.Default.Set(key, value, nil); err != nil {
		e.t.Fatalf("setting %s: %v", key, err)
	}
}

func str(m map[string]interface{}, path ...string) string {
	var cur interface{} = m
	for _, p := range path {
		mm, ok := cur.(map[string]interface{})
		if !ok {
			return ""
		}
		cur = mm[p]
	}
	s, _ := cur.(string)
	return s
}

func num(m map[string]interface{}, path ...string) float64 {
	var cur interface{} = m
	for _, p := range path {
		mm, ok := cur.(map[string]interface{})
		if !ok {
			return -1
		}
		cur = mm[p]
	}
	f, _ := cur.(float64)
	return f
}

// ── image helpers ─────────────────────────────────────────────────────────────

func pngBytes(w, h int, transparent bool) []byte {
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			a := uint8(255)
			if transparent && x < w/2 {
				a = 0
			}
			img.Set(x, y, color.NRGBA{uint8(x * 255 / w), uint8(y * 255 / h), 120, a})
		}
	}
	var b bytes.Buffer
	png.Encode(&b, img)
	return b.Bytes()
}

// jpegWithOrientation encodes a JPEG and splices in an EXIF APP1 segment.
func jpegWithOrientation(w, h, orientation int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{200, uint8(x), uint8(y), 255})
		}
	}
	var b bytes.Buffer
	jpeg.Encode(&b, img, nil)
	raw := b.Bytes()
	// minimal little-endian TIFF with one IFD entry (orientation)
	tiff := []byte{'I', 'I', 42, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, byte(orientation), 0, 0, 0, 0, 0, 0, 0}
	seg := append([]byte("Exif\x00\x00"), tiff...)
	l := len(seg) + 2
	app1 := append([]byte{0xFF, 0xE1, byte(l >> 8), byte(l)}, seg...)
	return append(append([]byte{}, raw[:2]...), append(app1, raw[2:]...)...)
}

// uploadImage runs presign → PUT (into the in-memory store) → complete as user.
func (e *env) uploadImage(user *models.User, purpose, mime string, data []byte) (int, map[string]interface{}) {
	e.t.Helper()
	code, pre := e.do("POST", "/media/presign", user, map[string]interface{}{
		"purpose": purpose, "file_name": "a.png", "content_type": mime, "bytes": len(data),
	})
	if code != 200 {
		return code, pre
	}
	key := str(pre, "file_key")
	e.mem.Put(key, mime, data)
	return e.do("POST", "/media/"+str(pre, "media_id")+"/complete", user, nil)
}

var _ = media.Purposes

func nil2() context.Context { return context.Background() }

func mustUUID(s string) uuid.UUID { return uuid.MustParse(s) }

// doHeader is do() with extra request headers.
func (e *env) doHeader(method, path string, user *models.User, body interface{}, headers map[string]string) (int, map[string]interface{}) {
	e.t.Helper()
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(method, "/api/v1"+path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	if user != nil {
		req.Header.Set("X-Test-User", user.ID.String())
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	e.r.ServeHTTP(rec, req)
	var out map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, out
}
