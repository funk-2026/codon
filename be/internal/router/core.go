package router

import (
	"net/http"
	"time"

	"codon-backend/internal/handlers"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"

	"github.com/gin-gonic/gin"
)

// CoreDeps are the handlers of the platform's core modules (auth, profile,
// courses, billing, KYC, content, wellness, admin). The assessment / custom
// test / engagement modules are wired by Deps + Register in router.go.
type CoreDeps struct {
	Auth gin.HandlerFunc
	// Ready reports whether dependencies (the database) are reachable.
	Ready func() error

	AuthH       *handlers.AuthHandler
	ProfileH    *handlers.ProfileHandler
	CourseH     *handlers.CourseHandler
	PlanH       *handlers.PlanHandler
	PaymentH    *handlers.PaymentHandler
	KYCH        *handlers.KYCHandler
	UploadH     *handlers.UploadHandler
	ContentH    *handlers.ContentHandler
	WellnessH   *handlers.WellnessHandler
	AdminH      *handlers.AdminHandler
	CurriculumH *handlers.CurriculumHandler
	FeedbackH   *handlers.FeedbackHandler
}

// RegisterPublic mounts health checks and the unauthenticated endpoints on the engine.
func RegisterPublic(r *gin.Engine, d *CoreDeps) {
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "time": time.Now()})
	})
	r.GET("/readyz", func(c *gin.Context) {
		if d.Ready != nil {
			if err := d.Ready(); err != nil {
				c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable"})
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})
	r.GET("/api/v1/platform-settings/kyc-required", d.KYCH.GetKYCRequired)
	// Razorpay webhook: public, signature-verified inside the handler.
	r.POST("/api/v1/webhooks/razorpay", d.PaymentH.RazorpayWebhook)
}

// RegisterCore mounts the core module routes on api (/api/v1).
func RegisterCore(api *gin.RouterGroup, d *CoreDeps) {
	auth := d.Auth

	// ── Auth ──
	authGroup := api.Group("/auth")
	authGroup.POST("/otp/send", d.AuthH.SendOTP)
	authGroup.POST("/otp/verify", d.AuthH.VerifyOTP)
	authGroup.POST("/logout", auth, d.AuthH.Logout)
	authGroup.GET("/sessions", auth, d.AuthH.ListSessions)
	authGroup.DELETE("/sessions/:id", auth, d.AuthH.RevokeSession)

	// ── Profile ──
	me := api.Group("/me").Use(auth)
	{
		me.GET("", d.ProfileH.GetMe)
		me.PATCH("", d.ProfileH.UpdateMe)
		me.GET("/progress", d.ProfileH.GetProgress)
		me.GET("/progress/breakdown", d.ProfileH.GetProgressBreakdown)
		me.GET("/recent-content", d.ProfileH.GetRecentContent)
		me.GET("/attempts", d.ProfileH.GetAttempts)
		me.GET("/subscription", d.ProfileH.GetMySubscription)
		me.POST("/kyc", d.KYCH.SubmitKYC)
		me.GET("/kyc", d.KYCH.GetMyKYC)
	}
	api.POST("/feedback", auth, d.FeedbackH.Submit)

	// ── Catalogue (public) ──
	courses := api.Group("/courses")
	{
		courses.GET("", d.CourseH.ListCourses)
		courses.GET("/:id", d.CourseH.GetCourse)
		courses.GET("/:id/curriculum", d.CurriculumH.GetCurriculum)
	}
	api.GET("/subscription-plans", d.PlanH.ListPlans)

	// ── Uploads ──
	api.POST("/uploads/presign", auth, d.UploadH.Presign)

	// ── Subscriptions & payments ──
	sub := api.Group("/subscriptions").Use(auth)
	{
		sub.POST("/checkout", d.PaymentH.Checkout)
		sub.POST("/verify-payment", d.PaymentH.VerifyPayment)
	}

	// ── Content (student) ──
	student := api.Group("").Use(auth).Use(middleware.RequireRole(models.RoleStudent))
	{
		student.GET("/chapters/:chapter_id/content", d.ContentH.GetChapterContent)
		student.GET("/content/:id", d.ContentH.GetContentItem)
		student.POST("/content/:id/heartbeat", d.ProfileH.ContentHeartbeat)
	}

	// ── Teacher: lecture content ──
	teacher := api.Group("/teacher").Use(auth).Use(middleware.RequireRole(models.RoleTeacher, models.RoleAdmin))
	{
		teacher.POST("/content", d.ContentH.CreateContent)
		teacher.PATCH("/content/:id", d.ContentH.UpdateContent)
		teacher.POST("/content/:id/submit-for-review", d.ContentH.SubmitContentForReview)
		teacher.GET("/content", d.ContentH.ListTeacherContent)
		teacher.GET("/content/:id", d.ContentH.TeacherGetContent)
		teacher.POST("/content/:id/publish", d.ContentH.PublishContent)
	}

	// ── Wellness (student) ──
	wellness := api.Group("/wellness").Use(auth).Use(middleware.RequireRole(models.RoleStudent, models.RoleAdmin))
	{
		wellness.GET("/content", d.WellnessH.ListWellnessContent)
		wellness.GET("/content/:id", d.WellnessH.GetWellnessContent)
		wellness.GET("/reflection-prompts", d.WellnessH.ListReflectionPrompts)
	}

	// ── Admin ──
	admin := api.Group("/admin").Use(auth).Use(middleware.RequireRole(models.RoleAdmin))
	{
		// Curriculum: admins own the whole course structure
		admin.POST("/courses/:course_id/subjects", d.CurriculumH.CreateSubject)
		admin.PATCH("/subjects/:id", d.CurriculumH.UpdateSubject)
		admin.POST("/subjects/:subject_id/chapters", d.CurriculumH.CreateChapter)
		admin.PATCH("/chapters/:id", d.CurriculumH.UpdateChapter)

		// Subscription plans
		admin.GET("/subscription-plans", d.PlanH.AdminListPlans)
		admin.POST("/subscription-plans", d.PlanH.CreatePlan)
		admin.PATCH("/subscription-plans/:id", d.PlanH.UpdatePlan)
		admin.DELETE("/subscription-plans/:id", d.PlanH.DeletePlan)

		// Payments
		admin.GET("/payments", d.PaymentH.ListPayments)
		admin.GET("/payments/:id", d.PaymentH.GetPayment)

		// KYC
		admin.GET("/kyc", d.KYCH.ListKYC)
		admin.POST("/kyc/:id/approve", d.KYCH.ApproveKYC)
		admin.POST("/kyc/:id/reject", d.KYCH.RejectKYC)
		admin.PATCH("/settings/kyc-required", d.KYCH.SetKYCRequired)

		// Content moderation
		admin.GET("/content", d.ContentH.AdminListContent)
		admin.GET("/content/:id", d.ContentH.AdminGetContent)
		admin.POST("/content/:id/approve", d.ContentH.AdminApproveContent)
		admin.POST("/content/:id/reject", d.ContentH.AdminRejectContent)

		// Users
		admin.GET("/users", d.AdminH.ListUsers)
		admin.GET("/users/:id", d.AdminH.GetUser)
		admin.PATCH("/users/:id/role", d.AdminH.UpdateUserRole)
		admin.PATCH("/users/:id/teacher-permissions", d.AdminH.UpdateTeacherPermissions)
		admin.GET("/users/:id/subscription", d.AdminH.GetUserSubscription)
		admin.GET("/users/:id/sessions", d.AdminH.GetUserSessions)

		// Dashboard
		admin.GET("/dashboard/summary", d.AdminH.DashboardSummary)
		admin.GET("/analytics", d.AdminH.AnalyticsOverview)

		// Wellness
		admin.POST("/wellness-content", d.WellnessH.CreateWellnessContent)
		admin.PATCH("/wellness-content/:id", d.WellnessH.UpdateWellnessContent)
		admin.DELETE("/wellness-content/:id", d.WellnessH.DeleteWellnessContent)
	}
}
