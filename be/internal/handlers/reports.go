package handlers

import (
	"net/http"
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

type ReportHandler struct {
	DB  *gorm.DB
	Svc *services.ReportService
}

func NewReportHandler(db *gorm.DB) *ReportHandler {
	return &ReportHandler{DB: db, Svc: services.NewReportService(db)}
}

type createReportRequest struct {
	ItemType  string  `json:"item_type" example:"question"`
	ItemID    string  `json:"item_id"`
	Reason    string  `json:"reason" enums:"wrong_answer,typo_unclear,duplicate,outdated,image_issue,other"`
	Note      string  `json:"note"`
	Context   string  `json:"context" enums:"runtime,review,tutor"`
	AttemptID *string `json:"attempt_id"`
}

// Create godoc
//
//	@Summary		Report a question
//	@Description	Reasons come from /app-config. One open report per (student, item): reporting again returns the existing report with `already_reported: true`. Students can only report questions they have seen. Enough distinct reporters for a hold reason (default 3× wrong_answer/image_issue) put the question under review, which excludes it from custom-test generation (existing tests are unaffected).
//	@Tags			Reports
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		createReportRequest	true	"Report"
//	@Success		201		{object}	map[string]interface{}
//	@Success		200		{object}	map[string]interface{}	"already reported"
//	@Router			/api/v1/reports [post]
func (h *ReportHandler) Create(c *gin.Context) {
	user := middleware.GetUser(c)
	var req createReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	itemID, err := uuid.Parse(req.ItemID)
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid item_id")
		return
	}
	in := services.ReportInput{ItemType: req.ItemType, ItemID: itemID, Reason: req.Reason, Note: req.Note, Context: req.Context}
	if req.AttemptID != nil {
		if a, err := uuid.Parse(*req.AttemptID); err == nil {
			in.AttemptID = &a
		}
	}
	r, created, err := h.Svc.Create(c.Request.Context(), user, in)
	if err != nil {
		respondService(c, err)
		return
	}
	status := http.StatusCreated
	if !created {
		status = http.StatusOK
	}
	c.JSON(status, gin.H{"report": r, "already_reported": !created})
}

// Mine godoc
//
//	@Summary		My reports and their outcome
//	@Tags			Reports
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/me/reports [get]
func (h *ReportHandler) Mine(c *gin.Context) {
	user := middleware.GetUser(c)
	limit := pagination.Limit(c.Query("limit"))
	q := pagination.Apply(h.DB.Model(&models.ContentReport{}).Where("content_reports.reporter_id = ?", user.ID), "content_reports", pagination.Decode(c.Query("cursor")), limit)
	var rs []models.ContentReport
	q.Find(&rs)
	rs, next := pagination.Page(rs, limit, func(r models.ContentReport) (time.Time, uuid.UUID) { return r.CreatedAt, r.ID })
	c.JSON(http.StatusOK, gin.H{"items": rs, "next_cursor": nilIfEmpty(next)})
}

type reportRow struct {
	models.ContentReport
	Question       *models.Question `json:"question,omitempty"`
	OpenForItem    int              `json:"open_reports_for_item"`
	QuestionTestID *uuid.UUID       `json:"test_id,omitempty"`
}

// list builds an inbox/queue. teacherOnly restricts to the caller's own content.
func (h *ReportHandler) list(c *gin.Context, teacherOnly bool) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	limit := pagination.Limit(c.Query("limit"))
	q := h.DB.WithContext(ctx).Model(&models.ContentReport{}).
		Joins("JOIN questions ON questions.id = content_reports.item_id AND content_reports.item_type = 'question'").
		Joins("JOIN tests ON tests.id = questions.test_id")
	if teacherOnly && !canManageAllTests(user) {
		q = q.Where("tests.created_by = ?", user.ID)
	}
	status := c.DefaultQuery("status", models.ReportOpen)
	if status != "all" {
		q = q.Where("content_reports.status = ?", status)
	}
	if v := c.Query("reason"); v != "" {
		q = q.Where("content_reports.reason = ?", v)
	}
	if v := c.Query("course_id"); v != "" {
		q = q.Where("tests.course_id = ?", v)
	}
	if v := c.Query("assignee_id"); v != "" {
		q = q.Where("content_reports.assignee_id = ?", v)
	}
	q = pagination.Apply(q, "content_reports", pagination.Decode(c.Query("cursor")), limit)
	var rs []models.ContentReport
	q.Select("content_reports.*").Find(&rs)
	rs, next := pagination.Page(rs, limit, func(r models.ContentReport) (time.Time, uuid.UUID) { return r.CreatedAt, r.ID })

	ids := make([]uuid.UUID, len(rs))
	for i, r := range rs {
		ids[i] = r.ItemID
	}
	qs := map[uuid.UUID]models.Question{}
	open := map[uuid.UUID]int{}
	if len(ids) > 0 {
		var rows []models.Question
		h.DB.WithContext(ctx).Where("id IN ?", ids).Find(&rows)
		for _, r := range rows {
			qs[r.ID] = r
		}
		var cnt []struct {
			ItemID uuid.UUID
			N      int
		}
		h.DB.WithContext(ctx).Raw("SELECT item_id, count(*) AS n FROM content_reports WHERE item_type = 'question' AND status = 'open' AND item_id IN ? GROUP BY item_id", ids).Scan(&cnt)
		for _, x := range cnt {
			open[x.ItemID] = x.N
		}
	}
	mc := media.NewCollector()
	out := make([]reportRow, len(rs))
	for i, r := range rs {
		out[i] = reportRow{ContentReport: r, OpenForItem: open[r.ItemID]}
		if qq, ok := qs[r.ItemID]; ok {
			cp := qq
			out[i].Question = &cp
			out[i].QuestionTestID = &cp.TestID
			mc.Add(cp.ContentFormat, &cp.QuestionText, &cp.OptionA, &cp.OptionB, &cp.OptionC, &cp.OptionD, cp.Explanation)
		}
	}
	c.JSON(http.StatusOK, gin.H{"items": out, "next_cursor": nilIfEmpty(next), "media": media.NewService(h.DB).ResolveCollector(ctx, mc, media.URLTTL(nil))})
}

// TeacherInbox godoc
//
//	@Summary		Reports on my questions (Teacher)
//	@Description	Filters: status (open|fixed|no_change|dismissed|all, default open), reason.
//	@Tags			Reports
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/teacher/reports [get]
func (h *ReportHandler) TeacherInbox(c *gin.Context) { h.list(c, true) }

// AdminQueue godoc
//
//	@Summary		All question reports (Admin)
//	@Tags			Reports
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/admin/reports [get]
func (h *ReportHandler) AdminQueue(c *gin.Context) { h.list(c, false) }

type resolveReportRequest struct {
	Status string `json:"status" enums:"fixed,no_change,dismissed"`
	Note   string `json:"note"`
}

// Resolve godoc
//
//	@Summary		Resolve a report (Teacher/Admin)
//	@Description	The reporter is notified. Resolving may release an auto-held question.
//	@Tags			Reports
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string					true	"Report UUID"
//	@Param			body	body		resolveReportRequest	true	"Outcome"
//	@Success		200		{object}	models.ContentReport
//	@Router			/api/v1/teacher/reports/{id}/resolve [post]
func (h *ReportHandler) Resolve(c *gin.Context) {
	var req resolveReportRequest
	id, err := uuid.Parse(c.Param("id"))
	if err != nil || c.ShouldBindJSON(&req) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "valid report id and status are required")
		return
	}
	r, err := h.Svc.Resolve(c.Request.Context(), middleware.GetUser(c), id, req.Status, req.Note)
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, r)
}

// AdminDismiss godoc
//
//	@Summary		Dismiss a report (Admin)
//	@Tags			Reports
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Report UUID"
//	@Success		200	{object}	models.ContentReport
//	@Router			/api/v1/admin/reports/{id}/dismiss [post]
func (h *ReportHandler) AdminDismiss(c *gin.Context) {
	var req resolveReportRequest
	_ = c.ShouldBindJSON(&req)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid report id")
		return
	}
	r, err := h.Svc.Resolve(c.Request.Context(), middleware.GetUser(c), id, models.ReportDismissed, req.Note)
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, r)
}

type reassignRequest struct {
	AssigneeID string `json:"assignee_id"`
}

// AdminReassign godoc
//
//	@Summary		Assign a report to a teacher (Admin)
//	@Tags			Reports
//	@Security		BearerAuth
//	@Accept			json
//	@Param			id		path	string				true	"Report UUID"
//	@Param			body	body	reassignRequest		true	"Assignee"
//	@Success		200		{object}	models.ContentReport
//	@Router			/api/v1/admin/reports/{id}/reassign [post]
func (h *ReportHandler) AdminReassign(c *gin.Context) {
	var req reassignRequest
	as, e1 := uuid.Parse(req.AssigneeID)
	if c.ShouldBindJSON(&req) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "assignee_id required")
		return
	}
	as, e1 = uuid.Parse(req.AssigneeID)
	var u models.User
	if e1 != nil || h.DB.First(&u, "id = ? AND role IN ?", as, []string{"teacher", "admin"}).Error != nil {
		respondErr(c, http.StatusBadRequest, "invalid_assignee", "assignee must be a teacher or admin")
		return
	}
	var r models.ContentReport
	if h.DB.First(&r, "id = ? AND status = ?", c.Param("id"), models.ReportOpen).Error != nil {
		respondErr(c, http.StatusNotFound, "report_not_found", "open report not found")
		return
	}
	h.DB.Model(&r).Update("assignee_id", as)
	services.Notify(h.DB, as, "report_assigned", "A question report was assigned to you", r.Reason, map[string]interface{}{"report_id": r.ID})
	c.JSON(http.StatusOK, r)
}
