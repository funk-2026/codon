package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "codon-backend/docs" // swagger docs
	"codon-backend/internal/config"
	"codon-backend/internal/db"
	"codon-backend/internal/handlers"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/otp"
	rzp "codon-backend/internal/razorpay"
	"codon-backend/internal/services"
	"codon-backend/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func main() {
	// ─── Config ───────────────────────────────────────────────────────────────
	config.Load()

	// ─── DB ──────────────────────────────────────────────────────────────────
	if err := db.Connect(); err != nil {
		log.Fatalf("DB connect: %v", err)
	}

	if err := db.AutoMigrateAll(); err != nil {
		log.Fatalf("AutoMigrate: %v", err)
	}

	if err := db.SeedCourses(db.DB); err != nil {
		log.Fatalf("SeedCourses: %v", err)
	}

	if err := db.SeedPlatformSettings(db.DB); err != nil {
		log.Fatalf("SeedPlatformSettings: %v", err)
	}

	// ─── Redis ────────────────────────────────────────────────────────────────
	redisOpts, err := redis.ParseURL(config.AppConfig.RedisURL)
	if err != nil {
		log.Fatalf("Redis URL parse: %v", err)
	}
	redisClient := redis.NewClient(redisOpts)
	ctx := context.Background()
	if _, err := redisClient.Ping(ctx).Result(); err != nil {
		log.Printf("Warning: Redis not available: %v (rate-limiting will not work)", err)
	}

	// ─── S3 ──────────────────────────────────────────────────────────────────
	if config.AppConfig.S3AccessKeyID != "" {
		if err := storage.Init(); err != nil {
			log.Printf("Warning: S3 init failed: %v (presigned URLs will use stub)", err)
		}
	}

	// ─── Razorpay ────────────────────────────────────────────────────────────
	rzp.Init()

	// ─── OTP Provider ────────────────────────────────────────────────────────
	var otpProvider otp.OTPProvider
	if config.AppConfig.TwoFactorAPIKey != "" {
		otpProvider = &otp.TwoFactorProvider{APIKey: config.AppConfig.TwoFactorAPIKey}
		log.Println("OTP provider: 2Factor.in")
	} else {
		otpProvider = &otp.ConsoleProvider{}
		log.Println("OTP provider: console stub (set TWO_FACTOR_API_KEY for real OTPs)")
	}

	// ─── Services ────────────────────────────────────────────────────────────
	otpSvc := services.NewOTPService(db.DB, redisClient, otpProvider, config.AppConfig.OTPRateLimitPerHour)
	sessionSvc := services.NewSessionService(db.DB)
	subSvc := services.NewSubscriptionService(db.DB)
	scoringSvc := services.NewScoringService(db.DB)

	// ─── Handlers ────────────────────────────────────────────────────────────
	authH := handlers.NewAuthHandler(db.DB, otpSvc, sessionSvc)
	profileH := handlers.NewProfileHandler(db.DB)
	courseH := handlers.NewCourseHandler(db.DB)
	planH := handlers.NewPlanHandler(db.DB)
	paymentH := handlers.NewPaymentHandler(db.DB, subSvc)
	kycH := handlers.NewKYCHandler(db.DB)
	uploadH := handlers.NewUploadHandler()
	testH := handlers.NewTestHandler(db.DB)
	attemptH := handlers.NewAttemptHandler(db.DB, scoringSvc)
	contentH := handlers.NewContentHandler(db.DB)
	wellnessH := handlers.NewWellnessHandler(db.DB)
	adminH := handlers.NewAdminHandler(db.DB)
	curriculumH := handlers.NewCurriculumHandler(db.DB)
	feedbackH := handlers.NewFeedbackHandler(db.DB)

	// ─── Gin Engine ──────────────────────────────────────────────────────────
	if config.AppConfig.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()
	r.Use(corsMiddleware())

	// Health check (public)
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "time": time.Now()})
	})

	// Swagger UI — available at /swagger/index.html
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// KYC flag (public read)
	r.GET("/api/v1/platform-settings/kyc-required", kycH.GetKYCRequired)

	// Razorpay webhook (public, but signature-verified inside handler)
	r.POST("/api/v1/webhooks/razorpay", paymentH.RazorpayWebhook)

	api := r.Group("/api/v1")

	// ─── Auth ─────────────────────────────────────────────────────────────────
	authGroup := api.Group("/auth")
	{
		authGroup.POST("/otp/send", authH.SendOTP)
		authGroup.POST("/otp/verify", authH.VerifyOTP)
	}

	// Auth middleware for protected routes
	auth := middleware.AuthMiddleware(sessionSvc, db.DB)

	// ─── Authenticated routes ─────────────────────────────────────────────────
	authGroup.Use(auth)
	{
		authGroup.POST("/logout", authH.Logout)
		authGroup.GET("/sessions", authH.ListSessions)
		authGroup.DELETE("/sessions/:id", authH.RevokeSession)
	}

	// Profile
	me := api.Group("/me").Use(auth)
	{
		me.GET("", profileH.GetMe)
		me.PATCH("", profileH.UpdateMe)
		me.GET("/progress", profileH.GetProgress)
		me.GET("/progress/breakdown", profileH.GetProgressBreakdown)
		me.GET("/recent-content", profileH.GetRecentContent)
		me.GET("/attempts", profileH.GetAttempts)
		me.GET("/subscription", profileH.GetMySubscription)
		me.POST("/kyc", kycH.SubmitKYC)
		me.GET("/kyc", kycH.GetMyKYC)
	}

	// Feedback
	api.POST("/feedback", auth, feedbackH.Submit)

	// Courses (public)
	courses := api.Group("/courses")
	{
		courses.GET("", courseH.ListCourses)
		courses.GET("/:id", courseH.GetCourse)
		courses.GET("/:id/curriculum", curriculumH.GetCurriculum)
	}

	// Subscription plans (public list)
	api.GET("/subscription-plans", planH.ListPlans)

	// Uploads (any authenticated)
	api.POST("/uploads/presign", auth, uploadH.Presign)

	// Subscriptions & Payments
	subGroup := api.Group("/subscriptions").Use(auth)
	{
		subGroup.POST("/checkout", paymentH.Checkout)
		subGroup.POST("/verify-payment", paymentH.VerifyPayment)
	}

	// ─── Tests (student) ──────────────────────────────────────────────────────
	kycRequiredFn := func() bool {
		var setting models.PlatformSetting
		if db.DB.Where("key = ?", "kyc_required").First(&setting).Error == nil {
			return setting.Value == "true"
		}
		return false
	}

	tests := api.Group("/tests").Use(auth).Use(middleware.RequireRole(models.RoleStudent))
	{
		tests.GET("", testH.ListTests)
		tests.GET("/:id", testH.GetTest)
		tests.POST("/:id/attempts", func(c *gin.Context) {
			// Gate check inline
			user := middleware.GetUser(c)
			testID := c.Param("id")
			var test models.Test
			if err := db.DB.Where("id = ? AND status = ?", testID, models.StatusPublished).First(&test).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "test not found"})
				return
			}
			if err := subSvc.CheckAccess(c.Request.Context(), user, test.RequiresSubscription, test.CourseID, kycRequiredFn()); err != nil {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": err.Error()})
				return
			}
			attemptH.StartAttempt(c)
		})
		tests.GET("/:id/questions", testH.GetQuestions)
	}

	// Attempts (student)
	attempts := api.Group("/attempts").Use(auth).Use(middleware.RequireRole(models.RoleStudent))
	{
		attempts.PUT("/:id/answers/:question_id", attemptH.UpsertAnswer)
		attempts.POST("/:id/submit", attemptH.SubmitAttempt)
		attempts.GET("/:id/result", attemptH.GetResult)
		attempts.GET("/:id/review", attemptH.GetReview)
	}

	// Content (student)
	studentContent := api.Group("").Use(auth).Use(middleware.RequireRole(models.RoleStudent))
	{
		studentContent.GET("/chapters/:chapter_id/content", contentH.GetChapterContent)
		studentContent.GET("/content/:id", contentH.GetContentItem)
	}

	// ─── Teacher routes ────────────────────────────────────────────────────────
	teacher := api.Group("/teacher").Use(auth).Use(middleware.RequireRole(models.RoleTeacher, models.RoleAdmin))
	{
		teacher.POST("/tests", testH.CreateTest)
		teacher.PATCH("/tests/:id", testH.UpdateTest)
		teacher.POST("/tests/:id/questions", testH.AddQuestion)
		teacher.POST("/tests/:id/csv-import", testH.CSVImport)
		teacher.GET("/csv-imports/:id", testH.GetCSVImport)
		teacher.POST("/tests/:id/submit-for-review", testH.SubmitForReview)
		teacher.POST("/tests/:id/publish", testH.PublishTest)
		teacher.GET("/tests", testH.ListTeacherTests)

		teacher.POST("/content", contentH.CreateContent)
		teacher.PATCH("/content/:id", contentH.UpdateContent)
		teacher.POST("/content/:id/submit-for-review", contentH.SubmitContentForReview)
		teacher.POST("/content/:id/publish", contentH.PublishContent)
		teacher.GET("/content", contentH.ListTeacherContent)
	}

	// ─── Wellness (student) ────────────────────────────────────────────────────
	wellness := api.Group("/wellness").Use(auth).Use(middleware.RequireRole(models.RoleStudent, models.RoleAdmin))
	{
		wellness.GET("/content", wellnessH.ListWellnessContent)
		wellness.GET("/reflection-prompts", wellnessH.ListReflectionPrompts)
	}

	// ─── Admin routes ─────────────────────────────────────────────────────────
	admin := api.Group("/admin").Use(auth).Use(middleware.RequireRole(models.RoleAdmin))
	{
		// Curriculum
		admin.POST("/courses/:course_id/subjects", curriculumH.CreateSubject)
		admin.PATCH("/subjects/:id", curriculumH.UpdateSubject)
		admin.POST("/subjects/:subject_id/chapters", curriculumH.CreateChapter)
		admin.PATCH("/chapters/:id", curriculumH.UpdateChapter)

		// Subscription plans
		admin.POST("/subscription-plans", planH.CreatePlan)
		admin.PATCH("/subscription-plans/:id", planH.UpdatePlan)
		admin.DELETE("/subscription-plans/:id", planH.DeletePlan)

		// Payments
		admin.GET("/payments", paymentH.ListPayments)
		admin.GET("/payments/:id", paymentH.GetPayment)

		// KYC
		admin.GET("/kyc", kycH.ListKYC)
		admin.POST("/kyc/:id/approve", kycH.ApproveKYC)
		admin.POST("/kyc/:id/reject", kycH.RejectKYC)
		admin.PATCH("/settings/kyc-required", kycH.SetKYCRequired)

		// Tests moderation
		admin.GET("/tests", testH.AdminListTests)
		admin.POST("/tests/:id/approve", testH.AdminApproveTest)
		admin.POST("/tests/:id/reject", testH.AdminRejectTest)

		// Content moderation
		admin.GET("/content", contentH.AdminListContent)
		admin.POST("/content/:id/approve", contentH.AdminApproveContent)
		admin.POST("/content/:id/reject", contentH.AdminRejectContent)

		// User management
		admin.GET("/users", adminH.ListUsers)
		admin.GET("/users/:id", adminH.GetUser)
		admin.PATCH("/users/:id/role", adminH.UpdateUserRole)
		admin.PATCH("/users/:id/teacher-permissions", adminH.UpdateTeacherPermissions)

		// Dashboard
		admin.GET("/dashboard/summary", adminH.DashboardSummary)

		// Wellness
		admin.POST("/wellness-content", wellnessH.CreateWellnessContent)
		admin.PATCH("/wellness-content/:id", wellnessH.UpdateWellnessContent)
		admin.DELETE("/wellness-content/:id", wellnessH.DeleteWellnessContent)
	}

	// ─── HTTP Server ─────────────────────────────────────────────────────────
	srv := &http.Server{
		Addr:         ":" + config.AppConfig.Port,
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("Codon API server starting on :%s (env=%s)", config.AppConfig.Port, config.AppConfig.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Forced shutdown: %v", err)
	}
	log.Println("Server exited")
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization,Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
