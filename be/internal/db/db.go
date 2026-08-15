package db

import (
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

// AutoMigrateAll runs GORM AutoMigrate for all models.
// In production, golang-migrate SQL files should be used instead.
// This is a convenience for local dev / tests.
func AutoMigrateAll() error {
	return DB.AutoMigrate(
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
