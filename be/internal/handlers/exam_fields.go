package handlers

import (
	"net/http"
	"time"

	"codon-backend/internal/models"
	"codon-backend/internal/services"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// examFieldsRequest carries the exam settings of a test. Every field is optional; absent means unchanged.
type examFieldsRequest struct {
	ExamStyle        *string    `json:"exam_style"`
	Kind             *string    `json:"kind"`
	Delivery         *string    `json:"delivery"`
	OpensAt          *time.Time `json:"opens_at"`
	LateEntryMinutes *int       `json:"late_entry_minutes"`
	ResultsAt        *time.Time `json:"results_at"`
	RankVisibility   *string    `json:"rank_visibility"`
	SeriesID         *string    `json:"series_id"` // "" removes it
	ExamYear         *int       `json:"exam_year"`
}

func oneOfStr(v string, allowed ...string) bool {
	for _, a := range allowed {
		if v == a {
			return true
		}
	}
	return false
}

// applyExamFields copies the request onto the test and checks the combination is sensible. Rules:
// school tests are anytime only; a live test needs a start in the future and a duration; late entry fits inside the
// exam; results open no earlier than the platform minimum after the window closes (and default to that).
func applyExamFields(db *gorm.DB, t *models.Test, r examFieldsRequest, now time.Time) *services.CodedError {
	bad := func(code, msg string) *services.CodedError { return services.Coded(http.StatusBadRequest, code, msg) }
	if r.ExamStyle != nil {
		if !oneOfStr(*r.ExamStyle, models.ExamStyleNEET, models.ExamStyleSchool) {
			return bad("invalid_exam_style", "exam_style must be neet or school")
		}
		t.ExamStyle = *r.ExamStyle
	}
	if r.Kind != nil {
		if !oneOfStr(*r.Kind, models.KindChapter, models.KindSubject, models.KindPart, models.KindFull, models.KindPYQ) {
			return bad("invalid_kind", "kind must be chapter, subject, part, full or pyq")
		}
		t.Kind = *r.Kind
	}
	if r.Delivery != nil {
		if !oneOfStr(*r.Delivery, models.DeliveryAnytime, models.DeliveryLive) {
			return bad("invalid_delivery", "delivery must be anytime or live")
		}
		t.Delivery = *r.Delivery
	}
	if r.RankVisibility != nil {
		if !oneOfStr(*r.RankVisibility, models.RankEveryone, models.RankSubscribers) {
			return bad("invalid_rank_visibility", "rank_visibility must be everyone or subscribers")
		}
		t.RankVisibility = *r.RankVisibility
	}
	if r.LateEntryMinutes != nil {
		if *r.LateEntryMinutes < 0 || *r.LateEntryMinutes > 240 {
			return bad("invalid_late_entry", "late entry must be between 0 and 240 minutes")
		}
		t.LateEntryMinutes = *r.LateEntryMinutes
	}
	if r.OpensAt != nil {
		t.OpensAt = r.OpensAt
	}
	if r.ResultsAt != nil {
		t.ResultsAt = r.ResultsAt
	}
	if r.ExamYear != nil {
		if *r.ExamYear < 1990 || *r.ExamYear > 2100 {
			return bad("invalid_exam_year", "exam_year is not a real year")
		}
		t.ExamYear = r.ExamYear
	}
	if r.SeriesID != nil {
		if *r.SeriesID == "" {
			t.SeriesID = nil
		} else {
			sid, err := uuid.Parse(*r.SeriesID)
			if err != nil {
				return bad("invalid_series", "invalid series_id")
			}
			var s models.TestSeries
			if db.First(&s, "id = ?", sid).Error != nil || s.CourseID != t.CourseID {
				return bad("invalid_series", "that series does not exist in this course")
			}
			t.SeriesID = &sid
		}
	}

	if t.Delivery == models.DeliveryLive {
		if t.ExamStyle == models.ExamStyleSchool {
			return bad("school_anytime_only", "school tests are anytime only")
		}
		if t.DurationMinutes == nil || *t.DurationMinutes <= 0 {
			return bad("duration_required", "a live test needs a duration")
		}
		if t.OpensAt == nil {
			return bad("opens_at_required", "a live test needs a start time")
		}
		if r.OpensAt != nil && !t.OpensAt.After(now) {
			return bad("opens_at_past", "the start time must be in the future")
		}
		if t.LateEntryMinutes > *t.DurationMinutes {
			return bad("invalid_late_entry", "late entry cannot be longer than the exam")
		}
		if earliest, ok := services.EarliestResults(t); ok {
			if t.ResultsAt == nil || t.ResultsAt.Before(earliest) {
				if r.ResultsAt != nil {
					return bad("results_too_early", "results must open at least "+services.MinResultGap().String()+" after the exam ends")
				}
				t.ResultsAt = &earliest
			}
		}
	} else {
		t.OpensAt, t.ResultsAt = nil, nil
	}
	return nil
}
