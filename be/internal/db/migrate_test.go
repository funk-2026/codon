package db_test

import (
	"os"
	"strings"
	"testing"
	"time"

	"codon-backend/internal/db"
	"codon-backend/internal/models"
	"codon-backend/internal/testutil"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestMigrationsAppliedAndIdempotent(t *testing.T) {
	g := testutil.DB(t)
	if err := db.RunMigrations(g); err != nil {
		t.Fatalf("second run must be a no-op: %v", err)
	}
	if err := db.WaitForSchema(g, 2*time.Second); err != nil {
		t.Fatalf("schema should be ready: %v", err)
	}
	var n int64
	g.Table("schema_migrations").Count(&n)
	if int(n) != len(db.ExpectedMigrations()) {
		t.Fatalf("ledger has %d rows, want %d", n, len(db.ExpectedMigrations()))
	}
}

// The 0001 backfill must build test_questions + question metadata from the
// legacy questions.test_id link without duplicating on re-run.
func TestBackfillTestQuestionsAndMetadata(t *testing.T) {
	g := testutil.DB(t)
	w := testutil.NewWorld(t, g)
	sub, ch := w.Subject.ID, w.Chapter.ID
	test := models.Test{Title: "legacy", CourseID: w.Course.ID, ModuleType: models.ModulePractice, SubjectID: &sub, ChapterID: &ch,
		CreatedBy: w.Teacher.ID, Status: models.StatusPublished, MarksPerCorrect: 4, MarksPerWrong: -1}
	g.Create(&test)
	// a legacy question: no join row, no metadata
	q := models.Question{TestID: test.ID, QuestionText: "q", OptionA: "a", OptionB: "b", OptionC: "c", OptionD: "d", CorrectOption: "A", OrderIndex: 7}
	g.Create(&q)

	for i := 0; i < 2; i++ { // twice → idempotent
		if err := g.Exec(db.MigrationSQL("0001_custom_test_foundations.sql")).Error; err != nil {
			t.Fatalf("backfill run %d: %v", i, err)
		}
	}
	var tq []models.TestQuestion
	g.Where("question_id = ?", q.ID).Find(&tq)
	if len(tq) != 1 || tq[0].Position != 7 || tq[0].TestID != test.ID {
		t.Fatalf("join row wrong: %+v", tq)
	}
	var got models.Question
	g.First(&got, "id = ?", q.ID)
	if got.ChapterID == nil || *got.ChapterID != ch || got.SubjectID == nil || *got.SubjectID != sub {
		t.Fatalf("metadata not inherited: %+v", got)
	}
	if got.SourceType != "practice" {
		t.Fatalf("source_type = %q, want practice", got.SourceType)
	}
}

// A brand-new production database is built from the baseline + migrations
// only (no AutoMigrate). Every table and column the models declare must exist.
func TestFreshDatabaseFromMigrationsMatchesModels(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	admin, err := gorm.Open(postgres.Open(url), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		t.Fatal(err)
	}
	schema := "t_fresh_" + uuid.NewString()[:8]
	admin.Exec("CREATE SCHEMA " + schema)
	t.Cleanup(func() { admin.Exec("DROP SCHEMA " + schema + " CASCADE") })

	sep := "?"
	if strings.Contains(url, "?") {
		sep = "&"
	}
	g, err := gorm.Open(postgres.Open(url+sep+"search_path="+schema), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.RunMigrations(g); err != nil {
		t.Fatalf("fresh migrate: %v", err)
	}
	if err := db.SeedAll(g); err != nil {
		t.Fatalf("seed on fresh schema: %v", err)
	}
	for _, m := range db.AllModels() {
		if !g.Migrator().HasTable(m) {
			t.Errorf("table missing for %T", m)
			continue
		}
		stmt := &gorm.Statement{DB: g}
		if err := stmt.Parse(m); err != nil {
			t.Fatal(err)
		}
		for _, f := range stmt.Schema.Fields {
			if f.DBName != "" && !g.Migrator().HasColumn(m, f.DBName) {
				t.Errorf("%s.%s missing after migrations", stmt.Schema.Table, f.DBName)
			}
		}
	}
}

// Reference data must come from the migrations alone (production never runs
// the Go seeds), and the Go seeds must then be a no-op.
func TestMigrationSeedsAreComplete(t *testing.T) {
	g := testutil.DB(t) // migrations ran; testutil then truncated + re-seeded
	g.Exec("TRUNCATE courses, platform_settings, bookmark_collections, custom_test_presets CASCADE")
	// re-run only the seed migration's SQL, as a fresh install would
	if err := g.Exec(db.MigrationSQL("0005_rate_limits_and_seeds.sql")).Error; err != nil {
		t.Fatal(err)
	}
	var courses, cols, presets int64
	g.Model(&models.Course{}).Count(&courses)
	g.Model(&models.BookmarkCollection{}).Count(&cols)
	g.Model(&models.CustomTestPreset{}).Count(&presets)
	if courses != 3 || cols != 3 || presets != 16 {
		t.Fatalf("seeds: courses=%d collections=%d presets=%d (want 3/3/16)", courses, cols, presets)
	}
	var neet models.Course
	g.First(&neet, "slug = ?", "neet-ug")
	if !neet.DefaultRequiresSubscription {
		t.Fatal("NEET UG must default to paid")
	}
	// the Go seeds find everything already there
	if err := db.SeedAll(g); err != nil {
		t.Fatal(err)
	}
	var after int64
	g.Model(&models.CustomTestPreset{}).Count(&after)
	if after != presets {
		t.Fatalf("Go seeds duplicated presets: %d → %d", presets, after)
	}
}
