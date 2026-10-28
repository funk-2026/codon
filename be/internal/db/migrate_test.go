package db_test

import (
	"testing"
	"time"

	"codon-backend/internal/db"
	"codon-backend/internal/models"
	"codon-backend/internal/testutil"
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
