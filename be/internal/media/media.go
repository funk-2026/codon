// Package media is the image pipeline behind rich content: presigned uploads,
// server-side validation (never trusting the client), variant generation,
// reference tracking and batched URL resolution.
package media

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"codon-backend/internal/models"
	"codon-backend/internal/richtext"
	"codon-backend/internal/services"
	"codon-backend/internal/settings"
	"codon-backend/internal/storage"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Purpose describes what an upload is for and who may make it.
type Purpose struct {
	Name  string
	Roles []models.UserRole // empty = any authenticated user
	Zip   bool              // import bundle (not a media asset)
}

var Purposes = map[string]Purpose{
	"question_image":    {Name: "question_image", Roles: []models.UserRole{models.RoleTeacher, models.RoleAdmin}},
	"explanation_image": {Name: "explanation_image", Roles: []models.UserRole{models.RoleTeacher, models.RoleAdmin}},
	"brain_hack_image":  {Name: "brain_hack_image", Roles: []models.UserRole{models.RoleTeacher, models.RoleAdmin}},
	"wellness_image":    {Name: "wellness_image", Roles: []models.UserRole{models.RoleAdmin}},
	"flashcard_image":   {Name: "flashcard_image", Roles: []models.UserRole{models.RoleTeacher, models.RoleAdmin}},
	"home_update_image": {Name: "home_update_image", Roles: []models.UserRole{models.RoleAdmin}},
	"note_image":        {Name: "note_image"},
	"import_bundle":     {Name: "import_bundle", Roles: []models.UserRole{models.RoleTeacher, models.RoleAdmin}, Zip: true},
}

// ownerPurposes: which purposes each kind of content may reference.
var ownerPurposes = map[string][]string{
	"question":   {"question_image", "explanation_image"},
	"brain_hack": {"brain_hack_image"},
	"wellness":   {"wellness_image"},
	"flashcard":  {"flashcard_image"},
	"note":       {"note_image"},
}

func allowedRole(p Purpose, role models.UserRole) bool {
	if len(p.Roles) == 0 || role == models.RoleAdmin {
		return true
	}
	for _, r := range p.Roles {
		if r == role {
			return true
		}
	}
	return false
}

type Service struct{ DB *gorm.DB }

func NewService(db *gorm.DB) *Service { return &Service{DB: db} }

var ErrNoStorage = services.Coded(http.StatusServiceUnavailable, "storage_unavailable", "file storage is not configured")

// ── Presign ───────────────────────────────────────────────────────────────────

type PresignRequest struct {
	Purpose     string `json:"purpose"`
	FileName    string `json:"file_name"`
	ContentType string `json:"content_type"`
	Bytes       int64  `json:"bytes"`
	SHA256      string `json:"sha256"`
}

type PresignResult struct {
	MediaID   *uuid.UUID        `json:"media_id,omitempty"`
	FileKey   string            `json:"file_key"`
	UploadURL string            `json:"upload_url"`
	Headers   map[string]string `json:"headers"`
	ExpiresIn int               `json:"expires_in"`
}

var mimeExt = map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/zip": ".zip"}

func (s *Service) Presign(ctx context.Context, user *models.User, req PresignRequest) (*PresignResult, error) {
	p, ok := Purposes[req.Purpose]
	if !ok {
		return nil, services.Coded(http.StatusBadRequest, "invalid_purpose", "unknown upload purpose")
	}
	if !allowedRole(p, user.Role) {
		return nil, services.Forbidden("purpose_forbidden", "your role can't upload this kind of file")
	}
	if storage.Store == nil {
		return nil, ErrNoStorage
	}
	if req.Bytes <= 0 {
		return nil, services.Coded(http.StatusBadRequest, "invalid_size", "bytes must be > 0")
	}

	expiry := 15 * time.Minute
	if p.Zip {
		if req.ContentType != "application/zip" && req.ContentType != "application/x-zip-compressed" {
			return nil, services.Coded(http.StatusBadRequest, "unsupported_type", "bundle must be a zip file")
		}
		if req.Bytes > settings.Int64("import.max_bundle_bytes") {
			return nil, services.Coded(http.StatusBadRequest, "too_large", "bundle is too large")
		}
		key := strings.ToLower(fmt.Sprintf("import_bundle/%s/%s.zip", user.ID, uuid.NewString()))
		url, err := storage.Store.PresignPutSized(ctx, key, req.ContentType, req.Bytes, expiry)
		if err != nil {
			return nil, err
		}
		return &PresignResult{FileKey: key, UploadURL: url, Headers: map[string]string{"Content-Type": req.ContentType}, ExpiresIn: int(expiry.Seconds())}, nil
	}

	allowed := settings.List("media.allowed_mimes")
	okMime := false
	for _, m := range allowed {
		if m == req.ContentType {
			okMime = true
		}
	}
	if !okMime {
		return nil, services.Coded(http.StatusBadRequest, "unsupported_type", "only JPEG, PNG or WebP images are allowed")
	}
	if req.Bytes > settings.Int64("media.max_bytes") {
		return nil, services.Coded(http.StatusBadRequest, "too_large",
			fmt.Sprintf("image must be at most %d bytes", settings.Int64("media.max_bytes")))
	}

	// Rate limit + quota (against pending + ready uploads).
	var recent int64
	s.DB.WithContext(ctx).Model(&models.MediaAsset{}).
		Where("owner_id = ? AND created_at > ?", user.ID, time.Now().Add(-time.Hour)).Count(&recent)
	if int(recent) >= settings.Int("media.presign_rate_per_hour") {
		return nil, services.Coded(http.StatusTooManyRequests, "rate_limited", "too many uploads — try again later")
	}
	var used int64
	s.DB.WithContext(ctx).Model(&models.MediaAsset{}).
		Where("owner_id = ? AND status <> ?", user.ID, models.MediaRejected).Select("COALESCE(SUM(bytes),0)").Scan(&used)
	if used+req.Bytes > settings.Int64("media.teacher_quota_bytes") {
		return nil, services.Forbidden("quota_exceeded", "storage quota exceeded")
	}

	ext := mimeExt[req.ContentType]
	if ext == "" {
		ext = strings.ToLower(filepath.Ext(req.FileName))
	}
	id := uuid.New()
	key := strings.ToLower(fmt.Sprintf("media/%s/%s/%s%s", req.Purpose, user.ID, id, ext))
	asset := models.MediaAsset{
		ID: id, OwnerID: user.ID, Purpose: req.Purpose, StorageKey: key, FileName: req.FileName,
		DeclaredMime: req.ContentType, DeclaredBytes: req.Bytes, Status: models.MediaPending, Source: "upload",
	}
	if err := s.DB.WithContext(ctx).Create(&asset).Error; err != nil {
		return nil, err
	}
	url, err := storage.Store.PresignPutSized(ctx, key, req.ContentType, req.Bytes, expiry)
	if err != nil {
		return nil, err
	}
	return &PresignResult{MediaID: &id, FileKey: key, UploadURL: url,
		Headers: map[string]string{"Content-Type": req.ContentType}, ExpiresIn: int(expiry.Seconds())}, nil
}

// ── Complete (validate + process) ─────────────────────────────────────────────

func reject(s *Service, ctx context.Context, a *models.MediaAsset, code, msg string) error {
	if storage.Store != nil {
		_ = storage.Store.DeleteObject(ctx, a.StorageKey)
	}
	s.DB.WithContext(ctx).Model(a).Updates(map[string]interface{}{"status": models.MediaRejected, "reject_reason": code})
	return services.Coded(http.StatusUnprocessableEntity, code, msg)
}

// Complete verifies the uploaded bytes and produces the display/thumb variants.
func (s *Service) Complete(ctx context.Context, user *models.User, id uuid.UUID) (*models.MediaAsset, error) {
	var a models.MediaAsset
	if err := s.DB.WithContext(ctx).First(&a, "id = ?", id).Error; err != nil || (a.OwnerID != user.ID && user.Role != models.RoleAdmin) {
		return nil, services.NotFound("media_not_found", "media not found")
	}
	switch a.Status {
	case models.MediaReady:
		return &a, nil
	case models.MediaRejected:
		return nil, services.Coded(http.StatusUnprocessableEntity, a.RejectReason, "this upload was rejected")
	}
	if storage.Store == nil {
		return nil, ErrNoStorage
	}
	info, err := storage.Store.HeadObject(ctx, a.StorageKey)
	if err != nil {
		return nil, services.Conflict("upload_missing", "the file has not been uploaded yet")
	}
	max := settings.Int64("media.max_bytes")
	if info.Size > max {
		return nil, reject(s, ctx, &a, "too_large", "image is larger than the allowed size")
	}
	rc, err := storage.Store.DownloadObject(ctx, a.StorageKey)
	if err != nil {
		return nil, services.Conflict("upload_missing", "the file has not been uploaded yet")
	}
	buf := new(bytes.Buffer)
	_, err = buf.ReadFrom(http.MaxBytesReader(nil, rc, max+1))
	rc.Close()
	if err != nil || int64(buf.Len()) > max {
		return nil, reject(s, ctx, &a, "too_large", "image is larger than the allowed size")
	}
	return s.processBytes(ctx, &a, buf.Bytes())
}

// processBytes validates raw bytes and (re)builds variants for the asset.
func (s *Service) processBytes(ctx context.Context, a *models.MediaAsset, data []byte) (*models.MediaAsset, error) {
	sniffed := http.DetectContentType(data)
	okMime := false
	for _, m := range settings.List("media.allowed_mimes") {
		if m == sniffed {
			okMime = true
		}
	}
	if !okMime {
		return nil, reject(s, ctx, a, "unsupported_type", "file is not a JPEG, PNG or WebP image")
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, reject(s, ctx, a, "corrupt_image", "image could not be read")
	}
	maxDim := settings.Int("media.max_dimension")
	if cfg.Width > maxDim || cfg.Height > maxDim || cfg.Width*cfg.Height > 24_000_000 {
		return nil, reject(s, ctx, a, "too_large_dimensions", fmt.Sprintf("image must be at most %d px on its longest side", maxDim))
	}
	sum := sha256.Sum256(data)
	hash := hex.EncodeToString(sum[:])

	// Duplicate of an already-ready upload by the same owner → reuse it.
	var dup models.MediaAsset
	if err := s.DB.WithContext(ctx).Where("owner_id = ? AND sha256 = ? AND status = ? AND id <> ?", a.OwnerID, hash, models.MediaReady, a.ID).
		First(&dup).Error; err == nil {
		_ = storage.Store.DeleteObject(ctx, a.StorageKey)
		s.DB.WithContext(ctx).Delete(a)
		return &dup, nil
	}

	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, reject(s, ctx, a, "corrupt_image", "image could not be decoded")
	}
	if sniffed == "image/jpeg" {
		img = applyOrientation(img, jpegOrientation(data))
	}
	alpha := hasAlpha(img)
	display := fit(img, 1600)
	thumb := fit(img, 400)
	dBytes, dMime, dExt, err := encode(display, alpha)
	if err != nil {
		return nil, reject(s, ctx, a, "corrupt_image", "image could not be processed")
	}
	tBytes, _, tExt, err := encode(thumb, alpha)
	if err != nil {
		return nil, reject(s, ctx, a, "corrupt_image", "image could not be processed")
	}
	base := strings.TrimSuffix(a.StorageKey, filepath.Ext(a.StorageKey))
	dKey, tKey := base+".display."+dExt, base+".thumb."+tExt
	if err := storage.Store.PutObject(ctx, dKey, dMime, dBytes); err != nil {
		return nil, err
	}
	if err := storage.Store.PutObject(ctx, tKey, dMime, tBytes); err != nil {
		return nil, err
	}
	b := display.Bounds()
	now := time.Now()
	oriented := img.Bounds()
	updates := map[string]interface{}{
		"status": models.MediaReady, "mime": dMime, "bytes": int64(len(data)), "sha256": hash,
		"width": oriented.Dx(), "height": oriented.Dy(), "display_key": dKey, "thumb_key": tKey,
		"ready_at": now, "reject_reason": "",
	}
	_ = b
	if err := s.DB.WithContext(ctx).Model(a).Updates(updates).Error; err != nil {
		return nil, err
	}
	s.DB.WithContext(ctx).First(a, "id = ?", a.ID)
	return a, nil
}

// HandleProcessJob re-runs processing for an asset stuck in "processing".
func (s *Service) HandleProcessJob(ctx context.Context, payload string) error {
	var id uuid.UUID
	if err := parseJSONID(payload, &id); err != nil {
		return err
	}
	var a models.MediaAsset
	if err := s.DB.WithContext(ctx).First(&a, "id = ?", id).Error; err != nil {
		return nil
	}
	if a.Status != models.MediaProcessing && a.Status != models.MediaPending {
		return nil
	}
	if storage.Store == nil {
		return ErrNoStorage
	}
	rc, err := storage.Store.DownloadObject(ctx, a.StorageKey)
	if err != nil {
		return err
	}
	defer rc.Close()
	buf := new(bytes.Buffer)
	buf.ReadFrom(rc)
	_, err = s.processBytes(ctx, &a, buf.Bytes())
	return err
}

// ── Resolution ────────────────────────────────────────────────────────────────

// View is the client-facing shape of a media asset.
type View struct {
	ID       string `json:"id"`
	URL      string `json:"url"`
	ThumbURL string `json:"thumb_url"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Alt      string `json:"alt"`
}

// Collector gathers media ids referenced by rich-text values so a whole
// response can be resolved with ONE query.
type Collector struct{ ids map[uuid.UUID]bool }

func NewCollector() *Collector { return &Collector{ids: map[uuid.UUID]bool{}} }

// Add extracts refs from rich_v1 values (plain values never reference media).
func (c *Collector) Add(format string, texts ...*string) {
	for _, t := range texts {
		if t == nil {
			continue
		}
		for _, id := range richtext.ExtractMediaRefs(format, *t) {
			c.ids[id] = true
		}
	}
}

// AddID registers a media id referenced directly (e.g. a cover image column).
func (c *Collector) AddID(id *uuid.UUID) {
	if id != nil {
		c.ids[*id] = true
	}
}

func (c *Collector) IDs() []uuid.UUID {
	out := make([]uuid.UUID, 0, len(c.ids))
	for id := range c.ids {
		out = append(out, id)
	}
	return out
}

// URLTTL returns the presigned-URL lifetime: long enough to cover a whole test.
func URLTTL(testDurationMinutes *int) time.Duration {
	ttl := time.Duration(settings.Int("media.url_ttl_minutes")) * time.Minute
	if testDurationMinutes != nil && *testDurationMinutes > 0 {
		if t := time.Duration(*testDurationMinutes+30) * time.Minute; t > ttl {
			ttl = t
		}
	}
	return ttl
}

// Resolve batches ids → signed views. Unknown / not-ready ids are omitted.
func (s *Service) Resolve(ctx context.Context, ids []uuid.UUID, ttl time.Duration) map[string]View {
	out := map[string]View{}
	if len(ids) == 0 {
		return out
	}
	var assets []models.MediaAsset
	s.DB.WithContext(ctx).Where("id IN ? AND status = ?", ids, models.MediaReady).Find(&assets)
	for _, a := range assets {
		v := View{ID: a.ID.String(), Width: a.Width, Height: a.Height, Alt: a.AltText}
		if storage.Store != nil {
			v.URL, _ = storage.Store.PresignGet(ctx, a.DisplayKey, ttl)
			v.ThumbURL, _ = storage.Store.PresignGet(ctx, a.ThumbKey, ttl)
		}
		out[v.ID] = v
	}
	return out
}

func (s *Service) ResolveCollector(ctx context.Context, c *Collector, ttl time.Duration) map[string]View {
	return s.Resolve(ctx, c.IDs(), ttl)
}

// ── Reference validation ──────────────────────────────────────────────────────

// Field is one rich-text field of an owner, for validation.
type Field struct {
	Name string
	Text string
	Kind string // "stem" | "option" | "explanation"
}

// SaveRefs validates every field against the rich-text grammar and length
// limits, checks every referenced media asset (exists, ready, owned by the
// author or the author may manage all content, compatible purpose), and
// replaces the owner's media_refs set — all inside tx.
func SaveRefs(ctx context.Context, tx *gorm.DB, actor *models.User, ownerType string, ownerID uuid.UUID, format string, fields []Field) error {
	limits := func(kind string) richtext.Limits {
		switch kind {
		case "option":
			return richtext.Limits{MaxChars: settings.Int("richtext.max_option_chars"), MaxImages: settings.Int("media.max_images_per_field")}
		case "explanation":
			return richtext.Limits{MaxChars: settings.Int("richtext.max_explanation_chars"), MaxImages: settings.Int("media.max_images_per_field")}
		default:
			return richtext.Limits{MaxChars: settings.Int("richtext.max_stem_chars"), MaxImages: settings.Int("media.max_images_per_field")}
		}
	}
	type fieldIssue struct {
		Field string `json:"field"`
		Code  string `json:"code"`
		Msg   string `json:"message"`
	}
	var issues []fieldIssue
	total := 0
	refField := map[uuid.UUID][]string{}
	for _, f := range fields {
		for _, is := range richtext.Validate(f.Text, format, limits(f.Kind)) {
			issues = append(issues, fieldIssue{f.Name, is.Code, is.Message})
		}
		total += richtext.CountImages(f.Text)
		for _, id := range richtext.ExtractMediaRefs(format, f.Text) {
			refField[id] = append(refField[id], f.Name)
		}
	}
	if format == richtext.FormatRichV1 && total > settings.Int("media.max_images_per_question") {
		issues = append(issues, fieldIssue{"", "TOO_MANY_IMAGES",
			fmt.Sprintf("at most %d images per item", settings.Int("media.max_images_per_question"))})
	}
	if len(issues) > 0 {
		return services.Invalid("invalid_content", "content is not valid", issues)
	}

	type refIssue struct {
		Field  string `json:"field"`
		ID     string `json:"id"`
		Reason string `json:"reason"`
	}
	var bad []refIssue
	ids := make([]uuid.UUID, 0, len(refField))
	for id := range refField {
		ids = append(ids, id)
	}
	found := map[uuid.UUID]models.MediaAsset{}
	if len(ids) > 0 {
		var assets []models.MediaAsset
		tx.WithContext(ctx).Where("id IN ?", ids).Find(&assets)
		for _, a := range assets {
			found[a.ID] = a
		}
	}
	manageAll := actor != nil && (actor.Role == models.RoleAdmin || actor.CanManageAllContent)
	allowedP := ownerPurposes[ownerType]
	for _, id := range ids {
		a, ok := found[id]
		reason := ""
		switch {
		case !ok:
			reason = "not_found"
		case a.Status != models.MediaReady:
			reason = "not_ready"
		case !manageAll && (actor == nil || a.OwnerID != actor.ID):
			reason = "not_owned"
		case len(allowedP) > 0 && !contains(allowedP, a.Purpose):
			reason = "wrong_purpose"
		}
		if reason != "" {
			for _, fn := range refField[id] {
				bad = append(bad, refIssue{fn, id.String(), reason})
			}
		}
	}
	if len(bad) > 0 {
		return services.Invalid("invalid_media_ref", "some images can't be used", bad)
	}

	if err := tx.WithContext(ctx).Where("owner_type = ? AND owner_id = ?", ownerType, ownerID).Delete(&models.MediaRef{}).Error; err != nil {
		return err
	}
	for id, fs := range refField {
		for _, fn := range uniq(fs) {
			if err := tx.WithContext(ctx).Create(&models.MediaRef{MediaID: id, OwnerType: ownerType, OwnerID: ownerID, Field: fn}).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

// DeleteRefs drops an owner's media references (call when the owner is deleted).
func DeleteRefs(tx *gorm.DB, ownerType string, ownerID uuid.UUID) error {
	return tx.Where("owner_type = ? AND owner_id = ?", ownerType, ownerID).Delete(&models.MediaRef{}).Error
}

// GCOrphans deletes never-completed uploads (>24h) and ready assets that
// nothing references (>7d). Returns the number of assets removed.
func (s *Service) GCOrphans(ctx context.Context, dryRun bool) (int, error) {
	now := time.Now()
	var stale []models.MediaAsset
	s.DB.WithContext(ctx).
		Where("(status IN ? AND created_at < ?) OR (status = ? AND created_at < ? AND NOT EXISTS (SELECT 1 FROM media_refs r WHERE r.media_id = media_assets.id))",
			[]string{models.MediaPending, models.MediaProcessing, models.MediaRejected}, now.Add(-24*time.Hour),
			models.MediaReady, now.Add(-7*24*time.Hour)).
		Limit(500).Find(&stale)
	if dryRun {
		return len(stale), nil
	}
	for _, a := range stale {
		if storage.Store != nil {
			for _, k := range []string{a.StorageKey, a.DisplayKey, a.ThumbKey} {
				if k != "" {
					_ = storage.Store.DeleteObject(ctx, k)
				}
			}
		}
		s.DB.WithContext(ctx).Delete(&a)
	}
	return len(stale), nil
}

func contains(set []string, v string) bool {
	for _, s := range set {
		if s == v {
			return true
		}
	}
	return false
}

func uniq(in []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, s := range in {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}

// DeleteAsset removes an asset's row and all its stored objects.
func (s *Service) DeleteAsset(ctx context.Context, a *models.MediaAsset) {
	if storage.Store != nil {
		for _, k := range []string{a.StorageKey, a.DisplayKey, a.ThumbKey} {
			if k != "" {
				_ = storage.Store.DeleteObject(ctx, k)
			}
		}
	}
	s.DB.WithContext(ctx).Delete(a)
}

// ── Bulk-import adapters (used by the CSV/ZIP importer) ──────────────────────

// IngestValidate checks image bytes without storing anything.
func (s *Service) IngestValidate(data []byte) error {
	sniffed := http.DetectContentType(data)
	ok := false
	for _, m := range settings.List("media.allowed_mimes") {
		if m == sniffed {
			ok = true
		}
	}
	if !ok {
		return services.Coded(http.StatusUnprocessableEntity, "unsupported_type", "not a JPEG, PNG or WebP image")
	}
	if int64(len(data)) > settings.Int64("media.max_bytes") {
		return services.Coded(http.StatusUnprocessableEntity, "too_large", "image is larger than the allowed size")
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return services.Coded(http.StatusUnprocessableEntity, "corrupt_image", "image could not be read")
	}
	max := settings.Int("media.max_dimension")
	if cfg.Width > max || cfg.Height > max || cfg.Width*cfg.Height > 24_000_000 {
		return services.Coded(http.StatusUnprocessableEntity, "too_large_dimensions", "image dimensions are too large")
	}
	return nil
}

// IngestCreate stores + processes an image supplied in bulk and returns its id.
func (s *Service) IngestCreate(ctx context.Context, ownerID uuid.UUID, fileName string, data []byte) (uuid.UUID, error) {
	if storage.Store == nil {
		return uuid.Nil, ErrNoStorage
	}
	id := uuid.New()
	ext := ".jpg"
	switch http.DetectContentType(data) {
	case "image/png":
		ext = ".png"
	case "image/webp":
		ext = ".webp"
	}
	key := strings.ToLower(fmt.Sprintf("media/question_image/%s/%s%s", ownerID, id, ext))
	a := models.MediaAsset{ID: id, OwnerID: ownerID, Purpose: "question_image", Source: "import", StorageKey: key, FileName: fileName,
		DeclaredMime: http.DetectContentType(data), DeclaredBytes: int64(len(data)), Status: models.MediaPending}
	if err := s.DB.WithContext(ctx).Create(&a).Error; err != nil {
		return uuid.Nil, err
	}
	if err := storage.Store.PutObject(ctx, key, a.DeclaredMime, data); err != nil {
		return uuid.Nil, err
	}
	res, err := s.processBytes(ctx, &a, data)
	if err != nil {
		return uuid.Nil, err
	}
	return res.ID, nil
}

// LibraryLookup finds an owner's ready asset by original file name.
func (s *Service) LibraryLookup(ctx context.Context, ownerID uuid.UUID, fileName string) (uuid.UUID, bool) {
	var a models.MediaAsset
	if err := s.DB.WithContext(ctx).Where("owner_id = ? AND lower(file_name) = lower(?) AND status = ?", ownerID, fileName, models.MediaReady).
		Order("created_at DESC").First(&a).Error; err != nil {
		return uuid.Nil, false
	}
	return a.ID, true
}

// QuestionRefSaver adapts SaveRefs to the QuestionService hook (services can't
// import media, so the wiring happens at the edges: handlers and the worker).
func QuestionRefSaver(ctx context.Context, tx *gorm.DB, actor *models.User, ownerType string, ownerID uuid.UUID, format string, fields []services.RichField) error {
	mf := make([]Field, len(fields))
	for i, f := range fields {
		mf[i] = Field{Name: f.Name, Text: f.Text, Kind: f.Kind}
	}
	return SaveRefs(ctx, tx, actor, ownerType, ownerID, format, mf)
}

// CheckOwned verifies a directly-referenced media id (cover images): exists,
// ready, owned by the actor (or actor may manage all) and of an allowed purpose.
func CheckOwned(ctx context.Context, db *gorm.DB, actor *models.User, id uuid.UUID, purposes ...string) error {
	var a models.MediaAsset
	if err := db.WithContext(ctx).First(&a, "id = ?", id).Error; err != nil {
		return services.Invalid("invalid_media_ref", "image not found", []map[string]string{{"id": id.String(), "reason": "not_found"}})
	}
	reason := ""
	switch {
	case a.Status != models.MediaReady:
		reason = "not_ready"
	case actor.Role != models.RoleAdmin && !actor.CanManageAllContent && a.OwnerID != actor.ID:
		reason = "not_owned"
	case !contains(purposes, a.Purpose):
		reason = "wrong_purpose"
	}
	if reason != "" {
		return services.Invalid("invalid_media_ref", "that image can't be used here", []map[string]string{{"id": id.String(), "reason": reason}})
	}
	return nil
}
