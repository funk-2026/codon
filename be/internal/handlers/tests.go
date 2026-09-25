package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"codon-backend/internal/jobs"
	"codon-backend/internal/media"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/services"
	"codon-backend/internal/validate"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TestHandler struct {
	DB *gorm.DB
	QS *services.QuestionService
}

func NewTestHandler(db *gorm.DB) *TestHandler {
	return &TestHandler{DB: db, QS: newQuestionService(db)}
}

// newQuestionService wires the media reference validator into the question service.
func newQuestionService(db *gorm.DB) *services.QuestionService {
	qs := services.NewQuestionService(db)
	qs.RefSaver = media.QuestionRefSaver
	return qs
}

// testView is a test plus the caller's own rating.
type testView struct {
	models.Test
	MyRating *int `json:"my_rating,omitempty"`
}

// activeAttemptView tells the pre-start screen whether "Start" is really
// "Resume", and how far along the student is.
type activeAttemptView struct {
	ID        uuid.UUID  `json:"id"`
	StartedAt time.Time  `json:"started_at"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	Answered  int64      `json:"answered"`
	Total     int64      `json:"total"`
}

func canManageAllTests(u *models.User) bool {
	return u != nil && (u.Role == models.RoleAdmin || u.CanManageAllContent)
}

// ListTests godoc
//
//	@Summary		List published tests
//	@Description	Returns all published tests (Q Bank, Test Series, Practice) filterable by course, module type, and topic. Items with requires_subscription=true require an active subscription.
//	@Tags			Tests
//	@Security		BearerAuth
//	@Produce		json
//	@Param			course_id	query		string	false	"Filter by course UUID"
//	@Param			module_type	query		string	false	"Filter by module type: qbank | test_series | practice"
//	@Param			subject_id	query		string	false	"Filter by subject UUID"
//	@Param			chapter_id	query		string	false	"Filter by chapter UUID"
//	@Success		200			{object}	listTestsResponse
//	@Failure		401			{object}	errorResponse
//	@Router			/api/v1/tests [get]
func (h *TestHandler) ListTests(c *gin.Context) {
	user := middleware.GetUser(c)
	courseID := c.Query("course_id")
	moduleType := c.Query("module_type")
	subjectID := c.Query("subject_id")
	chapterID := c.Query("chapter_id")

	// Generated (private) tests never appear in shared lists.
	query := h.DB.WithContext(c.Request.Context()).
		Where("status = ? AND origin = ? AND archived_at IS NULL", models.StatusPublished, models.OriginAuthored)

	if courseID != "" {
		query = query.Where("course_id = ?", courseID)
	}
	if moduleType != "" {
		query = query.Where("module_type = ?", moduleType)
	}
	if subjectID != "" {
		query = query.Where("subject_id = ?", subjectID)
	}
	if chapterID != "" {
		query = query.Where("chapter_id = ?", chapterID)
	}
	if c.Query("sort") == "rating" {
		query = query.Order("rating_avg DESC, rating_count DESC")
	}

	var tests []models.Test
	query.Preload("Course").Order("created_at DESC").Find(&tests)

	ids := make([]uuid.UUID, len(tests))
	for i, t := range tests {
		ids[i] = t.ID
	}
	mine := map[uuid.UUID]int{}
	if len(ids) > 0 {
		var rs []models.Rating
		h.DB.WithContext(c.Request.Context()).Where("user_id = ? AND item_type = 'test' AND item_id IN ?", user.ID, ids).Find(&rs)
		for _, r := range rs {
			mine[r.ItemID] = r.Value
		}
	}
	views := make([]testView, len(tests))
	for i, t := range tests {
		views[i] = testView{Test: t}
		if v, ok := mine[t.ID]; ok {
			vv := v
			views[i].MyRating = &vv
		}
	}
	c.JSON(http.StatusOK, gin.H{"tests": views})
}

// GetTest godoc
//
//	@Summary		Get a test by ID
//	@Description	Returns metadata for a single published test (no questions or answers included). When the caller has an in-progress attempt, `active_attempt` reports its id, progress and deadline so the client can offer Resume.
//	@Tags			Tests
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Test UUID"
//	@Success		200	{object}	models.Test
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/tests/{id} [get]
func (h *TestHandler) GetTest(c *gin.Context) {
	user := middleware.GetUser(c)
	id := c.Param("id")
	var test models.Test
	if err := h.DB.WithContext(c.Request.Context()).
		Where("id = ? AND status = ? AND archived_at IS NULL", id, models.StatusPublished).
		Preload("Course").
		First(&test).Error; err != nil || !visibleToUser(&test, user.ID) {
		respondErr(c, http.StatusNotFound, "test_not_found", "test not found")
		return
	}
	view := testView{Test: test}
	var r models.Rating
	if h.DB.Where("user_id = ? AND item_type = 'test' AND item_id = ?", user.ID, test.ID).First(&r).Error == nil {
		v := r.Value
		view.MyRating = &v
	}
	resp := gin.H{"test": view}
	var att models.StudentAttempt
	if h.DB.WithContext(c.Request.Context()).
		Where("user_id = ? AND test_id = ? AND status = ?", user.ID, test.ID, models.AttemptInProgress).
		Order("started_at DESC").First(&att).Error == nil {
		av := activeAttemptView{ID: att.ID, StartedAt: att.StartedAt, ExpiresAt: att.ExpiresAt, Total: int64(test.TotalQuestions)}
		h.DB.WithContext(c.Request.Context()).Model(&models.AttemptAnswer{}).
			Where("attempt_id = ? AND selected_option IS NOT NULL", att.ID).Count(&av.Answered)
		resp["active_attempt"] = av
	}
	// FE reads `res.test`; the bare fields are kept for older clients.
	c.JSON(http.StatusOK, resp)
}

// GetQuestions godoc
//
//	@Summary		Get test questions (requires active attempt)
//	@Description	Returns the question text and options for a published test. Correct answers and explanations are NOT included (those are shown via /attempts/{id}/review after submission). Requires an in-progress attempt on this test.
//	@Tags			Tests
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Test UUID"
//	@Success		200	{object}	testQuestionsResponse
//	@Failure		403	{object}	errorResponse	"No active attempt"
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/tests/{id}/questions [get]
func (h *TestHandler) GetQuestions(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	testID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid test id")
		return
	}

	var attempt models.StudentAttempt
	if err := h.DB.WithContext(ctx).
		Where("user_id = ? AND test_id = ? AND status = ?", user.ID, testID, models.AttemptInProgress).
		First(&attempt).Error; err != nil {
		respondErr(c, http.StatusForbidden, "no_active_attempt", "no active attempt — start an attempt first")
		return
	}
	var test models.Test
	if err := h.DB.WithContext(ctx).First(&test, "id = ?", testID).Error; err != nil || !visibleToUser(&test, user.ID) {
		respondErr(c, http.StatusNotFound, "test_not_found", "test not found")
		return
	}

	questions, err := services.LoadTestQuestions(ctx, h.DB, testID)
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to load questions")
		return
	}

	// Correct answers and explanations are NEVER included here.
	type QuestionView struct {
		ID            uuid.UUID `json:"id"`
		TestID        uuid.UUID `json:"test_id"`
		ContentFormat string    `json:"content_format"`
		QuestionText  string    `json:"question_text"`
		OptionA       string    `json:"option_a"`
		OptionB       string    `json:"option_b"`
		OptionC       string    `json:"option_c"`
		OptionD       string    `json:"option_d"`
		OrderIndex    int       `json:"order_index"`
		Position      int       `json:"position"`
	}

	mc := media.NewCollector()
	resp := make([]QuestionView, len(questions))
	for i, q := range questions {
		resp[i] = QuestionView{
			ID: q.ID, TestID: testID, ContentFormat: q.ContentFormat, QuestionText: q.QuestionText,
			OptionA: q.OptionA, OptionB: q.OptionB, OptionC: q.OptionC, OptionD: q.OptionD,
			OrderIndex: q.Position, Position: q.Position,
		}
		mc.Add(q.ContentFormat, &resp[i].QuestionText, &resp[i].OptionA, &resp[i].OptionB, &resp[i].OptionC, &resp[i].OptionD)
	}
	c.JSON(http.StatusOK, gin.H{
		"questions": resp, "attempt_id": attempt.ID,
		"media": media.NewService(h.DB).ResolveCollector(ctx, mc, media.URLTTL(test.DurationMinutes)),
	})
}

// CreateTest godoc
//
//	@Summary		Create a draft test (Teacher)
//	@Description	Creates a new test in draft status. The test must go through review and approval before students can access it.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		createTestRequest	true	"Test details"
//	@Success		201		{object}	models.Test
//	@Failure		400		{object}	errorResponse
//	@Failure		401		{object}	errorResponse
//	@Failure		403		{object}	errorResponse
//	@Router			/api/v1/teacher/tests [post]
func (h *TestHandler) CreateTest(c *gin.Context) {
	teacher := middleware.GetUser(c)

	var req createTestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid course_id"})
		return
	}
	// 'custom' tests are only ever produced by the generator, never authored.
	if !validate.OneOf(req.ModuleType, []string{"qbank", "test_series", "practice"}) {
		respondErr(c, http.StatusBadRequest, "invalid_module_type", "module_type must be one of: qbank, test_series, practice")
		return
	}
	if req.DurationMinutes != nil && (*req.DurationMinutes < 0 || *req.DurationMinutes > 600) {
		respondErr(c, http.StatusBadRequest, "invalid_duration", "duration_minutes must be between 0 and 600")
		return
	}
	if err := validate.MaxLen("title", req.Title, 200); err != nil || req.Title == "" {
		respondErr(c, http.StatusBadRequest, "invalid_title", "title is required (max 200 characters)")
		return
	}

	requiresSub := true
	var course models.Course
	if h.DB.Where("id = ?", courseID).First(&course).Error == nil {
		if course.Slug != "neet-ug" {
			requiresSub = false
		}
	}
	if req.RequiresSubscription != nil {
		requiresSub = *req.RequiresSubscription
	}

	marksCorrect := 4.0
	marksWrong := -1.0
	if req.MarksPerCorrect != nil {
		marksCorrect = *req.MarksPerCorrect
	}
	if req.MarksPerWrong != nil {
		marksWrong = *req.MarksPerWrong
	}

	var sID, cID *uuid.UUID
	if req.SubjectID != nil && *req.SubjectID != "" {
		u, err := uuid.Parse(*req.SubjectID)
		if err == nil {
			sID = &u
		}
	}
	if req.ChapterID != nil && *req.ChapterID != "" {
		u, err := uuid.Parse(*req.ChapterID)
		if err == nil {
			cID = &u
		}
	}

	test := models.Test{
		Title: req.Title, Description: req.Description, CourseID: courseID,
		ModuleType: models.ModuleType(req.ModuleType),
		SubjectID:  sID, ChapterID: cID,
		DurationMinutes: req.DurationMinutes, MarksPerCorrect: marksCorrect,
		MarksPerWrong: marksWrong, RequiresSubscription: requiresSub,
		CreatedBy: teacher.ID, Status: models.StatusDraft,
	}
	if err := h.DB.WithContext(c.Request.Context()).Create(&test).Error; err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to create test"})
		return
	}
	// GORM replaces a zero-value (false) bool on a `default:true` column with the
	// default at INSERT time, so every "free" test used to be stored as paid.
	// Write the real value back explicitly.
	h.DB.WithContext(c.Request.Context()).Model(&test).UpdateColumns(map[string]interface{}{
		"requires_subscription": requiresSub, "marks_per_correct": marksCorrect, "marks_per_wrong": marksWrong})
	test.RequiresSubscription, test.MarksPerCorrect, test.MarksPerWrong = requiresSub, marksCorrect, marksWrong
	c.JSON(http.StatusCreated, test)
}

// UpdateTest godoc
//
//	@Summary		Update a draft test (Teacher)
//	@Description	Partially updates a test. Only allowed when the test is in draft or rejected status.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string				true	"Test UUID"
//	@Param			body	body		updateTestRequest	true	"Fields to update"
//	@Success		200		{object}	models.Test
//	@Failure		400		{object}	errorResponse
//	@Failure		404		{object}	errorResponse
//	@Failure		409		{object}	errorResponse	"Test not in editable state"
//	@Router			/api/v1/teacher/tests/{id} [patch]
func (h *TestHandler) UpdateTest(c *gin.Context) {
	teacher := middleware.GetUser(c)
	id := c.Param("id")

	var test models.Test
	query := h.DB.Where("id = ?", id)
	if !canManageAllTests(teacher) {
		query = query.Where("created_by = ?", teacher.ID)
	}
	if err := query.First(&test).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "test not found"})
		return
	}

	if test.Status != models.StatusDraft && test.Status != models.StatusRejected {
		c.JSON(http.StatusConflict, errorResponse{Error: "test can only be edited in draft or rejected state"})
		return
	}

	var req updateTestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.SubjectID != nil {
		if *req.SubjectID == "" {
			updates["subject_id"] = nil
		} else if u, err := uuid.Parse(*req.SubjectID); err == nil {
			updates["subject_id"] = u
		}
	}
	if req.ChapterID != nil {
		if *req.ChapterID == "" {
			updates["chapter_id"] = nil
		} else if u, err := uuid.Parse(*req.ChapterID); err == nil {
			updates["chapter_id"] = u
		}
	}
	if req.DurationMinutes != nil {
		updates["duration_minutes"] = *req.DurationMinutes
	}
	if req.MarksPerCorrect != nil {
		updates["marks_per_correct"] = *req.MarksPerCorrect
	}
	if req.MarksPerWrong != nil {
		updates["marks_per_wrong"] = *req.MarksPerWrong
	}
	if req.RequiresSubscription != nil {
		updates["requires_subscription"] = *req.RequiresSubscription
	}

	h.DB.WithContext(c.Request.Context()).Model(&test).Updates(updates)
	h.DB.WithContext(c.Request.Context()).First(&test, test.ID)
	c.JSON(http.StatusOK, test)
}

// AddQuestion godoc
//
//	@Summary		Add a question to a test (Teacher)
//	@Description	Adds a single MCQ question to a draft test. The question is appended at the end (order_index auto-incremented). Correct option must be A, B, C, or D.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string				true	"Test UUID"
//	@Param			body	body		addQuestionRequest	true	"Question details"
//	@Success		201		{object}	models.Question
//	@Failure		400		{object}	errorResponse
//	@Failure		404		{object}	errorResponse
//	@Router			/api/v1/teacher/tests/{id}/questions [post]
func (h *TestHandler) AddQuestion(c *gin.Context) {
	teacher := middleware.GetUser(c)
	ctx := c.Request.Context()
	testID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid test id")
		return
	}
	var test models.Test
	query := h.DB.Where("id = ?", testID)
	if !canManageAllTests(teacher) {
		query = query.Where("created_by = ?", teacher.ID)
	}
	if err := query.First(&test).Error; err != nil {
		respondErr(c, http.StatusNotFound, "test_not_found", "test not found")
		return
	}
	if test.Status != models.StatusDraft && test.Status != models.StatusRejected {
		respondErr(c, http.StatusConflict, "test_locked", "questions can only be added while the test is in draft or rejected state")
		return
	}
	var req questionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	in, err := req.toInput()
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", err.Error())
		return
	}
	q, warnings, err := h.QS.Create(ctx, teacher, &test, in)
	if err != nil {
		respondService(c, err)
		return
	}
	services.LoadTags(ctx, h.DB, []models.Question{*q})
	tags := []models.Question{*q}
	services.LoadTags(ctx, h.DB, tags)
	q.Tags = tags[0].Tags
	c.JSON(http.StatusCreated, questionEnvelope(h.DB, ctx, q, warnings))
}

// UpdateQuestion godoc
//
//	@Summary		Update a question (Teacher)
//	@Description	Edits a question's text, options, correct answer, or explanation. Only allowed while the parent test is in draft or rejected state.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string				true	"Question UUID"
//	@Param			body	body		addQuestionRequest	true	"Question details"
//	@Success		200		{object}	models.Question
//	@Failure		400		{object}	errorResponse
//	@Failure		404		{object}	errorResponse
//	@Failure		409		{object}	errorResponse
//	@Router			/api/v1/teacher/questions/{id} [patch]
func (h *TestHandler) UpdateQuestion(c *gin.Context) {
	teacher := middleware.GetUser(c)
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid question id")
		return
	}
	var question models.Question
	if err := h.DB.Where("id = ?", id).First(&question).Error; err != nil {
		respondErr(c, http.StatusNotFound, "question_not_found", "question not found")
		return
	}
	var test models.Test
	testQuery := h.DB.Where("id = ?", question.TestID)
	if !canManageAllTests(teacher) {
		testQuery = testQuery.Where("created_by = ?", teacher.ID)
	}
	if err := testQuery.First(&test).Error; err != nil {
		respondErr(c, http.StatusNotFound, "question_not_found", "question not found")
		return
	}
	var req questionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	in, err := req.toInput()
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", err.Error())
		return
	}
	warnings, err := h.QS.Update(ctx, teacher, &question, &test, in)
	if err != nil {
		respondService(c, err)
		return
	}
	tags := []models.Question{question}
	services.LoadTags(ctx, h.DB, tags)
	question.Tags = tags[0].Tags
	c.JSON(http.StatusOK, questionEnvelope(h.DB, ctx, &question, warnings))
}

// DeleteQuestion godoc
//
//	@Summary		Delete a question (Teacher)
//	@Description	Removes a question from its test and decrements the test's question count. Only allowed while the parent test is in draft or rejected state.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Question UUID"
//	@Success		200	{object}	messageResponse
//	@Failure		404	{object}	errorResponse
//	@Failure		409	{object}	errorResponse
//	@Router			/api/v1/teacher/questions/{id} [delete]
func (h *TestHandler) DeleteQuestion(c *gin.Context) {
	teacher := middleware.GetUser(c)
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid question id")
		return
	}
	var question models.Question
	if err := h.DB.Where("id = ?", id).First(&question).Error; err != nil {
		respondErr(c, http.StatusNotFound, "question_not_found", "question not found")
		return
	}
	var test models.Test
	testQuery := h.DB.Where("id = ?", question.TestID)
	if !canManageAllTests(teacher) {
		testQuery = testQuery.Where("created_by = ?", teacher.ID)
	}
	if err := testQuery.First(&test).Error; err != nil {
		respondErr(c, http.StatusNotFound, "question_not_found", "question not found")
		return
	}
	if err := h.QS.Delete(ctx, &question, &test); err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "question deleted"})
}

// CSVImport godoc
//
//	@Summary		Bulk import questions from CSV (Teacher)
//	@Description	Enqueues a background job to parse a CSV file from S3 and append questions to a draft test. The CSV must have columns: question_text, option_a, option_b, option_c, option_d, correct_option, explanation (optional). Bad rows are skipped and logged — successful rows are always imported.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string				true	"Test UUID"
//	@Param			body	body		csvImportRequest	true	"S3 key of the uploaded CSV"
//	@Success		202		{object}	csvImportAcceptedResponse
//	@Failure		400		{object}	errorResponse
//	@Failure		404		{object}	errorResponse
//	@Router			/api/v1/teacher/tests/{id}/csv-import [post]
func (h *TestHandler) CSVImport(c *gin.Context) {
	teacher := middleware.GetUser(c)
	ctx := c.Request.Context()
	testID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid test id")
		return
	}
	var req csvImportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	mode := req.Mode
	if mode == "" {
		mode = services.ImportModeCommit
	}
	if !validate.OneOf(mode, []string{"validate", "commit", "update"}) {
		respondErr(c, http.StatusBadRequest, "invalid_mode", "mode must be validate, commit or update")
		return
	}
	if req.FileKey == "" && req.BundleKey == "" {
		respondErr(c, http.StatusBadRequest, "bad_request", "file_key or bundle_key is required")
		return
	}
	// The uploader must own the test (or have platform-wide permission) and, for
	// inserts, the test must still be editable. (Previously unchecked.)
	var test models.Test
	tq := h.DB.WithContext(ctx).Where("id = ? AND origin = ?", testID, models.OriginAuthored)
	if !canManageAllTests(teacher) {
		tq = tq.Where("created_by = ?", teacher.ID)
	}
	if err := tq.First(&test).Error; err != nil {
		respondErr(c, http.StatusNotFound, "test_not_found", "test not found")
		return
	}
	if mode == services.ImportModeCommit && test.Status != models.StatusDraft && test.Status != models.StatusRejected {
		respondErr(c, http.StatusConflict, "test_locked", "questions can only be imported into a draft or rejected test")
		return
	}
	// Keys must live under the caller's own upload prefixes.
	for _, k := range []string{req.FileKey, req.BundleKey} {
		if k != "" && !strings.Contains(k, "/"+teacher.ID.String()+"/") && teacher.Role != models.RoleAdmin {
			respondErr(c, http.StatusForbidden, "foreign_file", "that file was not uploaded by you")
			return
		}
	}

	batch := models.CSVImportBatch{
		TeacherID: teacher.ID, TestID: testID, FileKey: req.FileKey, Status: models.ImportProcessing,
		Mode: mode, AllowContentUpdate: req.AllowContentUpdate,
	}
	if req.BundleKey != "" {
		batch.BundleKey = &req.BundleKey
	}
	if err := h.DB.WithContext(ctx).Create(&batch).Error; err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to create import batch")
		return
	}
	if err := jobs.EnqueueJob(h.DB, jobs.JobTypeCSVImport, jobs.CSVImportPayload{BatchID: batch.ID, FileKey: req.FileKey, TestID: testID}); err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to enqueue import job")
		return
	}
	c.JSON(http.StatusAccepted, csvImportAcceptedResponse{BatchID: batch.ID, Status: "processing"})
}

// CommitCSVImport godoc
//
//	@Summary		Commit a validated CSV import (Teacher)
//	@Description	Creates a commit-mode batch from a completed validate-mode batch. The commit re-reads the same file and refuses to run if its hash changed since validation. Replaying the call returns the same child batch (idempotent).
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Validate batch UUID"
//	@Success		202	{object}	csvImportAcceptedResponse
//	@Router			/api/v1/teacher/csv-imports/{id}/commit [post]
func (h *TestHandler) CommitCSVImport(c *gin.Context) {
	teacher := middleware.GetUser(c)
	ctx := c.Request.Context()
	var parent models.CSVImportBatch
	if err := h.DB.WithContext(ctx).First(&parent, "id = ?", c.Param("id")).Error; err != nil || (parent.TeacherID != teacher.ID && teacher.Role != models.RoleAdmin) {
		respondErr(c, http.StatusNotFound, "batch_not_found", "batch not found")
		return
	}
	if parent.Mode != services.ImportModeValidate || parent.Status == models.ImportProcessing || parent.Status == models.ImportFailed {
		respondErr(c, http.StatusConflict, "not_validated", "only a completed validate run can be committed")
		return
	}
	var existing models.CSVImportBatch
	if h.DB.WithContext(ctx).Where("parent_batch_id = ?", parent.ID).First(&existing).Error == nil {
		c.JSON(http.StatusAccepted, csvImportAcceptedResponse{BatchID: existing.ID, Status: string(existing.Status)})
		return
	}
	child := models.CSVImportBatch{
		TeacherID: parent.TeacherID, TestID: parent.TestID, FileKey: parent.FileKey, BundleKey: parent.BundleKey,
		Status: models.ImportProcessing, Mode: services.ImportModeCommit, ParentBatchID: &parent.ID, AllowContentUpdate: parent.AllowContentUpdate,
	}
	if err := h.DB.WithContext(ctx).Create(&child).Error; err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to create import batch")
		return
	}
	if err := jobs.EnqueueJob(h.DB, jobs.JobTypeCSVImport, jobs.CSVImportPayload{BatchID: child.ID, FileKey: child.FileKey, TestID: child.TestID}); err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to enqueue import job")
		return
	}
	c.JSON(http.StatusAccepted, csvImportAcceptedResponse{BatchID: child.ID, Status: "processing"})
}

// CSVTemplate godoc
//
//	@Summary		CSV import template (Teacher)
//	@Description	Columns, required flags, allowed values and example values for a template version (1 = legacy plain text, 2 = metadata + images). Lets the app stop hard-coding column names.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Produce		json
//	@Param			version	query		int	false	"Template version (default 2)"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/teacher/csv-template [get]
func (h *TestHandler) CSVTemplate(c *gin.Context) {
	version := 2
	if c.Query("version") == "1" {
		version = 1
	}
	cols := services.TemplateSpec(version)
	names := make([]string, len(cols))
	example := make([]string, len(cols))
	for i, col := range cols {
		names[i], example[i] = col.Name, col.Example
	}
	c.JSON(http.StatusOK, gin.H{"version": version, "columns": cols, "header": strings.Join(names, ","), "example_row": example,
		"notes": []string{"Rich text (bold, sub/superscript, math) is supported in template v2.", "Image columns take a file name from your ZIP's images/ folder or your media library."}})
}

// GetCSVImport godoc
//
//	@Summary		Get CSV import batch status (Teacher)
//	@Description	Returns the current status and per-row error log for a CSV import batch.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Batch UUID"
//	@Success		200	{object}	csvImportStatusResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/teacher/csv-imports/{id} [get]
func (h *TestHandler) GetCSVImport(c *gin.Context) {
	teacher := middleware.GetUser(c)
	var batch models.CSVImportBatch
	if err := h.DB.Where("id = ?", c.Param("id")).First(&batch).Error; err != nil || (batch.TeacherID != teacher.ID && teacher.Role != models.RoleAdmin) {
		respondErr(c, http.StatusNotFound, "batch_not_found", "batch not found")
		return
	}
	var rowErrors []models.CSVImportRowError
	h.DB.Where("batch_id = ?", batch.ID).Order("row_number ASC, severity ASC").Find(&rowErrors)
	c.JSON(http.StatusOK, csvImportStatusResponse{Batch: batch, Errors: rowErrors})
}

// SubmitForReview godoc
//
//	@Summary		Submit a test for admin review (Teacher)
//	@Description	Transitions the test from draft or rejected state to pending_review. The test must have at least one question.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Test UUID"
//	@Success		200	{object}	messageResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/teacher/tests/{id}/submit-for-review [post]
func (h *TestHandler) SubmitForReview(c *gin.Context) {
	teacher := middleware.GetUser(c)
	id := c.Param("id")

	var test models.Test
	query := h.DB.Where("id = ? AND status IN ?", id, []string{string(models.StatusDraft), string(models.StatusRejected)})
	if !canManageAllTests(teacher) {
		query = query.Where("created_by = ?", teacher.ID)
	}
	if err := query.First(&test).Error; err != nil {
		respondErr(c, http.StatusNotFound, "test_not_found", "test not found or not in draft/rejected state")
		return
	}
	if err := h.QS.CheckPublishGate(c.Request.Context(), &test); err != nil {
		respondService(c, err)
		return
	}
	h.DB.WithContext(c.Request.Context()).Model(&test).Update("status", models.StatusPendingReview)
	c.JSON(http.StatusOK, messageResponse{Message: "submitted for review"})
}

// PublishTest godoc
//
//	@Summary		Publish an approved test (Teacher)
//	@Description	Transitions the test from approved to published, making it visible to students.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Test UUID"
//	@Success		200	{object}	messageResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/teacher/tests/{id}/publish [post]
func (h *TestHandler) PublishTest(c *gin.Context) {
	teacher := middleware.GetUser(c)
	id := c.Param("id")

	var test models.Test
	query := h.DB.Where("id = ? AND status = ?", id, models.StatusApproved)
	if !canManageAllTests(teacher) {
		query = query.Where("created_by = ?", teacher.ID)
	}
	if err := query.First(&test).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "test not found or not approved"})
		return
	}

	h.DB.WithContext(c.Request.Context()).Model(&test).Update("status", models.StatusPublished)
	c.JSON(http.StatusOK, messageResponse{Message: "test published"})
}

// DeleteTest godoc
//
//	@Summary		Delete a test (Teacher)
//	@Description	Permanently deletes a test and its questions, attempts, and CSV import history. Only allowed before the test has been approved or published.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Test UUID"
//	@Success		200	{object}	messageResponse
//	@Failure		404	{object}	errorResponse
//	@Failure		409	{object}	errorResponse
//	@Router			/api/v1/teacher/tests/{id} [delete]
func (h *TestHandler) DeleteTest(c *gin.Context) {
	teacher := middleware.GetUser(c)
	id := c.Param("id")

	var test models.Test
	query := h.DB.Where("id = ?", id)
	if !canManageAllTests(teacher) {
		query = query.Where("created_by = ?", teacher.ID)
	}
	if err := query.First(&test).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "test not found"})
		return
	}

	if test.Status == models.StatusApproved || test.Status == models.StatusPublished {
		c.JSON(http.StatusConflict, errorResponse{Error: "cannot delete a test that has been approved or published"})
		return
	}

	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where(
			"attempt_id IN (?)",
			tx.Model(&models.StudentAttempt{}).Select("id").Where("test_id = ?", test.ID),
		).Delete(&models.AttemptAnswer{}).Error; err != nil {
			return err
		}
		if err := tx.Where("test_id = ?", test.ID).Delete(&models.StudentAttempt{}).Error; err != nil {
			return err
		}
		if err := tx.Where(
			"batch_id IN (?)",
			tx.Model(&models.CSVImportBatch{}).Select("id").Where("test_id = ?", test.ID),
		).Delete(&models.CSVImportRowError{}).Error; err != nil {
			return err
		}
		if err := tx.Where("test_id = ?", test.ID).Delete(&models.CSVImportBatch{}).Error; err != nil {
			return err
		}
		var qids []uuid.UUID
		tx.Model(&models.Question{}).Where("test_id = ?", test.ID).Pluck("id", &qids)
		for _, qid := range qids {
			if err := services.DeleteQuestionCascade(tx, qid, test.ID); err != nil {
				return err
			}
		}
		if err := tx.Where("test_id = ?", test.ID).Delete(&models.TestQuestion{}).Error; err != nil {
			return err
		}
		for _, t := range []string{"bookmarks", "content_reports", "ratings"} {
			if err := tx.Exec("DELETE FROM "+t+" WHERE item_type = 'test' AND item_id = ?", test.ID).Error; err != nil {
				return err
			}
		}
		return tx.Delete(&test).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to delete test"})
		return
	}

	c.JSON(http.StatusOK, messageResponse{Message: "test deleted"})
}

// TeacherGetTest godoc
//
//	@Summary		Get a test with questions (Teacher)
//	@Description	Returns full test metadata plus all questions. A teacher can view their own tests (or all tests if they have platform-wide permission).
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Test UUID"
//	@Success		200	{object}	adminTestDetailResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/teacher/tests/{id} [get]
func (h *TestHandler) TeacherGetTest(c *gin.Context) {
	teacher := middleware.GetUser(c)
	query := h.DB.WithContext(c.Request.Context()).
		Preload("Course").Preload("Subject").Preload("Chapter").Preload("Creator").
		Where("id = ?", c.Param("id"))
	if !canManageAllTests(teacher) {
		query = query.Where("created_by = ?", teacher.ID)
	}
	var test models.Test

	if err := query.First(&test).Error; err != nil {
		respondErr(c, http.StatusNotFound, "test_not_found", "test not found")
		return
	}
	c.JSON(http.StatusOK, h.testDetail(c.Request.Context(), &test))
}

// ListTeacherTests godoc
//
//	@Summary		List teacher's own tests
//	@Description	Returns all tests created by the authenticated teacher across all statuses. Teachers with can_manage_all_content=true see all tests platform-wide.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	listTestsResponse
//	@Failure		401	{object}	errorResponse
//	@Router			/api/v1/teacher/tests [get]
func (h *TestHandler) ListTeacherTests(c *gin.Context) {
	teacher := middleware.GetUser(c)

	var tests []models.Test
	query := h.DB.WithContext(c.Request.Context()).Where("origin = ?", models.OriginAuthored)
	if !canManageAllTests(teacher) {
		query = query.Where("created_by = ?", teacher.ID)
	}
	query.Preload("Course").Order("created_at DESC").Find(&tests)
	c.JSON(http.StatusOK, listTestsResponse{Tests: tests})
}

// AdminGetTest godoc
//
//	@Summary		Get a test with questions (Admin)
//	@Description	Returns full test metadata plus all questions with correct answers and explanations. No status filter — admin can view any test regardless of status.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Test UUID"
//	@Success		200	{object}	adminTestDetailResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/admin/tests/{id} [get]
func (h *TestHandler) AdminGetTest(c *gin.Context) {
	query := h.DB.WithContext(c.Request.Context()).
		Preload("Course").Preload("Subject").Preload("Chapter").Preload("Creator").
		Where("id = ?", c.Param("id"))
	var test models.Test

	if err := query.First(&test).Error; err != nil {
		respondErr(c, http.StatusNotFound, "test_not_found", "test not found")
		return
	}
	c.JSON(http.StatusOK, h.testDetail(c.Request.Context(), &test))
}

// AdminListTests godoc
//
//	@Summary		List tests by status (Admin)
//	@Description	Returns tests filterable by status. Defaults to pending_review to show the admin moderation queue.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			status	query		string	false	"Filter by status"	default(pending_review)
//	@Success		200		{object}	listTestsResponse
//	@Failure		401		{object}	errorResponse
//	@Failure		403		{object}	errorResponse
//	@Router			/api/v1/admin/tests [get]
func (h *TestHandler) AdminListTests(c *gin.Context) {
	status := c.DefaultQuery("status", string(models.StatusPendingReview))
	var tests []models.Test
	h.DB.WithContext(c.Request.Context()).
		Where("status = ? AND origin = ?", status, models.OriginAuthored).
		Preload("Course").Preload("Subject").Preload("Chapter").Preload("Creator").
		Order("created_at DESC").
		Find(&tests)
	c.JSON(http.StatusOK, listTestsResponse{Tests: tests})
}

// AdminApproveTest godoc
//
//	@Summary		Approve a test (Admin)
//	@Description	Approves a pending_review test. The teacher can then publish it.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Test UUID"
//	@Success		200	{object}	messageResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/admin/tests/{id}/approve [post]
func (h *TestHandler) AdminApproveTest(c *gin.Context) {
	admin := middleware.GetUser(c)
	id := c.Param("id")

	var test models.Test
	if err := h.DB.Where("id = ? AND status = ?", id, models.StatusPendingReview).First(&test).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "test not found or not pending review"})
		return
	}

	now := time.Now()
	h.DB.WithContext(c.Request.Context()).Model(&test).Updates(map[string]interface{}{
		"status": models.StatusApproved, "reviewed_by": admin.ID, "reviewed_at": now,
	})
	c.JSON(http.StatusOK, messageResponse{Message: "test approved"})
}

// AdminRejectTest godoc
//
//	@Summary		Reject a test (Admin)
//	@Description	Rejects a pending_review test with a mandatory reason. The teacher can then fix and resubmit.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string				true	"Test UUID"
//	@Param			body	body		rejectContentRequest	true	"Rejection reason"
//	@Success		200		{object}	messageResponse
//	@Failure		400		{object}	errorResponse
//	@Failure		404		{object}	errorResponse
//	@Router			/api/v1/admin/tests/{id}/reject [post]
func (h *TestHandler) AdminRejectTest(c *gin.Context) {
	admin := middleware.GetUser(c)
	id := c.Param("id")

	var req rejectContentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	var test models.Test
	if err := h.DB.Where("id = ? AND status = ?", id, models.StatusPendingReview).First(&test).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "test not found or not pending review"})
		return
	}

	now := time.Now()
	h.DB.WithContext(c.Request.Context()).Model(&test).Updates(map[string]interface{}{
		"status": models.StatusRejected, "reviewed_by": admin.ID,
		"reviewed_at": now, "rejection_reason": req.Reason,
	})
	c.JSON(http.StatusOK, messageResponse{Message: "test rejected"})
}

// ── Request / Response types ──────────────────────────────────────────────────

type listTestsResponse struct {
	Tests []models.Test `json:"tests"`
}

type testQuestionsResponse struct {
	Questions interface{} `json:"questions"`
	AttemptID uuid.UUID   `json:"attempt_id"`
}

type createTestRequest struct {
	Title                string   `json:"title"       example:"Biology Chapter 1 — Cell Structure"`
	Description          *string  `json:"description" example:"Comprehensive practice test for Cell Structure and Organelles."`
	CourseID             string   `json:"course_id"   example:"550e8400-e29b-41d4-a716-446655440000"`
	ModuleType           string   `json:"module_type" example:"qbank" enums:"qbank,test_series,practice"`
	SubjectID            *string  `json:"subject_id"  example:"550e8400-e29b-41d4-a716-446655440001"`
	ChapterID            *string  `json:"chapter_id"  example:"550e8400-e29b-41d4-a716-446655440002"`
	DurationMinutes      *int     `json:"duration_minutes" example:"60"`
	MarksPerCorrect      *float64 `json:"marks_per_correct" example:"4"`
	MarksPerWrong        *float64 `json:"marks_per_wrong"   example:"-1"`
	RequiresSubscription *bool    `json:"requires_subscription" example:"true"`
}

type updateTestRequest struct {
	Title                *string  `json:"title"`
	Description          *string  `json:"description"`
	SubjectID            *string  `json:"subject_id"`
	ChapterID            *string  `json:"chapter_id"`
	DurationMinutes      *int     `json:"duration_minutes"`
	MarksPerCorrect      *float64 `json:"marks_per_correct"`
	MarksPerWrong        *float64 `json:"marks_per_wrong"`
	RequiresSubscription *bool    `json:"requires_subscription"`
}

// questionRequest is the create/patch body for a question. Every field is
// optional on PATCH; on create the text fields and correct_option are required
// (enforced by the service).
type questionRequest struct {
	QuestionText   *string   `json:"question_text"`
	OptionA        *string   `json:"option_a"`
	OptionB        *string   `json:"option_b"`
	OptionC        *string   `json:"option_c"`
	OptionD        *string   `json:"option_d"`
	CorrectOption  *string   `json:"correct_option" enums:"A,B,C,D"`
	Explanation    *string   `json:"explanation"`
	ContentFormat  *string   `json:"content_format" enums:"plain,rich_v1"`
	SubjectID      *string   `json:"subject_id"`
	ChapterID      *string   `json:"chapter_id"`
	TopicID        *string   `json:"topic_id"`
	Difficulty     *string   `json:"difficulty" enums:"easy,medium,hard"`
	NCERTClass     *int      `json:"ncert_class"`
	NCERTPage      *int      `json:"ncert_page"`
	SourceType     *string   `json:"source_type" enums:"qbank,practice,test_series,pyq,other"`
	SourceYear     *int      `json:"source_year"`
	SourceLabel    *string   `json:"source_label"`
	CustomEligible *bool     `json:"custom_eligible"`
	Tags           *[]string `json:"tags"`
}

func parseOptUUID(s *string) (*uuid.UUID, bool, error) {
	if s == nil {
		return nil, false, nil
	}
	if *s == "" {
		return nil, true, nil // explicit clear
	}
	u, err := uuid.Parse(*s)
	if err != nil {
		return nil, false, err
	}
	return &u, false, nil
}

func (r questionRequest) toInput() (services.QuestionInput, error) {
	in := services.QuestionInput{
		QuestionText: r.QuestionText, OptionA: r.OptionA, OptionB: r.OptionB, OptionC: r.OptionC, OptionD: r.OptionD,
		CorrectOption: r.CorrectOption, Explanation: r.Explanation, ContentFormat: r.ContentFormat,
		Difficulty: r.Difficulty, NCERTClass: r.NCERTClass, NCERTPage: r.NCERTPage, SourceType: r.SourceType,
		SourceYear: r.SourceYear, SourceLabel: r.SourceLabel, CustomEligible: r.CustomEligible, Tags: r.Tags,
	}
	var err error
	if in.SubjectID, _, err = parseOptUUID(r.SubjectID); err != nil {
		return in, errors.New("invalid subject_id")
	}
	if in.ChapterID, _, err = parseOptUUID(r.ChapterID); err != nil {
		return in, errors.New("invalid chapter_id")
	}
	var clear bool
	if in.TopicID, clear, err = parseOptUUID(r.TopicID); err != nil {
		return in, errors.New("invalid topic_id")
	}
	in.ClearTopic = clear
	return in, nil
}

// questionEnvelope wraps a question with its media map and duplicate warnings.
type questionResponse struct {
	models.Question
	Warnings []services.Warning    `json:"warnings"`
	Media    map[string]media.View `json:"media"`
}

// (fields are flattened so older clients that read `res.id` keep working)
func questionEnvelope(db *gorm.DB, ctx context.Context, q *models.Question, warnings []services.Warning) questionResponse {
	mc := media.NewCollector()
	mc.Add(q.ContentFormat, &q.QuestionText, &q.OptionA, &q.OptionB, &q.OptionC, &q.OptionD, q.Explanation)
	if warnings == nil {
		warnings = []services.Warning{}
	}
	return questionResponse{Question: *q, Warnings: warnings, Media: media.NewService(db).ResolveCollector(ctx, mc, media.URLTTL(nil))}
}

// testDetail loads a test's questions (via test_questions) with tags + media.
func (h *TestHandler) testDetail(ctx context.Context, test *models.Test) adminTestDetailResponse {
	rows, _ := services.LoadTestQuestions(ctx, h.DB, test.ID)
	qs := make([]models.Question, len(rows))
	for i, r := range rows {
		qs[i] = r.Question
		qs[i].OrderIndex = r.Position
	}
	services.LoadTags(ctx, h.DB, qs)
	mc := media.NewCollector()
	for i := range qs {
		mc.Add(qs[i].ContentFormat, &qs[i].QuestionText, &qs[i].OptionA, &qs[i].OptionB, &qs[i].OptionC, &qs[i].OptionD, qs[i].Explanation)
	}
	return adminTestDetailResponse{Test: *test, Questions: qs, Media: media.NewService(h.DB).ResolveCollector(ctx, mc, media.URLTTL(test.DurationMinutes))}
}

type addQuestionRequest struct {
	QuestionText  string  `json:"question_text"  example:"Which organelle is known as the powerhouse of the cell?"`
	OptionA       string  `json:"option_a"       example:"Nucleus"`
	OptionB       string  `json:"option_b"       example:"Mitochondria"`
	OptionC       string  `json:"option_c"       example:"Ribosome"`
	OptionD       string  `json:"option_d"       example:"Golgi body"`
	CorrectOption string  `json:"correct_option" example:"B" enums:"A,B,C,D"`
	Explanation   *string `json:"explanation"    example:"Mitochondria produce ATP through cellular respiration."`
}

type csvImportRequest struct {
	FileKey            string `json:"file_key" example:"csv/user-uuid/file-uuid.csv"`
	BundleKey          string `json:"bundle_key" example:"import_bundle/user-uuid/file-uuid.zip"`
	Mode               string `json:"mode" enums:"validate,commit,update"`
	AllowContentUpdate bool   `json:"allow_content_update"`
}

type csvImportAcceptedResponse struct {
	BatchID uuid.UUID `json:"batch_id"`
	Status  string    `json:"status" example:"processing"`
}

type csvImportStatusResponse struct {
	Batch  models.CSVImportBatch      `json:"batch"`
	Errors []models.CSVImportRowError `json:"errors"`
}

type rejectContentRequest struct {
	Reason string `json:"reason" example:"Questions contain formatting errors"`
}

type adminTestDetailResponse struct {
	Test      models.Test           `json:"test"`
	Questions []models.Question     `json:"questions"`
	Media     map[string]media.View `json:"media"`
}
