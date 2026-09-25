package handlers

import (
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"codon-backend/internal/items"
	"codon-backend/internal/media"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/pagination"
	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BrainHackHandler: short study/wellbeing tips authored by teachers, approved
// by admins (same review workflow as tests and content), read by students.
type BrainHackHandler struct{ DB *gorm.DB }

func NewBrainHackHandler(db *gorm.DB) *BrainHackHandler { return &BrainHackHandler{DB: db} }

var defaultHackCategories = []string{"Focus", "Memory", "Exam Day"}

type hackRequest struct {
	Title        *string `json:"title"`
	Category     *string `json:"category"`
	Body         *string `json:"body"`
	CoverMediaID *string `json:"cover_media_id"`
}

func readMinutes(body string) int {
	n := len(strings.Fields(body)) / 200
	if n < 1 {
		return 1
	}
	return n
}

type hackView struct {
	models.BrainHack
	MyRating *int `json:"my_rating,omitempty"`
}

func (h *BrainHackHandler) mediaMap(c *gin.Context, hs []models.BrainHack) map[string]media.View {
	mc := media.NewCollector()
	for i := range hs {
		mc.Add(hs[i].ContentFormat, &hs[i].Body)
		mc.AddID(hs[i].CoverMediaID)
	}
	return media.NewService(h.DB).ResolveCollector(c.Request.Context(), mc, media.URLTTL(nil))
}

func (h *BrainHackHandler) apply(c *gin.Context, tx *gorm.DB, actor *models.User, b *models.BrainHack, req hackRequest) error {
	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if t == "" || utf8.RuneCountInString(t) > 120 {
			return services.Coded(http.StatusBadRequest, "invalid_title", "title must be 1-120 characters")
		}
		b.Title = t
	}
	if req.Category != nil {
		cat := strings.TrimSpace(*req.Category)
		if cat == "" || utf8.RuneCountInString(cat) > 30 {
			return services.Coded(http.StatusBadRequest, "invalid_category", "category must be 1-30 characters")
		}
		b.Category = cat
	}
	if req.Body != nil {
		if strings.TrimSpace(*req.Body) == "" {
			return services.Coded(http.StatusBadRequest, "invalid_body", "body is required")
		}
		b.Body = *req.Body
		b.ReadMinutes = readMinutes(b.Body)
	}
	if req.CoverMediaID != nil {
		if *req.CoverMediaID == "" {
			b.CoverMediaID = nil
		} else {
			id, err := uuid.Parse(*req.CoverMediaID)
			if err != nil {
				return services.Coded(http.StatusBadRequest, "invalid_id", "invalid cover_media_id")
			}
			if err := media.CheckOwned(c.Request.Context(), tx, actor, id, "brain_hack_image"); err != nil {
				return err
			}
			b.CoverMediaID = &id
		}
	}
	if b.Title == "" || b.Category == "" || b.Body == "" {
		return nil // incomplete draft is fine; completeness is enforced on submit
	}
	return media.SaveRefs(c.Request.Context(), tx, actor, "brain_hack", b.ID, b.ContentFormat,
		[]media.Field{{Name: "body", Text: b.Body, Kind: "explanation"}})
}

func (h *BrainHackHandler) mine(c *gin.Context) (*models.BrainHack, bool) {
	user := middleware.GetUser(c)
	var b models.BrainHack
	q := h.DB.WithContext(c.Request.Context()).Where("id = ?", c.Param("id"))
	if !canManageAllContent(user) {
		q = q.Where("author_id = ?", user.ID)
	}
	if q.First(&b).Error != nil {
		respondErr(c, http.StatusNotFound, "not_found", "brain hack not found")
		return nil, false
	}
	return &b, true
}

// Create godoc
//
//	@Summary		Create a Brain Hack draft (Teacher)
//	@Description	Body is rich text v1 (images via uploaded `brain_hack_image` media); optional cover image. Goes through draft → review → approved → published like other content.
//	@Tags			BrainHacks
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		hackRequest	true	"Hack"
//	@Success		201		{object}	models.BrainHack
//	@Router			/api/v1/teacher/brain-hacks [post]
func (h *BrainHackHandler) Create(c *gin.Context) {
	user := middleware.GetUser(c)
	var req hackRequest
	if c.ShouldBindJSON(&req) != nil || req.Title == nil || req.Category == nil || req.Body == nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "title, category and body are required")
		return
	}
	b := models.BrainHack{ID: uuid.New(), AuthorID: user.ID, Status: models.StatusDraft, ContentFormat: models.ContentFormatRichV1}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := h.apply(c, tx, user, &b, req); err != nil {
			return err
		}
		return tx.Create(&b).Error
	})
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"brain_hack": b, "media": h.mediaMap(c, []models.BrainHack{b})})
}

// Update godoc
//
//	@Summary		Edit a Brain Hack (Teacher) — draft or rejected only
//	@Tags			BrainHacks
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string		true	"Brain hack UUID"
//	@Param			body	body		hackRequest	true	"Fields"
//	@Success		200		{object}	models.BrainHack
//	@Router			/api/v1/teacher/brain-hacks/{id} [patch]
func (h *BrainHackHandler) Update(c *gin.Context) {
	user := middleware.GetUser(c)
	b, ok := h.mine(c)
	if !ok {
		return
	}
	if b.Status != models.StatusDraft && b.Status != models.StatusRejected {
		respondErr(c, http.StatusConflict, "locked", "only drafts and rejected hacks can be edited")
		return
	}
	var req hackRequest
	if c.ShouldBindJSON(&req) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := h.apply(c, tx, user, b, req); err != nil {
			return err
		}
		return tx.Save(b).Error
	})
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"brain_hack": b, "media": h.mediaMap(c, []models.BrainHack{*b})})
}

// Submit godoc
//
//	@Summary		Submit a Brain Hack for review (Teacher)
//	@Tags			BrainHacks
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Brain hack UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/teacher/brain-hacks/{id}/submit-for-review [post]
func (h *BrainHackHandler) Submit(c *gin.Context) {
	b, ok := h.mine(c)
	if !ok {
		return
	}
	if b.Status != models.StatusDraft && b.Status != models.StatusRejected {
		respondErr(c, http.StatusConflict, "locked", "already submitted")
		return
	}
	if b.Title == "" || b.Body == "" || b.Category == "" {
		respondErr(c, http.StatusUnprocessableEntity, "incomplete", "title, category and body are required")
		return
	}
	h.DB.Model(b).Update("status", models.StatusPendingReview)
	c.JSON(http.StatusOK, messageResponse{Message: "submitted for review"})
}

// Publish godoc
//
//	@Summary		Publish an approved Brain Hack (Teacher)
//	@Tags			BrainHacks
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Brain hack UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/teacher/brain-hacks/{id}/publish [post]
func (h *BrainHackHandler) Publish(c *gin.Context) {
	b, ok := h.mine(c)
	if !ok {
		return
	}
	if b.Status != models.StatusApproved {
		respondErr(c, http.StatusConflict, "not_approved", "only approved hacks can be published")
		return
	}
	h.DB.Model(b).Update("status", models.StatusPublished)
	c.JSON(http.StatusOK, messageResponse{Message: "published"})
}

// Delete godoc
//
//	@Summary		Delete a draft/rejected Brain Hack (Teacher)
//	@Tags			BrainHacks
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Brain hack UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/teacher/brain-hacks/{id} [delete]
func (h *BrainHackHandler) Delete(c *gin.Context) {
	b, ok := h.mine(c)
	if !ok {
		return
	}
	if b.Status == models.StatusApproved || b.Status == models.StatusPublished {
		respondErr(c, http.StatusConflict, "locked", "approved or published hacks can't be deleted")
		return
	}
	h.DB.Transaction(func(tx *gorm.DB) error {
		media.DeleteRefs(tx, "brain_hack", b.ID)
		items.Cleanup(tx, items.BrainHack, b.ID)
		return tx.Delete(b).Error
	})
	c.JSON(http.StatusOK, messageResponse{Message: "deleted"})
}

// TeacherList godoc
//
//	@Summary		My Brain Hacks (Teacher)
//	@Tags			BrainHacks
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/teacher/brain-hacks [get]
func (h *BrainHackHandler) TeacherList(c *gin.Context) {
	user := middleware.GetUser(c)
	var hs []models.BrainHack
	q := h.DB.Order("created_at DESC")
	if !canManageAllContent(user) {
		q = q.Where("author_id = ?", user.ID)
	}
	q.Find(&hs)
	c.JSON(http.StatusOK, gin.H{"brain_hacks": hs, "media": h.mediaMap(c, hs)})
}

// TeacherGet godoc
//
//	@Summary		One of my Brain Hacks (Teacher)
//	@Tags			BrainHacks
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Brain hack UUID"
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/teacher/brain-hacks/{id} [get]
func (h *BrainHackHandler) TeacherGet(c *gin.Context) {
	b, ok := h.mine(c)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, gin.H{"brain_hack": b, "media": h.mediaMap(c, []models.BrainHack{*b})})
}

// AdminList godoc
//
//	@Summary		Brain Hacks awaiting review (Admin)
//	@Tags			BrainHacks
//	@Security		BearerAuth
//	@Produce		json
//	@Param			status	query		string	false	"Default pending_review"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/admin/brain-hacks [get]
func (h *BrainHackHandler) AdminList(c *gin.Context) {
	var hs []models.BrainHack
	h.DB.Where("status = ?", c.DefaultQuery("status", string(models.StatusPendingReview))).Order("created_at DESC").Find(&hs)
	c.JSON(http.StatusOK, gin.H{"brain_hacks": hs, "media": h.mediaMap(c, hs)})
}

// AdminGet godoc
//
//	@Summary		One Brain Hack with images (Admin)
//	@Tags			BrainHacks
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Brain hack UUID"
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/admin/brain-hacks/{id} [get]
func (h *BrainHackHandler) AdminGet(c *gin.Context) {
	var b models.BrainHack
	if h.DB.First(&b, "id = ?", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "not_found", "brain hack not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"brain_hack": b, "media": h.mediaMap(c, []models.BrainHack{b})})
}

// Approve godoc
//
//	@Summary		Approve a Brain Hack (Admin)
//	@Tags			BrainHacks
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Brain hack UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/admin/brain-hacks/{id}/approve [post]
func (h *BrainHackHandler) Approve(c *gin.Context) {
	admin := middleware.GetUser(c)
	var b models.BrainHack
	if h.DB.First(&b, "id = ? AND status = ?", c.Param("id"), models.StatusPendingReview).Error != nil {
		respondErr(c, http.StatusNotFound, "not_found", "brain hack not found or not pending review")
		return
	}
	now := time.Now()
	h.DB.Model(&b).Updates(map[string]interface{}{"status": models.StatusApproved, "reviewed_by": admin.ID, "reviewed_at": now})
	services.Notify(h.DB, b.AuthorID, "brain_hack_approved", "Your Brain Hack was approved", b.Title, map[string]interface{}{"id": b.ID})
	c.JSON(http.StatusOK, messageResponse{Message: "approved"})
}

// Reject godoc
//
//	@Summary		Reject a Brain Hack (Admin)
//	@Tags			BrainHacks
//	@Security		BearerAuth
//	@Accept			json
//	@Param			id		path	string					true	"Brain hack UUID"
//	@Param			body	body	rejectContentRequest	true	"Reason"
//	@Success		200		{object}	messageResponse
//	@Router			/api/v1/admin/brain-hacks/{id}/reject [post]
func (h *BrainHackHandler) Reject(c *gin.Context) {
	admin := middleware.GetUser(c)
	var req rejectContentRequest
	if c.ShouldBindJSON(&req) != nil || len(req.Reason) < 3 {
		respondErr(c, http.StatusBadRequest, "bad_request", "a reason is required")
		return
	}
	var b models.BrainHack
	if h.DB.First(&b, "id = ? AND status = ?", c.Param("id"), models.StatusPendingReview).Error != nil {
		respondErr(c, http.StatusNotFound, "not_found", "brain hack not found or not pending review")
		return
	}
	now := time.Now()
	h.DB.Model(&b).Updates(map[string]interface{}{"status": models.StatusRejected, "reviewed_by": admin.ID, "reviewed_at": now, "rejection_reason": req.Reason})
	services.Notify(h.DB, b.AuthorID, "brain_hack_rejected", "Your Brain Hack needs changes", req.Reason, map[string]interface{}{"id": b.ID})
	c.JSON(http.StatusOK, messageResponse{Message: "rejected"})
}

// StudentList godoc
//
//	@Summary		Published Brain Hacks (Student)
//	@Description	Cursor-paginated; `category` filter; `sort=rating`. Cards carry rating aggregates and the caller's own rating.
//	@Tags			BrainHacks
//	@Security		BearerAuth
//	@Produce		json
//	@Param			category	query		string	false	"Category"
//	@Param			sort		query		string	false	"rating"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/brain-hacks [get]
func (h *BrainHackHandler) StudentList(c *gin.Context) {
	user := middleware.GetUser(c)
	limit := pagination.Limit(c.Query("limit"))
	q := h.DB.Model(&models.BrainHack{}).Where("brain_hacks.status = ?", models.StatusPublished)
	if v := c.Query("category"); v != "" {
		q = q.Where("brain_hacks.category = ?", v)
	}
	if c.Query("sort") == "rating" {
		q = q.Order("rating_avg DESC, rating_count DESC").Limit(limit)
	} else {
		q = pagination.Apply(q, "brain_hacks", pagination.Decode(c.Query("cursor")), limit)
	}
	var hs []models.BrainHack
	q.Find(&hs)
	next := ""
	if c.Query("sort") != "rating" {
		hs, next = pagination.Page(hs, limit, func(b models.BrainHack) (time.Time, uuid.UUID) { return b.CreatedAt, b.ID })
	}
	mine := map[uuid.UUID]int{}
	if len(hs) > 0 {
		ids := make([]uuid.UUID, len(hs))
		for i, b := range hs {
			ids[i] = b.ID
		}
		var rs []models.Rating
		h.DB.Where("user_id = ? AND item_type = 'brain_hack' AND item_id IN ?", user.ID, ids).Find(&rs)
		for _, r := range rs {
			mine[r.ItemID] = r.Value
		}
	}
	views := make([]hackView, len(hs))
	for i, b := range hs {
		views[i] = hackView{BrainHack: b}
		if v, ok := mine[b.ID]; ok {
			vv := v
			views[i].MyRating = &vv
		}
	}
	c.JSON(http.StatusOK, gin.H{"brain_hacks": views, "next_cursor": nilIfEmpty(next), "media": h.mediaMap(c, hs)})
}

// Categories godoc
//
//	@Summary		Brain Hack categories in use
//	@Description	Categories are data: the defaults (Focus, Memory, Exam Day) plus any others in published hacks.
//	@Tags			BrainHacks
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/brain-hacks/categories [get]
func (h *BrainHackHandler) Categories(c *gin.Context) {
	var cats []string
	h.DB.Model(&models.BrainHack{}).Where("status = ?", models.StatusPublished).Distinct().Pluck("category", &cats)
	seen := map[string]bool{}
	out := []string{}
	for _, x := range append(append([]string{}, defaultHackCategories...), cats...) {
		if !seen[x] {
			seen[x] = true
			out = append(out, x)
		}
	}
	c.JSON(http.StatusOK, gin.H{"categories": out})
}

// StudentGet godoc
//
//	@Summary		One published Brain Hack (Student)
//	@Tags			BrainHacks
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Brain hack UUID"
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/brain-hacks/{id} [get]
func (h *BrainHackHandler) StudentGet(c *gin.Context) {
	user := middleware.GetUser(c)
	var b models.BrainHack
	if h.DB.First(&b, "id = ? AND status = ?", c.Param("id"), models.StatusPublished).Error != nil {
		respondErr(c, http.StatusNotFound, "not_found", "brain hack not found")
		return
	}
	v := hackView{BrainHack: b}
	var r models.Rating
	if h.DB.Where("user_id = ? AND item_type = 'brain_hack' AND item_id = ?", user.ID, b.ID).First(&r).Error == nil {
		x := r.Value
		v.MyRating = &x
	}
	c.JSON(http.StatusOK, gin.H{"brain_hack": v, "media": h.mediaMap(c, []models.BrainHack{b})})
}
