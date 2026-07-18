package handlers

import (
	"net/http"
	"strings"

	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AuthHandler struct {
	DB         *gorm.DB
	OTPSvc     *services.OTPService
	SessionSvc *services.SessionService
}

func NewAuthHandler(db *gorm.DB, otpSvc *services.OTPService, sessionSvc *services.SessionService) *AuthHandler {
	return &AuthHandler{DB: db, OTPSvc: otpSvc, SessionSvc: sessionSvc}
}

// SendOTP godoc
//
//	@Summary		Send OTP
//	@Description	Sends a one-time password to the given phone number via SMS (or logs to console in dev mode). Rate-limited to 3 requests per phone number per hour.
//	@Tags			Auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		sendOTPRequest	true	"Phone number"
//	@Success		200		{object}	messageResponse
//	@Failure		400		{object}	errorResponse
//	@Failure		429		{object}	errorResponse	"Rate limit exceeded"
//	@Router			/auth/otp/send [post]
func (h *AuthHandler) SendOTP(c *gin.Context) {
	var req sendOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	phone := strings.TrimSpace(req.PhoneNumber)
	if err := h.OTPSvc.SendOTP(c.Request.Context(), phone); err != nil {
		c.JSON(http.StatusTooManyRequests, errorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, messageResponse{Message: "OTP sent successfully"})
}

// VerifyOTP godoc
//
//	@Summary		Verify OTP and login
//	@Description	Verifies the OTP for a phone number. Creates the user if they are new (role=student). Enforces the two-device limit (3rd login evicts the oldest session). Returns a JWT access token.
//	@Tags			Auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		verifyOTPRequest	true	"OTP verification payload"
//	@Success		200		{object}	verifyOTPResponse
//	@Failure		400		{object}	errorResponse
//	@Failure		401		{object}	errorResponse
//	@Failure		500		{object}	errorResponse
//	@Router			/auth/otp/verify [post]
func (h *AuthHandler) VerifyOTP(c *gin.Context) {
	var req verifyOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{Error: err.Error()})
		return
	}

	phone := strings.TrimSpace(req.PhoneNumber)
	if err := h.OTPSvc.VerifyOTP(c.Request.Context(), phone, req.OTPCode); err != nil {
		c.JSON(http.StatusUnauthorized, errorResponse{Error: err.Error()})
		return
	}

	var user models.User
	result := h.DB.WithContext(c.Request.Context()).
		Where("phone_number = ?", phone).
		FirstOrCreate(&user, models.User{
			PhoneNumber: phone,
			Role:        models.RoleStudent,
			KYCStatus:   models.KYCNotRequired,
		})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to create user"})
		return
	}

	h.DB.WithContext(c.Request.Context()).Model(&user).
		UpdateColumn("last_login_at", gorm.Expr("NOW()"))

	token, _, err := h.SessionSvc.CreateSession(c.Request.Context(), &user, req.DeviceID, req.DeviceInfo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to create session"})
		return
	}

	c.JSON(http.StatusOK, verifyOTPResponse{AccessToken: token, User: user})
}

// Logout godoc
//
//	@Summary		Logout
//	@Description	Revokes the current session. The JWT will no longer be accepted.
//	@Tags			Auth
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	messageResponse
//	@Failure		401	{object}	errorResponse
//	@Router			/auth/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	session := middleware.GetSession(c)
	if session == nil {
		c.JSON(http.StatusUnauthorized, errorResponse{Error: "not authenticated"})
		return
	}
	if err := h.SessionSvc.RevokeSession(c.Request.Context(), session.ID); err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to logout"})
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "logged out"})
}

// ListSessions godoc
//
//	@Summary		List active sessions
//	@Description	Returns all active (non-revoked, non-expired) sessions for the authenticated user.
//	@Tags			Auth
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	listSessionsResponse
//	@Failure		401	{object}	errorResponse
//	@Router			/auth/sessions [get]
func (h *AuthHandler) ListSessions(c *gin.Context) {
	user := middleware.GetUser(c)
	sessions, err := h.SessionSvc.ListActiveSessions(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to list sessions"})
		return
	}
	c.JSON(http.StatusOK, listSessionsResponse{Sessions: sessions})
}

// RevokeSession godoc
//
//	@Summary		Revoke a specific session
//	@Description	Remotely logs out another device by revoking a specific session by its ID.
//	@Tags			Auth
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id	path		string	true	"Session ID (UUID)"
//	@Success		200	{object}	messageResponse
//	@Failure		401	{object}	errorResponse
//	@Failure		404	{object}	errorResponse
//	@Router			/auth/sessions/{id} [delete]
func (h *AuthHandler) RevokeSession(c *gin.Context) {
	user := middleware.GetUser(c)
	sessionIDStr := c.Param("id")

	var targetSession models.Session
	if err := h.DB.WithContext(c.Request.Context()).
		Where("id = ? AND user_id = ?", sessionIDStr, user.ID).
		First(&targetSession).Error; err != nil {
		c.JSON(http.StatusNotFound, errorResponse{Error: "session not found"})
		return
	}

	if err := h.SessionSvc.RevokeSession(c.Request.Context(), targetSession.ID); err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "failed to revoke session"})
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "session revoked"})
}

// ── Request / Response types (used by swaggo for schema generation) ───────────

type sendOTPRequest struct {
	PhoneNumber string `json:"phone_number" example:"+919876543210"`
}

type verifyOTPRequest struct {
	PhoneNumber string `json:"phone_number" example:"+919876543210"`
	OTPCode     string `json:"otp_code"     example:"482901"`
	DeviceID    string `json:"device_id"    example:"device-uuid-abc"`
	DeviceInfo  string `json:"device_info"  example:"iPhone 14, iOS 17"`
}

type verifyOTPResponse struct {
	AccessToken string      `json:"access_token" example:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
	User        models.User `json:"user"`
}

type listSessionsResponse struct {
	Sessions []models.Session `json:"sessions"`
}
