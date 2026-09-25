package handlers

import (
	"encoding/json"
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

type CorrectionHandler struct {
	DB  *gorm.DB
	Svc *services.CorrectionService
}

func NewCorrectionHandler(db *gorm.DB) *CorrectionHandler {
	return &CorrectionHandler{DB: db, Svc: services.NewCorrectionService(db, newQuestionService(db))}
}

type correctionRequest struct {
	Proposed questionRequest `json:"proposed"`
	Reason   string          `json:"reason"`
	Rescore  bool            `json:"rescore"`
}

// Submit godoc
//
//	@Summary		Propose a correction to a LIVE question (Teacher)
//	@Description	Live questions can't be edited directly. A correction carries the proposed content/answer/metadata, a required reason, and whether past attempts should be re-scored (only meaningful when the answer key changes). Admins and teachers with platform-wide permission are applied immediately; others go to admin review. Applying bumps the question `version`, resolves its open reports as fixed (reporters are notified) and lifts any auto-hold.
//	@Tags			Corrections
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string				true	"Question UUID"
//	@Param			body	body		correctionRequest	true	"Correction"
//	@Success		201		{object}	models.QuestionRevision
//	@Failure		409		{object}	errorResponse
//	@Router			/api/v1/teacher/questions/{id}/corrections [post]
func (h *CorrectionHandler) Submit(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	var q models.Question
	if h.DB.First(&q, "id = ?", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "question_not_found", "question not found")
		return
	}
	var test models.Test
	tq := h.DB.Where("id = ?", q.TestID)
	if !canManageAllTests(user) {
		tq = tq.Where("created_by = ?", user.ID)
	}
	if tq.First(&test).Error != nil {
		respondErr(c, http.StatusNotFound, "question_not_found", "question not found")
		return
	}
	var req correctionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	in, err := req.Proposed.toInput()
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", err.Error())
		return
	}
	rev, err := h.Svc.Submit(ctx, user, &q, &test, in, req.Reason, req.Rescore)
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusCreated, rev)
}

func (h *CorrectionHandler) list(c *gin.Context, mine bool) {
	user := middleware.GetUser(c)
	limit := pagination.Limit(c.Query("limit"))
	q := h.DB.Model(&models.QuestionRevision{})
	if mine {
		q = q.Where("question_revisions.created_by = ?", user.ID)
	}
	if s := c.Query("status"); s != "" && s != "all" {
		q = q.Where("question_revisions.status = ?", s)
	} else if s == "" && !mine {
		q = q.Where("question_revisions.status = ?", models.RevisionPending)
	}
	q = pagination.Apply(q, "question_revisions", pagination.Decode(c.Query("cursor")), limit)
	var rs []models.QuestionRevision
	q.Find(&rs)
	rs, next := pagination.Page(rs, limit, func(r models.QuestionRevision) (time.Time, uuid.UUID) { return r.CreatedAt, r.ID })
	type row struct {
		models.QuestionRevision
		Question *models.Question `json:"question,omitempty"`
	}
	out := make([]row, len(rs))
	mc := media.NewCollector()
	for i, r := range rs {
		out[i] = row{QuestionRevision: r}
		var qq models.Question
		if h.DB.First(&qq, "id = ?", r.QuestionID).Error == nil {
			out[i].Question = &qq
			mc.Add(qq.ContentFormat, &qq.QuestionText, &qq.OptionA, &qq.OptionB, &qq.OptionC, &qq.OptionD, qq.Explanation)
		}
		// the proposed version may reference new images too, so the reviewer can see them
		var proposed map[string]interface{}
		if json.Unmarshal(r.Proposed, &proposed) == nil {
			fields := make([]*string, 0, 6)
			for _, k := range []string{"question_text", "option_a", "option_b", "option_c", "option_d", "explanation"} {
				if v, ok := proposed[k].(string); ok {
					vv := v
					fields = append(fields, &vv)
				}
			}
			mc.Add(models.ContentFormatRichV1, fields...)
		}
	}
	c.JSON(http.StatusOK, gin.H{"items": out, "next_cursor": nilIfEmpty(next),
		"media": media.NewService(h.DB).ResolveCollector(c.Request.Context(), mc, media.URLTTL(nil))})
}

// Mine godoc
//
//	@Summary		My corrections and their status (Teacher)
//	@Tags			Corrections
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/teacher/corrections [get]
func (h *CorrectionHandler) Mine(c *gin.Context) { h.list(c, true) }

// AdminQueue godoc
//
//	@Summary		Corrections awaiting review (Admin)
//	@Description	Default status filter is pending. Each row carries the CURRENT question so the reviewer can diff it against `proposed`.
//	@Tags			Corrections
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/admin/corrections [get]
func (h *CorrectionHandler) AdminQueue(c *gin.Context) { h.list(c, false) }

// Approve godoc
//
//	@Summary		Approve a correction (Admin)
//	@Tags			Corrections
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Correction UUID"
//	@Success		200	{object}	models.QuestionRevision
//	@Router			/api/v1/admin/corrections/{id}/approve [post]
func (h *CorrectionHandler) Approve(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid id")
		return
	}
	rev, err := h.Svc.Approve(c.Request.Context(), middleware.GetUser(c), id)
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, rev)
}

type rejectCorrectionRequest struct {
	Reason string `json:"reason"`
}

// Reject godoc
//
//	@Summary		Reject a correction (Admin)
//	@Tags			Corrections
//	@Security		BearerAuth
//	@Accept			json
//	@Param			id		path		string					true	"Correction UUID"
//	@Param			body	body		rejectCorrectionRequest	true	"Reason"
//	@Success		200		{object}	models.QuestionRevision
//	@Router			/api/v1/admin/corrections/{id}/reject [post]
func (h *CorrectionHandler) Reject(c *gin.Context) {
	var req rejectCorrectionRequest
	id, err := uuid.Parse(c.Param("id"))
	if err != nil || c.ShouldBindJSON(&req) != nil || len(req.Reason) < 3 {
		respondErr(c, http.StatusBadRequest, "bad_request", "a reason is required")
		return
	}
	rev, err := h.Svc.Reject(c.Request.Context(), middleware.GetUser(c), id, req.Reason)
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, rev)
}
