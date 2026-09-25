package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"codon-backend/internal/media"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AttemptHandler struct {
	DB          *gorm.DB
	ScoringKSvc *services.ScoringService
}

func NewAttemptHandler(db *gorm.DB, scoringSvc *services.ScoringService) *AttemptHandler {
	return &AttemptHandler{DB: db, ScoringKSvc: scoringSvc}
}

// respondService translates a service error into the standard coded envelope.
func respondService(c *gin.Context, err error) {
	var ce *services.CodedError
	if errors.As(err, &ce) {
		respondErr(c, ce.Status, ce.Code, ce.Msg, ce.Details)
		return
	}
	respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
}

// sessionCtx tags the request context with the caller's login session (for the
// one-active-device-per-attempt rule).
func sessionCtx(c *gin.Context) context.Context {
	var id *uuid.UUID
	if sess := middleware.GetSession(c); sess != nil {
		id = &sess.ID
	}
	return services.WithSession(c.Request.Context(), id)
}

// visibleToUser reports whether a test may be seen by this user: public tests
// by everyone, private (generated) tests only by their owner.
func visibleToUser(t *models.Test, userID uuid.UUID) bool {
	if t.Visibility != models.VisibilityPrivate {
		return true
	}
	return t.OwnerUserID != nil && *t.OwnerUserID == userID
}

// StartAttempt godoc
//
//	@Summary		Start or resume a test attempt
//	@Description	Starts a new attempt for the given test, or resumes the in-progress one. Timed tests get a server-side deadline (`attempt.expires_at`); `server_now` lets the client correct for clock skew. If the previous attempt already ran out of time it is auto-submitted and 409 `attempt_expired` (with the attempt id) is returned. Subscription gating is checked by the route before this handler runs.
//	@Tags			Attempts
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Test UUID"
//	@Success		200	{object}	services.StartResult
//	@Failure		403	{object}	errorResponse	"Subscription required"
//	@Failure		404	{object}	errorResponse
//	@Failure		409	{object}	errorResponse	"attempt_expired"
//	@Router			/api/v1/tests/{id}/attempts [post]
func (h *AttemptHandler) StartAttempt(c *gin.Context) {
	user := middleware.GetUser(c)
	testID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid test id")
		return
	}

	var test models.Test
	if err := h.DB.WithContext(c.Request.Context()).
		Where("id = ? AND status = ? AND archived_at IS NULL", testID, models.StatusPublished).
		First(&test).Error; err != nil || !visibleToUser(&test, user.ID) {
		respondErr(c, http.StatusNotFound, "test_not_found", "test not found")
		return
	}

	res, err := h.ScoringKSvc.StartAttempt(sessionCtx(c), user.ID, &test)
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, res)
}

// optString distinguishes "field absent" from "field: null" (clear the answer).
type optString struct {
	Set bool
	Val *string
}

func (o *optString) UnmarshalJSON(b []byte) error {
	o.Set = true
	if string(b) == "null" {
		o.Val = nil
		return nil
	}
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	o.Val = &s
	return nil
}

type upsertAnswerRequest struct {
	SelectedOption   optString  `json:"selected_option" swaggertype:"string" example:"B"`
	TimeSpentSeconds *int       `json:"time_spent_seconds" example:"42"`
	TimeTakenSeconds *int       `json:"time_taken_seconds" example:"42"` // legacy alias sent by older app builds
	MarkedForReview  *bool      `json:"marked_for_review"`
	Confidence       *string    `json:"confidence" enums:"sure,unsure,guess"`
	AnsweredAt       *time.Time `json:"answered_at"`
}

func (r upsertAnswerRequest) toInput() services.AnswerInput {
	in := services.AnswerInput{
		SelectedSet: r.SelectedOption.Set, Selected: r.SelectedOption.Val,
		TimeSpent: r.TimeSpentSeconds, Marked: r.MarkedForReview, Confidence: r.Confidence, AnsweredAt: r.AnsweredAt,
	}
	if in.TimeSpent == nil {
		in.TimeSpent = r.TimeTakenSeconds
	}
	return in
}

// UpsertAnswer godoc
//
//	@Summary		Save / update / clear an answer
//	@Description	Partial update of one answer inside an in-progress attempt. `selected_option: "A".."D"` sets it, `null` clears it; omitted fields are left untouched, so toggling `marked_for_review` never wipes the answer. The question must belong to the attempt's test (422 `invalid_question`), the attempt must not be past its deadline (409 `attempt_expired`), and in tutor mode a revealed answer is locked (409 `answer_locked`).
//	@Tags			Attempts
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id			path		string				true	"Attempt UUID"
//	@Param			question_id	path		string				true	"Question UUID"
//	@Param			body		body		upsertAnswerRequest	true	"Answer fields"
//	@Success		200			{object}	messageResponse
//	@Failure		400			{object}	errorResponse
//	@Failure		403			{object}	errorResponse
//	@Failure		409			{object}	errorResponse
//	@Failure		422			{object}	errorResponse
//	@Router			/api/v1/attempts/{id}/answers/{question_id} [put]
func (h *AttemptHandler) UpsertAnswer(c *gin.Context) {
	user := middleware.GetUser(c)
	attemptID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid attempt id")
		return
	}
	questionID, err := uuid.Parse(c.Param("question_id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid question id")
		return
	}
	var req upsertAnswerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if err := h.ScoringKSvc.UpsertAnswer(sessionCtx(c), user.ID, attemptID, questionID, req.toInput()); err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "answer saved"})
}

type batchAnswerItem struct {
	QuestionID string `json:"question_id"`
	upsertAnswerRequest
}

type batchAnswersRequest struct {
	Answers []batchAnswerItem `json:"answers"`
}

// BatchUpsertAnswers godoc
//
//	@Summary		Batch-sync answers (offline recovery)
//	@Description	Applies up to 200 answer updates at once. Each item carries an optional client `answered_at`; an update older than what the server already has is ignored (last-write-wins). Returns a per-item result; one bad item never fails the batch.
//	@Tags			Attempts
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string					true	"Attempt UUID"
//	@Param			body	body		batchAnswersRequest		true	"Answers"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/attempts/{id}/answers [put]
func (h *AttemptHandler) BatchUpsertAnswers(c *gin.Context) {
	user := middleware.GetUser(c)
	attemptID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid attempt id")
		return
	}
	var req batchAnswersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if len(req.Answers) == 0 || len(req.Answers) > 200 {
		respondErr(c, http.StatusBadRequest, "bad_request", "answers must contain 1-200 items")
		return
	}
	items := make([]services.BatchItem, 0, len(req.Answers))
	for _, a := range req.Answers {
		qid, err := uuid.Parse(a.QuestionID)
		if err != nil {
			respondErr(c, http.StatusBadRequest, "invalid_id", "invalid question id: "+a.QuestionID)
			return
		}
		items = append(items, services.BatchItem{QuestionID: qid, Input: a.upsertAnswerRequest.toInput()})
	}
	res, err := h.ScoringKSvc.BatchUpsert(sessionCtx(c), user.ID, attemptID, items)
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"results": res})
}

// RevealAnswer godoc
//
//	@Summary		Reveal the answer for one question (tutor mode)
//	@Description	Only valid for attempts started in tutor mode, after an answer has been selected. Locks the answer and returns the correct option and explanation for that single question. Exam-mode attempts get 403 `not_tutor_mode`.
//	@Tags			Attempts
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id			path		string	true	"Attempt UUID"
//	@Param			question_id	path		string	true	"Question UUID"
//	@Success		200			{object}	services.RevealResult
//	@Failure		403			{object}	errorResponse
//	@Failure		409			{object}	errorResponse
//	@Router			/api/v1/attempts/{id}/answers/{question_id}/reveal [post]
func (h *AttemptHandler) RevealAnswer(c *gin.Context) {
	user := middleware.GetUser(c)
	attemptID, err1 := uuid.Parse(c.Param("id"))
	questionID, err2 := uuid.Parse(c.Param("question_id"))
	if err1 != nil || err2 != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid id")
		return
	}
	res, err := h.ScoringKSvc.Reveal(sessionCtx(c), user.ID, attemptID, questionID)
	if err != nil {
		respondService(c, err)
		return
	}
	resp := gin.H{
		"question_id": res.QuestionID, "correct_option": res.CorrectOption, "explanation": res.Explanation,
		"is_correct": res.IsCorrect, "marks": res.Marks,
		"content_format": res.Question.ContentFormat,
	}
	mc := media.NewCollector()
	mc.Add(res.Question.ContentFormat, res.Explanation)
	resp["media"] = media.NewService(h.DB).ResolveCollector(c.Request.Context(), mc, media.URLTTL(nil))
	c.JSON(http.StatusOK, resp)
}

type submitAttemptRequest struct {
	TimeTakenSeconds *int `json:"time_taken_seconds" example:"1800"`
}

// SubmitAttempt godoc
//
//	@Summary		Submit a test attempt
//	@Description	Finalizes the attempt. The score is computed server-side from the test's marks settings. Unattempted questions score 0. Submitting after the deadline still works (the server clamps time taken to the test duration).
//	@Tags			Attempts
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string					true	"Attempt UUID"
//	@Param			body	body		submitAttemptRequest	false	"Optional: time taken in seconds"
//	@Success		200		{object}	models.StudentAttempt
//	@Failure		400		{object}	errorResponse
//	@Router			/api/v1/attempts/{id}/submit [post]
func (h *AttemptHandler) SubmitAttempt(c *gin.Context) {
	user := middleware.GetUser(c)
	attemptID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid attempt id")
		return
	}
	var req submitAttemptRequest
	_ = c.ShouldBindJSON(&req)

	attempt, err := h.ScoringKSvc.SubmitAttempt(sessionCtx(c), attemptID, user.ID, req.TimeTakenSeconds)
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, attempt)
}

// GetResult godoc
//
//	@Summary		Get attempt result
//	@Description	Scored summary for a submitted attempt plus a `breakdown` by subject, chapter and difficulty computed from question-level metadata. Accuracy = correct ÷ attempted.
//	@Tags			Attempts
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Attempt UUID"
//	@Success		200	{object}	map[string]interface{}
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/attempts/{id}/result [get]
func (h *AttemptHandler) GetResult(c *gin.Context) {
	user := middleware.GetUser(c)
	attemptID := c.Param("id")

	var attempt models.StudentAttempt
	if err := h.DB.WithContext(c.Request.Context()).
		Where("id = ? AND user_id = ? AND status = ?", attemptID, user.ID, models.AttemptSubmitted).
		Preload("Test").
		First(&attempt).Error; err != nil {
		respondErr(c, http.StatusNotFound, "result_not_found", "result not found")
		return
	}
	bd, err := h.ScoringKSvc.Breakdown(c.Request.Context(), attempt.ID)
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to compute breakdown")
		return
	}
	c.JSON(http.StatusOK, gin.H{"attempt": attempt, "breakdown": bd})
}

type reviewItem struct {
	QuestionID       uuid.UUID             `json:"question_id"`
	Position         int                   `json:"position"`
	ContentFormat    string                `json:"content_format"`
	QuestionText     string                `json:"question_text"`
	OptionA          string                `json:"option_a"`
	OptionB          string                `json:"option_b"`
	OptionC          string                `json:"option_c"`
	OptionD          string                `json:"option_d"`
	CorrectOption    models.CorrectOption  `json:"correct_option"`
	Explanation      *string               `json:"explanation"`
	SelectedOption   *models.CorrectOption `json:"selected_option"`
	IsCorrect        *bool                 `json:"is_correct"`
	MarksAwarded     *float64              `json:"marks_awarded"`
	MarkedForReview  bool                  `json:"marked_for_review"`
	TimeSpentSeconds *int                  `json:"time_spent_seconds,omitempty"`
	Confidence       *string               `json:"confidence,omitempty"`
	QuestionMeta     reviewMeta            `json:"question_meta"`
	Bookmarked       bool                  `json:"bookmarked"`
	ReportedByMe     bool                  `json:"reported_by_me"`
	MyRating         *int                  `json:"my_rating,omitempty"`
	CohortCorrectPct *float64              `json:"cohort_correct_pct,omitempty"`
	MyNote           *string               `json:"my_note,omitempty"`
}

type reviewMeta struct {
	SubjectID  *uuid.UUID `json:"subject_id,omitempty"`
	Subject    string     `json:"subject,omitempty"`
	ChapterID  *uuid.UUID `json:"chapter_id,omitempty"`
	Chapter    string     `json:"chapter,omitempty"`
	Difficulty *string    `json:"difficulty,omitempty"`
	NCERTClass *int       `json:"ncert_class,omitempty"`
	NCERTPage  *int       `json:"ncert_page,omitempty"`
}

// GetReview godoc
//
//	@Summary		Get attempt review
//	@Description	Per-question review for a submitted attempt, ordered by question position. `filter` = all|correct|wrong|unattempted|marked|bookmarked. Without `limit` all items are returned (backwards compatible); with `limit` + `cursor` (the last `position` seen) it paginates. Rich-text fields come with a resolved `media` map.
//	@Tags			Attempts
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id		path		string	true	"Attempt UUID"
//	@Param			filter	query		string	false	"all|correct|wrong|unattempted|marked|bookmarked"
//	@Param			limit	query		int		false	"Page size"
//	@Param			cursor	query		int		false	"Last position from the previous page"
//	@Success		200		{object}	map[string]interface{}
//	@Failure		404		{object}	errorResponse
//	@Router			/api/v1/attempts/{id}/review [get]
func (h *AttemptHandler) GetReview(c *gin.Context) {
	user := middleware.GetUser(c)
	attemptID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid attempt id")
		return
	}
	ctx := c.Request.Context()

	var attempt models.StudentAttempt
	if err := h.DB.WithContext(ctx).
		Where("id = ? AND user_id = ? AND status = ?", attemptID, user.ID, models.AttemptSubmitted).
		First(&attempt).Error; err != nil {
		respondErr(c, http.StatusNotFound, "attempt_not_found", "attempt not found or not submitted")
		return
	}

	q := h.DB.WithContext(ctx).Table("attempt_answers aa").
		Select(`aa.question_id, aa.position, aa.selected_option, aa.is_correct, aa.marks_awarded,
			aa.marked_for_review, aa.time_spent_seconds, aa.confidence,
			q.content_format, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
			q.correct_option, q.explanation, q.subject_id, q.chapter_id, q.difficulty, q.ncert_class, q.ncert_page,
			s.name AS subject_name, ch.name AS chapter_name`).
		Joins("JOIN questions q ON q.id = aa.question_id").
		Joins("LEFT JOIN subjects s ON s.id = q.subject_id").
		Joins("LEFT JOIN chapters ch ON ch.id = q.chapter_id").
		Where("aa.attempt_id = ?", attemptID)

	switch c.DefaultQuery("filter", "all") {
	case "correct":
		q = q.Where("aa.is_correct IS TRUE")
	case "wrong":
		q = q.Where("aa.selected_option IS NOT NULL AND aa.is_correct IS NOT TRUE")
	case "unattempted":
		q = q.Where("aa.selected_option IS NULL")
	case "marked":
		q = q.Where("aa.marked_for_review IS TRUE")
	case "bookmarked":
		q = q.Where("EXISTS (SELECT 1 FROM bookmarks b WHERE b.user_id = ? AND b.item_type = 'question' AND b.item_id = aa.question_id)", user.ID)
	case "all":
	default:
		respondErr(c, http.StatusBadRequest, "invalid_filter", "filter must be all, correct, wrong, unattempted, marked or bookmarked")
		return
	}

	limit := 0
	if raw := c.Query("limit"); raw != "" {
		limit, _ = strconv.Atoi(raw)
		if limit < 1 {
			limit = 50
		}
		if limit > 200 {
			limit = 200
		}
		if cur, err := strconv.Atoi(c.Query("cursor")); err == nil {
			q = q.Where("aa.position > ?", cur)
		}
	}
	q = q.Order("aa.position ASC, aa.question_id ASC")
	if limit > 0 {
		q = q.Limit(limit + 1)
	} else {
		q = q.Limit(500)
	}

	var rows []struct {
		QuestionID       uuid.UUID
		Position         int
		SelectedOption   *models.CorrectOption
		IsCorrect        *bool
		MarksAwarded     *float64
		MarkedForReview  bool
		TimeSpentSeconds *int
		Confidence       *string
		ContentFormat    string
		QuestionText     string
		OptionA          string
		OptionB          string
		OptionC          string
		OptionD          string
		CorrectOption    models.CorrectOption
		Explanation      *string
		SubjectID        *uuid.UUID
		ChapterID        *uuid.UUID
		Difficulty       *string
		NCERTClass       *int
		NCERTPage        *int
		SubjectName      *string
		ChapterName      *string
	}
	if err := q.Scan(&rows).Error; err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to load review")
		return
	}
	nextCursor := ""
	if limit > 0 && len(rows) > limit {
		rows = rows[:limit]
		nextCursor = strconv.Itoa(rows[len(rows)-1].Position)
	}

	ids := make([]uuid.UUID, len(rows))
	for i, r := range rows {
		ids[i] = r.QuestionID
	}
	bookmarked := idSet(h.DB, ctx, "SELECT item_id FROM bookmarks WHERE user_id = ? AND item_type = 'question' AND item_id IN ?", user.ID, ids)
	reported := idSet(h.DB, ctx, "SELECT item_id FROM content_reports WHERE reporter_id = ? AND item_type = 'question' AND item_id IN ?", user.ID, ids)
	myRatings := map[uuid.UUID]int{}
	if len(ids) > 0 {
		var rs []models.Rating
		h.DB.WithContext(ctx).Where("user_id = ? AND item_type = 'question' AND item_id IN ?", user.ID, ids).Find(&rs)
		for _, r := range rs {
			myRatings[r.ItemID] = r.Value
		}
	}
	cohort := cohortCorrectPct(h.DB, ctx, ids)
	notes := map[uuid.UUID]string{}
	if len(ids) > 0 {
		var ns []models.QuestionNote
		h.DB.WithContext(ctx).Where("user_id = ? AND question_id IN ?", user.ID, ids).Find(&ns)
		for _, n := range ns {
			notes[n.QuestionID] = n.Body
		}
	}

	items := make([]reviewItem, len(rows))
	mc := media.NewCollector()
	for i, r := range rows {
		it := reviewItem{
			QuestionID: r.QuestionID, Position: r.Position, ContentFormat: r.ContentFormat,
			QuestionText: r.QuestionText, OptionA: r.OptionA, OptionB: r.OptionB, OptionC: r.OptionC, OptionD: r.OptionD,
			CorrectOption: r.CorrectOption, Explanation: r.Explanation, SelectedOption: r.SelectedOption,
			IsCorrect: r.IsCorrect, MarksAwarded: r.MarksAwarded, MarkedForReview: r.MarkedForReview,
			TimeSpentSeconds: r.TimeSpentSeconds, Confidence: r.Confidence,
			Bookmarked: bookmarked[r.QuestionID], ReportedByMe: reported[r.QuestionID],
			QuestionMeta: reviewMeta{SubjectID: r.SubjectID, ChapterID: r.ChapterID, Difficulty: r.Difficulty, NCERTClass: r.NCERTClass, NCERTPage: r.NCERTPage},
		}
		if r.SubjectName != nil {
			it.QuestionMeta.Subject = *r.SubjectName
		}
		if r.ChapterName != nil {
			it.QuestionMeta.Chapter = *r.ChapterName
		}
		if v, ok := myRatings[r.QuestionID]; ok {
			vv := v
			it.MyRating = &vv
		}
		if n, ok := notes[r.QuestionID]; ok {
			nn := n
			it.MyNote = &nn
		}
		if p, ok := cohort[r.QuestionID]; ok {
			pp := p
			it.CohortCorrectPct = &pp
		}
		items[i] = it
		mc.Add(r.ContentFormat, &items[i].QuestionText, &items[i].OptionA, &items[i].OptionB, &items[i].OptionC, &items[i].OptionD, items[i].Explanation)
	}

	c.JSON(http.StatusOK, gin.H{
		"attempt_id": attemptID, "review": items, "next_cursor": nilIfEmpty(nextCursor),
		"media": media.NewService(h.DB).ResolveCollector(ctx, mc, media.URLTTL(testDuration(h.DB, ctx, attempt.TestID))),
	})
}

func nilIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// Takeover godoc
//
//	@Summary		Move an in-progress attempt to this device
//	@Description	An attempt is bound to the login session that started it. If it is open on another device, writes from this one fail with 409 `attempt_active_elsewhere` until this call moves it here.
//	@Tags			Attempts
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Attempt UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/attempts/{id}/takeover [post]
func (h *AttemptHandler) Takeover(c *gin.Context) {
	user := middleware.GetUser(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid attempt id")
		return
	}
	if err := h.ScoringKSvc.Takeover(sessionCtx(c), user.ID, id); err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "attempt moved to this device"})
}
