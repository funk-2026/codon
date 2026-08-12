package handlers

import (
	"net/http"

	"codon-backend/internal/models"

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
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid course id"})
		return
	}

	var req createSubjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	var course models.Course
	if err := h.DB.WithContext(c.Request.Context()).Where("id = ?", courseID).First(&course).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "course not found"})
		return
	}

	subject := models.Subject{
		CourseID:    courseID,
		Name:        req.Name,
		Description: req.Description,
		OrderIndex:  req.OrderIndex,
	}

	if err := h.DB.WithContext(c.Request.Context()).Create(&subject).Error; err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to create subject"})
		return
	}
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
		c.JSON(http.StatusNotFound, errorResponse{Error: "subject not found"})
		return
	}

	var req updateSubjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
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

	h.DB.WithContext(c.Request.Context()).Model(&subject).Updates(updates)
	h.DB.WithContext(c.Request.Context()).First(&subject, subject.ID)
	c.JSON(http.StatusOK, subject)
}

// CreateChapter godoc
//
//	@Summary		Create a Chapter (Admin)
//	@Description	Creates a new chapter under a specific subject.
//	@Tags			Curriculum
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			subject_id	path		string					true	"Subject UUID"
//	@Param			body		body		createChapterRequest	true	"Chapter details"
//	@Success		201			{object}	models.Chapter
//	@Failure		400			{object}	errorResponse
//	@Failure		404			{object}	errorResponse
//	@Router			/api/v1/admin/subjects/{subject_id}/chapters [post]
func (h *CurriculumHandler) CreateChapter(c *gin.Context) {
	subjectID, err := uuid.Parse(c.Param("subject_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid subject id"})
		return
	}

	var req createChapterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	var subject models.Subject
	if err := h.DB.WithContext(c.Request.Context()).Where("id = ?", subjectID).First(&subject).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "subject not found"})
		return
	}

	chapter := models.Chapter{
		SubjectID:   subjectID,
		Name:        req.Name,
		Description: req.Description,
		OrderIndex:  req.OrderIndex,
	}

	if err := h.DB.WithContext(c.Request.Context()).Create(&chapter).Error; err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to create chapter"})
		return
	}
	c.JSON(http.StatusCreated, chapter)
}

// UpdateChapter godoc
//
//	@Summary		Update a Chapter (Admin)
//	@Description	Partially updates a chapter.
//	@Tags			Curriculum
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string					true	"Chapter UUID"
//	@Param			body	body		updateChapterRequest	true	"Fields to update"
//	@Success		200		{object}	models.Chapter
//	@Failure		400		{object}	errorResponse
//	@Failure		404		{object}	errorResponse
//	@Router			/api/v1/admin/chapters/{id} [patch]
func (h *CurriculumHandler) UpdateChapter(c *gin.Context) {
	id := c.Param("id")

	var chapter models.Chapter
	if err := h.DB.WithContext(c.Request.Context()).Where("id = ?", id).First(&chapter).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "chapter not found"})
		return
	}

	var req updateChapterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
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

	h.DB.WithContext(c.Request.Context()).Model(&chapter).Updates(updates)
	h.DB.WithContext(c.Request.Context()).First(&chapter, chapter.ID)
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
		c.JSON(http.StatusNotFound, errorResponse{Error: "course not found"})
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
		Where("course_id = ? AND status = ? AND chapter_id IS NOT NULL", courseID, models.StatusPublished).
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
