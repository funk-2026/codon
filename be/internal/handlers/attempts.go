package handlers

import (
	"net/http"

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

// StartAttempt godoc
//
//	@Summary		Start or resume a test attempt
//	@Description	Starts a new attempt for the given test. If the student already has an in-progress attempt on this test, the existing attempt is returned (resume). Subscription gating is checked before creation.
//	@Tags			Attempts
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Test UUID"
//	@Success		200	{object}	models.StudentAttempt
//	@Failure		403	{object}	errorResponse	"Subscription required"
//	@Failure		404	{object}	errorResponse
//	@Router			/tests/{id}/attempts [post]
func (h *AttemptHandler) StartAttempt(c *gin.Context) {
	user := middleware.GetUser(c)
	testID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid test id"})
		return
	}

	var test models.Test
	if err := h.DB.WithContext(c.Request.Context()).
		Where("id = ? AND status = ?", testID, models.StatusPublished).
		First(&test).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "test not found"})
		return
	}

	attempt, err := h.ScoringKSvc.GetOrCreateAttempt(c.Request.Context(), user.ID, testID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, attempt)
}

// UpsertAnswer godoc
//
//	@Summary		Save / update an answer
//	@Description	Upserts the student's selected option for a question within an in-progress attempt. Safe to call repeatedly (supports save-as-you-go). Requires the attempt to be in_progress and owned by the caller.
//	@Tags			Attempts
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id			path		string				true	"Attempt UUID"
//	@Param			question_id	path		string				true	"Question UUID"
//	@Param			body		body		upsertAnswerRequest	true	"Selected option"
//	@Success		200			{object}	messageResponse
//	@Failure		400			{object}	errorResponse
//	@Failure		403			{object}	errorResponse
//	@Router			/attempts/{id}/answers/{question_id} [put]
func (h *AttemptHandler) UpsertAnswer(c *gin.Context) {
	user := middleware.GetUser(c)
	attemptID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid attempt id"})
		return
	}
	questionID, err := uuid.Parse(c.Param("question_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid question id"})
		return
	}

	var attempt models.StudentAttempt
	if err := h.DB.WithContext(c.Request.Context()).
		Where("id = ? AND user_id = ? AND status = ?", attemptID, user.ID, models.AttemptInProgress).
		First(&attempt).Error; err != nil {
		c.JSON(http.StatusForbidden, errorResponse{Error: "attempt not found or not in progress"})
		return
	}

	var req upsertAnswerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	opt := models.CorrectOption(req.SelectedOption)
	if opt != models.OptionA && opt != models.OptionB && opt != models.OptionC && opt != models.OptionD {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "selected_option must be A, B, C, or D"})
		return
	}

	if err := h.ScoringKSvc.UpsertAnswer(c.Request.Context(), attemptID, questionID, opt); err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "answer saved"})
}

// SubmitAttempt godoc
//
//	@Summary		Submit a test attempt
//	@Description	Finalizes the attempt. Server computes the score from the test's marks_per_correct/marks_per_wrong settings. Returns the scored attempt. Unattempted questions are counted but score 0.
//	@Tags			Attempts
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string				true	"Attempt UUID"
//	@Param			body	body		submitAttemptRequest	false	"Optional: time taken in seconds"
//	@Success		200		{object}	models.StudentAttempt
//	@Failure		400		{object}	errorResponse
//	@Router			/attempts/{id}/submit [post]
func (h *AttemptHandler) SubmitAttempt(c *gin.Context) {
	user := middleware.GetUser(c)
	attemptID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid attempt id"})
		return
	}

	var req submitAttemptRequest
	c.ShouldBindJSON(&req)

	attempt, err := h.ScoringKSvc.SubmitAttempt(c.Request.Context(), attemptID, user.ID, req.TimeTakenSeconds)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, attempt)
}

// GetResult godoc
//
//	@Summary		Get attempt result
//	@Description	Returns the scored summary for a submitted attempt: total score, marks, correct/wrong/unattempted counts, and time taken.
//	@Tags			Attempts
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Attempt UUID"
//	@Success		200	{object}	models.StudentAttempt
//	@Failure		404	{object}	errorResponse
//	@Router			/attempts/{id}/result [get]
func (h *AttemptHandler) GetResult(c *gin.Context) {
	user := middleware.GetUser(c)
	attemptID := c.Param("id")

	var attempt models.StudentAttempt
	if err := h.DB.WithContext(c.Request.Context()).
		Where("id = ? AND user_id = ? AND status = ?", attemptID, user.ID, models.AttemptSubmitted).
		Preload("Test").
		First(&attempt).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "result not found"})
		return
	}
	c.JSON(http.StatusOK, attempt)
}

// GetReview godoc
//
//	@Summary		Get attempt review
//	@Description	Returns per-question review for a submitted attempt: the student's answer vs. the correct answer, explanation, and marks awarded for each question.
//	@Tags			Attempts
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Attempt UUID"
//	@Success		200	{object}	reviewResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/attempts/{id}/review [get]
func (h *AttemptHandler) GetReview(c *gin.Context) {
	user := middleware.GetUser(c)
	attemptID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid attempt id"})
		return
	}

	var attempt models.StudentAttempt
	if err := h.DB.WithContext(c.Request.Context()).
		Where("id = ? AND user_id = ? AND status = ?", attemptID, user.ID, models.AttemptSubmitted).
		First(&attempt).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "attempt not found or not submitted"})
		return
	}

	type ReviewItem struct {
		QuestionID     uuid.UUID             `json:"question_id"`
		QuestionText   string                `json:"question_text"`
		OptionA        string                `json:"option_a"`
		OptionB        string                `json:"option_b"`
		OptionC        string                `json:"option_c"`
		OptionD        string                `json:"option_d"`
		CorrectOption  models.CorrectOption  `json:"correct_option"`
		Explanation    *string               `json:"explanation"`
		SelectedOption *models.CorrectOption `json:"selected_option"`
		IsCorrect      *bool                 `json:"is_correct"`
		MarksAwarded   *float64              `json:"marks_awarded"`
	}

	var answers []models.AttemptAnswer
	h.DB.WithContext(c.Request.Context()).
		Where("attempt_id = ?", attemptID).
		Preload("Question").
		Find(&answers)

	items := make([]ReviewItem, len(answers))
	for i, a := range answers {
		items[i] = ReviewItem{
			QuestionID: a.QuestionID, QuestionText: a.Question.QuestionText,
			OptionA: a.Question.OptionA, OptionB: a.Question.OptionB,
			OptionC: a.Question.OptionC, OptionD: a.Question.OptionD,
			CorrectOption: a.Question.CorrectOption, Explanation: a.Question.Explanation,
			SelectedOption: a.SelectedOption, IsCorrect: a.IsCorrect, MarksAwarded: a.MarksAwarded,
		}
	}

	c.JSON(http.StatusOK, reviewResponse{AttemptID: attemptID, Review: items})
}

// ── Request / Response types ──────────────────────────────────────────────────

type upsertAnswerRequest struct {
	SelectedOption string `json:"selected_option" example:"B" enums:"A,B,C,D"`
}

type submitAttemptRequest struct {
	TimeTakenSeconds *int `json:"time_taken_seconds" example:"1800"`
}

type reviewResponse struct {
	AttemptID uuid.UUID   `json:"attempt_id"`
	Review    interface{} `json:"review"`
}
