// Package router registers the assessment / custom-test / rich-content API
// routes. It is separate from cmd/api so integration tests can mount exactly
// the same routes the server serves.
package router

import (
	"net/http"

	"codon-backend/internal/generation"
	"codon-backend/internal/handlers"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Deps are the collaborators the routes need.
type Deps struct {
	DB          *gorm.DB
	Auth        gin.HandlerFunc
	SubSvc      *services.SubscriptionService
	KYCRequired func() bool
	Scoring     *services.ScoringService

	Tests     *handlers.TestHandler
	Attempts  *handlers.AttemptHandler
	Media     *handlers.MediaHandler
	TQ        *handlers.TeacherQuestionHandler
	Taxonomy  *handlers.TaxonomyHandler
	AppConfig *handlers.AppConfigHandler
	Bookmarks *handlers.BookmarkHandler
	Reports   *handlers.ReportHandler
	Corrs     *handlers.CorrectionHandler
	Ratings   *handlers.RatingHandler
	Custom    *handlers.CustomTestHandler
	Analytics *handlers.AnalyticsHandler
	Hacks     *handlers.BrainHackHandler
	Cards     *handlers.FlashcardHandler
	Extras    *handlers.ExtrasHandler
	Extra     []func(api *gin.RouterGroup, d *Deps) // later milestones plug in here
}

// NewDeps builds all handlers from a DB and the shared services.
func NewDeps(db *gorm.DB, auth gin.HandlerFunc, sub *services.SubscriptionService, scoring *services.ScoringService, kycRequired func() bool) *Deps {
	eng := generation.NewEngine(db, sub, kycRequired)
	an := handlers.NewAnalyticsHandler(db, eng)
	return &Deps{
		Extras: handlers.NewExtrasHandler(db, sub, kycRequired, eng, an),
		DB:     db, Auth: auth, SubSvc: sub, KYCRequired: kycRequired, Scoring: scoring,
		Tests: handlers.NewTestHandler(db), Attempts: handlers.NewAttemptHandler(db, scoring),
		Media: handlers.NewMediaHandler(db), TQ: handlers.NewTeacherQuestionHandler(db),
		Taxonomy: handlers.NewTaxonomyHandler(db), AppConfig: handlers.NewAppConfigHandler(db),
		Bookmarks: handlers.NewBookmarkHandler(db), Reports: handlers.NewReportHandler(db),
		Corrs: handlers.NewCorrectionHandler(db), Ratings: handlers.NewRatingHandler(db),
		Custom: handlers.NewCustomTestHandler(db, eng), Analytics: an, Hacks: handlers.NewBrainHackHandler(db), Cards: handlers.NewFlashcardHandler(db, sub, kycRequired),
	}
}

// Register mounts every route owned by this package on api (/api/v1).
func Register(api *gin.RouterGroup, d *Deps) {
	auth := d.Auth

	api.GET("/app-config", auth, d.AppConfig.Get)

	// Media pipeline (validated image uploads for rich content)
	api.POST("/media/presign", auth, d.Media.Presign)
	api.POST("/media/:id/complete", auth, d.Media.Complete)
	api.GET("/media/:id", auth, d.Media.Get)

	// Taxonomy lookups
	api.GET("/tags", auth, d.Taxonomy.ListTags)
	api.GET("/courses/:id/topics", auth, d.Taxonomy.ListTopics)

	// ── Bookmarks / reports / ratings (students; admins allowed by RequireRole) ──
	me := api.Group("/me").Use(auth)
	{
		me.GET("/bookmark-collections", d.Bookmarks.ListCollections)
		me.PUT("/bookmarks", d.Bookmarks.Put)
		me.GET("/bookmarks", d.Bookmarks.List)
		me.GET("/bookmarks/ids", d.Bookmarks.IDs)
		me.DELETE("/bookmarks/:item_type/:item_id", d.Bookmarks.Delete)
		me.GET("/reports", d.Reports.Mine)
		me.GET("/video-notes", d.Extras.ListVideoNotes)
		me.POST("/video-notes", d.Extras.CreateVideoNote)
		me.PATCH("/video-notes/:id", d.Extras.UpdateVideoNote)
		me.DELETE("/video-notes/:id", d.Extras.DeleteVideoNote)
		me.POST("/push-tokens", d.Extras.RegisterPushToken)
		me.DELETE("/push-tokens/:token", d.Extras.DeletePushToken)
		me.GET("/notification-preferences", d.Extras.GetPrefs)
		me.PUT("/notification-preferences", d.Extras.PutPrefs)
		me.GET("/notifications", d.Extras.ListNotifications)
		me.POST("/notifications/read", d.Extras.MarkRead)
		me.GET("/analytics/mastery", d.Analytics.Mastery)
		me.GET("/analytics/coverage", d.Analytics.Coverage)
		me.GET("/analytics/weak-areas", d.Analytics.WeakAreas)
		me.GET("/analytics/trend", d.Analytics.Trend)
		me.GET("/recommendations", d.Analytics.Recommendations)
		me.GET("/question-notes", d.Analytics.ListNotes)
		me.PUT("/question-notes/:question_id", d.Analytics.PutNote)
		me.DELETE("/question-notes/:question_id", d.Analytics.DeleteNote)
	}
	api.POST("/reports", auth, d.Reports.Create)
	api.PUT("/ratings", auth, d.Ratings.Put)
	api.DELETE("/ratings/:item_type/:item_id", auth, d.Ratings.Delete)

	api.GET("/home/updates", auth, d.Extras.HomeUpdates)
	api.GET("/explore", auth, d.Extras.Explore)

	// ── Custom tests (student; behind the custom_test.enabled flag) ──
	ct := api.Group("/custom-tests").Use(auth).Use(middleware.RequireRole(models.RoleStudent)).Use(handlers.RequireFlag("custom_test.enabled"))
	{
		ct.GET("/builder-config", d.Custom.BuilderConfig)
		ct.POST("/share", d.Custom.ShareBlueprint)
		ct.GET("/shared/:code", d.Custom.GetShared)
		ct.POST("/count", d.Custom.Count)
		ct.POST("", d.Custom.Generate)
		ct.GET("", d.Custom.List)
		ct.GET("/templates", d.Custom.ListTemplates)
		ct.POST("/templates", d.Custom.CreateTemplate)
		ct.PATCH("/templates/:id", d.Custom.UpdateTemplate)
		ct.DELETE("/templates/:id", d.Custom.DeleteTemplate)
		ct.POST("/from-attempt/:attempt_id", d.Custom.FromAttempt)
		ct.GET("/:id", d.Custom.Get)
		ct.PATCH("/:id", d.Custom.Rename)
		ct.DELETE("/:id", d.Custom.Delete)
		ct.POST("/:id/regenerate", d.Custom.Regenerate)
	}

	// ── Brain hacks (student read) ──
	bh := api.Group("/brain-hacks").Use(auth).Use(middleware.RequireRole(models.RoleStudent))
	{
		bh.GET("", d.Hacks.StudentList)
		bh.GET("/categories", d.Hacks.Categories)
		bh.GET("/:id", d.Hacks.StudentGet)
	}

	// ── Flashcards (student) ──
	fc := api.Group("/flashcards").Use(auth).Use(middleware.RequireRole(models.RoleStudent))
	{
		fc.GET("/decks", d.Cards.StudentDecks)
		fc.GET("/decks/:id/cards", d.Cards.StudentDeckCards)
		fc.GET("/decks/:id/study", d.Cards.Study)
		fc.GET("/quick", d.Cards.Quick)
		fc.POST("/cards/:id/review", d.Cards.Review)
	}

	// ── Tests (student) ──
	tests := api.Group("/tests").Use(auth).Use(middleware.RequireRole(models.RoleStudent))
	{
		tests.GET("", d.Tests.ListTests)
		tests.GET("/:id", d.Tests.GetTest)
		tests.POST("/:id/attempts", func(c *gin.Context) {
			user := middleware.GetUser(c)
			var test models.Test
			if err := d.DB.Where("id = ? AND status = ? AND archived_at IS NULL", c.Param("id"), models.StatusPublished).First(&test).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "test not found", "code": "test_not_found"})
				return
			}
			if err := d.SubSvc.CheckAccess(c.Request.Context(), user, test.RequiresSubscription, test.CourseID, d.KYCRequired()); err != nil {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": err.Error(), "code": "subscription_required"})
				return
			}
			d.Attempts.StartAttempt(c)
		})
		tests.GET("/:id/questions", d.Tests.GetQuestions)
	}

	// ── Attempts (student) ──
	attempts := api.Group("/attempts").Use(auth).Use(middleware.RequireRole(models.RoleStudent))
	{
		attempts.PUT("/:id/answers", d.Attempts.BatchUpsertAnswers)
		attempts.PUT("/:id/answers/:question_id", d.Attempts.UpsertAnswer)
		attempts.POST("/:id/answers/:question_id/reveal", d.Attempts.RevealAnswer)
		attempts.POST("/:id/takeover", d.Attempts.Takeover)
		attempts.POST("/:id/submit", d.Attempts.SubmitAttempt)
		attempts.GET("/:id/result", d.Attempts.GetResult)
		attempts.GET("/:id/review", d.Attempts.GetReview)
	}

	// ── Teacher: tests, questions, imports, media, taxonomy ──
	teacher := api.Group("/teacher").Use(auth).Use(middleware.RequireRole(models.RoleTeacher, models.RoleAdmin))
	{
		teacher.POST("/tests", d.Tests.CreateTest)
		teacher.PATCH("/tests/:id", d.Tests.UpdateTest)
		teacher.POST("/tests/:id/questions", d.Tests.AddQuestion)
		teacher.PATCH("/questions/:id", d.Tests.UpdateQuestion)
		teacher.DELETE("/questions/:id", d.Tests.DeleteQuestion)
		teacher.POST("/tests/:id/csv-import", d.Tests.CSVImport)
		teacher.POST("/csv-imports/:id/commit", d.Tests.CommitCSVImport)
		teacher.GET("/csv-imports/:id", d.Tests.GetCSVImport)
		teacher.GET("/csv-template", d.Tests.CSVTemplate)
		teacher.POST("/tests/:id/submit-for-review", d.Tests.SubmitForReview)
		teacher.GET("/tests", d.Tests.ListTeacherTests)
		teacher.GET("/tests/:id", d.Tests.TeacherGetTest)
		teacher.POST("/tests/:id/publish", d.Tests.PublishTest)
		teacher.DELETE("/tests/:id", d.Tests.DeleteTest)

		teacher.GET("/questions", d.TQ.ListQuestions)
		teacher.POST("/questions/bulk-update", d.TQ.BulkUpdate)
		teacher.POST("/questions/check-duplicate", d.TQ.CheckDuplicate)
		teacher.GET("/questions/completeness", d.TQ.Completeness)

		teacher.GET("/media", d.Media.List)
		teacher.PATCH("/media/:id", d.Media.Update)
		teacher.DELETE("/media/:id", d.Media.Delete)

		teacher.POST("/chapters/:chapter_id/topics", d.Taxonomy.CreateTopic)

		teacher.POST("/flashcard-decks", d.Cards.CreateDeck)
		teacher.GET("/flashcard-decks", d.Cards.TeacherDecks)
		teacher.GET("/flashcard-decks/:id", d.Cards.TeacherDeck)
		teacher.PATCH("/flashcard-decks/:id", d.Cards.UpdateDeck)
		teacher.DELETE("/flashcard-decks/:id", d.Cards.DeleteDeck)
		teacher.POST("/flashcard-decks/:id/cards", d.Cards.AddCard)
		teacher.POST("/flashcard-decks/:id/reorder", d.Cards.ReorderCards)
		teacher.POST("/flashcard-decks/:id/submit-for-review", d.Cards.SubmitDeck)
		teacher.POST("/flashcard-decks/:id/publish", d.Cards.PublishDeck)
		teacher.PATCH("/flashcards/:id", d.Cards.UpdateCard)
		teacher.DELETE("/flashcards/:id", d.Cards.DeleteCard)
		teacher.POST("/brain-hacks", d.Hacks.Create)
		teacher.GET("/brain-hacks", d.Hacks.TeacherList)
		teacher.GET("/brain-hacks/:id", d.Hacks.TeacherGet)
		teacher.PATCH("/brain-hacks/:id", d.Hacks.Update)
		teacher.POST("/brain-hacks/:id/submit-for-review", d.Hacks.Submit)
		teacher.POST("/brain-hacks/:id/publish", d.Hacks.Publish)
		teacher.DELETE("/brain-hacks/:id", d.Hacks.Delete)
		teacher.POST("/questions/:id/corrections", d.Corrs.Submit)
		teacher.GET("/questions/:id/stats", d.Analytics.QuestionStats)
		teacher.GET("/inventory", d.Analytics.Inventory)
		teacher.GET("/corrections", d.Corrs.Mine)
		teacher.GET("/reports", d.Reports.TeacherInbox)
		teacher.POST("/reports/:id/resolve", d.Reports.Resolve)
	}

	// ── Admin: settings + taxonomy ──
	admin := api.Group("/admin").Use(auth).Use(middleware.RequireRole(models.RoleAdmin))
	{
		admin.GET("/tests", d.Tests.AdminListTests)
		admin.GET("/tests/:id", d.Tests.AdminGetTest)
		admin.POST("/tests/:id/approve", d.Tests.AdminApproveTest)
		admin.POST("/tests/:id/reject", d.Tests.AdminRejectTest)
		admin.GET("/home-updates", d.Extras.AdminListHome)
		admin.POST("/home-updates", d.Extras.AdminCreateHome)
		admin.PATCH("/home-updates/:id", d.Extras.AdminUpdateHome)
		admin.DELETE("/home-updates/:id", d.Extras.AdminDeleteHome)
		admin.GET("/flashcard-decks", d.Cards.AdminDecks)
		admin.GET("/flashcard-decks/:id", d.Cards.AdminDeck)
		admin.POST("/flashcard-decks/:id/approve", d.Cards.AdminApproveDeck)
		admin.POST("/flashcard-decks/:id/reject", d.Cards.AdminRejectDeck)
		admin.GET("/brain-hacks", d.Hacks.AdminList)
		admin.GET("/brain-hacks/:id", d.Hacks.AdminGet)
		admin.POST("/brain-hacks/:id/approve", d.Hacks.Approve)
		admin.POST("/brain-hacks/:id/reject", d.Hacks.Reject)
		admin.GET("/pool-health", d.Analytics.PoolHealth)
		admin.POST("/users/:id/purge-personal-data", d.Analytics.PurgePersonalData)
		admin.GET("/reports", d.Reports.AdminQueue)
		admin.POST("/reports/:id/resolve", d.Reports.Resolve)
		admin.POST("/reports/:id/dismiss", d.Reports.AdminDismiss)
		admin.POST("/reports/:id/reassign", d.Reports.AdminReassign)
		admin.GET("/corrections", d.Corrs.AdminQueue)
		admin.POST("/corrections/:id/approve", d.Corrs.Approve)
		admin.POST("/corrections/:id/reject", d.Corrs.Reject)
		admin.GET("/bookmark-collections", d.Bookmarks.AdminListCollections)
		admin.PATCH("/bookmark-collections/:id", d.Bookmarks.AdminPatchCollection)
		admin.GET("/custom-test/presets", d.Custom.AdminListPresets)
		admin.POST("/custom-test/presets", d.Custom.AdminCreatePreset)
		admin.PATCH("/custom-test/presets/:id", d.Custom.AdminUpdatePreset)
		admin.DELETE("/custom-test/presets/:id", d.Custom.AdminDeletePreset)
		admin.GET("/custom-test/metrics", d.Custom.AdminMetrics)
		admin.GET("/settings/custom-test", d.AppConfig.GetSettings)
		admin.PATCH("/settings/custom-test", d.AppConfig.PatchSettings)
		admin.PATCH("/topics/:id", d.Taxonomy.UpdateTopic)
		admin.DELETE("/topics/:id", d.Taxonomy.DeleteTopic)
		admin.GET("/tags", d.Taxonomy.AdminListTags)
		admin.PATCH("/tags/:id", d.Taxonomy.RenameTag)
		admin.POST("/tags/:id/merge", d.Taxonomy.MergeTag)
		admin.DELETE("/tags/:id", d.Taxonomy.DeleteTag)
	}

	for _, extra := range d.Extra {
		extra(api, d)
	}
}
