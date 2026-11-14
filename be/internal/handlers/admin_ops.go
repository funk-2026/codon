package handlers

import (
	"encoding/csv"
	"encoding/json"
	"errors"
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

// Admin operations beyond list/approve: account control, support tools, take-down, audit and feedback.
// Every change that matters is written to admin_audit_logs in the same transaction.

// auditAdmin records one admin action. Pass the surrounding transaction so the record and the change
// commit or roll back together.
func auditAdmin(tx *gorm.DB, actor *models.User, action, target string, before, after interface{}) error {
	if actor == nil {
		return nil
	}
	rec := models.AdminAuditLog{ActorID: actor.ID, Action: action, Target: target}
	if before != nil {
		if b, err := json.Marshal(before); err == nil {
			rec.Before = models.JSONB(b)
		}
	}
	if after != nil {
		if b, err := json.Marshal(after); err == nil {
			rec.After = models.JSONB(b)
		}
	}
	return tx.Create(&rec).Error
}

type reasonRequest struct {
	Reason string `json:"reason" binding:"required,min=3,max=500"`
}

// ── Accounts ─────────────────────────────────────────────────────────────────

// SuspendUser godoc
//
//	@Summary		Suspend an account (Admin)
//	@Description	Blocks sign-in, ends every session and records the reason. Admins cannot suspend themselves.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string			true	"User UUID"
//	@Param			body	body		reasonRequest	true	"Why"
//	@Success		200		{object}	messageResponse
//	@Router			/api/v1/admin/users/{id}/suspend [post]
func (h *AdminHandler) SuspendUser(c *gin.Context) {
	actor := middleware.GetUser(c)
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var req reasonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if actor != nil && actor.ID == id {
		respondErr(c, http.StatusConflict, "cannot_suspend_self", "you can't suspend your own account")
		return
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&models.User{}).Where("id = ?", id).
			Updates(map[string]interface{}{"suspended_at": time.Now(), "suspended_reason": req.Reason})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		if err := tx.Where("user_id = ?", id).Delete(&models.Session{}).Error; err != nil {
			return err
		}
		return auditAdmin(tx, actor, "user.suspend", "user:"+id.String(), nil, map[string]string{"reason": req.Reason})
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "account suspended"})
}

// ReactivateUser godoc
//
//	@Summary		Reactivate a suspended account (Admin)
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"User UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/admin/users/{id}/reactivate [post]
func (h *AdminHandler) ReactivateUser(c *gin.Context) {
	actor := middleware.GetUser(c)
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&models.User{}).Where("id = ?", id).
			Updates(map[string]interface{}{"suspended_at": nil, "suspended_reason": nil})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return auditAdmin(tx, actor, "user.reactivate", "user:"+id.String(), nil, nil)
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "account reactivated"})
}

// RevokeUserSession godoc
//
//	@Summary		Sign a user out of one device (Admin)
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"User UUID"
//	@Param			sid	path		string	true	"Session UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/admin/users/{id}/sessions/{sid} [delete]
func (h *AdminHandler) RevokeUserSession(c *gin.Context) {
	actor := middleware.GetUser(c)
	uid, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	sid, ok := httpx.ParamUUID(c, "sid")
	if !ok {
		return
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		res := tx.Where("id = ? AND user_id = ?", sid, uid).Delete(&models.Session{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return auditAdmin(tx, actor, "user.session_revoke", "user:"+uid.String(), nil, map[string]string{"session": sid.String()})
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "signed out"})
}

// RevokeAllUserSessions godoc
//
//	@Summary		Sign a user out everywhere (Admin)
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"User UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/admin/users/{id}/sessions [delete]
func (h *AdminHandler) RevokeAllUserSessions(c *gin.Context) {
	actor := middleware.GetUser(c)
	uid, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", uid).Delete(&models.Session{}).Error; err != nil {
			return err
		}
		return auditAdmin(tx, actor, "user.sessions_revoke_all", "user:"+uid.String(), nil, nil)
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "signed out everywhere"})
}

type grantAccessRequest struct {
	PlanID string `json:"plan_id" binding:"required"`
	// Days to add; 0 means the plan's own duration.
	Days   int    `json:"days"`
	Reason string `json:"reason" binding:"required,min=3,max=500"`
}

// GrantAccess godoc
//
//	@Summary		Give or extend access without a payment (Admin)
//	@Description	Extends the user's active subscription for the plan's course, or starts one. No payment record is created; the reason is kept in the audit log.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string				true	"User UUID"
//	@Param			body	body		grantAccessRequest	true	"Plan, days and reason"
//	@Success		200		{object}	adminUserSubscriptionResponse
//	@Router			/api/v1/admin/users/{id}/subscription/grant [post]
func (h *AdminHandler) GrantAccess(c *gin.Context) {
	actor := middleware.GetUser(c)
	uid, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var req grantAccessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	planID, err := uuid.Parse(req.PlanID)
	if err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid plan id")
		return
	}
	if req.Days < 0 || req.Days > 3650 {
		respondErr(c, http.StatusBadRequest, "bad_request", "days must be between 0 and 3650")
		return
	}

	var out models.Subscription
	err = h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var user models.User
		if err := tx.Where("id = ?", uid).First(&user).Error; err != nil {
			return err
		}
		var plan models.SubscriptionPlan
		if err := tx.Where("id = ?", planID).First(&plan).Error; err != nil {
			return err
		}
		days := req.Days
		if days == 0 {
			days = plan.DurationDays
		}
		now := time.Now()

		var current models.Subscription
		findErr := tx.Where("user_id = ? AND course_id = ? AND status = ? AND end_date > ?", uid, plan.CourseID, models.SubActive, now).
			Order("end_date DESC").First(&current).Error
		switch {
		case findErr == nil:
			base := now
			if current.EndDate != nil && current.EndDate.After(now) {
				base = *current.EndDate
			}
			end := base.AddDate(0, 0, days)
			if err := tx.Model(&current).Update("end_date", end).Error; err != nil {
				return err
			}
			current.EndDate = &end
			out = current
		case errors.Is(findErr, gorm.ErrRecordNotFound):
			end := now.AddDate(0, 0, days)
			out = models.Subscription{UserID: uid, PlanID: plan.ID, CourseID: plan.CourseID, Status: models.SubActive, StartDate: &now, EndDate: &end}
			if err := tx.Create(&out).Error; err != nil {
				return err
			}
		default:
			return findErr
		}
		return auditAdmin(tx, actor, "user.grant_access", "user:"+uid.String(), nil,
			map[string]interface{}{"plan_id": plan.ID, "days": days, "reason": req.Reason, "end_date": out.EndDate})
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, adminUserSubscriptionResponse{Subscription: &out})
}

// UserActivity godoc
//
//	@Summary		How much a user uses the app (Admin)
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"User UUID"
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/admin/users/{id}/activity [get]
func (h *AdminHandler) UserActivity(c *gin.Context) {
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var user models.User
	if err := h.DB.WithContext(c.Request.Context()).Where("id = ?", id).First(&user).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	var row struct {
		Attempts  int64
		Submitted int64
		AvgPct    *float64
		LastAt    *time.Time
	}
	err := h.DB.WithContext(c.Request.Context()).Raw(`
		SELECT count(*) AS attempts,
		       count(*) FILTER (WHERE status = 'submitted') AS submitted,
		       avg(CASE WHEN total_marks > 0 THEN score * 100.0 / total_marks END) FILTER (WHERE status = 'submitted') AS avg_pct,
		       max(started_at) AS last_at
		FROM student_attempts WHERE user_id = ?`, id).Scan(&row).Error
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"last_login_at":   user.LastLoginAt,
		"last_attempt_at": row.LastAt,
		"tests_started":   row.Attempts,
		"tests_submitted": row.Submitted,
		"avg_score_pct":   row.AvgPct,
	})
}

// ── Taking content down ──────────────────────────────────────────────────────

var takedownTables = map[string]string{
	"tests":           "tests",
	"content":         "content_items",
	"brain-hacks":     "brain_hacks",
	"flashcard-decks": "flashcard_decks",
}

// takedownOwner is the column holding the author, so they can be told why.
var takedownOwner = map[string]string{
	"tests":           "created_by",
	"content":         "uploaded_by",
	"brain-hacks":     "author_id",
	"flashcard-decks": "author_id",
}

// Takedown godoc
//
//	@Summary		Pull published content back (Admin)
//	@Description	Moves a published test, lesson, Brain Hack or deck to "rejected" with the reason, so students stop seeing it and the author can fix and resubmit. kind is tests | content | brain-hacks | flashcard-decks.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			kind	path		string			true	"tests | content | brain-hacks | flashcard-decks"
//	@Param			id		path		string			true	"Item UUID"
//	@Param			body	body		reasonRequest	true	"Why"
//	@Success		200		{object}	messageResponse
//	@Router			/api/v1/admin/takedown/{kind}/{id} [post]
func (h *AdminHandler) Takedown(c *gin.Context) {
	actor := middleware.GetUser(c)
	kind := c.Param("kind")
	table, ok := takedownTables[kind]
	if !ok {
		respondErr(c, http.StatusBadRequest, "bad_request", "kind must be tests, content, brain-hacks or flashcard-decks")
		return
	}
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var req reasonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		res := tx.Table(table).Where("id = ? AND status = ?", id, models.StatusPublished).Updates(map[string]interface{}{
			"status":           models.StatusRejected,
			"rejection_reason": "Taken down: " + req.Reason,
			"reviewed_by":      actor.ID,
			"reviewed_at":      time.Now(),
		})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return services.Conflict("not_published", "only published items can be taken down")
		}
		var owners []uuid.UUID
		var titles []string
		if err := tx.Table(table).Where("id = ?", id).Pluck(takedownOwner[kind], &owners).Error; err == nil && len(owners) > 0 {
			_ = tx.Table(table).Where("id = ?", id).Pluck("title", &titles).Error
			title := ""
			if len(titles) > 0 {
				title = titles[0]
			}
			services.Notify(tx, owners[0], "content_taken_down", "Your content was taken down", title+": "+req.Reason, map[string]interface{}{"id": id})
		}
		return auditAdmin(tx, actor, "content.takedown", kind+":"+id.String(), nil, map[string]string{"reason": req.Reason})
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "taken down"})
}

// ── Audit log ────────────────────────────────────────────────────────────────

type auditEntry struct {
	models.AdminAuditLog
	ActorName  *string `json:"actor_name,omitempty"`
	ActorPhone *string `json:"actor_phone,omitempty"`
}

// ListAuditLog godoc
//
//	@Summary		Read the admin audit log (Admin)
//	@Description	Newest first, paged. Filter by action (exact), actor_id, or target (prefix).
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			action		query		string	false	"Exact action, e.g. user.role_change"
//	@Param			actor_id	query		string	false	"Admin who did it"
//	@Param			target		query		string	false	"Target prefix, e.g. user:<uuid>"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/admin/audit-log [get]
func (h *AdminHandler) ListAuditLog(c *gin.Context) {
	q := h.DB.WithContext(c.Request.Context()).Model(&models.AdminAuditLog{})
	if v := c.Query("action"); v != "" {
		q = q.Where("action = ?", v)
	}
	if v := c.Query("actor_id"); v != "" {
		q = q.Where("actor_id = ?", v)
	}
	if v := strings.TrimSpace(c.Query("target")); v != "" {
		q = q.Where("target LIKE ?", v+"%")
	}
	rows, next, err := paged(c, q, "admin_audit_logs", func(a models.AdminAuditLog) (time.Time, uuid.UUID) { return a.CreatedAt, a.ID })
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	ids := make([]uuid.UUID, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.ActorID)
	}
	names := map[uuid.UUID]models.User{}
	if len(ids) > 0 {
		var users []models.User
		if err := h.DB.WithContext(c.Request.Context()).Where("id IN ?", ids).Find(&users).Error; err == nil {
			for _, u := range users {
				names[u.ID] = u
			}
		}
	}
	items := make([]auditEntry, 0, len(rows))
	for _, r := range rows {
		e := auditEntry{AdminAuditLog: r}
		if u, ok := names[r.ActorID]; ok {
			e.ActorName = u.Name
			phone := u.PhoneNumber
			e.ActorPhone = &phone
		}
		items = append(items, e)
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "next_cursor": nilIfEmpty(next)})
}

// ── Feedback inbox ───────────────────────────────────────────────────────────

type feedbackEntry struct {
	models.UserFeedback
	UserName  *string         `json:"user_name,omitempty"`
	UserPhone string          `json:"user_phone,omitempty"`
	UserRole  models.UserRole `json:"user_role,omitempty"`
}

// ListFeedback godoc
//
//	@Summary		Read what users have sent through Give feedback (Admin)
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			status		query		string	false	"new | in_progress | resolved"
//	@Param			category	query		string	false	"Category"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/admin/feedback [get]
func (h *AdminHandler) ListFeedback(c *gin.Context) {
	q := h.DB.WithContext(c.Request.Context()).Model(&models.UserFeedback{}).Preload("User")
	if v := c.Query("status"); v != "" {
		q = q.Where("status = ?", v)
	}
	if v := c.Query("category"); v != "" {
		q = q.Where("category = ?", v)
	}
	rows, next, err := paged(c, q, "user_feedbacks", func(f models.UserFeedback) (time.Time, uuid.UUID) { return f.CreatedAt, f.ID })
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	items := make([]feedbackEntry, 0, len(rows))
	for _, r := range rows {
		items = append(items, feedbackEntry{UserFeedback: r, UserName: r.User.Name, UserPhone: r.User.PhoneNumber, UserRole: r.User.Role})
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "next_cursor": nilIfEmpty(next)})
}

type updateFeedbackRequest struct {
	Status string  `json:"status" binding:"required"`
	Note   *string `json:"note"`
}

// UpdateFeedback godoc
//
//	@Summary		Triage a feedback entry (Admin)
//	@Tags			Admin
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string					true	"Feedback UUID"
//	@Param			body	body		updateFeedbackRequest	true	"Status and optional note"
//	@Success		200		{object}	messageResponse
//	@Router			/api/v1/admin/feedback/{id} [patch]
func (h *AdminHandler) UpdateFeedback(c *gin.Context) {
	actor := middleware.GetUser(c)
	id, ok := httpx.ParamUUID(c, "id")
	if !ok {
		return
	}
	var req updateFeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	if req.Status != "new" && req.Status != "in_progress" && req.Status != "resolved" {
		respondErr(c, http.StatusBadRequest, "bad_request", "status must be new, in_progress or resolved")
		return
	}
	updates := map[string]interface{}{"status": req.Status, "admin_note": req.Note}
	if req.Status == "resolved" && actor != nil {
		updates["resolved_at"] = time.Now()
		updates["resolved_by"] = actor.ID
	} else {
		updates["resolved_at"] = nil
		updates["resolved_by"] = nil
	}
	res := h.DB.WithContext(c.Request.Context()).Model(&models.UserFeedback{}).Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		httpx.Fail(c, res.Error)
		return
	}
	if res.RowsAffected == 0 {
		respondErr(c, http.StatusNotFound, "not_found", "feedback not found")
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "updated"})
}

// ── Inviting a teacher ───────────────────────────────────────────────────────

type inviteUserRequest struct {
	PhoneNumber string  `json:"phone_number" binding:"required"`
	Name        *string `json:"name"`
}

// InviteTeacher godoc
//
//	@Summary		Create a teacher by phone number (Admin)
//	@Description	Creates the account as a teacher before the person has signed in, so their first OTP sign-in lands them in the teacher app. If the number already has an account the response is 409 with that user's id.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		inviteUserRequest	true	"Phone and optional name"
//	@Success		201		{object}	models.User
//	@Router			/api/v1/admin/users/invite [post]
func (h *AdminHandler) InviteTeacher(c *gin.Context) {
	actor := middleware.GetUser(c)
	var req inviteUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	phone := services.NormalizePhone(req.PhoneNumber)
	if len(phone) < 8 || len(phone) > 16 {
		respondErr(c, http.StatusBadRequest, "bad_request", "enter a valid phone number")
		return
	}
	var name *string
	if req.Name != nil {
		if n := strings.TrimSpace(*req.Name); n != "" {
			name = &n
		}
	}
	user := models.User{PhoneNumber: phone, Name: name, Role: models.RoleTeacher, KYCStatus: models.KYCNotRequired}
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var existing models.User
		if err := tx.Where("phone_number = ?", phone).First(&existing).Error; err == nil {
			return services.Coded(http.StatusConflict, "user_exists", "this number already has an account", map[string]string{"user_id": existing.ID.String()})
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		return auditAdmin(tx, actor, "user.invite", "user:"+user.ID.String(), nil, map[string]string{"role": "teacher"})
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, user)
}

// ── Exports ──────────────────────────────────────────────────────────────────

// csvCell neutralises spreadsheet formulas: a cell that starts with = + - or @ would run when opened.
func csvCell(s string) string {
	if s != "" && strings.ContainsRune("=+-@\t\r", rune(s[0])) {
		return "'" + s
	}
	return s
}

func (h *AdminHandler) streamCSV(c *gin.Context, filename, query string, header []string, row func(scan func(dest ...interface{}) error) ([]string, error)) {
	rows, err := h.DB.WithContext(c.Request.Context()).Raw(query).Rows()
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	defer rows.Close()
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename="+filename)
	w := csv.NewWriter(c.Writer)
	_ = w.Write(header)
	for rows.Next() {
		rec, err := row(rows.Scan)
		if err != nil {
			break
		}
		_ = w.Write(rec)
	}
	w.Flush()
}

// ExportUsers godoc
//
//	@Summary		Download every user as CSV (Admin)
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		text/csv
//	@Router			/api/v1/admin/export/users.csv [get]
func (h *AdminHandler) ExportUsers(c *gin.Context) {
	if actor := middleware.GetUser(c); actor != nil {
		_ = auditAdmin(h.DB.WithContext(c.Request.Context()), actor, "export.users", "users", nil, nil)
	}
	h.streamCSV(c, "users.csv",
		`SELECT id::text, phone_number, COALESCE(name, ''), role, kyc_status, to_char(created_at, 'YYYY-MM-DD HH24:MI'),
		        COALESCE(to_char(last_login_at, 'YYYY-MM-DD HH24:MI'), ''), CASE WHEN suspended_at IS NULL THEN '' ELSE 'suspended' END
		 FROM users ORDER BY created_at DESC`,
		[]string{"id", "phone", "name", "role", "kyc_status", "joined", "last_login", "suspended"},
		func(scan func(dest ...interface{}) error) ([]string, error) {
			var r [8]string
			if err := scan(&r[0], &r[1], &r[2], &r[3], &r[4], &r[5], &r[6], &r[7]); err != nil {
				return nil, err
			}
			out := make([]string, len(r))
			for i, v := range r {
				out[i] = csvCell(v)
			}
			return out, nil
		})
}

// ExportPayments godoc
//
//	@Summary		Download every payment as CSV (Admin)
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		text/csv
//	@Router			/api/v1/admin/export/payments.csv [get]
func (h *AdminHandler) ExportPayments(c *gin.Context) {
	if actor := middleware.GetUser(c); actor != nil {
		_ = auditAdmin(h.DB.WithContext(c.Request.Context()), actor, "export.payments", "payments", nil, nil)
	}
	h.streamCSV(c, "payments.csv",
		`SELECT p.id::text, p.razorpay_order_id, COALESCE(p.razorpay_payment_id, ''), COALESCE(u.name, ''), COALESCE(u.phone_number, ''),
		        (p.amount_paise / 100.0)::text, p.currency, p.status, to_char(p.created_at, 'YYYY-MM-DD HH24:MI')
		 FROM payment_records p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC`,
		[]string{"id", "order_id", "payment_id", "name", "phone", "amount", "currency", "status", "created"},
		func(scan func(dest ...interface{}) error) ([]string, error) {
			var r [9]string
			if err := scan(&r[0], &r[1], &r[2], &r[3], &r[4], &r[5], &r[6], &r[7], &r[8]); err != nil {
				return nil, err
			}
			out := make([]string, len(r))
			for i, v := range r {
				out[i] = csvCell(v)
			}
			return out, nil
		})
}

// ── Announcements ────────────────────────────────────────────────────────────

var announcementRoles = map[string][]string{
	"students": {"student"},
	"teachers": {"teacher"},
	"all":      {"student", "teacher"},
}

// AnnouncementAudience godoc
//
//	@Summary		How many people an announcement would reach (Admin)
//	@Tags			Admin
//	@Security		BearerAuth
//	@Produce		json
//	@Param			audience	query		string	true	"students | teachers | all"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/admin/announcements/audience [get]
func (h *AdminHandler) AnnouncementAudience(c *gin.Context) {
	roles, ok := announcementRoles[c.Query("audience")]
	if !ok {
		respondErr(c, http.StatusBadRequest, "bad_request", "audience must be students, teachers or all")
		return
	}
	var n int64
	if err := h.DB.WithContext(c.Request.Context()).Model(&models.User{}).Where("role IN ? AND suspended_at IS NULL", roles).Count(&n).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": n})
}

type announcementRequest struct {
	Audience string `json:"audience" binding:"required"`
	Title    string `json:"title" binding:"required,min=3,max=80"`
	Body     string `json:"body" binding:"max=300"`
	// Route is an optional screen to open when the notification is tapped (student screens only).
	Route string `json:"route"`
}

// SendAnnouncement godoc
//
//	@Summary		Send a notification to every student, teacher or both (Admin)
//	@Description	Stores one in-app notification per person; push delivery picks them up like any other notification.
//	@Tags			Admin
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		announcementRequest	true	"Audience, title, body"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/admin/announcements [post]
func (h *AdminHandler) SendAnnouncement(c *gin.Context) {
	actor := middleware.GetUser(c)
	var req announcementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	roles, ok := announcementRoles[req.Audience]
	if !ok {
		respondErr(c, http.StatusBadRequest, "bad_request", "audience must be students, teachers or all")
		return
	}
	data := "{}"
	if r := strings.TrimSpace(req.Route); r != "" {
		if !strings.HasPrefix(r, "/(student)/") || strings.Contains(r, "..") || strings.Contains(r, "://") {
			respondErr(c, http.StatusBadRequest, "bad_request", "route must be a student screen")
			return
		}
		if b, err := json.Marshal(map[string]string{"route": r}); err == nil {
			data = string(b)
		}
	}
	var sent int64
	err := h.DB.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		res := tx.Exec(`INSERT INTO notifications (id, user_id, type, title, body, data, created_at)
			SELECT gen_random_uuid(), id, 'announcement', ?, ?, ?::jsonb, now()
			FROM users WHERE role IN ? AND suspended_at IS NULL`, strings.TrimSpace(req.Title), strings.TrimSpace(req.Body), data, roles)
		if res.Error != nil {
			return res.Error
		}
		sent = res.RowsAffected
		return auditAdmin(tx, actor, "announcement.send", "audience:"+req.Audience, nil,
			map[string]interface{}{"title": req.Title, "recipients": sent})
	})
	if err != nil {
		httpx.Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"sent": sent})
}
