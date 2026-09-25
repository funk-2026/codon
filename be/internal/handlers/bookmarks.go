package handlers

import (
	"net/http"
	"strings"
	"time"

	"codon-backend/internal/items"
	"codon-backend/internal/media"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/pagination"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type BookmarkHandler struct{ DB *gorm.DB }

func NewBookmarkHandler(db *gorm.DB) *BookmarkHandler { return &BookmarkHandler{DB: db} }

var bookmarkTypes = []string{items.Question, items.Flashcard, items.Content}

func (h *BookmarkHandler) collectionsFor(userID uuid.UUID) []models.BookmarkCollection {
	var cols []models.BookmarkCollection
	h.DB.Where("is_active = true AND (owner_id IS NULL OR owner_id = ?)", userID).Order("order_index ASC, created_at ASC").Find(&cols)
	return cols
}

// ListCollections godoc
//
//	@Summary		My bookmark collections
//	@Description	The system collections (admin-configurable labels) plus any the student created. Bookmarks live in exactly one collection.
//	@Tags			Bookmarks
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/me/bookmark-collections [get]
func (h *BookmarkHandler) ListCollections(c *gin.Context) {
	user := middleware.GetUser(c)
	cols := h.collectionsFor(user.ID)
	var counts []struct {
		CollectionID uuid.UUID
		N            int
	}
	h.DB.Raw("SELECT collection_id, count(*) AS n FROM bookmarks WHERE user_id = ? GROUP BY collection_id", user.ID).Scan(&counts)
	byID := map[uuid.UUID]int{}
	for _, x := range counts {
		byID[x.CollectionID] = x.N
	}
	out := make([]gin.H, len(cols))
	for i, col := range cols {
		out[i] = gin.H{"id": col.ID, "key": col.Key, "label": col.Label, "order_index": col.OrderIndex, "is_system": col.OwnerID == nil, "count": byID[col.ID]}
	}
	c.JSON(http.StatusOK, gin.H{"collections": out})
}

type putBookmarkRequest struct {
	ItemType     string  `json:"item_type" enums:"question,flashcard,content"`
	ItemID       string  `json:"item_id"`
	CollectionID *string `json:"collection_id"`
	Note         *string `json:"note"`
}

// Put godoc
//
//	@Summary		Bookmark an item (idempotent)
//	@Description	Creates or moves a bookmark. Without `collection_id` the first system collection is used. For questions the student must have been exposed to the question in one of their attempts (403 `not_exposed`) so the pool can't be enumerated by guessing ids.
//	@Tags			Bookmarks
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		putBookmarkRequest	true	"Bookmark"
//	@Success		200		{object}	models.Bookmark
//	@Router			/api/v1/me/bookmarks [put]
func (h *BookmarkHandler) Put(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	var req putBookmarkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	itemID, err := uuid.Parse(req.ItemID)
	if err != nil || !contains(bookmarkTypes, req.ItemType) {
		respondErr(c, http.StatusBadRequest, "bad_request", "item_type must be question, flashcard or content and item_id a uuid")
		return
	}
	if req.Note != nil && len([]rune(*req.Note)) > 1000 {
		respondErr(c, http.StatusBadRequest, "note_too_long", "note must be at most 1000 characters")
		return
	}
	if _, ok := items.Resolve(ctx, h.DB, req.ItemType, itemID); !ok {
		respondErr(c, http.StatusNotFound, "item_not_found", "item not found")
		return
	}
	if !items.Exposed(ctx, h.DB, user.ID, req.ItemType, itemID) {
		respondErr(c, http.StatusForbidden, "not_exposed", "you can only bookmark questions you have seen")
		return
	}
	cols := h.collectionsFor(user.ID)
	if len(cols) == 0 {
		respondErr(c, http.StatusServiceUnavailable, "no_collections", "no bookmark collections are configured")
		return
	}
	colID := cols[0].ID
	if req.CollectionID != nil {
		cid, err := uuid.Parse(*req.CollectionID)
		found := false
		for _, col := range cols {
			if err == nil && col.ID == cid {
				found = true
				colID = cid
			}
		}
		if !found {
			respondErr(c, http.StatusBadRequest, "invalid_collection", "unknown collection")
			return
		}
	}
	b := models.Bookmark{UserID: user.ID, ItemType: req.ItemType, ItemID: itemID, CollectionID: colID, Note: req.Note}
	up := clause.Set{{Column: clause.Column{Name: "collection_id"}, Value: colID}}
	if req.Note != nil {
		up = append(up, clause.Assignment{Column: clause.Column{Name: "note"}, Value: req.Note})
	}
	if err := h.DB.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "item_type"}, {Name: "item_id"}}, DoUpdates: up,
	}).Create(&b).Error; err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to save bookmark")
		return
	}
	h.DB.WithContext(ctx).Where("user_id = ? AND item_type = ? AND item_id = ?", user.ID, req.ItemType, itemID).First(&b)
	c.JSON(http.StatusOK, b)
}

// Delete godoc
//
//	@Summary		Remove a bookmark (idempotent)
//	@Tags			Bookmarks
//	@Security		BearerAuth
//	@Param			item_type	path	string	true	"question|flashcard|content"
//	@Param			item_id		path	string	true	"Item UUID"
//	@Success		200			{object}	messageResponse
//	@Router			/api/v1/me/bookmarks/{item_type}/{item_id} [delete]
func (h *BookmarkHandler) Delete(c *gin.Context) {
	user := middleware.GetUser(c)
	h.DB.Where("user_id = ? AND item_type = ? AND item_id = ?", user.ID, c.Param("item_type"), c.Param("item_id")).Delete(&models.Bookmark{})
	c.JSON(http.StatusOK, messageResponse{Message: "bookmark removed"})
}

// IDs godoc
//
//	@Summary		Compact bookmark id sets
//	@Description	All bookmarked ids of one type, grouped by collection — the app keeps this in memory to show bookmark state instantly.
//	@Tags			Bookmarks
//	@Security		BearerAuth
//	@Produce		json
//	@Param			item_type	query		string	false	"Default: question"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/me/bookmarks/ids [get]
func (h *BookmarkHandler) IDs(c *gin.Context) {
	user := middleware.GetUser(c)
	typ := c.DefaultQuery("item_type", items.Question)
	var rows []models.Bookmark
	h.DB.Select("item_id", "collection_id").Where("user_id = ? AND item_type = ?", user.ID, typ).Find(&rows)
	by := map[string][]uuid.UUID{}
	all := make([]uuid.UUID, 0, len(rows))
	for _, r := range rows {
		by[r.CollectionID.String()] = append(by[r.CollectionID.String()], r.ItemID)
		all = append(all, r.ItemID)
	}
	c.JSON(http.StatusOK, gin.H{"item_type": typ, "ids": all, "by_collection": by})
}

type bookmarkQuestion struct {
	ID            uuid.UUID             `json:"id"`
	ContentFormat string                `json:"content_format"`
	QuestionText  string                `json:"question_text"`
	OptionA       string                `json:"option_a"`
	OptionB       string                `json:"option_b"`
	OptionC       string                `json:"option_c"`
	OptionD       string                `json:"option_d"`
	CorrectOption *models.CorrectOption `json:"correct_option,omitempty"`
	Explanation   *string               `json:"explanation,omitempty"`
	SubjectID     *uuid.UUID            `json:"subject_id,omitempty"`
	ChapterID     *uuid.UUID            `json:"chapter_id,omitempty"`
	Difficulty    *string               `json:"difficulty,omitempty"`
}

type bookmarkRow struct {
	models.Bookmark
	Question  *bookmarkQuestion `json:"question,omitempty"`
	Content   gin.H             `json:"content,omitempty"`
	Flashcard gin.H             `json:"flashcard,omitempty"`
}

// List godoc
//
//	@Summary		My bookmarks
//	@Description	Cursor-paginated. Filters: collection_id, item_type, subject_id, chapter_id, q. Questions come with their content; the answer key and explanation are included ONLY for questions the student has finished (submitted attempt) or revealed in tutor mode.
//	@Tags			Bookmarks
//	@Security		BearerAuth
//	@Produce		json
//	@Param			limit	query		int		false	"Page size"
//	@Param			cursor	query		string	false	"Cursor"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/me/bookmarks [get]
func (h *BookmarkHandler) List(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	limit := pagination.Limit(c.Query("limit"))
	q := h.DB.WithContext(ctx).Model(&models.Bookmark{}).Where("bookmarks.user_id = ?", user.ID)
	if v := c.Query("collection_id"); v != "" {
		q = q.Where("bookmarks.collection_id = ?", v)
	}
	if v := c.Query("item_type"); v != "" {
		q = q.Where("bookmarks.item_type = ?", v)
	}
	if v := c.Query("subject_id"); v != "" {
		q = q.Where("bookmarks.item_type = 'question' AND bookmarks.item_id IN (SELECT id FROM questions WHERE subject_id = ?)", v)
	}
	if v := c.Query("chapter_id"); v != "" {
		q = q.Where("bookmarks.item_type = 'question' AND bookmarks.item_id IN (SELECT id FROM questions WHERE chapter_id = ?)", v)
	}
	if v := strings.TrimSpace(c.Query("q")); v != "" {
		like := "%" + v + "%"
		q = q.Where("(bookmarks.item_type = 'question' AND bookmarks.item_id IN (SELECT id FROM questions WHERE question_text ILIKE ?)) OR (bookmarks.item_type = 'content' AND bookmarks.item_id IN (SELECT id FROM content_items WHERE title ILIKE ?))", like, like)
	}
	q = pagination.Apply(q, "bookmarks", pagination.Decode(c.Query("cursor")), limit)
	var bms []models.Bookmark
	q.Find(&bms)
	bms, next := pagination.Page(bms, limit, func(b models.Bookmark) (time.Time, uuid.UUID) { return b.CreatedAt, b.ID })

	var qids, cids, fids []uuid.UUID
	for _, b := range bms {
		switch b.ItemType {
		case items.Question:
			qids = append(qids, b.ItemID)
		case items.Content:
			cids = append(cids, b.ItemID)
		case items.Flashcard:
			fids = append(fids, b.ItemID)
		}
	}
	cards := map[uuid.UUID]models.Flashcard{}
	if len(fids) > 0 {
		var rows []models.Flashcard
		h.DB.WithContext(ctx).Where("id IN ?", fids).Find(&rows)
		for _, r := range rows {
			cards[r.ID] = r
		}
	}
	qs := map[uuid.UUID]models.Question{}
	if len(qids) > 0 {
		var rows []models.Question
		h.DB.WithContext(ctx).Where("id IN ?", qids).Find(&rows)
		for _, r := range rows {
			qs[r.ID] = r
		}
	}
	contents := map[uuid.UUID]models.ContentItem{}
	if len(cids) > 0 {
		var rows []models.ContentItem
		h.DB.WithContext(ctx).Select("id", "title", "content_type", "chapter_id", "course_id").Where("id IN ?", cids).Find(&rows)
		for _, r := range rows {
			contents[r.ID] = r
		}
	}
	revealed := map[uuid.UUID]bool{}
	if len(qids) > 0 {
		var ok []uuid.UUID
		h.DB.WithContext(ctx).Raw(`SELECT DISTINCT aa.question_id FROM attempt_answers aa JOIN student_attempts sa ON sa.id = aa.attempt_id
			WHERE sa.user_id = ? AND aa.question_id IN ? AND (sa.status = 'submitted' OR aa.revealed_at IS NOT NULL)`, user.ID, qids).Scan(&ok)
		for _, id := range ok {
			revealed[id] = true
		}
	}
	mc := media.NewCollector()
	rows := make([]bookmarkRow, len(bms))
	for i, b := range bms {
		rows[i] = bookmarkRow{Bookmark: b}
		switch b.ItemType {
		case items.Question:
			if qq, ok := qs[b.ItemID]; ok {
				v := &bookmarkQuestion{ID: qq.ID, ContentFormat: qq.ContentFormat, QuestionText: qq.QuestionText, OptionA: qq.OptionA, OptionB: qq.OptionB,
					OptionC: qq.OptionC, OptionD: qq.OptionD, SubjectID: qq.SubjectID, ChapterID: qq.ChapterID, Difficulty: qq.Difficulty}
				if revealed[qq.ID] {
					v.CorrectOption, v.Explanation = &qq.CorrectOption, qq.Explanation
				}
				rows[i].Question = v
				mc.Add(qq.ContentFormat, &v.QuestionText, &v.OptionA, &v.OptionB, &v.OptionC, &v.OptionD, v.Explanation)
			}
		case items.Flashcard:
			if fc, ok := cards[b.ItemID]; ok {
				rows[i].Flashcard = gin.H{"id": fc.ID, "deck_id": fc.DeckID, "content_format": fc.ContentFormat, "front": fc.Front, "back": fc.Back}
				mc.Add(fc.ContentFormat, &fc.Front, &fc.Back)
			}
		case items.Content:
			if ct, ok := contents[b.ItemID]; ok {
				rows[i].Content = gin.H{"id": ct.ID, "title": ct.Title, "content_type": ct.ContentType, "chapter_id": ct.ChapterID}
			}
		}
	}
	c.JSON(http.StatusOK, gin.H{"items": rows, "next_cursor": nilIfEmpty(next), "media": media.NewService(h.DB).ResolveCollector(ctx, mc, media.URLTTL(nil))})
}

// ── Admin: collection config ─────────────────────────────────────────────────

// AdminListCollections godoc
//
//	@Summary		List system bookmark collections (Admin)
//	@Tags			Bookmarks
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/admin/bookmark-collections [get]
func (h *BookmarkHandler) AdminListCollections(c *gin.Context) {
	var cols []models.BookmarkCollection
	h.DB.Where("owner_id IS NULL").Order("order_index ASC").Find(&cols)
	c.JSON(http.StatusOK, gin.H{"collections": cols})
}

type patchCollectionRequest struct {
	Label      *string `json:"label"`
	OrderIndex *int    `json:"order_index"`
	IsActive   *bool   `json:"is_active"`
}

// AdminPatchCollection godoc
//
//	@Summary		Rename / reorder / deactivate a system collection (Admin)
//	@Description	Deactivating moves its bookmarks to the first remaining active collection; the last active collection can't be deactivated.
//	@Tags			Bookmarks
//	@Security		BearerAuth
//	@Accept			json
//	@Param			id		path	string					true	"Collection UUID"
//	@Param			body	body	patchCollectionRequest	true	"Fields"
//	@Success		200		{object}	models.BookmarkCollection
//	@Router			/api/v1/admin/bookmark-collections/{id} [patch]
func (h *BookmarkHandler) AdminPatchCollection(c *gin.Context) {
	admin := middleware.GetUser(c)
	var col models.BookmarkCollection
	if h.DB.First(&col, "id = ? AND owner_id IS NULL", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "collection_not_found", "collection not found")
		return
	}
	var req patchCollectionRequest
	if c.ShouldBindJSON(&req) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	up := map[string]interface{}{}
	if req.Label != nil {
		l := strings.TrimSpace(*req.Label)
		if l == "" || len([]rune(l)) > 40 {
			respondErr(c, http.StatusBadRequest, "invalid_label", "label must be 1-40 characters")
			return
		}
		up["label"] = l
	}
	if req.OrderIndex != nil {
		up["order_index"] = *req.OrderIndex
	}
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if req.IsActive != nil && !*req.IsActive && col.IsActive {
			var other models.BookmarkCollection
			if tx.Where("owner_id IS NULL AND is_active = true AND id <> ?", col.ID).Order("order_index ASC").First(&other).Error != nil {
				return gorm.ErrInvalidData
			}
			if err := tx.Model(&models.Bookmark{}).Where("collection_id = ?", col.ID).Update("collection_id", other.ID).Error; err != nil {
				return err
			}
		}
		if req.IsActive != nil {
			up["is_active"] = *req.IsActive
		}
		if len(up) > 0 {
			if err := tx.Model(&col).Updates(up).Error; err != nil {
				return err
			}
		}
		return tx.Create(&models.AdminAuditLog{ActorID: admin.ID, Action: "bookmark_collection.update", Target: "collection:" + col.ID.String()}).Error
	})
	if err == gorm.ErrInvalidData {
		respondErr(c, http.StatusConflict, "last_collection", "at least one collection must stay active")
		return
	}
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to update collection")
		return
	}
	h.DB.First(&col, "id = ?", col.ID)
	c.JSON(http.StatusOK, col)
}
