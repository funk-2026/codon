package handlers

import (
	"net/http"
	"strings"
	"time"

	"codon-backend/internal/media"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/pagination"
	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TeacherQuestionHandler serves the question-bank workspace: browse, bulk edit,
// duplicate check and metadata completeness.
type TeacherQuestionHandler struct {
	DB *gorm.DB
	QS *services.QuestionService
}

func NewTeacherQuestionHandler(db *gorm.DB) *TeacherQuestionHandler {
	return &TeacherQuestionHandler{DB: db, QS: newQuestionService(db)}
}

// scope restricts a query on questions to what this teacher may see.
func (h *TeacherQuestionHandler) scope(q *gorm.DB, user *models.User) *gorm.DB {
	q = q.Joins("JOIN tests ON tests.id = questions.test_id").Where("tests.origin = ?", models.OriginAuthored)
	if !canManageAllTests(user) {
		q = q.Where("tests.created_by = ?", user.ID)
	}
	return q
}

type teacherQuestionRow struct {
	models.Question
	Test        questionTestSummary `json:"test"`
	ReportCount int                 `json:"report_count"`
}

type questionTestSummary struct {
	ID         uuid.UUID            `json:"id"`
	Title      string               `json:"title"`
	Status     models.ContentStatus `json:"status"`
	ModuleType models.ModuleType    `json:"module_type"`
}

// ListQuestions godoc
//
//	@Summary		Browse my questions (Teacher)
//	@Description	Cursor-paginated question-bank list across all my tests (or everyone's for teachers with platform-wide permission). Filters: course_id, subject_id, chapter_id, test_id, difficulty, tag_id, eligible, flag_status, reported=true, missing=difficulty|chapter|topic|tags|ncert|alt_text, q (text search).
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Produce		json
//	@Param			limit	query		int		false	"Page size (max 100)"
//	@Param			cursor	query		string	false	"Cursor from previous page"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/teacher/questions [get]
func (h *TeacherQuestionHandler) ListQuestions(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	limit := pagination.Limit(c.Query("limit"))

	q := h.scope(h.DB.WithContext(ctx).Model(&models.Question{}), user)
	if v := c.Query("course_id"); v != "" {
		q = q.Where("tests.course_id = ?", v)
	}
	if v := c.Query("test_id"); v != "" {
		q = q.Where("questions.test_id = ?", v)
	}
	if v := c.Query("subject_id"); v != "" {
		q = q.Where("questions.subject_id = ?", v)
	}
	if v := c.Query("chapter_id"); v != "" {
		q = q.Where("questions.chapter_id = ?", v)
	}
	if v := c.Query("difficulty"); v != "" {
		q = q.Where("questions.difficulty = ?", v)
	}
	if v := c.Query("flag_status"); v != "" {
		q = q.Where("questions.flag_status = ?", v)
	}
	if v := c.Query("eligible"); v != "" {
		q = q.Where("questions.custom_eligible = ?", v == "true")
	}
	if v := c.Query("tag_id"); v != "" {
		q = q.Where("EXISTS (SELECT 1 FROM question_tags qt WHERE qt.question_id = questions.id AND qt.tag_id = ?)", v)
	}
	if c.Query("reported") == "true" {
		q = q.Where("EXISTS (SELECT 1 FROM content_reports r WHERE r.item_type = 'question' AND r.item_id = questions.id AND r.status = 'open')")
	}
	switch c.Query("missing") {
	case "":
	case "difficulty":
		q = q.Where("questions.difficulty IS NULL")
	case "chapter":
		q = q.Where("questions.chapter_id IS NULL")
	case "topic":
		q = q.Where("questions.topic_id IS NULL")
	case "tags":
		q = q.Where("NOT EXISTS (SELECT 1 FROM question_tags qt WHERE qt.question_id = questions.id)")
	case "ncert":
		q = q.Where("questions.ncert_page IS NULL")
	case "alt_text":
		q = q.Where(`EXISTS (SELECT 1 FROM media_refs r JOIN media_assets m ON m.id = r.media_id
			WHERE r.owner_type = 'question' AND r.owner_id = questions.id AND m.alt_text = '')`)
	default:
		respondErr(c, http.StatusBadRequest, "invalid_filter", "missing must be one of difficulty, chapter, topic, tags, ncert, alt_text")
		return
	}
	if v := strings.TrimSpace(c.Query("q")); v != "" {
		like := "%" + strings.ReplaceAll(strings.ReplaceAll(v, "%", `\%`), "_", `\_`) + "%"
		q = q.Where("(questions.question_text ILIKE ? OR questions.option_a ILIKE ? OR questions.option_b ILIKE ? OR questions.option_c ILIKE ? OR questions.option_d ILIKE ?)", like, like, like, like, like)
	}

	q = pagination.Apply(q, "questions", pagination.Decode(c.Query("cursor")), limit)
	var qs []models.Question
	if err := q.Select("questions.*").Find(&qs).Error; err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to list questions")
		return
	}
	qs, next := pagination.Page(qs, limit, func(x models.Question) (time.Time, uuid.UUID) { return x.CreatedAt, x.ID })
	services.LoadTags(ctx, h.DB, qs)

	ids := make([]uuid.UUID, len(qs))
	testIDs := map[uuid.UUID]bool{}
	for i, x := range qs {
		ids[i] = x.ID
		testIDs[x.TestID] = true
	}
	tests := map[uuid.UUID]models.Test{}
	if len(ids) > 0 {
		var ts []models.Test
		tid := make([]uuid.UUID, 0, len(testIDs))
		for id := range testIDs {
			tid = append(tid, id)
		}
		h.DB.WithContext(ctx).Select("id", "title", "status", "module_type").Where("id IN ?", tid).Find(&ts)
		for _, t := range ts {
			tests[t.ID] = t
		}
	}
	reportCounts := map[uuid.UUID]int{}
	if len(ids) > 0 {
		var rc []struct {
			ItemID uuid.UUID
			N      int
		}
		h.DB.WithContext(ctx).Raw(`SELECT item_id, count(*) AS n FROM content_reports
			WHERE item_type = 'question' AND status = 'open' AND item_id IN ? GROUP BY item_id`, ids).Scan(&rc)
		for _, r := range rc {
			reportCounts[r.ItemID] = r.N
		}
	}
	mc := media.NewCollector()
	rows := make([]teacherQuestionRow, len(qs))
	for i := range qs {
		t := tests[qs[i].TestID]
		rows[i] = teacherQuestionRow{Question: qs[i], Test: questionTestSummary{t.ID, t.Title, t.Status, t.ModuleType}, ReportCount: reportCounts[qs[i].ID]}
		mc.Add(qs[i].ContentFormat, &rows[i].QuestionText, &rows[i].OptionA, &rows[i].OptionB, &rows[i].OptionC, &rows[i].OptionD, rows[i].Explanation)
	}
	c.JSON(http.StatusOK, gin.H{"items": rows, "next_cursor": nilIfEmpty(next), "media": media.NewService(h.DB).ResolveCollector(ctx, mc, media.URLTTL(nil))})
}

type bulkPatch struct {
	SubjectID      *string  `json:"subject_id"`
	ChapterID      *string  `json:"chapter_id"`
	Difficulty     *string  `json:"difficulty"`
	TagsAdd        []string `json:"tags_add"`
	TagsRemove     []string `json:"tags_remove"`
	CustomEligible *bool    `json:"custom_eligible"`
	MoveToTestID   *string  `json:"move_to_test_id"`
}

type bulkUpdateRequest struct {
	IDs   []string  `json:"ids"`
	Patch bulkPatch `json:"patch"`
}

// BulkUpdate godoc
//
//	@Summary		Bulk-edit question metadata (Teacher)
//	@Description	Applies one metadata patch to up to 200 questions in a single all-or-nothing transaction: chapter/subject, difficulty, tags add/remove, custom_eligible, or move to another draft test. Every id must be owned by the caller (or the caller must have platform-wide permission) or nothing is applied (403 `not_owner`). Metadata-only edits on live questions are allowed and audited; content is never changed here.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		bulkUpdateRequest	true	"Ids + patch"
//	@Success		200		{object}	map[string]interface{}
//	@Failure		403		{object}	errorResponse
//	@Router			/api/v1/teacher/questions/bulk-update [post]
func (h *TeacherQuestionHandler) BulkUpdate(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	var req bulkUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if len(req.IDs) == 0 || len(req.IDs) > 200 {
		respondErr(c, http.StatusBadRequest, "bad_request", "ids must contain 1-200 questions")
		return
	}
	ids := make([]uuid.UUID, 0, len(req.IDs))
	seen := map[uuid.UUID]bool{}
	for _, s := range req.IDs {
		id, err := uuid.Parse(s)
		if err != nil {
			respondErr(c, http.StatusBadRequest, "invalid_id", "invalid question id: "+s)
			return
		}
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	var qs []models.Question
	h.scope(h.DB.WithContext(ctx).Model(&models.Question{}), user).Where("questions.id IN ?", ids).Select("questions.*").Find(&qs)
	if len(qs) != len(ids) {
		found := map[uuid.UUID]bool{}
		for _, q := range qs {
			found[q.ID] = true
		}
		var missing []uuid.UUID
		for _, id := range ids {
			if !found[id] {
				missing = append(missing, id)
			}
		}
		respondErr(c, http.StatusForbidden, "not_owner", "some questions don't exist or aren't yours — nothing was changed", gin.H{"ids": missing})
		return
	}

	var moveTo *models.Test
	if req.Patch.MoveToTestID != nil {
		var t models.Test
		q := h.DB.WithContext(ctx).Where("id = ? AND origin = ?", *req.Patch.MoveToTestID, models.OriginAuthored)
		if !canManageAllTests(user) {
			q = q.Where("created_by = ?", user.ID)
		}
		if err := q.First(&t).Error; err != nil {
			respondErr(c, http.StatusNotFound, "test_not_found", "destination test not found")
			return
		}
		if t.Status != models.StatusDraft && t.Status != models.StatusRejected {
			respondErr(c, http.StatusConflict, "test_locked", "questions can only be moved into a draft or rejected test")
			return
		}
		moveTo = &t
	}

	base := questionRequest{SubjectID: req.Patch.SubjectID, ChapterID: req.Patch.ChapterID, Difficulty: req.Patch.Difficulty, CustomEligible: req.Patch.CustomEligible}
	baseIn, err := base.toInput()
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", err.Error())
		return
	}
	services.LoadTags(ctx, h.DB, qs)

	type result struct {
		ID uuid.UUID `json:"id"`
		OK bool      `json:"ok"`
	}
	results := make([]result, 0, len(qs))
	err = h.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		qsvc := *h.QS
		qsvc.DB = tx
		for i := range qs {
			q := &qs[i]
			var test models.Test
			if err := tx.First(&test, "id = ?", q.TestID).Error; err != nil {
				return err
			}
			in := baseIn
			if len(req.Patch.TagsAdd) > 0 || len(req.Patch.TagsRemove) > 0 {
				remove := map[string]bool{}
				for _, r := range req.Patch.TagsRemove {
					remove[services.TagSlug(r)] = true
				}
				var labels []string
				for _, t := range q.Tags {
					if !remove[t.Slug] {
						labels = append(labels, t.Label)
					}
				}
				labels = append(labels, req.Patch.TagsAdd...)
				in.Tags = &labels
			}
			if _, err := qsvc.Update(ctx, user, q, &test, in); err != nil {
				return &bulkFail{ID: q.ID, Err: err}
			}
			if moveTo != nil && q.TestID != moveTo.ID {
				if test.Status != models.StatusDraft && test.Status != models.StatusRejected {
					return &bulkFail{ID: q.ID, Err: services.Conflict("test_locked", "live questions can't be moved")}
				}
				var pos struct{ Max int }
				tx.Model(&models.TestQuestion{}).Select("COALESCE(MAX(position),0) AS max").Where("test_id = ?", moveTo.ID).Scan(&pos)
				if err := tx.Where("test_id = ? AND question_id = ?", q.TestID, q.ID).Delete(&models.TestQuestion{}).Error; err != nil {
					return err
				}
				if err := services.AddQuestionToTest(tx, moveTo.ID, q.ID, pos.Max+1); err != nil {
					return err
				}
				tx.Model(&models.Test{}).Where("id = ?", q.TestID).UpdateColumn("total_questions", gorm.Expr("GREATEST(total_questions - 1, 0)"))
				tx.Model(&models.Test{}).Where("id = ?", moveTo.ID).UpdateColumn("total_questions", gorm.Expr("total_questions + 1"))
				if err := tx.Model(&models.Question{}).Where("id = ?", q.ID).Updates(map[string]interface{}{"test_id": moveTo.ID, "order_index": pos.Max + 1}).Error; err != nil {
					return err
				}
			}
			results = append(results, result{q.ID, true})
		}
		return nil
	})
	if err != nil {
		if bf, ok := err.(*bulkFail); ok {
			var ce *services.CodedError
			code, msg := "bulk_failed", bf.Err.Error()
			if asCoded(bf.Err, &ce) {
				code, msg = ce.Code, ce.Msg
			}
			respondErr(c, http.StatusUnprocessableEntity, code, msg+" — nothing was changed", gin.H{"id": bf.ID})
			return
		}
		respondErr(c, http.StatusInternalServerError, "internal", "bulk update failed")
		return
	}
	c.JSON(http.StatusOK, gin.H{"results": results})
}

type bulkFail struct {
	ID  uuid.UUID
	Err error
}

func (b *bulkFail) Error() string { return b.Err.Error() }

type duplicateRequest struct {
	QuestionText  string `json:"question_text"`
	OptionA       string `json:"option_a"`
	OptionB       string `json:"option_b"`
	OptionC       string `json:"option_c"`
	OptionD       string `json:"option_d"`
	ContentFormat string `json:"content_format"`
	ExcludeID     string `json:"exclude_id"`
}

// CheckDuplicate godoc
//
//	@Summary		Check whether a question already exists (Teacher)
//	@Description	Hashes the normalised text (markup stripped, case/spacing/Unicode-insensitive, images by content hash) and returns matching questions. Warn-only — near duplicates across courses are legitimate.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		duplicateRequest	true	"Question content"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/teacher/questions/check-duplicate [post]
func (h *TeacherQuestionHandler) CheckDuplicate(c *gin.Context) {
	var req duplicateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	format := req.ContentFormat
	if format == "" {
		format = models.ContentFormatRichV1
	}
	q := models.Question{QuestionText: req.QuestionText, OptionA: req.OptionA, OptionB: req.OptionB, OptionC: req.OptionC, OptionD: req.OptionD, ContentFormat: format}
	hash := services.ContentHash(c.Request.Context(), h.DB, &q)
	exclude, _ := uuid.Parse(req.ExcludeID)
	dups := h.QS.FindDuplicates(c.Request.Context(), hash, exclude, 5)
	c.JSON(http.StatusOK, gin.H{"duplicates": dups, "warnings": func() []services.Warning {
		w := []services.Warning{}
		for _, d := range dups {
			w = append(w, services.Warning{Code: "possible_duplicate", QuestionID: d.ID, Message: "an identical question already exists"})
		}
		return w
	}()})
}

// Completeness godoc
//
//	@Summary		Metadata completeness by chapter (Teacher)
//	@Description	Counts of questions missing difficulty / chapter / topic / tags / NCERT page / image alt text, grouped by chapter — drives the quick-tag backfill queue. Counts match the `missing=` list filter exactly.
//	@Tags			Teacher
//	@Security		BearerAuth
//	@Produce		json
//	@Param			course_id	query		string	false	"Course UUID"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/teacher/questions/completeness [get]
func (h *TeacherQuestionHandler) Completeness(c *gin.Context) {
	user := middleware.GetUser(c)
	q := h.scope(h.DB.WithContext(c.Request.Context()).Table("questions"), user).
		Joins("LEFT JOIN chapters ch ON ch.id = questions.chapter_id")
	if v := c.Query("course_id"); v != "" {
		q = q.Where("tests.course_id = ?", v)
	}
	var rows []struct {
		ChapterID         *uuid.UUID `json:"chapter_id"`
		Chapter           string     `json:"chapter"`
		Total             int        `json:"total"`
		MissingDifficulty int        `json:"missing_difficulty"`
		MissingTopic      int        `json:"missing_topic"`
		MissingTags       int        `json:"missing_tags"`
		MissingNCERT      int        `json:"missing_ncert"`
		MissingAltText    int        `json:"missing_alt_text"`
	}
	err := q.Select(`questions.chapter_id AS chapter_id, COALESCE(ch.name, 'Unassigned') AS chapter, count(*) AS total,
		count(*) FILTER (WHERE questions.difficulty IS NULL) AS missing_difficulty,
		count(*) FILTER (WHERE questions.topic_id IS NULL) AS missing_topic,
		count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM question_tags qt WHERE qt.question_id = questions.id)) AS missing_tags,
		count(*) FILTER (WHERE questions.ncert_page IS NULL) AS missing_ncert,
		count(*) FILTER (WHERE EXISTS (SELECT 1 FROM media_refs r JOIN media_assets m ON m.id = r.media_id
			WHERE r.owner_type = 'question' AND r.owner_id = questions.id AND m.alt_text = '')) AS missing_alt_text`).
		Group("questions.chapter_id, ch.name").Order("chapter ASC").Scan(&rows).Error
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to compute completeness")
		return
	}
	totals := map[string]int{}
	for _, r := range rows {
		totals["total"] += r.Total
		totals["missing_difficulty"] += r.MissingDifficulty
		totals["missing_topic"] += r.MissingTopic
		totals["missing_tags"] += r.MissingTags
		totals["missing_ncert"] += r.MissingNCERT
		totals["missing_alt_text"] += r.MissingAltText
	}
	c.JSON(http.StatusOK, gin.H{"chapters": rows, "totals": totals})
}
