package handlers

import (
	"codon-backend/internal/httpx"
	"net/http"
	"strings"

	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CurriculumHandler struct{ DB *gorm.DB }

func NewCurriculumHandler(db *gorm.DB) *CurriculumHandler { return &CurriculumHandler{DB: db} }

// CreateSubject godoc
//
//	@Summary		Create a Subject (Admin)
//	@Description	Creates a new subject under a specific course.
//	@Tags			Curriculum
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			course_id	path		string					true	"Course UUID"
//	@Param			body		body		createSubjectRequest	true	"Subject details"
//	@Success		201			{object}	models.Subject
//	@Failure		400			{object}	errorResponse
//	@Failure		404			{object}	errorResponse
//	@Router			/api/v1/admin/courses/{course_id}/subjects [post]
func (h *CurriculumHandler) CreateSubject(c *gin.Context) {
	courseID, err := uuid.Parse(c.Param("course_id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid course id")
		return
	}

	var req createSubjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	var course models.Course
	if err := h.DB.WithContext(c.Request.Context()).Where("id = ?", courseID).First(&course).Error; err != nil {
		respondErr(c, http.StatusNotFound, "not_found", "course not found")
		return
	}

	subject := models.Subject{
		CourseID:    courseID,
		Name:        req.Name,
		Description: req.Description,
		OrderIndex:  req.OrderIndex,
	}

	if err := h.DB.WithContext(c.Request.Context()).Create(&subject).Error; err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to create subject")
		return
	}
	_ = auditAdmin(h.DB.WithContext(c.Request.Context()), middleware.GetUser(c), "subject.create", "subject:"+subject.ID.String(), nil, map[string]string{"name": subject.Name})
	c.JSON(http.StatusCreated, subject)
}

// UpdateSubject godoc
//
//	@Summary		Update a Subject (Admin)
//	@Description	Partially updates a subject.
//	@Tags			Curriculum
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string					true	"Subject UUID"
//	@Param			body	body		updateSubjectRequest	true	"Fields to update"
//	@Success		200		{object}	models.Subject
//	@Failure		400		{object}	errorResponse
//	@Failure		404		{object}	errorResponse
//	@Router			/api/v1/admin/subjects/{id} [patch]
func (h *CurriculumHandler) UpdateSubject(c *gin.Context) {
	id := c.Param("id")

	var subject models.Subject
	if err := h.DB.WithContext(c.Request.Context()).Where("id = ?", id).First(&subject).Error; err != nil {
		respondErr(c, http.StatusNotFound, "not_found", "subject not found")
		return
	}

	var req updateSubjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.OrderIndex != nil {
		updates["order_index"] = *req.OrderIndex
	}

	if err := h.DB.WithContext(c.Request.Context()).Model(&subject).Updates(updates).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	h.DB.WithContext(c.Request.Context()).First(&subject, subject.ID)
	_ = auditAdmin(h.DB.WithContext(c.Request.Context()), middleware.GetUser(c), "subject.update", "subject:"+subject.ID.String(), nil, updates)
	c.JSON(http.StatusOK, subject)
}

// CreateChapter godoc
//
//	@Summary		Create a Chapter (Teacher)
//	@Description	Creates a new chapter (topic) under a specific subject. Callable by teachers and admins.
//	@Tags			Curriculum
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			subject_id	path		string					true	"Subject UUID"
//	@Param			body		body		createChapterRequest	true	"Chapter details"
//	@Success		201			{object}	models.Chapter
//	@Failure		400			{object}	errorResponse
//	@Failure		404			{object}	errorResponse
//	@Router			/api/v1/teacher/subjects/{subject_id}/chapters [post]
func (h *CurriculumHandler) CreateChapter(c *gin.Context) {
	subjectID, err := uuid.Parse(c.Param("subject_id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid subject id")
		return
	}

	var req createChapterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	var subject models.Subject
	if err := h.DB.WithContext(c.Request.Context()).Where("id = ?", subjectID).First(&subject).Error; err != nil {
		respondErr(c, http.StatusNotFound, "not_found", "subject not found")
		return
	}

	chapter := models.Chapter{
		SubjectID:   subjectID,
		Name:        req.Name,
		Description: req.Description,
		OrderIndex:  req.OrderIndex,
	}

	if err := h.DB.WithContext(c.Request.Context()).Create(&chapter).Error; err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to create chapter")
		return
	}
	_ = auditAdmin(h.DB.WithContext(c.Request.Context()), middleware.GetUser(c), "chapter.create", "chapter:"+chapter.ID.String(), nil, map[string]string{"name": chapter.Name})
	c.JSON(http.StatusCreated, chapter)
}

// UpdateChapter godoc
//
//	@Summary		Update a Chapter (Teacher)
//	@Description	Partially updates a chapter. Callable by teachers and admins.
//	@Tags			Curriculum
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string					true	"Chapter UUID"
//	@Param			body	body		updateChapterRequest	true	"Fields to update"
//	@Success		200		{object}	models.Chapter
//	@Failure		400		{object}	errorResponse
//	@Failure		404		{object}	errorResponse
//	@Router			/api/v1/teacher/chapters/{id} [patch]
func (h *CurriculumHandler) UpdateChapter(c *gin.Context) {
	id := c.Param("id")

	var chapter models.Chapter
	if err := h.DB.WithContext(c.Request.Context()).Where("id = ?", id).First(&chapter).Error; err != nil {
		respondErr(c, http.StatusNotFound, "not_found", "chapter not found")
		return
	}

	var req updateChapterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.OrderIndex != nil {
		updates["order_index"] = *req.OrderIndex
	}

	if err := h.DB.WithContext(c.Request.Context()).Model(&chapter).Updates(updates).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	h.DB.WithContext(c.Request.Context()).First(&chapter, chapter.ID)
	_ = auditAdmin(h.DB.WithContext(c.Request.Context()), middleware.GetUser(c), "chapter.update", "chapter:"+chapter.ID.String(), nil, updates)
	c.JSON(http.StatusOK, chapter)
}

// GetCurriculum godoc
//
//	@Summary		Get course curriculum hierarchy
//	@Description	Returns the nested hierarchy of a course -> subjects -> chapters, including counts of published content and tests.
//	@Tags			Curriculum
//	@Produce		json
//	@Param			id	path		string	true	"Course UUID"
//	@Success		200	{object}	curriculumResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/api/v1/courses/{id}/curriculum [get]
func (h *CurriculumHandler) GetCurriculum(c *gin.Context) {
	courseID := c.Param("id")

	var course models.Course
	if err := h.DB.WithContext(c.Request.Context()).Where("id = ? AND is_active = ?", courseID, true).First(&course).Error; err != nil {
		respondErr(c, http.StatusNotFound, "not_found", "course not found")
		return
	}

	var subjects []models.Subject
	h.DB.WithContext(c.Request.Context()).Where("course_id = ?", courseID).Order("order_index ASC").Find(&subjects)

	var chapters []models.Chapter
	if len(subjects) > 0 {
		subjectIDs := make([]uuid.UUID, len(subjects))
		for i, s := range subjects {
			subjectIDs[i] = s.ID
		}
		h.DB.WithContext(c.Request.Context()).Where("subject_id IN ?", subjectIDs).Order("order_index ASC").Find(&chapters)
	}

	// Fetch published content counts per chapter
	type ChapterCount struct {
		ChapterID uuid.UUID
		Count     int
	}
	var contentCounts []ChapterCount
	h.DB.WithContext(c.Request.Context()).Model(&models.ContentItem{}).
		Select("chapter_id, COUNT(*) as count").
		Where("course_id = ? AND status = ?", courseID, models.StatusPublished).
		Group("chapter_id").Scan(&contentCounts)

	contentMap := make(map[uuid.UUID]int)
	for _, cc := range contentCounts {
		contentMap[cc.ChapterID] = cc.Count
	}

	// Fetch published test counts per chapter
	var testCounts []ChapterCount
	h.DB.WithContext(c.Request.Context()).Model(&models.Test{}).
		Select("chapter_id, COUNT(*) as count").
		Where("course_id = ? AND status = ? AND chapter_id IS NOT NULL AND origin = ? AND archived_at IS NULL", courseID, models.StatusPublished, models.OriginAuthored).
		Group("chapter_id").Scan(&testCounts)

	testMap := make(map[uuid.UUID]int)
	for _, tc := range testCounts {
		testMap[tc.ChapterID] = tc.Count
	}

	// Build the nested response
	chaptersBySubject := make(map[uuid.UUID][]curriculumChapterView)
	for _, chap := range chapters {
		chaptersBySubject[chap.SubjectID] = append(chaptersBySubject[chap.SubjectID], curriculumChapterView{
			ID:           chap.ID,
			Name:         chap.Name,
			OrderIndex:   chap.OrderIndex,
			ContentCount: contentMap[chap.ID],
			TestCount:    testMap[chap.ID],
		})
	}

	subjectViews := make([]curriculumSubjectView, len(subjects))
	for i, sub := range subjects {
		chaps := chaptersBySubject[sub.ID]
		if chaps == nil {
			chaps = []curriculumChapterView{}
		}
		subjectViews[i] = curriculumSubjectView{
			ID:         sub.ID,
			Name:       sub.Name,
			OrderIndex: sub.OrderIndex,
			Chapters:   chaps,
		}
	}

	c.JSON(http.StatusOK, curriculumResponse{
		Course: curriculumCourseView{
			ID:       course.ID,
			Name:     course.Name,
			Subjects: subjectViews,
		},
	})
}

// ── Request / Response types ──────────────────────────────────────────────────

type createSubjectRequest struct {
	Name        string `json:"name" example:"Physics"`
	Description string `json:"description" example:"The study of matter and energy"`
	OrderIndex  int    `json:"order_index" example:"1"`
}

type updateSubjectRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	OrderIndex  *int    `json:"order_index"`
}

type createChapterRequest struct {
	Name        string `json:"name" example:"Thermodynamics"`
	Description string `json:"description" example:"Laws of thermodynamics"`
	OrderIndex  int    `json:"order_index" example:"1"`
}

type updateChapterRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	OrderIndex  *int    `json:"order_index"`
}

type curriculumChapterView struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name" example:"Thermodynamics"`
	OrderIndex   int       `json:"order_index" example:"1"`
	ContentCount int       `json:"content_count" example:"5"`
	TestCount    int       `json:"test_count" example:"2"`
}

type curriculumSubjectView struct {
	ID         uuid.UUID               `json:"id"`
	Name       string                  `json:"name" example:"Physics"`
	OrderIndex int                     `json:"order_index" example:"1"`
	Chapters   []curriculumChapterView `json:"chapters"`
}

type curriculumCourseView struct {
	ID       uuid.UUID               `json:"id"`
	Name     string                  `json:"name" example:"NEET UG"`
	Subjects []curriculumSubjectView `json:"subjects"`
}

type curriculumResponse struct {
	Course curriculumCourseView `json:"course"`
}

// ── Courses, and removing empty subjects and chapters ────────────────────────

type createCourseRequest struct {
	Name                        string  `json:"name" binding:"required,min=2,max=80"`
	Slug                        string  `json:"slug"`
	Description                 *string `json:"description"`
	DefaultRequiresSubscription *bool   `json:"default_requires_subscription"`
}

// slugify turns "NEET PG 2027" into "neet-pg-2027".
func slugify(s string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(strings.TrimSpace(s)) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			dash = false
			continue
		}
		if !dash && b.Len() > 0 {
			b.WriteByte('-')
			dash = true
		}
	}
	return strings.TrimRight(b.String(), "-")
}

// CreateCourse godoc
//
//	@Summary		Create a course (Admin)
//	@Tags			Courses
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		createCourseRequest	true	"Course"
//	@Success		201		{object}	models.Course
//	@Router			/api/v1/admin/courses [post]
func (h *CurriculumHandler) CreateCourse(c *gin.Context) {
	var req createCourseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	name := strings.TrimSpace(req.Name)
	slug := slugify(req.Slug)
	if slug == "" {
		slug = slugify(name)
	}
	if slug == "" {
		respondErr(c, http.StatusBadRequest, "bad_request", "the name must contain letters or numbers")
		return
	}
	course := models.Course{Name: name, Slug: slug, Description: req.Description, IsActive: true}
	if req.DefaultRequiresSubscription != nil {
		course.DefaultRequiresSubscription = *req.DefaultRequiresSubscription
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var taken int64
		if err := tx.Model(&models.Course{}).Where("slug = ?", slug).Count(&taken).Error; err != nil {
			return err
		}
		if taken > 0 {
			return services.Conflict("slug_taken", "a course with this name already exists")
		}
		if err := tx.Create(&course).Error; err != nil {
			return err
		}
		return auditAdmin(tx, middleware.GetUser(c), "course.create", "course:"+course.ID.String(), nil, map[string]string{"name": course.Name})
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, course)
}

// inUse refuses a delete while anything still points at the row. FK columns only exist on some tables,
// so each referencing table is counted explicitly.
func inUse(tx *gorm.DB, col string, id uuid.UUID, tables []string, code, msg string) error {
	for _, t := range tables {
		var n int64
		if err := tx.Table(t).Where(col+" = ?", id).Count(&n).Error; err != nil {
			return err
		}
		if n > 0 {
			return services.Conflict(code, msg)
		}
	}
	return nil
}

// DeleteChapter godoc
//
//	@Summary		Delete an empty chapter (Admin)
//	@Description	Only a chapter with no lessons, tests, questions, decks or topics can be deleted.
//	@Tags			Courses
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Chapter UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/admin/chapters/{id} [delete]
func (h *CurriculumHandler) DeleteChapter(c *gin.Context) {
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var ch models.Chapter
		if err := tx.Where("id = ?", id).First(&ch).Error; err != nil {
			return err
		}
		if err := inUse(tx, "chapter_id", id, []string{"content_items", "tests", "questions", "flashcard_decks", "topics"},
			"chapter_in_use", "this chapter still has content, tests or questions; move or remove them first"); err != nil {
			return err
		}
		if err := tx.Where("id = ?", id).Delete(&models.Chapter{}).Error; err != nil {
			return err
		}
		return auditAdmin(tx, middleware.GetUser(c), "chapter.delete", "chapter:"+id.String(), map[string]string{"name": ch.Name}, nil)
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "chapter deleted"})
}

// DeleteSubject godoc
//
//	@Summary		Delete an empty subject (Admin)
//	@Description	Only a subject with no chapters, tests, questions or decks can be deleted.
//	@Tags			Courses
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Subject UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/admin/subjects/{id} [delete]
func (h *CurriculumHandler) DeleteSubject(c *gin.Context) {
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var sub models.Subject
		if err := tx.Where("id = ?", id).First(&sub).Error; err != nil {
			return err
		}
		if err := inUse(tx, "subject_id", id, []string{"chapters", "tests", "questions", "flashcard_decks"},
			"subject_in_use", "this subject still has chapters, tests or questions; remove them first"); err != nil {
			return err
		}
		if err := tx.Where("id = ?", id).Delete(&models.Subject{}).Error; err != nil {
			return err
		}
		return auditAdmin(tx, middleware.GetUser(c), "subject.delete", "subject:"+id.String(), map[string]string{"name": sub.Name}, nil)
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "subject deleted"})
}
