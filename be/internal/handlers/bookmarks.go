package handlers

import (
	"codon-backend/internal/httpx"
	"net/http"
	"slices"
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

var bookmarkTypes = []string{items.Question, items.Flashcard, items.Content, items.FlashcardDeck, items.Pulse}

// typesFor widens a tab's item type to every stored type it shows: the Flashcards tab holds cards and decks.
func typesFor(it string) []string {
	if it == items.Flashcard {
		return []string{items.Flashcard, items.FlashcardDeck}
	}
	return []string{it}
}

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
	ItemType     string  `json:"item_type" enums:"question,flashcard,flashcard_deck,pulse,content"`
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
	if err != nil || !slices.Contains(bookmarkTypes, req.ItemType) {
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
	if err := h.DB.Where("user_id = ? AND item_type = ? AND item_id = ?", user.ID, c.Param("item_type"), c.Param("item_id")).Delete(&models.Bookmark{}).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
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
	h.DB.Select("item_id", "collection_id").Where("user_id = ? AND item_type IN ?", user.ID, typesFor(typ)).Find(&rows)
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
	Tags          []string              `json:"tags,omitempty"`
	RefBook       *string               `json:"ref_book,omitempty"`
	RefEdition    *string               `json:"ref_edition,omitempty"`
	RefPages      *string               `json:"ref_pages,omitempty"`
}

type bookmarkRow struct {
	models.Bookmark
	Question  *bookmarkQuestion `json:"question,omitempty"`
	Content   gin.H             `json:"content,omitempty"`
	Flashcard gin.H             `json:"flashcard,omitempty"`
	Deck      gin.H             `json:"deck,omitempty"`
	Pulse     gin.H             `json:"pulse,omitempty"`
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
		q = q.Where("bookmarks.item_type IN ?", typesFor(v))
	}
	if ids := csvIDs(c.Query("collection_ids")); len(ids) > 0 {
		q = q.Where("bookmarks.collection_id IN ?", ids)
	}
	subjects := csvIDs(firstNonEmpty(c.Query("subject_ids"), c.Query("subject_id")))
	chapters := csvIDs(firstNonEmpty(c.Query("chapter_ids"), c.Query("chapter_id")))
	if len(subjects) > 0 {
		switch c.Query("item_type") {
		case items.Flashcard:
			q = q.Where("(bookmarks.item_type = 'flashcard' AND bookmarks.item_id IN (SELECT f.id FROM flashcards f JOIN flashcard_decks d ON d.id = f.deck_id WHERE d.subject_id IN ?)) OR (bookmarks.item_type = 'flashcard_deck' AND bookmarks.item_id IN (SELECT id FROM flashcard_decks WHERE subject_id IN ?))", subjects, subjects)
		case items.Pulse:
			q = q.Where("bookmarks.item_type = 'pulse' AND bookmarks.item_id IN (SELECT id FROM pulse_items WHERE subject_id IN ?)", subjects)
		default:
			q = q.Where("bookmarks.item_type = 'question' AND bookmarks.item_id IN (SELECT id FROM questions WHERE subject_id IN ?)", subjects)
		}
	}
	if len(chapters) > 0 {
		switch c.Query("item_type") {
		case items.Flashcard:
			q = q.Where("(bookmarks.item_type = 'flashcard' AND bookmarks.item_id IN (SELECT f.id FROM flashcards f JOIN flashcard_decks d ON d.id = f.deck_id WHERE d.chapter_id IN ?)) OR (bookmarks.item_type = 'flashcard_deck' AND bookmarks.item_id IN (SELECT id FROM flashcard_decks WHERE chapter_id IN ?))", chapters, chapters)
		case items.Pulse:
			q = q.Where("bookmarks.item_type = 'pulse' AND bookmarks.item_id IN (SELECT id FROM pulse_items WHERE chapter_id IN ?)", chapters)
		default:
			q = q.Where("bookmarks.item_type = 'question' AND bookmarks.item_id IN (SELECT id FROM questions WHERE chapter_id IN ?)", chapters)
		}
	}
	if v := strings.TrimSpace(c.Query("q")); v != "" {
		like := "%" + v + "%"
		q = q.Where(`(bookmarks.item_type = 'question' AND bookmarks.item_id IN (SELECT id FROM questions WHERE question_text ILIKE ?))
			OR (bookmarks.item_type = 'content' AND bookmarks.item_id IN (SELECT id FROM content_items WHERE title ILIKE ?))
			OR (bookmarks.item_type = 'flashcard' AND bookmarks.item_id IN (SELECT id FROM flashcards WHERE front ILIKE ?))
			OR (bookmarks.item_type = 'flashcard_deck' AND bookmarks.item_id IN (SELECT id FROM flashcard_decks WHERE title ILIKE ?))
			OR (bookmarks.item_type = 'pulse' AND bookmarks.item_id IN (SELECT id FROM pulse_items WHERE title ILIKE ?))`, like, like, like, like, like)
	}
	q = pagination.Apply(q, "bookmarks", pagination.Decode(c.Query("cursor")), limit)
	var bms []models.Bookmark
	q.Find(&bms)
	bms, next := pagination.Page(bms, limit, func(b models.Bookmark) (time.Time, uuid.UUID) { return b.CreatedAt, b.ID })

	var qids, cids, fids, dids, pids []uuid.UUID
	for _, b := range bms {
		switch b.ItemType {
		case items.FlashcardDeck:
			dids = append(dids, b.ItemID)
		case items.Pulse:
			pids = append(pids, b.ItemID)
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
	decks := map[uuid.UUID]gin.H{}
	if len(dids) > 0 {
		var ds []struct {
			ID        uuid.UUID
			Title     string
			CardCount int
			Subject   *string
			Chapter   *string
		}
		h.DB.WithContext(ctx).Raw(`SELECT d.id, d.title, d.card_count, s.name AS subject, ch.name AS chapter FROM flashcard_decks d LEFT JOIN subjects s ON s.id = d.subject_id LEFT JOIN chapters ch ON ch.id = d.chapter_id WHERE d.id IN ?`, dids).Scan(&ds)
		for _, d := range ds {
			decks[d.ID] = gin.H{"id": d.ID, "title": d.Title, "card_count": d.CardCount, "subject": d.Subject, "chapter": d.Chapter}
		}
	}
	pulses := map[uuid.UUID]gin.H{}
	if len(pids) > 0 {
		var ps []struct {
			ID      uuid.UUID
			Title   string
			Subject string
			Chapter string
		}
		h.DB.WithContext(ctx).Raw(`SELECT p.id, p.title, s.name AS subject, ch.name AS chapter FROM pulse_items p JOIN subjects s ON s.id = p.subject_id JOIN chapters ch ON ch.id = p.chapter_id WHERE p.id IN ?`, pids).Scan(&ps)
		for _, p := range ps {
			pulses[p.ID] = gin.H{"id": p.ID, "title": p.Title, "subject": p.Subject, "chapter": p.Chapter}
		}
	}
	tagsBy := tagNames(h.DB, ctx, qids)
	mc := media.NewCollector()
	rows := make([]bookmarkRow, len(bms))
	for i, b := range bms {
		rows[i] = bookmarkRow{Bookmark: b}
		switch b.ItemType {
		case items.Question:
			if qq, ok := qs[b.ItemID]; ok {
				v := &bookmarkQuestion{ID: qq.ID, ContentFormat: qq.ContentFormat, QuestionText: qq.QuestionText, OptionA: qq.OptionA, OptionB: qq.OptionB,
					OptionC: qq.OptionC, OptionD: qq.OptionD, SubjectID: qq.SubjectID, ChapterID: qq.ChapterID, Difficulty: qq.Difficulty,
					Tags: tagsBy[qq.ID], RefBook: qq.RefBook, RefEdition: qq.RefEdition, RefPages: qq.RefPages}
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
		case items.FlashcardDeck:
			rows[i].Deck = decks[b.ItemID]
		case items.Pulse:
			rows[i].Pulse = pulses[b.ItemID]
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

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

// csvIDs reads "id1,id2" into UUIDs, ignoring anything that is not one.
func csvIDs(v string) []uuid.UUID {
	var out []uuid.UUID
	for _, p := range strings.Split(v, ",") {
		if id, err := uuid.Parse(strings.TrimSpace(p)); err == nil {
			out = append(out, id)
		}
	}
	return out
}

// Summary godoc
//
//	@Summary		Bookmark counts for the Bookmarks screen
//	@Description	For one item type (default question): the total, the count per bookmark type (collection) and the count per subject. Subjects are in the order Biology, Chemistry, Physics, then any others.
//	@Tags			Bookmarks
//	@Security		BearerAuth
//	@Produce		json
//	@Param			item_type	query		string	false	"question or flashcard"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/me/bookmarks/summary [get]
func (h *BookmarkHandler) Summary(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	it := c.DefaultQuery("item_type", items.Question)
	if it != items.Question && it != items.Flashcard && it != items.Pulse {
		respondErr(c, http.StatusBadRequest, "invalid_item_type", "item_type must be question, flashcard or pulse")
		return
	}
	var total int64
	h.DB.WithContext(ctx).Model(&models.Bookmark{}).Where("user_id = ? AND item_type IN ?", user.ID, typesFor(it)).Count(&total)
	var byCol []struct {
		CollectionID uuid.UUID `json:"collection_id"`
		N            int       `json:"count"`
	}
	h.DB.WithContext(ctx).Raw("SELECT collection_id, count(*) AS n FROM bookmarks WHERE user_id = ? AND item_type IN ? GROUP BY collection_id", user.ID, typesFor(it)).Scan(&byCol)
	subjectSQL := `SELECT q.subject_id AS subject_id, count(*) AS n FROM bookmarks b JOIN questions q ON q.id = b.item_id
		WHERE b.user_id = ? AND b.item_type = 'question' AND q.subject_id IS NOT NULL GROUP BY q.subject_id`
	switch it {
	case items.Flashcard:
		subjectSQL = `SELECT subject_id, sum(n)::int AS n FROM (
			SELECT d.subject_id AS subject_id, count(*) AS n FROM bookmarks b JOIN flashcards f ON f.id = b.item_id JOIN flashcard_decks d ON d.id = f.deck_id
			  WHERE b.user_id = ? AND b.item_type = 'flashcard' AND d.subject_id IS NOT NULL GROUP BY d.subject_id
			UNION ALL
			SELECT d.subject_id, count(*) FROM bookmarks b JOIN flashcard_decks d ON d.id = b.item_id
			  WHERE b.user_id = ? AND b.item_type = 'flashcard_deck' AND d.subject_id IS NOT NULL GROUP BY d.subject_id) u GROUP BY subject_id`
	case items.Pulse:
		subjectSQL = `SELECT p.subject_id AS subject_id, count(*) AS n FROM bookmarks b JOIN pulse_items p ON p.id = b.item_id
			WHERE b.user_id = ? AND b.item_type = 'pulse' GROUP BY p.subject_id`
	}
	var bySubject []struct {
		SubjectID uuid.UUID
		N         int
	}
	if it == items.Flashcard {
		h.DB.WithContext(ctx).Raw(subjectSQL, user.ID, user.ID).Scan(&bySubject)
	} else {
		h.DB.WithContext(ctx).Raw(subjectSQL, user.ID).Scan(&bySubject)
	}
	counts := map[uuid.UUID]int{}
	for _, x := range bySubject {
		counts[x.SubjectID] = x.N
	}
	// Every subject of the student's course is listed, even with no bookmarks, so the landing always has the same rows.
	var subs []models.Subject
	q := h.DB.WithContext(ctx).Model(&models.Subject{})
	if user.SelectedCourseID != nil {
		q = q.Where("course_id = ?", *user.SelectedCourseID)
	}
	q.Find(&subs)
	rank := func(name string) int {
		switch strings.ToLower(name) {
		case "biology":
			return 0
		case "chemistry":
			return 1
		case "physics":
			return 2
		}
		return 3
	}
	slices.SortFunc(subs, func(a, b models.Subject) int {
		if ra, rb := rank(a.Name), rank(b.Name); ra != rb {
			return ra - rb
		}
		return strings.Compare(a.Name, b.Name)
	})
	subjects := make([]gin.H, 0, len(subs))
	for _, sj := range subs {
		subjects = append(subjects, gin.H{"subject_id": sj.ID, "name": sj.Name, "count": counts[sj.ID]})
	}
	var colOut interface{} = byCol
	if byCol == nil {
		colOut = []interface{}{}
	}
	c.JSON(http.StatusOK, gin.H{"total": total, "by_collection": colOut, "by_subject": subjects})
}

type checkRequest struct {
	Option string `json:"option"`
}

// CheckQuestion godoc
//
//	@Summary		Answer a bookmarked question again, without saving anything
//	@Description	Returns whether the chosen option is right, the correct option, the explanation and, where enough students have answered, the share who chose each option. Nothing is written: attempts, accuracy, progress, goals and streak are untouched. Only a question the student has bookmarked can be checked.
//	@Tags			Bookmarks
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string			true	"Question UUID"
//	@Param			body	body		checkRequest	true	"Chosen option"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/me/bookmarks/questions/{id}/check [post]
func (h *BookmarkHandler) CheckQuestion(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var req checkRequest
	// An empty option means the time ran out with no answer: the answer is shown and nothing is marked right.
	if c.ShouldBindJSON(&req) != nil || !slices.Contains([]string{"", "A", "B", "C", "D"}, req.Option) {
		respondErr(c, http.StatusBadRequest, "invalid_option", "option must be A, B, C, D or empty for no answer")
		return
	}
	var n int64
	h.DB.WithContext(ctx).Model(&models.Bookmark{}).Where("user_id = ? AND item_type = 'question' AND item_id = ?", user.ID, id).Count(&n)
	if n == 0 {
		respondErr(c, http.StatusNotFound, "not_bookmarked", "only a bookmarked question can be re-attempted here")
		return
	}
	var qq models.Question
	if h.DB.WithContext(ctx).First(&qq, "id = ?", id).Error != nil {
		respondErr(c, http.StatusNotFound, "not_found", "question not found")
		return
	}
	mc := media.NewCollector()
	mc.Add(qq.ContentFormat, qq.Explanation)
	shares := optionShares(h.DB, ctx, []uuid.UUID{id})[id]
	out := gin.H{
		"is_correct": req.Option != "" && string(qq.CorrectOption) == req.Option, "tags": tagNames(h.DB, ctx, []uuid.UUID{id})[id],
		"ref_book": qq.RefBook, "ref_edition": qq.RefEdition, "ref_pages": qq.RefPages, "correct_option": qq.CorrectOption, "explanation": qq.Explanation,
		"content_format": qq.ContentFormat, "media": media.NewService(h.DB).ResolveCollector(ctx, mc, media.URLTTL(nil)),
	}
	if shares != nil {
		out["option_shares"] = shares
		out["percent_correct"] = shares[string(qq.CorrectOption)]
	}
	c.JSON(http.StatusOK, out)
}
