package handlers

import (
	"net/http"
	"strings"
	"time"

	"codon-backend/internal/httpx"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TeacherExtrasHandler holds the author-side features that sit around the review workflow:
// scheduling, review turnaround, cloning, hand-over, deleting lessons and impact numbers.
type TeacherExtrasHandler struct {
	DB     *gorm.DB
	Review *services.ReviewService
}

func NewTeacherExtrasHandler(db *gorm.DB, review *services.ReviewService) *TeacherExtrasHandler {
	return &TeacherExtrasHandler{DB: db, Review: review}
}

// submitNote reads the optional {"note": "..."} body of a submit-for-review call. A missing or empty body is fine.
func submitNote(c *gin.Context) string {
	var b struct {
		Note string `json:"note"`
	}
	_ = c.ShouldBindJSON(&b)
	return b.Note
}

func (h *TeacherExtrasHandler) schedule(r services.Reviewable) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, ok := httpx.ParamUUID(c, "id")
		if !ok {
			return
		}
		var req struct {
			PublishAt *time.Time `json:"publish_at"` // null cancels
		}
		if !httpx.Bind(c, &req) {
			return
		}
		if err := h.Review.Schedule(c.Request.Context(), middleware.GetUser(c), r, id, nil, req.PublishAt); err != nil {
			respondService(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "schedule saved", "publish_at": req.PublishAt})
	}
}

func (h *TeacherExtrasHandler) ScheduleTest(c *gin.Context)    { h.schedule(services.ReviewTest)(c) }
func (h *TeacherExtrasHandler) ScheduleContent(c *gin.Context) { h.schedule(services.ReviewContent)(c) }
func (h *TeacherExtrasHandler) ScheduleHack(c *gin.Context)    { h.schedule(services.ReviewHack)(c) }
func (h *TeacherExtrasHandler) ScheduleDeck(c *gin.Context)    { h.schedule(services.ReviewDeck)(c) }

// ReviewStats: how long review takes right now.
func (h *TeacherExtrasHandler) ReviewStats(c *gin.Context) {
	c.JSON(http.StatusOK, h.Review.Stats(c.Request.Context(), time.Now()))
}

// DeleteContent removes a lesson that students cannot see. Approved or published lessons are kept:
// students may already have progress on them.
func (h *TeacherExtrasHandler) DeleteContent(c *gin.Context) {
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	teacher := middleware.GetUser(c)
	var item models.ContentItem
	q := h.DB.WithContext(c.Request.Context()).Where("id = ?", id)
	if !canManageAllContent(teacher) {
		q = q.Where("uploaded_by = ?", teacher.ID)
	}
	if err := q.First(&item).Error; err != nil {
		httpx.NotFound(c, "not_found", "content item not found")
		return
	}
	if item.Status == models.StatusApproved || item.Status == models.StatusPublished {
		httpx.Fail(c, services.Conflict("conflict", "an approved or published lesson can't be deleted"))
		return
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("content_item_id = ?", item.ID).Delete(&models.UserWatchHistory{}).Error; err != nil {
			return err
		}
		return tx.Delete(&item).Error
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "lesson deleted"})
}

// CloneTest copies a test and all its questions into a new draft owned by the caller
// ("Mock 7" from "Mock 6").
func (h *TeacherExtrasHandler) CloneTest(c *gin.Context) {
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	teacher := middleware.GetUser(c)
	ctx := c.Request.Context()
	var src models.Test
	q := h.DB.WithContext(ctx).Where("id = ? AND origin = 'authored'", id)
	if !canManageAllTests(teacher) {
		q = q.Where("created_by = ?", teacher.ID)
	}
	if err := q.First(&src).Error; err != nil {
		httpx.NotFound(c, "not_found", "test not found")
		return
	}
	title := src.Title
	if len([]rune(title)) > 190 {
		title = string([]rune(title)[:190])
	}
	var out models.Test
	err := h.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		cp := models.Test{
			Title: title + " (copy)", Description: src.Description, CourseID: src.CourseID, ModuleType: src.ModuleType,
			RequiresSubscription: src.RequiresSubscription, SubjectID: src.SubjectID, ChapterID: src.ChapterID,
			CreatedBy: teacher.ID, DurationMinutes: src.DurationMinutes, MarksPerCorrect: src.MarksPerCorrect,
			MarksPerWrong: src.MarksPerWrong, Status: models.StatusDraft, Instructions: src.Instructions,
			Mode: src.Mode,
		}
		if err := tx.Create(&cp).Error; err != nil {
			return err
		}
		qs, err := services.LoadTestQuestions(ctx, tx, src.ID)
		if err != nil {
			return err
		}
		for _, sq := range qs {
			nq := sq.Question
			nq.ID = uuid.Nil
			nq.TestID = cp.ID
			nq.Version = 1
			if err := tx.Create(&nq).Error; err != nil {
				return err
			}
			if err := services.AddQuestionToTest(tx, cp.ID, nq.ID, sq.Position); err != nil {
				return err
			}
			if err := tx.Exec(`INSERT INTO question_tags (question_id, tag_id) SELECT ?, tag_id FROM question_tags WHERE question_id = ?`,
				nq.ID, sq.Question.ID).Error; err != nil {
				return err
			}
		}
		if err := tx.Model(&cp).Update("total_questions", len(qs)).Error; err != nil {
			return err
		}
		return tx.First(&out, cp.ID).Error
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, out)
}

type transferRequest struct {
	PhoneNumber string `json:"phone_number"`
}

// transfer hands an item to another teacher. Only the owner (or an admin) can do it, and the new owner
// must be an active teacher. The new owner is notified.
func (h *TeacherExtrasHandler) transfer(c *gin.Context, table, ownerCol, label string) {
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var req transferRequest
	if !httpx.Bind(c, &req) {
		return
	}
	teacher := middleware.GetUser(c)
	ctx := c.Request.Context()
	var to models.User
	if err := h.DB.WithContext(ctx).Where("phone_number = ? AND role = ? AND suspended_at IS NULL",
		services.NormalizePhone(req.PhoneNumber), models.RoleTeacher).First(&to).Error; err != nil {
		httpx.NotFound(c, "teacher_not_found", "no active teacher has that phone number")
		return
	}
	if to.ID == teacher.ID {
		httpx.BadRequest(c, "same_owner", "you already own this")
		return
	}
	q := h.DB.WithContext(ctx).Table(table).Where("id = ?", id)
	if teacher.Role != models.RoleAdmin && !teacher.CanManageAllContent {
		q = q.Where(ownerCol+" = ?", teacher.ID)
	}
	var titles []string
	if err := q.Session(&gorm.Session{}).Pluck("title", &titles).Error; err != nil || len(titles) == 0 {
		httpx.NotFound(c, "not_found", label+" not found")
		return
	}
	if err := q.Updates(map[string]interface{}{ownerCol: to.ID, "updated_at": time.Now()}).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	from := "Another teacher"
	if teacher.Name != nil && strings.TrimSpace(*teacher.Name) != "" {
		from = strings.TrimSpace(*teacher.Name)
	}
	services.Notify(h.DB.WithContext(ctx), to.ID, "content_transferred", from+" handed you a "+label, titles[0], map[string]interface{}{"id": id, "route": "/(teacher)/notifications"})
	c.JSON(http.StatusOK, messageResponse{Message: "handed over"})
}

func (h *TeacherExtrasHandler) TransferTest(c *gin.Context) {
	h.transfer(c, "tests", "created_by", "test")
}
func (h *TeacherExtrasHandler) TransferContent(c *gin.Context) {
	h.transfer(c, "content_items", "uploaded_by", "lesson")
}

// TestStats: how a test is doing with students.
func (h *TeacherExtrasHandler) TestStats(c *gin.Context) {
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	teacher := middleware.GetUser(c)
	ctx := c.Request.Context()
	own := h.DB.WithContext(ctx).Table("tests").Where("id = ?", id)
	if !canManageAllTests(teacher) {
		own = own.Where("created_by = ?", teacher.ID)
	}
	var n int64
	if err := own.Count(&n).Error; err != nil || n == 0 {
		httpx.NotFound(c, "not_found", "test not found")
		return
	}
	var agg struct {
		Started     int64   `json:"started"`
		Submitted   int64   `json:"submitted"`
		Students    int64   `json:"students"`
		AvgPercent  float64 `json:"avg_percent"`
		AvgMinutes  float64 `json:"avg_minutes"`
	}
	h.DB.WithContext(ctx).Raw(`
		SELECT COUNT(*) AS started,
		       COUNT(*) FILTER (WHERE status = 'submitted') AS submitted,
		       COUNT(DISTINCT user_id) AS students,
		       COALESCE(AVG(CASE WHEN status = 'submitted' AND total_marks > 0 THEN score * 100.0 / total_marks END), 0) AS avg_percent,
		       COALESCE(AVG(CASE WHEN status = 'submitted' THEN time_taken_seconds END) / 60.0, 0) AS avg_minutes
		FROM student_attempts WHERE test_id = ?`, id).Scan(&agg)
	var hardest []struct {
		QuestionID uuid.UUID `json:"question_id"`
		Position   int       `json:"position"`
		Answered   int64     `json:"answered"`
		CorrectPct float64   `json:"correct_pct"`
	}
	h.DB.WithContext(ctx).Raw(`
		SELECT aa.question_id, MIN(aa.position) AS position, COUNT(*) AS answered,
		       100.0 * COUNT(*) FILTER (WHERE aa.is_correct) / COUNT(*) AS correct_pct
		FROM attempt_answers aa JOIN student_attempts a ON a.id = aa.attempt_id
		WHERE a.test_id = ? AND a.status = 'submitted' AND aa.selected_option IS NOT NULL
		GROUP BY aa.question_id HAVING COUNT(*) >= 5
		ORDER BY correct_pct ASC LIMIT 5`, id).Scan(&hardest)
	if hardest == nil {
		hardest = make([]struct {
			QuestionID uuid.UUID `json:"question_id"`
			Position   int       `json:"position"`
			Answered   int64     `json:"answered"`
			CorrectPct float64   `json:"correct_pct"`
		}, 0)
	}
	c.JSON(http.StatusOK, gin.H{
		"started": agg.Started, "submitted": agg.Submitted, "students": agg.Students,
		"completion_pct": pct(agg.Submitted, agg.Started), "avg_percent": agg.AvgPercent, "avg_minutes": agg.AvgMinutes,
		"hardest_questions": hardest,
	})
}

// ContentStats: how a lesson is doing with students.
func (h *TeacherExtrasHandler) ContentStats(c *gin.Context) {
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	teacher := middleware.GetUser(c)
	ctx := c.Request.Context()
	own := h.DB.WithContext(ctx).Table("content_items").Where("id = ?", id)
	if !canManageAllContent(teacher) {
		own = own.Where("uploaded_by = ?", teacher.ID)
	}
	var n int64
	if err := own.Count(&n).Error; err != nil || n == 0 {
		httpx.NotFound(c, "not_found", "content not found")
		return
	}
	var agg struct {
		Viewers   int64
		Completed int64
		AvgMin    float64
	}
	h.DB.WithContext(ctx).Raw(`
		SELECT COUNT(*) AS viewers, COUNT(*) FILTER (WHERE is_completed) AS completed,
		       COALESCE(AVG(progress_seconds) / 60.0, 0) AS avg_min
		FROM user_watch_histories WHERE content_item_id = ?`, id).Scan(&agg)
	c.JSON(http.StatusOK, gin.H{
		"viewers": agg.Viewers, "completed": agg.Completed,
		"completion_pct": pct(agg.Completed, agg.Viewers), "avg_minutes_watched": agg.AvgMin,
	})
}

// Impact: one summary of what the teacher's published work has done.
func (h *TeacherExtrasHandler) Impact(c *gin.Context) {
	teacher := middleware.GetUser(c)
	ctx := c.Request.Context()
	var out struct {
		PublishedTests    int64 `json:"published_tests"`
		PublishedLessons  int64 `json:"published_lessons"`
		PublishedHacks    int64 `json:"published_hacks"`
		PublishedDecks    int64 `json:"published_decks"`
		TestAttempts      int64 `json:"test_attempts"`
		TestStudents      int64 `json:"test_students"`
		LessonViewers     int64 `json:"lesson_viewers"`
	}
	var ta struct{ TestAttempts, TestStudents int64 }
	var lv struct{ LessonViewers int64 }
	db := h.DB.WithContext(ctx)
	db.Table("tests").Where("created_by = ? AND status = ? AND origin = 'authored'", teacher.ID, models.StatusPublished).Count(&out.PublishedTests)
	db.Table("content_items").Where("uploaded_by = ? AND status = ?", teacher.ID, models.StatusPublished).Count(&out.PublishedLessons)
	db.Table("brain_hacks").Where("author_id = ? AND status = ?", teacher.ID, models.StatusPublished).Count(&out.PublishedHacks)
	db.Table("flashcard_decks").Where("author_id = ? AND status = ?", teacher.ID, models.StatusPublished).Count(&out.PublishedDecks)
	db.Raw(`SELECT COUNT(*) AS test_attempts, COUNT(DISTINCT a.user_id) AS test_students
		FROM student_attempts a JOIN tests t ON t.id = a.test_id
		WHERE t.created_by = ? AND a.status = 'submitted'`, teacher.ID).Scan(&ta)
	db.Raw(`SELECT COUNT(DISTINCT w.user_id) AS lesson_viewers
		FROM user_watch_histories w JOIN content_items ci ON ci.id = w.content_item_id
		WHERE ci.uploaded_by = ?`, teacher.ID).Scan(&lv)
	out.TestAttempts, out.TestStudents, out.LessonViewers = ta.TestAttempts, ta.TestStudents, lv.LessonViewers
	c.JSON(http.StatusOK, out)
}

func pct(a, b int64) float64 {
	if b == 0 {
		return 0
	}
	return float64(a) * 100 / float64(b)
}

// authorNames maps author ids to the name students see. Authors without a name are left out,
// so the app shows no byline rather than a blank one.
func authorNames(db *gorm.DB, ids []uuid.UUID) map[uuid.UUID]string {
	out := map[uuid.UUID]string{}
	if len(ids) == 0 {
		return out
	}
	var rows []struct {
		ID   uuid.UUID
		Name *string
	}
	if err := db.Model(&models.User{}).Select("id, name").Where("id IN ?", ids).Scan(&rows).Error; err != nil {
		return out
	}
	for _, r := range rows {
		if r.Name == nil {
			continue
		}
		if n := strings.TrimSpace(*r.Name); n != "" {
			out[r.ID] = n
		}
	}
	return out
}
