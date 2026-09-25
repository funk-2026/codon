package db

import (
	"encoding/json"
	"fmt"
	"log"

	"codon-backend/internal/config"
	"codon-backend/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect() error {
	var logLevel logger.LogLevel
	if config.AppConfig.Env == "production" {
		logLevel = logger.Error
	} else {
		logLevel = logger.Info
	}

	db, err := gorm.Open(postgres.Open(config.AppConfig.DatabaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	DB = db
	log.Println("Database connected successfully")
	return nil
}

// AutoMigrateAll runs GORM AutoMigrate for all models (table/column structure).
//
// Structure only: anything AutoMigrate cannot express — partial/unique/GIN
// indexes, data backfills, seed rows — lives in versioned SQL files under
// internal/db/migrations and is applied by RunMigrations (see migrate.go).
// Only the API process runs this; the worker waits for the schema
// (WaitForSchema) instead of racing the API on start-up.
func AutoMigrateAll() error { return AutoMigrateAllOn(DB) }

// AutoMigrateAllOn is AutoMigrateAll against an explicit connection (tests).
func AutoMigrateAllOn(g *gorm.DB) error {
	return g.AutoMigrate(
		&models.User{},
		&models.OTPRequest{},
		&models.Session{},
		&models.Course{},
		&models.Subject{},
		&models.Chapter{},
		&models.SubscriptionPlan{},
		&models.Subscription{},
		&models.PaymentRecord{},
		&models.Test{},
		&models.Question{},
		&models.StudentAttempt{},
		&models.AttemptAnswer{},
		&models.ContentItem{},
		&models.CSVImportBatch{},
		&models.CSVImportRowError{},
		&models.KYCRecord{},
		&models.WellnessContent{},
		&models.PlatformSetting{},
		&models.BackgroundJob{},
		&models.UserWatchHistory{},
		&models.DailyActivity{},
		&models.UserFeedback{},

		// Custom test module / rich content / platform features
		&models.MediaAsset{},
		&models.MediaRef{},
		&models.TestQuestion{},
		&models.StudentQuestionState{},
		&models.Topic{},
		&models.Tag{},
		&models.QuestionTag{},
		&models.BookmarkCollection{},
		&models.Bookmark{},
		&models.ContentReport{},
		&models.QuestionRevision{},
		&models.Rating{},
		&models.CustomTestPreset{},
		&models.CustomTestTemplate{},
		&models.CustomTestRequest{},
		&models.QuestionStats{},
		&models.AdminAuditLog{},
		&models.QuestionNote{},
		&models.BlueprintShare{},
		&models.BrainHack{},
		&models.FlashcardDeck{},
		&models.Flashcard{},
		&models.FlashcardState{},
		&models.VideoNote{},
		&models.PushToken{},
		&models.Notification{},
		&models.HomeUpdate{},
		&models.NotificationPref{},
	)
}

// SeedCourses inserts the fixed 3 courses if they don't exist.
func SeedCourses(db *gorm.DB) error {
	courses := []models.Course{
		{Name: "NEET UG", Slug: "neet-ug", IsActive: true},
		{Name: "9th Standard", Slug: "9th-standard", IsActive: true},
		{Name: "10th Standard", Slug: "10th-standard", IsActive: true},
	}

	for _, c := range courses {
		result := db.Where("slug = ?", c.Slug).FirstOrCreate(&c)
		if result.Error != nil {
			return fmt.Errorf("seeding course %s: %w", c.Slug, result.Error)
		}
	}
	return nil
}

// SeedPlatformSettings inserts default platform settings.
func SeedPlatformSettings(db *gorm.DB) error {
	setting := models.PlatformSetting{
		Key:   "kyc_required",
		Value: "false",
	}
	return db.Where("key = ?", setting.Key).FirstOrCreate(&setting).Error
}

// SeedBookmarkCollections inserts the three system bookmark collections.
// Labels are placeholders pending product confirmation (spec D19) and are
// admin-editable at runtime, so changing them is a data change, not a release.
func SeedBookmarkCollections(db *gorm.DB) error {
	defaults := []models.BookmarkCollection{
		{Key: "revise_later", Label: "Revise later", OrderIndex: 1, IsActive: true},
		{Key: "doubts", Label: "Doubts", OrderIndex: 2, IsActive: true},
		{Key: "important", Label: "Important", OrderIndex: 3, IsActive: true},
	}
	for _, c := range defaults {
		var count int64
		db.Model(&models.BookmarkCollection{}).Where("key = ? AND owner_id IS NULL", c.Key).Count(&count)
		if count == 0 {
			if err := db.Create(&c).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

// SeedAll runs every idempotent seed.
func SeedAll(db *gorm.DB) error {
	if err := SeedCourses(db); err != nil {
		return err
	}
	if err := SeedPlatformSettings(db); err != nil {
		return err
	}
	if err := SeedBookmarkCollections(db); err != nil {
		return err
	}
	return SeedCustomTestPresets(db)
}

// SeedCustomTestPresets inserts the default system presets per course
// (idempotent by course + title). They are data: admins can rename, edit,
// reorder or deactivate them at runtime.
func SeedCustomTestPresets(db *gorm.DB) error {
	var courses []models.Course
	if err := db.Find(&courses).Error; err != nil {
		return err
	}
	type preset struct {
		title, desc string
		bp          map[string]interface{}
		order       int
	}
	for _, c := range courses {
		id := c.ID.String()
		list := []preset{
			{"Daily 20", "20 fresh questions, no timer — a quick daily habit.", map[string]interface{}{"count": 20, "strategy": "unseen_first", "timing": map[string]interface{}{"timed": false}}, 1},
			{"Weak areas", "15 questions from the chapters you're weakest in.", map[string]interface{}{"count": 15, "strategy": "weak_first", "timing": map[string]interface{}{"timed": false}}, 2},
			{"Revision due", "20 questions that are due for spaced revision, then fresh ones.", map[string]interface{}{"count": 20, "strategy": "spaced", "timing": map[string]interface{}{"timed": false}}, 6},
			{"Chapter sprint", "10 questions in 10 minutes, in syllabus order.", map[string]interface{}{"count": 10, "order": "syllabus", "timing": map[string]interface{}{"timed": true, "duration_minutes": 10}}, 3},
			{"PYQ only", "20 previous-year questions.", map[string]interface{}{"count": 20, "filters": map[string]interface{}{"source_types": []string{"pyq"}}, "timing": map[string]interface{}{"timed": false}}, 4},
		}
		if c.Slug == "neet-ug" {
			list = append(list, preset{"NEET 45 min", "45 questions, 45 minutes, NEET marking (+4 / −1).", map[string]interface{}{"count": 45, "timing": map[string]interface{}{"timed": true, "duration_minutes": 45}, "marking": map[string]interface{}{"preset": "neet"}}, 5})
		}
		for _, p := range list {
			var n int64
			db.Model(&models.CustomTestPreset{}).Where("course_id = ? AND title = ?", c.ID, p.title).Count(&n)
			if n > 0 {
				continue
			}
			p.bp["schema_version"], p.bp["course_id"] = 1, id
			raw, _ := json.Marshal(p.bp)
			if err := db.Create(&models.CustomTestPreset{CourseID: c.ID, Title: p.title, Description: p.desc, Blueprint: raw, OrderIndex: p.order, IsActive: true}).Error; err != nil {
				return err
			}
		}
	}
	return nil
}
