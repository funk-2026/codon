package services

import (
	"context"

	"codon-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// QuestionWithPos is a question plus its position inside a specific test.
type QuestionWithPos struct {
	models.Question
	Position int `gorm:"column:position" json:"position"`
}

// LoadTestQuestions returns the questions of a test in position order.
// Membership and order live in test_questions; questions.test_id is only the
// authoring ("home") test.
func LoadTestQuestions(ctx context.Context, db *gorm.DB, testID uuid.UUID) ([]QuestionWithPos, error) {
	var out []QuestionWithPos
	err := db.WithContext(ctx).
		Table("questions").
		Select("questions.*, test_questions.position AS position").
		Joins("JOIN test_questions ON test_questions.question_id = questions.id").
		Where("test_questions.test_id = ?", testID).
		Order("test_questions.position ASC, questions.id ASC").
		Scan(&out).Error
	return out, err
}

// TestQuestionCount counts the questions in a test.
func TestQuestionCount(ctx context.Context, db *gorm.DB, testID uuid.UUID) (int64, error) {
	var n int64
	err := db.WithContext(ctx).Model(&models.TestQuestion{}).Where("test_id = ?", testID).Count(&n).Error
	return n, err
}

// QuestionInTest reports whether a question belongs to a test, and its position.
func QuestionInTest(ctx context.Context, db *gorm.DB, testID, questionID uuid.UUID) (position int, ok bool) {
	var tq models.TestQuestion
	if err := db.WithContext(ctx).Where("test_id = ? AND question_id = ?", testID, questionID).First(&tq).Error; err != nil {
		return 0, false
	}
	return tq.Position, true
}

// AddQuestionToTest dual-writes the membership row (call inside the same
// transaction that creates the question).
func AddQuestionToTest(tx *gorm.DB, testID, questionID uuid.UUID, position int) error {
	return tx.Where(models.TestQuestion{TestID: testID, QuestionID: questionID}).
		Assign(models.TestQuestion{Position: position}).
		FirstOrCreate(&models.TestQuestion{}).Error
}

// ParityReport compares the join table against the legacy link.
type ParityReport struct {
	MissingInJoin   int64 `json:"missing_in_join"`  // question rows with no join row for their home test
	OrphanJoinRows  int64 `json:"orphan_join_rows"` // join rows pointing at deleted questions/tests
	CountMismatches int64 `json:"count_mismatches"` // tests whose total_questions != join count (authored only)
}

func CheckTestQuestionParity(ctx context.Context, db *gorm.DB) (ParityReport, error) {
	var r ParityReport
	db = db.WithContext(ctx)
	if err := db.Raw(`SELECT count(*) FROM questions q
		WHERE NOT EXISTS (SELECT 1 FROM test_questions tq WHERE tq.question_id = q.id AND tq.test_id = q.test_id)`).Scan(&r.MissingInJoin).Error; err != nil {
		return r, err
	}
	if err := db.Raw(`SELECT count(*) FROM test_questions tq
		WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.id = tq.question_id)
		   OR NOT EXISTS (SELECT 1 FROM tests t WHERE t.id = tq.test_id)`).Scan(&r.OrphanJoinRows).Error; err != nil {
		return r, err
	}
	err := db.Raw(`SELECT count(*) FROM tests t
		WHERE t.origin = 'authored'
		  AND t.total_questions <> (SELECT count(*) FROM test_questions tq WHERE tq.test_id = t.id)`).Scan(&r.CountMismatches).Error
	return r, err
}
