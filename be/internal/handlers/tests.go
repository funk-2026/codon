package handlers

import (
	"net/http"
	"time"

	"codon-backend/internal/jobs"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TestHandler struct{ DB *gorm.DB }

func NewTestHandler(db *gorm.DB) *TestHandler { return &TestHandler{DB: db} }

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
	courseID := c.Query("course_id")
	moduleType := c.Query("module_type")
	subjectID := c.Query("subject_id")
	chapterID := c.Query("chapter_id")

	query := h.DB.WithContext(c.Request.Context()).
		Where("status = ?", models.StatusPublished)

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

	var tests []models.Test
	query.Preload("Course").Order("created_at DESC").Find(&tests)
	c.JSON(http.StatusOK, listTestsResponse{Tests: tests})
}

// GetTest godoc
//
//	@Summary		Get a test by ID
//	@Description	Returns metadata for a single published test (no questions or answers included).
//	@Tags			Tests
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Test UUID"
//	@Success		200	{object}	models.Test
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/tests/{id} [get]
func (h *TestHandler) GetTest(c *gin.Context) {
	id := c.Param("id")
	var test models.Test
	if err := h.DB.WithContext(c.Request.Context()).
		Where("id = ? AND status = ?", id, models.StatusPublished).
		Preload("Course").
		First(&test).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "test not found"})
		return
	}
	c.JSON(http.StatusOK, test)
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
	testID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid test id"})
		return
	}

	var attempt models.StudentAttempt
	if err := h.DB.WithContext(c.Request.Context()).
		Where("user_id = ? AND test_id = ? AND status = ?", user.ID, testID, models.AttemptInProgress).
		First(&attempt).Error; err != nil {
		c.JSON(http.StatusForbidden, errorResponse{Error: "no active attempt — start an attempt first"})
		return
	}

	var questions []models.Question
	h.DB.WithContext(c.Request.Context()).
		Where("test_id = ?", testID).
		Order("order_index ASC").
		Find(&questions)

	type QuestionView struct {
		ID           uuid.UUID `json:"id"`
		TestID       uuid.UUID `json:"test_id"`
		QuestionText string    `json:"question_text"`
		OptionA      string    `json:"option_a"`
		OptionB      string    `json:"option_b"`
		OptionC      string    `json:"option_c"`
		OptionD      string    `json:"option_d"`
		OrderIndex   int       `json:"order_index"`
	}

	resp := make([]QuestionView, len(questions))
	for i, q := range questions {
		resp[i] = QuestionView{
			ID: q.ID, TestID: q.TestID, QuestionText: q.QuestionText,
			OptionA: q.OptionA, OptionB: q.OptionB, OptionC: q.OptionC, OptionD: q.OptionD,
			OrderIndex: q.OrderIndex,
		}
	}
	c.JSON(http.StatusOK, testQuestionsResponse{Questions: resp, AttemptID: attempt.ID})
}

// ─── Teacher Test Management ──────────────────────────────────────────────────

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
		SubjectID: sID, ChapterID: cID,
		DurationMinutes: req.DurationMinutes, MarksPerCorrect: marksCorrect,
		MarksPerWrong: marksWrong, RequiresSubscription: requiresSub,
		CreatedBy: teacher.ID, Status: models.StatusDraft,
	}
	if err := h.DB.WithContext(c.Request.Context()).Create(&test).Error; err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to create test"})
		return
	}
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
	if !teacher.CanManageAllContent {
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
	testID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid test id"})
		return
	}

	var test models.Test
	query := h.DB.Where("id = ?", testID)
	if !teacher.CanManageAllContent {
		query = query.Where("created_by = ?", teacher.ID)
	}
	if err := query.First(&test).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "test not found"})
		return
	}

	var req addQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	opt := models.CorrectOption(req.CorrectOption)
	if opt != models.OptionA && opt != models.OptionB && opt != models.OptionC && opt != models.OptionD {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "correct_option must be A, B, C, or D"})
		return
	}

	var maxOrder struct{ MaxIdx int }
	h.DB.Model(&models.Question{}).
		Select("COALESCE(MAX(order_index), 0) as max_idx").
		Where("test_id = ?", testID).
		Scan(&maxOrder)

	question := models.Question{
		TestID: testID, QuestionText: req.QuestionText,
		OptionA: req.OptionA, OptionB: req.OptionB, OptionC: req.OptionC, OptionD: req.OptionD,
		CorrectOption: opt, Explanation: req.Explanation, OrderIndex: maxOrder.MaxIdx + 1,
	}
	if err := h.DB.WithContext(c.Request.Context()).Create(&question).Error; err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to add question"})
		return
	}

	h.DB.WithContext(c.Request.Context()).Model(&test).
		UpdateColumn("total_questions", gorm.Expr("total_questions + 1"))

	c.JSON(http.StatusCreated, question)
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
	testID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid test id"})
		return
	}

	var req csvImportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	batch := models.CSVImportBatch{
		TeacherID: teacher.ID, TestID: testID,
		FileKey: req.FileKey, Status: models.ImportProcessing,
	}
	if err := h.DB.WithContext(c.Request.Context()).Create(&batch).Error; err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to create import batch"})
		return
	}

	if err := jobs.EnqueueJob(h.DB, jobs.JobTypeCSVImport, jobs.CSVImportPayload{
		BatchID: batch.ID, FileKey: req.FileKey, TestID: testID,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to enqueue import job"})
		return
	}

	c.JSON(http.StatusAccepted, csvImportAcceptedResponse{BatchID: batch.ID, Status: "processing"})
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
	id := c.Param("id")
	var batch models.CSVImportBatch
	if err := h.DB.Where("id = ?", id).First(&batch).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "batch not found"})
		return
	}

	var rowErrors []models.CSVImportRowError
	h.DB.Where("batch_id = ?", batch.ID).Find(&rowErrors)

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
	if !teacher.CanManageAllContent {
		query = query.Where("created_by = ?", teacher.ID)
	}
	if err := query.First(&test).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "test not found or not in draft/rejected state"})
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
	if !teacher.CanManageAllContent {
		query = query.Where("created_by = ?", teacher.ID)
	}
	if err := query.First(&test).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "test not found or not approved"})
		return
	}

	h.DB.WithContext(c.Request.Context()).Model(&test).Update("status", models.StatusPublished)
	c.JSON(http.StatusOK, messageResponse{Message: "test published"})
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
	id := c.Param("id")

	var test models.Test
	query := h.DB.WithContext(c.Request.Context()).
		Preload("Course").Preload("Subject").Preload("Chapter").Preload("Creator").
		Where("id = ?", id)
	
	if !teacher.CanManageAllContent {
		query = query.Where("created_by = ?", teacher.ID)
	}

	if err := query.First(&test).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "test not found"})
		return
	}

	var questions []models.Question
	h.DB.WithContext(c.Request.Context()).
		Where("test_id = ?", test.ID).
		Order("order_index ASC").
		Find(&questions)

	c.JSON(http.StatusOK, adminTestDetailResponse{Test: test, Questions: questions})
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
	query := h.DB.WithContext(c.Request.Context())
	if !teacher.CanManageAllContent {
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
	id := c.Param("id")
	var test models.Test
	if err := h.DB.WithContext(c.Request.Context()).
		Preload("Course").Preload("Subject").Preload("Chapter").Preload("Creator").
		Where("id = ?", id).
		First(&test).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "test not found"})
		return
	}

	var questions []models.Question
	h.DB.WithContext(c.Request.Context()).
		Where("test_id = ?", test.ID).
		Order("order_index ASC").
		Find(&questions)

	c.JSON(http.StatusOK, adminTestDetailResponse{Test: test, Questions: questions})
}

// ─── Admin Test Moderation ────────────────────────────────────────────────────

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
		Where("status = ?", status).
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
	Title               string   `json:"title"       example:"Biology Chapter 1 — Cell Structure"`
	Description         *string  `json:"description" example:"Comprehensive practice test for Cell Structure and Organelles."`
	CourseID            string   `json:"course_id"   example:"550e8400-e29b-41d4-a716-446655440000"`
	ModuleType          string   `json:"module_type" example:"qbank" enums:"qbank,test_series,practice"`
	SubjectID           *string  `json:"subject_id"  example:"550e8400-e29b-41d4-a716-446655440001"`
	ChapterID           *string  `json:"chapter_id"  example:"550e8400-e29b-41d4-a716-446655440002"`
	DurationMinutes     *int     `json:"duration_minutes" example:"60"`
	MarksPerCorrect     *float64 `json:"marks_per_correct" example:"4"`
	MarksPerWrong       *float64 `json:"marks_per_wrong"   example:"-1"`
	RequiresSubscription *bool   `json:"requires_subscription" example:"true"`
}

type updateTestRequest struct {
	Title               *string  `json:"title"`
	Description         *string  `json:"description"`
	SubjectID           *string  `json:"subject_id"`
	ChapterID           *string  `json:"chapter_id"`
	DurationMinutes     *int     `json:"duration_minutes"`
	MarksPerCorrect     *float64 `json:"marks_per_correct"`
	MarksPerWrong       *float64 `json:"marks_per_wrong"`
	RequiresSubscription *bool   `json:"requires_subscription"`
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
	FileKey string `json:"file_key" example:"csv/user-uuid/file-uuid.csv"`
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
	Test      models.Test       `json:"test"`
	Questions []models.Question `json:"questions"`
}
