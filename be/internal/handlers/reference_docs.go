package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"codon-backend/internal/httpx"
	"codon-backend/internal/media"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/storage"
)

type ReferenceHandler struct{ DB *gorm.DB }

func NewReferenceHandler(db *gorm.DB) *ReferenceHandler { return &ReferenceHandler{DB: db} }

var refKinds = map[string]bool{
	models.RefHowTo: true, models.RefPattern: true, models.RefPastPaper: true,
	models.RefPractice: true, models.RefWeightage: true, models.RefSchema: true,
}

// kindNeedsYear: past and practice papers are organised by year; the others are not.
func kindNeedsYear(k string) bool { return k == models.RefPastPaper || k == models.RefPractice }

// canDownload: a paper pattern is view-only in the app. (This is the app's behaviour; it cannot stop a determined
// person from saving what they can see.)
func canDownload(k string) bool { return k != models.RefPattern }

func signRef(ctx context.Context, key string) string {
	if key == "" {
		return ""
	}
	if storage.Client != nil {
		if u, err := storage.Client.PresignGet(ctx, key, 2*time.Hour); err == nil {
			return u
		}
	}
	if storage.Store != nil {
		if u, err := storage.Store.PresignGet(ctx, key, 2*time.Hour); err == nil {
			return u
		}
	}
	return ""
}

// List godoc
//
//	@Summary		Reference documents, newest year first (metadata only)
//	@Description	Filters: kind, class, board, subject, year, slug. Only active documents. Open one with GET /reference-docs/{id}.
//	@Tags			Reference
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/reference-docs [get]
func (h *ReferenceHandler) List(c *gin.Context) {
	q := h.DB.WithContext(c.Request.Context()).Where("is_active = true")
	for _, f := range []string{"kind", "class", "board", "subject", "slug", "year"} {
		if v := strings.TrimSpace(c.Query(f)); v != "" {
			q = q.Where(f+" = ?", v)
		}
	}
	var docs []models.ReferenceDoc
	if err := q.Order("year DESC NULLS LAST, board ASC, subject ASC, title ASC").Limit(500).Find(&docs).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"docs": docs})
}

// Get godoc
//
//	@Summary		Open a reference document
//	@Description	Returns the document and a link valid for two hours. `can_download` is false for paper patterns, which are read in the app only.
//	@Tags			Reference
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Document UUID"
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/reference-docs/{id} [get]
func (h *ReferenceHandler) Get(c *gin.Context) {
	var d models.ReferenceDoc
	if h.DB.First(&d, "id = ? AND is_active = true", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "doc_not_found", "document not found")
		return
	}
	url := signRef(c.Request.Context(), d.FileKey)
	if url == "" {
		respondErr(c, http.StatusServiceUnavailable, "file_unavailable", "this document can't be opened right now")
		return
	}
	c.JSON(http.StatusOK, gin.H{"doc": d, "url": url, "can_download": canDownload(d.Kind)})
}

type refDocRequest struct {
	Kind      *string `json:"kind"`
	Title     *string `json:"title"`
	Class     *string `json:"class"`
	Board     *string `json:"board"`
	Subject   *string `json:"subject"`
	Year      *int    `json:"year"`
	ClearYear *bool   `json:"clear_year"`
	Slug      *string `json:"slug"`
	Language  *string `json:"language"`
	FileKey   *string `json:"file_key"`
	FileName  *string `json:"file_name"`
	SizeBytes *int64  `json:"size_bytes"`
	IsActive  *bool   `json:"is_active"`
}

func (h *ReferenceHandler) apply(c *gin.Context, d *models.ReferenceDoc, r refDocRequest, creating bool) bool {
	bad := func(code, msg string) bool { respondErr(c, http.StatusBadRequest, code, msg); return false }
	if r.Kind != nil {
		if !refKinds[*r.Kind] {
			return bad("invalid_kind", "kind must be howto, pattern, past_paper, practice_paper, weightage or schema")
		}
		d.Kind = *r.Kind
	}
	if r.Title != nil {
		t := strings.TrimSpace(*r.Title)
		if t == "" || len([]rune(t)) > 160 {
			return bad("invalid_title", "title must be 1-160 characters")
		}
		d.Title = t
	}
	for dst, src := range map[*string]*string{&d.Class: r.Class, &d.Board: r.Board, &d.Subject: r.Subject, &d.Slug: r.Slug, &d.Language: r.Language, &d.FileName: r.FileName} {
		if src != nil {
			v := strings.TrimSpace(*src)
			if len([]rune(v)) > 120 {
				return bad("too_long", "a text field is too long")
			}
			*dst = v
		}
	}
	if r.Year != nil {
		if *r.Year < 1990 || *r.Year > 2100 {
			return bad("invalid_year", "year must be between 1990 and 2100")
		}
		y := *r.Year
		d.Year = &y
	}
	if r.ClearYear != nil && *r.ClearYear {
		d.Year = nil
	}
	if r.SizeBytes != nil && *r.SizeBytes >= 0 {
		d.SizeBytes = *r.SizeBytes
	}
	if r.FileKey != nil {
		if !strings.HasPrefix(*r.FileKey, "reference_pdf/") {
			return bad("invalid_pdf", "the PDF must be uploaded with purpose reference_pdf")
		}
		d.FileKey = *r.FileKey
	}
	if r.IsActive != nil {
		d.IsActive = *r.IsActive
	}
	if creating && (d.Kind == "" || d.Title == "" || d.FileKey == "") {
		return bad("bad_request", "kind, title and the PDF are required")
	}
	if kindNeedsYear(d.Kind) && d.Year == nil {
		return bad("year_required", "past and practice papers need a year")
	}
	if d.Kind == models.RefHowTo && d.Slug == "" {
		return bad("slug_required", "a how-to guide needs the feature it explains")
	}
	return true
}

// AdminList godoc
//
//	@Summary		All reference documents, including switched-off ones (Admin)
//	@Tags			Reference
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/admin/reference-docs [get]
func (h *ReferenceHandler) AdminList(c *gin.Context) {
	q := h.DB.WithContext(c.Request.Context())
	if k := strings.TrimSpace(c.Query("kind")); k != "" {
		q = q.Where("kind = ?", k)
	}
	var docs []models.ReferenceDoc
	if err := q.Order("kind ASC, class ASC, board ASC, subject ASC, year DESC NULLS LAST, title ASC").Limit(1000).Find(&docs).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"docs": docs})
}

// AdminCreate godoc
//
//	@Summary		Add a reference document (Admin)
//	@Tags			Reference
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		refDocRequest	true	"Document"
//	@Success		201		{object}	models.ReferenceDoc
//	@Router			/api/v1/admin/reference-docs [post]
func (h *ReferenceHandler) AdminCreate(c *gin.Context) {
	var r refDocRequest
	if c.ShouldBindJSON(&r) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	d := models.ReferenceDoc{IsActive: true}
	if !h.apply(c, &d, r, true) {
		return
	}
	want := d.IsActive
	if err := h.DB.Create(&d).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	if err := h.DB.Model(&d).UpdateColumn("is_active", want).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	d.IsActive = want
	_ = auditAdmin(h.DB.WithContext(c.Request.Context()), middleware.GetUser(c), "reference_doc.create", "reference_doc:"+d.ID.String(), nil, nil)
	c.JSON(http.StatusCreated, d)
}

// AdminUpdate godoc
//
//	@Summary		Edit or switch off a reference document (Admin)
//	@Tags			Reference
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string			true	"Document UUID"
//	@Param			body	body		refDocRequest	true	"Fields"
//	@Success		200		{object}	models.ReferenceDoc
//	@Router			/api/v1/admin/reference-docs/{id} [patch]
func (h *ReferenceHandler) AdminUpdate(c *gin.Context) {
	var d models.ReferenceDoc
	if h.DB.First(&d, "id = ?", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "doc_not_found", "document not found")
		return
	}
	var r refDocRequest
	if c.ShouldBindJSON(&r) != nil || !h.apply(c, &d, r, false) {
		return
	}
	d.UpdatedAt = time.Now()
	if err := h.DB.Select("*").Save(&d).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	_ = auditAdmin(h.DB.WithContext(c.Request.Context()), middleware.GetUser(c), "reference_doc.update", "reference_doc:"+d.ID.String(), nil, nil)
	c.JSON(http.StatusOK, d)
}

// AdminDelete godoc
//
//	@Summary		Delete a reference document (Admin)
//	@Tags			Reference
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Document UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/admin/reference-docs/{id} [delete]
func (h *ReferenceHandler) AdminDelete(c *gin.Context) {
	if err := h.DB.Delete(&models.ReferenceDoc{}, "id = ?", c.Param("id")).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	_ = auditAdmin(h.DB.WithContext(c.Request.Context()), middleware.GetUser(c), "reference_doc.delete", "reference_doc:"+c.Param("id"), nil, nil)
	c.JSON(http.StatusOK, messageResponse{Message: "deleted"})
}

// ── Faculty ───────────────────────────────────────────────────────────────────

type facultyRequest struct {
	Name       *string `json:"name"`
	Title      *string `json:"title"`
	Summary    *string `json:"summary"`
	About      *string `json:"about"`
	MediaID    *string `json:"media_id"`
	OrderIndex *int    `json:"order_index"`
	IsActive   *bool   `json:"is_active"`
}

func (h *ReferenceHandler) facultyView(c *gin.Context, list []models.FacultyMember) gin.H {
	mc := media.NewCollector()
	for _, f := range list {
		mc.AddID(f.MediaID)
	}
	return gin.H{"faculty": list, "media": media.NewService(h.DB).ResolveCollector(c.Request.Context(), mc, media.URLTTL(nil))}
}

// Faculty godoc
//
//	@Summary		The faculty roster students see
//	@Description	Empty until an admin adds people. The app shows an honest empty state, never invented names.
//	@Tags			Reference
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/faculty [get]
func (h *ReferenceHandler) Faculty(c *gin.Context) {
	var list []models.FacultyMember
	h.DB.Where("is_active = true").Order("order_index ASC, name ASC").Find(&list)
	c.JSON(http.StatusOK, h.facultyView(c, list))
}

// AdminFaculty godoc
//
//	@Summary		The faculty roster including switched-off people (Admin)
//	@Tags			Reference
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/admin/faculty [get]
func (h *ReferenceHandler) AdminFaculty(c *gin.Context) {
	var list []models.FacultyMember
	h.DB.Order("order_index ASC, name ASC").Find(&list)
	c.JSON(http.StatusOK, h.facultyView(c, list))
}

func (h *ReferenceHandler) applyFaculty(c *gin.Context, f *models.FacultyMember, r facultyRequest) bool {
	bad := func(code, msg string) bool { respondErr(c, http.StatusBadRequest, code, msg); return false }
	if r.Name != nil {
		n := strings.TrimSpace(*r.Name)
		if n == "" || len([]rune(n)) > 100 {
			return bad("invalid_name", "name must be 1-100 characters")
		}
		f.Name = n
	}
	set := func(dst *string, src *string, max int) bool {
		if src == nil {
			return true
		}
		v := strings.TrimSpace(*src)
		if len([]rune(v)) > max {
			return bad("too_long", "a text field is too long")
		}
		*dst = v
		return true
	}
	if !set(&f.Title, r.Title, 120) || !set(&f.Summary, r.Summary, 300) || !set(&f.About, r.About, 3000) {
		return false
	}
	if r.MediaID != nil {
		if *r.MediaID == "" {
			f.MediaID = nil
		} else {
			id, err := uuid.Parse(*r.MediaID)
			if err != nil {
				return bad("invalid_id", "invalid media_id")
			}
			if err := media.CheckOwned(c.Request.Context(), h.DB, middleware.GetUser(c), id, "faculty_photo"); err != nil {
				respondService(c, err)
				return false
			}
			f.MediaID = &id
		}
	}
	if r.OrderIndex != nil {
		f.OrderIndex = *r.OrderIndex
	}
	if r.IsActive != nil {
		f.IsActive = *r.IsActive
	}
	return true
}

// AdminAddFaculty godoc
//
//	@Summary		Add a person to the faculty roster (Admin)
//	@Tags			Reference
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		facultyRequest	true	"Person"
//	@Success		201		{object}	models.FacultyMember
//	@Router			/api/v1/admin/faculty [post]
func (h *ReferenceHandler) AdminAddFaculty(c *gin.Context) {
	var r facultyRequest
	if c.ShouldBindJSON(&r) != nil || r.Name == nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "name is required")
		return
	}
	f := models.FacultyMember{IsActive: true}
	if !h.applyFaculty(c, &f, r) {
		return
	}
	want := f.IsActive
	if err := h.DB.Create(&f).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	h.DB.Model(&f).UpdateColumn("is_active", want)
	f.IsActive = want
	c.JSON(http.StatusCreated, f)
}

// AdminUpdateFaculty godoc
//
//	@Summary		Edit a person on the faculty roster (Admin)
//	@Tags			Reference
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string			true	"Person UUID"
//	@Param			body	body		facultyRequest	true	"Fields"
//	@Success		200		{object}	models.FacultyMember
//	@Router			/api/v1/admin/faculty/{id} [patch]
func (h *ReferenceHandler) AdminUpdateFaculty(c *gin.Context) {
	var f models.FacultyMember
	if h.DB.First(&f, "id = ?", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "not_found", "person not found")
		return
	}
	var r facultyRequest
	if c.ShouldBindJSON(&r) != nil || !h.applyFaculty(c, &f, r) {
		return
	}
	f.UpdatedAt = time.Now()
	if err := h.DB.Select("*").Save(&f).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, f)
}

// AdminDeleteFaculty godoc
//
//	@Summary		Remove a person from the faculty roster (Admin)
//	@Tags			Reference
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Person UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/admin/faculty/{id} [delete]
func (h *ReferenceHandler) AdminDeleteFaculty(c *gin.Context) {
	if err := h.DB.Delete(&models.FacultyMember{}, "id = ?", c.Param("id")).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "deleted"})
}
