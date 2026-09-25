package services

import (
	"context"

	"codon-backend/internal/models"
	"codon-backend/internal/settings"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// QuestionWithPos is a question plus its position inside a specific test.
type QuestionWithPos struct {
	models.Question
	Position int `gorm:"column:position" json:"position"`
}

// readViaJoin reports whether test membership is read through test_questions
// (the default, D1-B) or the legacy questions.test_id link. The switch exists
// so the join-based read path can be rolled back without a deploy.
func readViaJoin() bool {
	if settings.Default == nil {
		return true
	}
	v := settings.Default.String("test_questions.read_via_join")
	return v != "false"
}

// LoadTestQuestions returns the questions of a test in position order.
func LoadTestQuestions(ctx context.Context, db *gorm.DB, testID uuid.UUID) ([]QuestionWithPos, error) {
	var out []QuestionWithPos
	var err error
	if readViaJoin() {
		err = db.WithContext(ctx).
			Table("questions").
			Select("questions.*, test_questions.position AS position").
			Joins("JOIN test_questions ON test_questions.question_id = questions.id").
			Where("test_questions.test_id = ?", testID).
			Order("test_questions.position ASC, questions.id ASC").
			Scan(&out).Error
	} else {
		err = db.WithContext(ctx).
			Table("questions").
			Select("questions.*, questions.order_index AS position").
			Where("questions.test_id = ?", testID).
			Order("questions.order_index ASC, questions.id ASC").
			Scan(&out).Error
	}
	return out, err
}

// TestQuestionCount counts the questions in a test.
func TestQuestionCount(ctx context.Context, db *gorm.DB, testID uuid.UUID) (int64, error) {
	var n int64
	if readViaJoin() {
		err := db.WithContext(ctx).Model(&models.TestQuestion{}).Where("test_id = ?", testID).Count(&n).Error
		return n, err
	}
	err := db.WithContext(ctx).Model(&models.Question{}).Where("test_id = ?", testID).Count(&n).Error
	return n, err
}

// QuestionInTest reports whether a question belongs to a test.
func QuestionInTest(ctx context.Context, db *gorm.DB, testID, questionID uuid.UUID) (position int, ok bool) {
	if readViaJoin() {
		var tq models.TestQuestion
		if err := db.WithContext(ctx).Where("test_id = ? AND question_id = ?", testID, questionID).First(&tq).Error; err != nil {
			return 0, false
		}
		return tq.Position, true
	}
	var q models.Question
	if err := db.WithContext(ctx).Where("id = ? AND test_id = ?", questionID, testID).First(&q).Error; err != nil {
		return 0, false
	}
	return q.OrderIndex, true
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
