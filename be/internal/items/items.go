// Package items is the single place that knows how to look up a "thing a
// student can bookmark, report or rate" (a question, test, content item, …),
// who authored it, and whether a given student has actually been exposed to it.
// Bookmarks, reports and ratings all authorise through here so the logic exists
// once.
package items

import (
	"context"

	"codon-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	Question      = "question"
	Test          = "test"
	Content       = "content"
	BrainHack     = "brain_hack"
	FlashcardDeck = "flashcard_deck"
	Flashcard     = "flashcard"
)

// Item is a resolved reference.
type Item struct {
	Type     string
	ID       uuid.UUID
	OwnerID  *uuid.UUID // author (teacher) if known
	CourseID *uuid.UUID
	TestID   *uuid.UUID // home test for questions
	Version  *int
}

// Resolve looks an item up. found=false means it doesn't exist / isn't public.
func Resolve(ctx context.Context, db *gorm.DB, typ string, id uuid.UUID) (Item, bool) {
	it := Item{Type: typ, ID: id}
	db = db.WithContext(ctx)
	switch typ {
	case Question:
		var q models.Question
		if db.First(&q, "id = ?", id).Error != nil {
			return it, false
		}
		var t models.Test
		if db.Select("id", "created_by", "course_id").First(&t, "id = ?", q.TestID).Error != nil {
			return it, false
		}
		it.OwnerID, it.CourseID, it.TestID, it.Version = &t.CreatedBy, &t.CourseID, &t.ID, &q.Version
	case Test:
		var t models.Test
		if db.Where("id = ? AND origin = ?", id, models.OriginAuthored).First(&t).Error != nil {
			return it, false
		}
		it.OwnerID, it.CourseID = &t.CreatedBy, &t.CourseID
	case Content:
		var c models.ContentItem
		if db.First(&c, "id = ?", id).Error != nil {
			return it, false
		}
		it.OwnerID, it.CourseID = &c.UploadedBy, &c.CourseID
	case BrainHack:
		var b models.BrainHack
		if db.First(&b, "id = ?", id).Error != nil {
			return it, false
		}
		it.OwnerID = &b.AuthorID
	case FlashcardDeck:
		var d models.FlashcardDeck
		if db.First(&d, "id = ?", id).Error != nil {
			return it, false
		}
		it.OwnerID, it.CourseID = &d.AuthorID, &d.CourseID
	case Flashcard:
		var c models.Flashcard
		if db.First(&c, "id = ?", id).Error != nil {
			return it, false
		}
		var d models.FlashcardDeck
		if db.First(&d, "id = ?", c.DeckID).Error != nil {
			return it, false
		}
		it.OwnerID, it.CourseID = &d.AuthorID, &d.CourseID
	default:
		return it, false
	}
	return it, true
}

// Known reports whether typ is a supported item type.
func Known(typ string) bool {
	switch typ {
	case Question, Test, Content, BrainHack, FlashcardDeck, Flashcard:
		return true
	}
	return false
}

// Exposed reports whether the user has actually met the item: for questions,
// an answer row in one of their attempts. This is the anti-scrape rule — you
// can't bookmark/report/rate what you were never shown, so the pool can't be
// enumerated by guessing ids. Non-question items are always "exposed".
func Exposed(ctx context.Context, db *gorm.DB, userID uuid.UUID, typ string, id uuid.UUID) bool {
	if typ != Question {
		return true
	}
	var n int64
	db.WithContext(ctx).Table("attempt_answers aa").
		Joins("JOIN student_attempts sa ON sa.id = aa.attempt_id").
		Where("sa.user_id = ? AND aa.question_id = ?", userID, id).Count(&n)
	return n > 0
}

// AnswerRevealed reports whether the user may see the key/explanation of a
// question: it appeared in one of their SUBMITTED attempts, or was revealed in
// tutor mode.
func AnswerRevealed(ctx context.Context, db *gorm.DB, userID, questionID uuid.UUID) bool {
	var n int64
	db.WithContext(ctx).Table("attempt_answers aa").
		Joins("JOIN student_attempts sa ON sa.id = aa.attempt_id").
		Where("sa.user_id = ? AND aa.question_id = ? AND (sa.status = 'submitted' OR aa.revealed_at IS NOT NULL)", userID, questionID).Count(&n)
	return n > 0
}

// Cleanup removes bookmarks, reports and ratings that point at a deleted item.
func Cleanup(tx *gorm.DB, typ string, id uuid.UUID) error {
	for _, t := range []string{"bookmarks", "content_reports", "ratings"} {
		if err := tx.Exec("DELETE FROM "+t+" WHERE item_type = ? AND item_id = ?", typ, id).Error; err != nil {
			return err
		}
	}
	return nil
}
