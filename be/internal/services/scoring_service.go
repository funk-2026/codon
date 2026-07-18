package services

import (
	"context"
	"fmt"
	"time"

	"codon-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ScoringService struct {
	DB *gorm.DB
}

func NewScoringService(db *gorm.DB) *ScoringService {
	return &ScoringService{DB: db}
}

// SubmitAttempt finalizes the attempt, computes score server-side.
func (s *ScoringService) SubmitAttempt(ctx context.Context, attemptID, userID uuid.UUID, timeTakenSeconds *int) (*models.StudentAttempt, error) {
	var attempt models.StudentAttempt
	if err := s.DB.WithContext(ctx).
		Where("id = ? AND user_id = ? AND status = ?", attemptID, userID, models.AttemptInProgress).
		First(&attempt).Error; err != nil {
		return nil, fmt.Errorf("attempt not found or not in progress")
	}

	// Load the test for scoring config
	var test models.Test
	if err := s.DB.WithContext(ctx).Where("id = ?", attempt.TestID).First(&test).Error; err != nil {
		return nil, fmt.Errorf("loading test: %w", err)
	}

	// Load all questions for the test
	var questions []models.Question
	s.DB.WithContext(ctx).Where("test_id = ?", test.ID).Find(&questions)

	// Load student's answers
	var answers []models.AttemptAnswer
	s.DB.WithContext(ctx).Where("attempt_id = ?", attempt.ID).Find(&answers)

	// Build answer map
	answerMap := make(map[uuid.UUID]*models.AttemptAnswer)
	for i := range answers {
		answerMap[answers[i].QuestionID] = &answers[i]
	}

	// Score
	var totalScore float64
	var correctCount, wrongCount, unattemptedCount int
	totalMarks := float64(len(questions)) * test.MarksPerCorrect

	now := time.Now()
	for _, q := range questions {
		ans, answered := answerMap[q.ID]
		if !answered || ans.SelectedOption == nil {
			unattemptedCount++
			// Ensure there's an unattempted row
			if !answered {
				unanswered := models.AttemptAnswer{
					AttemptID:  attempt.ID,
					QuestionID: q.ID,
				}
				s.DB.WithContext(ctx).
					Where("attempt_id = ? AND question_id = ?", attempt.ID, q.ID).
					FirstOrCreate(&unanswered)
			}
			continue
		}

		isCorrect := *ans.SelectedOption == q.CorrectOption
		var marks float64
		if isCorrect {
			marks = test.MarksPerCorrect
			correctCount++
		} else {
			marks = test.MarksPerWrong
			wrongCount++
		}
		totalScore += marks

		// Update the answer record
		s.DB.WithContext(ctx).Model(ans).Updates(map[string]interface{}{
			"is_correct":    isCorrect,
			"marks_awarded": marks,
		})
	}

	// Update attempt
	attempt.Status = models.AttemptSubmitted
	attempt.SubmittedAt = &now
	attempt.TimeTakenSeconds = timeTakenSeconds
	attempt.Score = &totalScore
	attempt.TotalMarks = &totalMarks
	attempt.CorrectCount = &correctCount
	attempt.WrongCount = &wrongCount
	attempt.UnattemptedCount = &unattemptedCount

	if err := s.DB.WithContext(ctx).Save(&attempt).Error; err != nil {
		return nil, fmt.Errorf("saving attempt: %w", err)
	}

	return &attempt, nil
}

// GetOrCreateAttempt starts a new attempt or returns an existing in-progress one.
func (s *ScoringService) GetOrCreateAttempt(ctx context.Context, userID, testID uuid.UUID) (*models.StudentAttempt, error) {
	// Check for existing in-progress
	var existing models.StudentAttempt
	err := s.DB.WithContext(ctx).
		Where("user_id = ? AND test_id = ? AND status = ?", userID, testID, models.AttemptInProgress).
		First(&existing).Error
	if err == nil {
		return &existing, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("checking existing attempt: %w", err)
	}

	// Create new
	attempt := models.StudentAttempt{
		UserID:    userID,
		TestID:    testID,
		Status:    models.AttemptInProgress,
		StartedAt: time.Now(),
	}
	if err := s.DB.WithContext(ctx).Create(&attempt).Error; err != nil {
		return nil, fmt.Errorf("creating attempt: %w", err)
	}
	return &attempt, nil
}

// UpsertAnswer saves or updates a student's answer for a question in an attempt.
func (s *ScoringService) UpsertAnswer(ctx context.Context, attemptID, questionID uuid.UUID, selectedOption models.CorrectOption) error {
	now := time.Now()
	answer := models.AttemptAnswer{
		AttemptID:      attemptID,
		QuestionID:     questionID,
		SelectedOption: &selectedOption,
		AnsweredAt:     &now,
	}

	return s.DB.WithContext(ctx).
		Where("attempt_id = ? AND question_id = ?", attemptID, questionID).
		Assign(models.AttemptAnswer{SelectedOption: &selectedOption, AnsweredAt: &now}).
		FirstOrCreate(&answer).Error
}
