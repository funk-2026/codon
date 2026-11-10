package services

import (
	"context"

	"codon-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ResolveTaxonomy validates a (course, subject, chapter) selection: the course
// must exist, a subject must belong to the course, a chapter to the subject.
// A chapter alone implies its subject. It returns the course (for its
// defaults) and the resolved subject/chapter ids.
func ResolveTaxonomy(ctx context.Context, db *gorm.DB, courseID uuid.UUID, subjectID, chapterID *uuid.UUID) (models.Course, *uuid.UUID, *uuid.UUID, error) {
	db = db.WithContext(ctx)
	var course models.Course
	if err := db.First(&course, "id = ?", courseID).Error; err != nil {
		return course, nil, nil, Invalid("unknown_course", "course not found")
	}
	if chapterID != nil {
		var ch models.Chapter
		if err := db.Preload("Subject").First(&ch, "id = ?", *chapterID).Error; err != nil {
			return course, nil, nil, Invalid("unknown_chapter", "chapter not found")
		}
		if ch.Subject.CourseID != courseID {
			return course, nil, nil, Invalid("chapter_course_mismatch", "chapter belongs to a different course")
		}
		if subjectID != nil && *subjectID != ch.SubjectID {
			return course, nil, nil, Invalid("chapter_subject_mismatch", "chapter does not belong to the given subject")
		}
		sid := ch.SubjectID
		return course, &sid, chapterID, nil
	}
	if subjectID != nil {
		var sub models.Subject
		if err := db.First(&sub, "id = ?", *subjectID).Error; err != nil {
			return course, nil, nil, Invalid("unknown_subject", "subject not found")
		}
		if sub.CourseID != courseID {
			return course, nil, nil, Invalid("subject_course_mismatch", "subject belongs to a different course")
		}
	}
	return course, subjectID, nil, nil
}
