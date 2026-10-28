// Package testutil provides a real-Postgres test harness and small factories.
// Tests that need a database call testutil.DB(t); they are skipped (not failed)
// when TEST_DATABASE_URL is not set, so `go test ./...` stays green on a laptop
// without Postgres.
package testutil

import (
	"crypto/sha1"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"codon-backend/internal/db"
	"codon-backend/internal/models"
	"codon-backend/internal/settings"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	once    sync.Once
	shared  *gorm.DB
	initErr error
)

// DB returns a migrated database with all tables truncated and seeds re-applied.
// Each test binary gets its own schema so packages can run in parallel.
func DB(t *testing.T) *gorm.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set — skipping database test")
	}
	once.Do(func() {
		schema := fmt.Sprintf("t_%x", sha1.Sum([]byte(os.Args[0])))[:14]
		admin, err := gorm.Open(postgres.Open(url), &gorm.Config{Logger: logger.Discard})
		if err != nil {
			initErr = err
			return
		}
		admin.Exec("DROP SCHEMA IF EXISTS " + schema + " CASCADE")
		if err := admin.Exec("CREATE SCHEMA " + schema).Error; err != nil {
			initErr = err
			return
		}
		sep := "?"
		if strings.Contains(url, "?") {
			sep = "&"
		}
		g, err := gorm.Open(postgres.Open(url+sep+"search_path="+schema), &gorm.Config{Logger: logger.Discard})
		if err != nil {
			initErr = err
			return
		}
		if err := db.AutoMigrateAllOn(g); err != nil {
			initErr = fmt.Errorf("automigrate: %w", err)
			return
		}
		if err := db.RunMigrations(g); err != nil {
			initErr = fmt.Errorf("migrations: %w", err)
			return
		}
		shared = g
	})
	if initErr != nil {
		t.Fatalf("test database init: %v", initErr)
	}
	// Truncate everything except the migration ledger.
	var tables []string
	shared.Raw(`SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> 'schema_migrations'`).Scan(&tables)
	if len(tables) > 0 {
		shared.Exec("TRUNCATE " + strings.Join(tables, ", ") + " RESTART IDENTITY CASCADE")
	}
	if err := db.SeedAll(shared); err != nil {
		t.Fatalf("seed: %v", err)
	}
	settings.Init(shared)
	return shared
}

// ── Factories ─────────────────────────────────────────────────────────────────

type World struct {
	DB      *gorm.DB
	Course  models.Course
	Subject models.Subject
	Chapter models.Chapter
	Admin   models.User
	Teacher models.User
	Student models.User
}

// NewWorld creates a course→subject→chapter tree plus one user per role.
func NewWorld(t *testing.T, g *gorm.DB) *World {
	t.Helper()
	var course models.Course
	if err := g.Where("slug = ?", "neet-ug").First(&course).Error; err != nil {
		t.Fatalf("course: %v", err)
	}
	w := &World{DB: g, Course: course}
	w.Subject = models.Subject{CourseID: course.ID, Name: "Physics"}
	mustCreate(t, g, &w.Subject)
	w.Chapter = models.Chapter{SubjectID: w.Subject.ID, Name: "Thermodynamics"}
	mustCreate(t, g, &w.Chapter)
	w.Admin = w.User(t, models.RoleAdmin)
	w.Teacher = w.User(t, models.RoleTeacher)
	w.Student = w.User(t, models.RoleStudent)
	return w
}

func (w *World) User(t *testing.T, role models.UserRole) models.User {
	t.Helper()
	u := models.User{PhoneNumber: "+91" + uuid.NewString()[:10], Role: role, KYCStatus: models.KYCNotRequired}
	mustCreate(t, w.DB, &u)
	return u
}

// Test creates a published authored test with n questions in the world's chapter.
func (w *World) Test(t *testing.T, module models.ModuleType, n int, free bool) models.Test {
	t.Helper()
	sub := w.Subject.ID
	ch := w.Chapter.ID
	dur := 30
	test := models.Test{
		Title: "T-" + uuid.NewString()[:6], CourseID: w.Course.ID, ModuleType: module,
		RequiresSubscription: !free, SubjectID: &sub, ChapterID: &ch, CreatedBy: w.Teacher.ID,
		DurationMinutes: &dur, MarksPerCorrect: 4, MarksPerWrong: -1, Status: models.StatusPublished,
		Origin: models.OriginAuthored, Visibility: models.VisibilityPublic, Mode: models.ModeExam,
	}
	mustCreate(t, w.DB, &test)
	// GORM turns a false bool on a `default:true` column into the default; write it back.
	w.DB.Model(&test).UpdateColumn("requires_subscription", !free)
	for i := 1; i <= n; i++ {
		w.Question(t, test, i, "medium")
	}
	return test
}

// Question adds a question to a test (and its join row).
func (w *World) Question(t *testing.T, test models.Test, pos int, difficulty string) models.Question {
	t.Helper()
	d := difficulty
	sub, ch := w.Subject.ID, w.Chapter.ID
	src := "qbank"
	switch test.ModuleType {
	case models.ModulePractice:
		src = "practice"
	case models.ModuleTestSeries:
		src = "test_series"
	}
	q := models.Question{
		TestID: test.ID, QuestionText: fmt.Sprintf("Question %d %s", pos, uuid.NewString()[:8]),
		OptionA: "A", OptionB: "B", OptionC: "C", OptionD: "D", CorrectOption: models.OptionB,
		OrderIndex: pos, ContentFormat: "plain", SubjectID: &sub, ChapterID: &ch, Difficulty: &d,
		SourceType: src, CustomEligible: true, QuestionType: "mcq_single", Version: 1, Lang: "en",
		FlagStatus: models.FlagActive, ContentHash: uuid.NewString(),
	}
	mustCreate(t, w.DB, &q)
	mustCreate(t, w.DB, &models.TestQuestion{TestID: test.ID, QuestionID: q.ID, Position: pos})
	w.DB.Model(&models.Test{}).Where("id = ?", test.ID).UpdateColumn("total_questions", gorm.Expr("total_questions + 1"))
	return q
}

func mustCreate(t *testing.T, g *gorm.DB, v interface{}) {
	t.Helper()
	if err := g.Create(v).Error; err != nil {
		t.Fatalf("create %T: %v", v, err)
	}
}

// Chemistry adds a second subject + chapter to the world (for cross-subject tests).
func (w *World) Chemistry(t *testing.T) (models.Subject, models.Chapter) {
	t.Helper()
	sub := models.Subject{CourseID: w.Course.ID, Name: "Chemistry", OrderIndex: 2}
	mustCreate(t, w.DB, &sub)
	ch := models.Chapter{SubjectID: sub.ID, Name: "Acids", OrderIndex: 1}
	mustCreate(t, w.DB, &ch)
	return sub, ch
}

// QuestionIn adds a question with explicit subject/chapter/difficulty/source.
func (w *World) QuestionIn(t *testing.T, test models.Test, pos int, difficulty string, sub models.Subject, ch models.Chapter) models.Question {
	t.Helper()
	q := w.Question(t, test, pos, difficulty)
	w.DB.Model(&models.Question{}).Where("id = ?", q.ID).Updates(map[string]interface{}{"subject_id": sub.ID, "chapter_id": ch.ID})
	q.SubjectID, q.ChapterID = &sub.ID, &ch.ID
	return q
}

// Subscribe gives the user an active subscription to the course.
func (w *World) Subscribe(t *testing.T, u models.User) {
	t.Helper()
	plan := models.SubscriptionPlan{Name: "P", CourseID: w.Course.ID, DurationDays: 30, PricePaise: 100, Currency: "INR", IsActive: true, CreatedBy: w.Admin.ID}
	mustCreate(t, w.DB, &plan)
	start, end := time.Now().Add(-time.Hour), time.Now().Add(24*time.Hour)
	mustCreate(t, w.DB, &models.Subscription{UserID: u.ID, PlanID: plan.ID, CourseID: w.Course.ID, Status: models.SubActive, StartDate: &start, EndDate: &end})
}
