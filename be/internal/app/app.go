// Package app is the one place that wires the API together: services,
// handlers, middleware and routes. cmd/api only loads config, prepares the
// database and runs the server this package builds.
package app

import (
	"log"

	"codon-backend/internal/config"
	"codon-backend/internal/handlers"
	"codon-backend/internal/middleware"
	"codon-backend/internal/otp"
	"codon-backend/internal/router"
	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"gorm.io/gorm"
)

const maxBodyBytes = 2 << 20 // 2 MiB: files go to object storage, not through the API

// NewOTPProvider picks the SMS provider from config (console stub in dev).
func NewOTPProvider(cfg config.Config) otp.OTPProvider {
	switch {
	case cfg.Msg91AuthKey != "" && cfg.Msg91TemplateID != "":
		log.Println("OTP provider: Msg91")
		return &otp.Msg91Provider{AuthKey: cfg.Msg91AuthKey, TemplateID: cfg.Msg91TemplateID}
	case cfg.TwoFactorAPIKey != "":
		log.Println("OTP provider: 2Factor.in")
		return &otp.TwoFactorProvider{APIKey: cfg.TwoFactorAPIKey}
	default:
		log.Println("OTP provider: console stub (set MSG91_AUTH_KEY and MSG91_TEMPLATE_ID for real OTPs)")
		return &otp.ConsoleProvider{}
	}
}

// NewEngine builds the fully wired HTTP engine.
func NewEngine(db *gorm.DB, cfg config.Config) *gin.Engine {
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Services
	otpSvc := services.NewOTPService(db, NewOTPProvider(cfg), cfg.OTPRateLimitPerHour)
	sessionSvc := services.NewSessionService(db)
	subSvc := services.NewSubscriptionService(db)
	scoringSvc := services.NewScoringService(db)

	auth := middleware.AuthMiddleware(sessionSvc, db)

	core := &router.CoreDeps{
		Auth: auth,
		Ready: func() error {
			sqlDB, err := db.DB()
			if err != nil {
				return err
			}
			return sqlDB.Ping()
		},
		AuthH:       handlers.NewAuthHandler(db, otpSvc, sessionSvc),
		ProfileH:    handlers.NewProfileHandler(db, subSvc),
		CourseH:     handlers.NewCourseHandler(db),
		PlanH:       handlers.NewPlanHandler(db),
		PaymentH:    handlers.NewPaymentHandler(db, subSvc),
		KYCH:        handlers.NewKYCHandler(db),
		UploadH:     handlers.NewUploadHandler(),
		ContentH:    handlers.NewContentHandler(db, subSvc),
		WellnessH:   handlers.NewWellnessHandler(db),
		AdminH:      handlers.NewAdminHandler(db, sessionSvc, subSvc),
		CurriculumH: handlers.NewCurriculumHandler(db),
		FeedbackH:   handlers.NewFeedbackHandler(db),
	}

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery(), middleware.CORS(), middleware.BodyLimit(maxBodyBytes))
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	router.RegisterPublic(r, core)
	api := r.Group("/api/v1")
	router.RegisterCore(api, core)
	router.Register(api, router.NewDeps(db, auth, subSvc, scoringSvc))
	return r
}
