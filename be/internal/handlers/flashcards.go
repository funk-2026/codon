package handlers

import (
	"math"
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
	"codon-backend/internal/settings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// FlashcardHandler: decks + cards authored by teachers (rich text + images),
// approved by admins, studied by students with spaced repetition.
type FlashcardHandler struct {
	DB          *gorm.DB
	Sub         *services.SubscriptionService
	KYCRequired func() bool
}

func NewFlashcardHandler(db *gorm.DB, sub *services.SubscriptionService, kyc func() bool) *FlashcardHandler {
	if kyc == nil {
		kyc = func() bool { return false }
	}
	return &FlashcardHandler{DB: db, Sub: sub, KYCRequired: kyc}
}

type deckRequest struct {
	Title                *string `json:"title"`
	Description          *string `json:"description"`
	CourseID             *string `json:"course_id"`
	SubjectID            *string `json:"subject_id"`
	ChapterID            *string `json:"chapter_id"`
	RequiresSubscription *bool   `json:"requires_subscription"`
}

type cardRequest struct {
	Front *string `json:"front"`
	Back  *string `json:"back"`
}

func (h *FlashcardHandler) mediaOfCards(c *gin.Context, cards []models.Flashcard) map[string]media.View {
	mc := media.NewCollector()
	for i := range cards {
		mc.Add(cards[i].ContentFormat, &cards[i].Front, &cards[i].Back)
	}
	return media.NewService(h.DB).ResolveCollector(c.Request.Context(), mc, media.URLTTL(nil))
}

func (h *FlashcardHandler) myDeck(c *gin.Context) (*models.FlashcardDeck, bool) {
	user := middleware.GetUser(c)
	var d models.FlashcardDeck
	q := h.DB.WithContext(c.Request.Context()).Where("id = ?", c.Param("id"))
	if !canManageAllContent(user) {
		q = q.Where("author_id = ?", user.ID)
	}
	if q.First(&d).Error != nil {
		respondErr(c, http.StatusNotFound, "deck_not_found", "deck not found")
		return nil, false
	}
	return &d, true
}

func deckEditable(d *models.FlashcardDeck) bool {
	return d.Status == models.StatusDraft || d.Status == models.StatusRejected
}

// ── Teacher: decks ────────────────────────────────────────────────────────────

// CreateDeck godoc
//
//	@Summary		Create a flashcard deck (Teacher)
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		deckRequest	true	"Deck"
//	@Success		201		{object}	models.FlashcardDeck
//	@Router			/api/v1/teacher/flashcard-decks [post]
func (h *FlashcardHandler) CreateDeck(c *gin.Context) {
	user := middleware.GetUser(c)
	var req deckRequest
	if c.ShouldBindJSON(&req) != nil || req.Title == nil || req.CourseID == nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "title and course_id are required")
		return
	}
	title := strings.TrimSpace(*req.Title)
	cid, err := uuid.Parse(*req.CourseID)
	if title == "" || utf8.RuneCountInString(title) > 120 || err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "title (1-120 chars) and a valid course_id are required")
		return
	}
	var course models.Course
	if h.DB.First(&course, "id = ?", cid).Error != nil {
		respondErr(c, http.StatusNotFound, "course_not_found", "course not found")
		return
	}
	d := models.FlashcardDeck{Title: title, CourseID: cid, AuthorID: user.ID, Status: models.StatusDraft, RequiresSubscription: course.Slug == "neet-ug"}
	if req.Description != nil {
		d.Description = *req.Description
	}
	if req.RequiresSubscription != nil {
		d.RequiresSubscription = *req.RequiresSubscription
	}
	if !h.setTaxonomy(c, &d, req) {
		return
	}
	want := d.RequiresSubscription
	h.DB.Create(&d)
	// GORM replaces a false bool on a default:true column with the default (and writes
	// it back into the struct), so persist the value captured BEFORE the insert.
	h.DB.Model(&d).UpdateColumn("requires_subscription", want)
	d.RequiresSubscription = want
	c.JSON(http.StatusCreated, d)
}

func (h *FlashcardHandler) setTaxonomy(c *gin.Context, d *models.FlashcardDeck, req deckRequest) bool {
	if req.ChapterID != nil && *req.ChapterID != "" {
		id, err := uuid.Parse(*req.ChapterID)
		var ch models.Chapter
		if err != nil || h.DB.Preload("Subject").First(&ch, "id = ?", id).Error != nil || ch.Subject.CourseID != d.CourseID {
			respondErr(c, http.StatusUnprocessableEntity, "unknown_chapter", "chapter not found in this course")
			return false
		}
		d.ChapterID, d.SubjectID = &ch.ID, &ch.SubjectID
	} else if req.SubjectID != nil && *req.SubjectID != "" {
		id, err := uuid.Parse(*req.SubjectID)
		var sub models.Subject
		if err != nil || h.DB.First(&sub, "id = ? AND course_id = ?", id, d.CourseID).Error != nil {
			respondErr(c, http.StatusUnprocessableEntity, "unknown_subject", "subject not found in this course")
			return false
		}
		d.SubjectID = &sub.ID
	}
	return true
}

// UpdateDeck godoc
//
//	@Summary		Edit a deck (Teacher) — draft/rejected only
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string		true	"Deck UUID"
//	@Param			body	body		deckRequest	true	"Fields"
//	@Success		200		{object}	models.FlashcardDeck
//	@Router			/api/v1/teacher/flashcard-decks/{id} [patch]
func (h *FlashcardHandler) UpdateDeck(c *gin.Context) {
	d, ok := h.myDeck(c)
	if !ok {
		return
	}
	if !deckEditable(d) {
		respondErr(c, http.StatusConflict, "locked", "only drafts and rejected decks can be edited")
		return
	}
	var req deckRequest
	if c.ShouldBindJSON(&req) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if t == "" || utf8.RuneCountInString(t) > 120 {
			respondErr(c, http.StatusBadRequest, "invalid_title", "title must be 1-120 characters")
			return
		}
		d.Title = t
	}
	if req.Description != nil {
		d.Description = *req.Description
	}
	if req.RequiresSubscription != nil {
		d.RequiresSubscription = *req.RequiresSubscription
	}
	if !h.setTaxonomy(c, d, req) {
		return
	}
	h.DB.Select("*").Save(d)
	c.JSON(http.StatusOK, d)
}

// DeleteDeck godoc
//
//	@Summary		Delete a draft/rejected deck (Teacher)
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Deck UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/teacher/flashcard-decks/{id} [delete]
func (h *FlashcardHandler) DeleteDeck(c *gin.Context) {
	d, ok := h.myDeck(c)
	if !ok {
		return
	}
	if !deckEditable(d) {
		respondErr(c, http.StatusConflict, "locked", "approved or published decks can't be deleted")
		return
	}
	h.DB.Transaction(func(tx *gorm.DB) error {
		var ids []uuid.UUID
		tx.Model(&models.Flashcard{}).Where("deck_id = ?", d.ID).Pluck("id", &ids)
		for _, id := range ids {
			media.DeleteRefs(tx, "flashcard", id)
			items.Cleanup(tx, items.Flashcard, id)
			tx.Where("card_id = ?", id).Delete(&models.FlashcardState{})
		}
		tx.Where("deck_id = ?", d.ID).Delete(&models.Flashcard{})
		items.Cleanup(tx, items.FlashcardDeck, d.ID)
		return tx.Delete(d).Error
	})
	c.JSON(http.StatusOK, messageResponse{Message: "deck deleted"})
}

// SubmitDeck godoc
//
//	@Summary		Submit a deck for review (Teacher)
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Deck UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/teacher/flashcard-decks/{id}/submit-for-review [post]
func (h *FlashcardHandler) SubmitDeck(c *gin.Context) {
	d, ok := h.myDeck(c)
	if !ok {
		return
	}
	if !deckEditable(d) {
		respondErr(c, http.StatusConflict, "locked", "already submitted")
		return
	}
	if d.CardCount < 1 {
		respondErr(c, http.StatusUnprocessableEntity, "incomplete", "add at least one card first")
		return
	}
	h.DB.Model(d).Update("status", models.StatusPendingReview)
	c.JSON(http.StatusOK, messageResponse{Message: "submitted for review"})
}

// PublishDeck godoc
//
//	@Summary		Publish an approved deck (Teacher)
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Deck UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/teacher/flashcard-decks/{id}/publish [post]
func (h *FlashcardHandler) PublishDeck(c *gin.Context) {
	d, ok := h.myDeck(c)
	if !ok {
		return
	}
	if d.Status != models.StatusApproved {
		respondErr(c, http.StatusConflict, "not_approved", "only approved decks can be published")
		return
	}
	h.DB.Model(d).Update("status", models.StatusPublished)
	c.JSON(http.StatusOK, messageResponse{Message: "published"})
}

// TeacherDecks godoc
//
//	@Summary		My decks (Teacher)
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/teacher/flashcard-decks [get]
func (h *FlashcardHandler) TeacherDecks(c *gin.Context) {
	user := middleware.GetUser(c)
	var ds []models.FlashcardDeck
	q := h.DB.Order("created_at DESC")
	if !canManageAllContent(user) {
		q = q.Where("author_id = ?", user.ID)
	}
	q.Find(&ds)
	c.JSON(http.StatusOK, gin.H{"decks": ds})
}

// TeacherDeck godoc
//
//	@Summary		One of my decks with all cards (Teacher)
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Deck UUID"
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/teacher/flashcard-decks/{id} [get]
func (h *FlashcardHandler) TeacherDeck(c *gin.Context) {
	d, ok := h.myDeck(c)
	if !ok {
		return
	}
	h.deckWithCards(c, d)
}

func (h *FlashcardHandler) deckWithCards(c *gin.Context, d *models.FlashcardDeck) {
	var cards []models.Flashcard
	h.DB.Where("deck_id = ?", d.ID).Order("position ASC, created_at ASC").Find(&cards)
	c.JSON(http.StatusOK, gin.H{"deck": d, "cards": cards, "media": h.mediaOfCards(c, cards)})
}

// ── Teacher: cards ────────────────────────────────────────────────────────────

func (h *FlashcardHandler) saveCard(c *gin.Context, tx *gorm.DB, actor *models.User, card *models.Flashcard, req cardRequest) error {
	if req.Front != nil {
		card.Front = *req.Front
	}
	if req.Back != nil {
		card.Back = *req.Back
	}
	if strings.TrimSpace(card.Front) == "" || strings.TrimSpace(card.Back) == "" {
		return services.Coded(http.StatusBadRequest, "missing_content", "both sides of the card need content")
	}
	return media.SaveRefs(c.Request.Context(), tx, actor, "flashcard", card.ID, card.ContentFormat, []media.Field{
		{Name: "front", Text: card.Front, Kind: "option"}, {Name: "back", Text: card.Back, Kind: "explanation"}})
}

// AddCard godoc
//
//	@Summary		Add a card to a deck (Teacher)
//	@Description	Both sides are rich text v1 and may contain images (`flashcard_image` media).
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string		true	"Deck UUID"
//	@Param			body	body		cardRequest	true	"Card"
//	@Success		201		{object}	models.Flashcard
//	@Router			/api/v1/teacher/flashcard-decks/{id}/cards [post]
func (h *FlashcardHandler) AddCard(c *gin.Context) {
	user := middleware.GetUser(c)
	d, ok := h.myDeck(c)
	if !ok {
		return
	}
	if !deckEditable(d) {
		respondErr(c, http.StatusConflict, "locked", "cards can only be added to draft or rejected decks")
		return
	}
	var req cardRequest
	if c.ShouldBindJSON(&req) != nil || req.Front == nil || req.Back == nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "front and back are required")
		return
	}
	card := models.Flashcard{ID: uuid.New(), DeckID: d.ID, ContentFormat: models.ContentFormatRichV1}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var pos struct{ Max int }
		tx.Model(&models.Flashcard{}).Select("COALESCE(MAX(position), 0) AS max").Where("deck_id = ?", d.ID).Scan(&pos)
		card.Position = pos.Max + 1
		if err := h.saveCard(c, tx, user, &card, req); err != nil {
			return err
		}
		if err := tx.Create(&card).Error; err != nil {
			return err
		}
		return tx.Model(d).UpdateColumn("card_count", gorm.Expr("card_count + 1")).Error
	})
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"card": card, "media": h.mediaOfCards(c, []models.Flashcard{card})})
}

func (h *FlashcardHandler) cardAndDeck(c *gin.Context) (*models.Flashcard, *models.FlashcardDeck, bool) {
	user := middleware.GetUser(c)
	var card models.Flashcard
	var d models.FlashcardDeck
	if h.DB.First(&card, "id = ?", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "card_not_found", "card not found")
		return nil, nil, false
	}
	q := h.DB.Where("id = ?", card.DeckID)
	if !canManageAllContent(user) {
		q = q.Where("author_id = ?", user.ID)
	}
	if q.First(&d).Error != nil {
		respondErr(c, http.StatusNotFound, "card_not_found", "card not found")
		return nil, nil, false
	}
	if !deckEditable(&d) {
		respondErr(c, http.StatusConflict, "locked", "cards of a live deck can't be edited")
		return nil, nil, false
	}
	return &card, &d, true
}

// UpdateCard godoc
//
//	@Summary		Edit a card (Teacher)
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string		true	"Card UUID"
//	@Param			body	body		cardRequest	true	"Fields"
//	@Success		200		{object}	models.Flashcard
//	@Router			/api/v1/teacher/flashcards/{id} [patch]
func (h *FlashcardHandler) UpdateCard(c *gin.Context) {
	user := middleware.GetUser(c)
	card, _, ok := h.cardAndDeck(c)
	if !ok {
		return
	}
	var req cardRequest
	if c.ShouldBindJSON(&req) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := h.saveCard(c, tx, user, card, req); err != nil {
			return err
		}
		return tx.Save(card).Error
	})
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"card": card, "media": h.mediaOfCards(c, []models.Flashcard{*card})})
}

// DeleteCard godoc
//
//	@Summary		Delete a card (Teacher)
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Card UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/teacher/flashcards/{id} [delete]
func (h *FlashcardHandler) DeleteCard(c *gin.Context) {
	card, d, ok := h.cardAndDeck(c)
	if !ok {
		return
	}
	h.DB.Transaction(func(tx *gorm.DB) error {
		media.DeleteRefs(tx, "flashcard", card.ID)
		items.Cleanup(tx, items.Flashcard, card.ID)
		tx.Where("card_id = ?", card.ID).Delete(&models.FlashcardState{})
		tx.Delete(card)
		return tx.Model(d).UpdateColumn("card_count", gorm.Expr("GREATEST(card_count - 1, 0)")).Error
	})
	c.JSON(http.StatusOK, messageResponse{Message: "card deleted"})
}

type reorderRequest struct {
	IDs []string `json:"ids"`
}

// ReorderCards godoc
//
//	@Summary		Reorder a deck's cards (Teacher)
//	@Description	Send every card id of the deck in the new order.
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Accept			json
//	@Param			id		path	string			true	"Deck UUID"
//	@Param			body	body	reorderRequest	true	"Ordered ids"
//	@Success		200		{object}	messageResponse
//	@Router			/api/v1/teacher/flashcard-decks/{id}/reorder [post]
func (h *FlashcardHandler) ReorderCards(c *gin.Context) {
	d, ok := h.myDeck(c)
	if !ok {
		return
	}
	var req reorderRequest
	if c.ShouldBindJSON(&req) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "ids required")
		return
	}
	var cards []models.Flashcard
	h.DB.Where("deck_id = ?", d.ID).Find(&cards)
	have := map[string]bool{}
	for _, cd := range cards {
		have[cd.ID.String()] = true
	}
	if len(req.IDs) != len(cards) {
		respondErr(c, http.StatusUnprocessableEntity, "bad_order", "send every card id of the deck exactly once")
		return
	}
	for _, id := range req.IDs {
		if !have[id] {
			respondErr(c, http.StatusUnprocessableEntity, "bad_order", "unknown card id: "+id)
			return
		}
		delete(have, id)
	}
	h.DB.Transaction(func(tx *gorm.DB) error {
		for i, id := range req.IDs {
			tx.Model(&models.Flashcard{}).Where("id = ?", id).Update("position", i+1)
		}
		return nil
	})
	c.JSON(http.StatusOK, messageResponse{Message: "reordered"})
}

// ── Admin review ──────────────────────────────────────────────────────────────

// AdminDecks godoc
//
//	@Summary		Decks by status (Admin) — default pending review
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/admin/flashcard-decks [get]
func (h *FlashcardHandler) AdminDecks(c *gin.Context) {
	var ds []models.FlashcardDeck
	h.DB.Where("status = ?", c.DefaultQuery("status", string(models.StatusPendingReview))).Order("created_at DESC").Find(&ds)
	c.JSON(http.StatusOK, gin.H{"decks": ds})
}

// AdminDeck godoc
//
//	@Summary		A deck with all cards for review (Admin)
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Deck UUID"
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/admin/flashcard-decks/{id} [get]
func (h *FlashcardHandler) AdminDeck(c *gin.Context) {
	var d models.FlashcardDeck
	if h.DB.First(&d, "id = ?", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "deck_not_found", "deck not found")
		return
	}
	h.deckWithCards(c, &d)
}

// AdminApproveDeck godoc
//
//	@Summary		Approve a deck (Admin)
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Deck UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/admin/flashcard-decks/{id}/approve [post]
func (h *FlashcardHandler) AdminApproveDeck(c *gin.Context) {
	var d models.FlashcardDeck
	if h.DB.First(&d, "id = ? AND status = ?", c.Param("id"), models.StatusPendingReview).Error != nil {
		respondErr(c, http.StatusNotFound, "deck_not_found", "deck not found or not pending review")
		return
	}
	h.DB.Model(&d).Update("status", models.StatusApproved)
	services.Notify(h.DB, d.AuthorID, "deck_approved", "Your flashcard deck was approved", d.Title, map[string]interface{}{"id": d.ID})
	c.JSON(http.StatusOK, messageResponse{Message: "approved"})
}

// AdminRejectDeck godoc
//
//	@Summary		Reject a deck (Admin)
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Accept			json
//	@Param			id		path	string					true	"Deck UUID"
//	@Param			body	body	rejectContentRequest	true	"Reason"
//	@Success		200		{object}	messageResponse
//	@Router			/api/v1/admin/flashcard-decks/{id}/reject [post]
func (h *FlashcardHandler) AdminRejectDeck(c *gin.Context) {
	var req rejectContentRequest
	if c.ShouldBindJSON(&req) != nil || len(req.Reason) < 3 {
		respondErr(c, http.StatusBadRequest, "bad_request", "a reason is required")
		return
	}
	var d models.FlashcardDeck
	if h.DB.First(&d, "id = ? AND status = ?", c.Param("id"), models.StatusPendingReview).Error != nil {
		respondErr(c, http.StatusNotFound, "deck_not_found", "deck not found or not pending review")
		return
	}
	h.DB.Model(&d).Updates(map[string]interface{}{"status": models.StatusRejected, "rejection_reason": req.Reason})
	services.Notify(h.DB, d.AuthorID, "deck_rejected", "Your flashcard deck needs changes", req.Reason, map[string]interface{}{"id": d.ID})
	c.JSON(http.StatusOK, messageResponse{Message: "rejected"})
}

// ── Student ───────────────────────────────────────────────────────────────────

func (h *FlashcardHandler) canStudy(c *gin.Context, d *models.FlashcardDeck) bool {
	user := middleware.GetUser(c)
	if err := h.Sub.CheckAccess(c.Request.Context(), user, d.RequiresSubscription, d.CourseID, h.KYCRequired()); err != nil {
		respondErr(c, http.StatusForbidden, "subscription_required", err.Error())
		return false
	}
	return true
}

func (h *FlashcardHandler) publishedDeck(c *gin.Context) (*models.FlashcardDeck, bool) {
	var d models.FlashcardDeck
	if h.DB.First(&d, "id = ? AND status = ?", c.Param("id"), models.StatusPublished).Error != nil {
		respondErr(c, http.StatusNotFound, "deck_not_found", "deck not found")
		return nil, false
	}
	return &d, true
}

type deckCard struct {
	models.FlashcardDeck
	Locked   bool `json:"locked"`
	New      int  `json:"new_cards"`
	Due      int  `json:"due_cards"`
	Learned  int  `json:"learned_cards"`
	MyRating *int `json:"my_rating,omitempty"`
}

// StudentDecks godoc
//
//	@Summary		Browse published decks (Student)
//	@Description	Filters: course_id, subject_id, chapter_id, q (title). `sort=rating`. Each deck carries `locked` (subscription), and the caller's progress: new / due / learned cards. Decks the student can't open are still listed (locked) so they can be discovered.
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/flashcards/decks [get]
func (h *FlashcardHandler) StudentDecks(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	limit := pagination.Limit(c.Query("limit"))
	q := h.DB.WithContext(ctx).Model(&models.FlashcardDeck{}).Where("flashcard_decks.status = ? AND flashcard_decks.card_count > 0", models.StatusPublished)
	for _, f := range [][2]string{{"course_id", "flashcard_decks.course_id"}, {"subject_id", "flashcard_decks.subject_id"}, {"chapter_id", "flashcard_decks.chapter_id"}} {
		if v := c.Query(f[0]); v != "" {
			q = q.Where(f[1]+" = ?", v)
		}
	}
	if v := strings.TrimSpace(c.Query("q")); v != "" {
		q = q.Where("flashcard_decks.title ILIKE ?", "%"+v+"%")
	}
	sortRating := c.Query("sort") == "rating"
	if sortRating {
		q = q.Order("rating_avg DESC, rating_count DESC").Limit(limit)
	} else {
		q = pagination.Apply(q, "flashcard_decks", pagination.Decode(c.Query("cursor")), limit)
	}
	var ds []models.FlashcardDeck
	q.Find(&ds)
	next := ""
	if !sortRating {
		ds, next = pagination.Page(ds, limit, func(d models.FlashcardDeck) (time.Time, uuid.UUID) { return d.CreatedAt, d.ID })
	}
	out := make([]deckCard, len(ds))
	ids := make([]uuid.UUID, len(ds))
	for i, d := range ds {
		ids[i] = d.ID
	}
	type prog struct {
		DeckID  uuid.UUID
		Seen    int
		Due     int
		Learned int
	}
	progs := map[uuid.UUID]prog{}
	if len(ids) > 0 {
		var ps []prog
		h.DB.WithContext(ctx).Raw(`SELECT f.deck_id, count(s.card_id) AS seen,
			count(s.card_id) FILTER (WHERE s.due_at <= now()) AS due, count(s.card_id) FILTER (WHERE s.reps > 0) AS learned
			FROM flashcards f JOIN flashcard_states s ON s.card_id = f.id AND s.user_id = ?
			WHERE f.deck_id IN ? GROUP BY f.deck_id`, user.ID, ids).Scan(&ps)
		for _, p := range ps {
			progs[p.DeckID] = p
		}
	}
	mine := map[uuid.UUID]int{}
	if len(ids) > 0 {
		var rs []models.Rating
		h.DB.WithContext(ctx).Where("user_id = ? AND item_type = 'flashcard_deck' AND item_id IN ?", user.ID, ids).Find(&rs)
		for _, r := range rs {
			mine[r.ItemID] = r.Value
		}
	}
	for i, d := range ds {
		p := progs[d.ID]
		out[i] = deckCard{FlashcardDeck: d, New: d.CardCount - p.Seen, Due: p.Due, Learned: p.Learned,
			Locked: h.Sub.CheckAccess(ctx, user, d.RequiresSubscription, d.CourseID, h.KYCRequired()) != nil}
		if v, ok := mine[d.ID]; ok {
			vv := v
			out[i].MyRating = &vv
		}
	}
	c.JSON(http.StatusOK, gin.H{"decks": out, "next_cursor": nilIfEmpty(next)})
}

// StudentDeckCards godoc
//
//	@Summary		Browse all cards of a deck (Student)
//	@Description	Ordered by position, cursor = last position. Subject to the deck's subscription rule.
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id		path		string	true	"Deck UUID"
//	@Param			cursor	query		int		false	"Last position"
//	@Param			limit	query		int		false	"Default 50"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/flashcards/decks/{id}/cards [get]
func (h *FlashcardHandler) StudentDeckCards(c *gin.Context) {
	d, ok := h.publishedDeck(c)
	if !ok || !h.canStudy(c, d) {
		return
	}
	limit := 50
	if n := atoiDefault(c.Query("limit"), 50); n > 0 && n <= 200 {
		limit = n
	}
	q := h.DB.Where("deck_id = ?", d.ID).Order("position ASC").Limit(limit + 1)
	if cur := atoiDefault(c.Query("cursor"), -1); cur >= 0 {
		q = q.Where("position > ?", cur)
	}
	var cards []models.Flashcard
	q.Find(&cards)
	next := ""
	if len(cards) > limit {
		cards = cards[:limit]
		next = itoa(cards[len(cards)-1].Position)
	}
	c.JSON(http.StatusOK, gin.H{"deck": d, "cards": cards, "next_cursor": nilIfEmpty(next), "media": h.mediaOfCards(c, cards)})
}

type studyCard struct {
	models.Flashcard
	State string `json:"state"` // due | new
}

func (h *FlashcardHandler) studyQueue(c *gin.Context, deckIDs []uuid.UUID, limit int) []studyCard {
	user := middleware.GetUser(c)
	var due []models.Flashcard
	h.DB.Raw(`SELECT f.* FROM flashcards f JOIN flashcard_states s ON s.card_id = f.id AND s.user_id = ?
		WHERE f.deck_id IN ? AND s.due_at <= now() ORDER BY s.due_at ASC LIMIT ?`, user.ID, deckIDs, limit).Scan(&due)
	out := make([]studyCard, 0, limit)
	for _, d := range due {
		out = append(out, studyCard{d, "due"})
	}
	if len(out) < limit {
		var fresh []models.Flashcard
		h.DB.Raw(`SELECT f.* FROM flashcards f WHERE f.deck_id IN ? AND NOT EXISTS
			(SELECT 1 FROM flashcard_states s WHERE s.card_id = f.id AND s.user_id = ?) ORDER BY f.position ASC LIMIT ?`,
			deckIDs, user.ID, limit-len(out)).Scan(&fresh)
		for _, f := range fresh {
			out = append(out, studyCard{f, "new"})
		}
	}
	return out
}

// Study godoc
//
//	@Summary		Next cards to study in a deck (Student)
//	@Description	Cards whose review is due (oldest first), then unseen cards in deck order, up to `limit` (default 20, max 50) — the deck's spaced-repetition queue.
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id		path		string	true	"Deck UUID"
//	@Param			limit	query		int		false	"Default 20"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/flashcards/decks/{id}/study [get]
func (h *FlashcardHandler) Study(c *gin.Context) {
	d, ok := h.publishedDeck(c)
	if !ok || !h.canStudy(c, d) {
		return
	}
	limit := 20
	if n := atoiDefault(c.Query("limit"), 20); n > 0 && n <= 50 {
		limit = n
	}
	q := h.studyQueue(c, []uuid.UUID{d.ID}, limit)
	cards := make([]models.Flashcard, len(q))
	for i := range q {
		cards[i] = q[i].Flashcard
	}
	c.JSON(http.StatusOK, gin.H{"deck": d, "cards": q, "media": h.mediaOfCards(c, cards)})
}

// Quick godoc
//
//	@Summary		Quick-questions session across decks (Student)
//	@Description	A short, time-boxed set (default 10, max 30) of due-then-new cards from decks the student can open, optionally limited to a course/chapter — distinct from a full Q Bank session.
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Produce		json
//	@Param			course_id	query		string	false	"Course UUID"
//	@Param			chapter_id	query		string	false	"Chapter UUID"
//	@Param			count		query		int		false	"Default 10"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/flashcards/quick [get]
func (h *FlashcardHandler) Quick(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	count := 10
	if n := atoiDefault(c.Query("count"), 10); n > 0 && n <= 30 {
		count = n
	}
	q := h.DB.WithContext(ctx).Where("status = ? AND card_count > 0", models.StatusPublished)
	if v := c.Query("course_id"); v != "" {
		q = q.Where("course_id = ?", v)
	}
	if v := c.Query("chapter_id"); v != "" {
		q = q.Where("chapter_id = ?", v)
	}
	var ds []models.FlashcardDeck
	q.Find(&ds)
	var ids []uuid.UUID
	for _, d := range ds {
		if h.Sub.CheckAccess(ctx, user, d.RequiresSubscription, d.CourseID, h.KYCRequired()) == nil {
			ids = append(ids, d.ID)
		}
	}
	if len(ids) == 0 {
		c.JSON(http.StatusOK, gin.H{"cards": []studyCard{}, "media": map[string]media.View{}, "minutes_estimate": 0})
		return
	}
	qs := h.studyQueue(c, ids, count)
	cards := make([]models.Flashcard, len(qs))
	for i := range qs {
		cards[i] = qs[i].Flashcard
	}
	c.JSON(http.StatusOK, gin.H{"cards": qs, "media": h.mediaOfCards(c, cards), "minutes_estimate": (len(qs)*20 + 59) / 60})
}

type reviewCardRequest struct {
	Result string `json:"result" enums:"again,hard,good,easy"`
}

// nextInterval implements the flashcard spaced-repetition rule (days).
func nextInterval(result string, reps, interval int) (newReps, newInterval int, due time.Time) {
	now := time.Now()
	switch result {
	case "again":
		return 0, 0, now.Add(10 * time.Minute)
	case "hard":
		iv := int(math.Ceil(float64(interval) * 1.2))
		if iv < 1 {
			iv = 1
		}
		return reps + 1, iv, now.AddDate(0, 0, iv)
	case "easy":
		iv := 3
		if reps > 0 {
			iv = interval * 3
		}
		if iv > 180 {
			iv = 180
		}
		return reps + 1, iv, now.AddDate(0, 0, iv)
	}
	iv := 1
	if reps > 0 {
		iv = interval * 2
	}
	if iv > 180 {
		iv = 180
	}
	return reps + 1, iv, now.AddDate(0, 0, iv)
}

// Review godoc
//
//	@Summary		Grade a card (Student)
//	@Description	`again` (due in 10 min, streak resets), `hard` (×1.2), `good` (1 d, then ×2), `easy` (3 d, then ×3); interval capped at 180 days. Counts toward the daily streak.
//	@Tags			Flashcards
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string				true	"Card UUID"
//	@Param			body	body		reviewCardRequest	true	"Result"
//	@Success		200		{object}	models.FlashcardState
//	@Router			/api/v1/flashcards/cards/{id}/review [post]
func (h *FlashcardHandler) Review(c *gin.Context) {
	user := middleware.GetUser(c)
	var req reviewCardRequest
	if c.ShouldBindJSON(&req) != nil || (req.Result != "again" && req.Result != "hard" && req.Result != "good" && req.Result != "easy") {
		respondErr(c, http.StatusBadRequest, "invalid_result", "result must be again, hard, good or easy")
		return
	}
	var card models.Flashcard
	var d models.FlashcardDeck
	if h.DB.First(&card, "id = ?", c.Param("id")).Error != nil || h.DB.First(&d, "id = ? AND status = ?", card.DeckID, models.StatusPublished).Error != nil {
		respondErr(c, http.StatusNotFound, "card_not_found", "card not found")
		return
	}
	if !h.canStudy(c, &d) {
		return
	}
	var st models.FlashcardState
	h.DB.Where("user_id = ? AND card_id = ?", user.ID, card.ID).First(&st)
	reps, iv, due := nextInterval(req.Result, st.Reps, st.IntervalDays)
	st = models.FlashcardState{UserID: user.ID, CardID: card.ID, Reps: reps, IntervalDays: iv, DueAt: due, LastResult: req.Result}
	h.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "card_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"reps", "interval_days", "due_at", "last_result", "updated_at"}),
	}).Create(&st)
	services.RecordDailyActivity(h.DB, user.ID, time.Now())
	_ = settings.Default
	c.JSON(http.StatusOK, st)
}
