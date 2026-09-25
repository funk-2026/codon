// Package blueprint defines the custom-test "blueprint": a declarative,
// versioned description of what a student asked for (filters, count, mix,
// mode, timing, marking). It is pure — no database access — so it can be
// validated, migrated and golden-tested in isolation.
package blueprint

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"codon-backend/internal/validate"

	"github.com/google/uuid"
)

const CurrentVersion = 1

type NCERT struct {
	Class    *int `json:"class,omitempty"`
	PageFrom *int `json:"page_from,omitempty"`
	PageTo   *int `json:"page_to,omitempty"`
}

type Filters struct {
	SubjectIDs                []uuid.UUID `json:"subject_ids,omitempty"`
	ChapterIDs                []uuid.UUID `json:"chapter_ids,omitempty"`
	TopicIDs                  []uuid.UUID `json:"topic_ids,omitempty"`
	Difficulty                []string    `json:"difficulty,omitempty"`
	Status                    []string    `json:"status,omitempty"`
	BookmarkCollectionIDs     []uuid.UUID `json:"bookmark_collection_ids,omitempty"`
	TagIDs                    []uuid.UUID `json:"tag_ids,omitempty"`
	ExcludeTagIDs             []uuid.UUID `json:"exclude_tag_ids,omitempty"`
	SourceTypes               []string    `json:"source_types,omitempty"`
	NCERT                     *NCERT      `json:"ncert,omitempty"`
	ExcludeAttemptedWithinDay int         `json:"exclude_attempted_within_days,omitempty"`
}

type Timing struct {
	Timed           bool `json:"timed"`
	DurationMinutes int  `json:"duration_minutes,omitempty"`
}

type Marking struct {
	Preset  string   `json:"preset,omitempty"`
	Correct *float64 `json:"correct,omitempty"`
	Wrong   *float64 `json:"wrong,omitempty"`
}

type Blueprint struct {
	SchemaVersion  int                `json:"schema_version"`
	CourseID       uuid.UUID          `json:"course_id"`
	Title          string             `json:"title,omitempty"`
	Filters        Filters            `json:"filters"`
	Count          int                `json:"count"`
	DifficultyMix  map[string]float64 `json:"difficulty_mix,omitempty"`
	SubjectWeights json.RawMessage    `json:"subject_weights,omitempty"` // "even" | "proportional" | {"<subject_id>": weight}
	Order          string             `json:"order,omitempty"`
	Strategy       string             `json:"strategy,omitempty"`
	Fallback       string             `json:"fallback,omitempty"` // "fewer" (default) | "fail"
	Mode           string             `json:"mode,omitempty"`
	Timing         Timing             `json:"timing"`
	Marking        Marking            `json:"marking"`
	Seed           *int64             `json:"seed,omitempty"`
}

var (
	Statuses   = []string{"unattempted", "incorrect", "correct", "bookmarked"}
	Orders     = []string{"random", "syllabus", "easy_first", "hard_first", "unattempted_first"}
	Strategies = []string{"random", "weak_first", "unseen_first", "spaced"}
	Fallbacks  = []string{"fewer", "fail"}
)

// Limits are the admin-tunable bounds a blueprint is validated against.
type Limits struct {
	MinQuestions, MaxQuestions int
	MinDuration, MaxDuration   int
	AllowedSources             []string // sources the pool may draw from
	TutorEnabled               bool
	StatusFiltersEnabled       bool
}

// Issue is one validation failure.
type Issue struct {
	Field   string `json:"field"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (i Issue) Error() string { return i.Field + ": " + i.Message }

// Parse decodes a blueprint. Unknown top-level fields are ignored (forward
// compatibility) but unknown keys inside `filters` are rejected. Old schema
// versions are migrated forward; a newer version than we know is an error.
func Parse(raw []byte) (Blueprint, []Issue) {
	var bp Blueprint
	if err := json.Unmarshal(raw, &bp); err != nil {
		return bp, []Issue{{"", "invalid_json", "blueprint is not valid JSON: " + err.Error()}}
	}
	var probe struct {
		Filters json.RawMessage `json:"filters"`
	}
	_ = json.Unmarshal(raw, &probe)
	if len(probe.Filters) > 0 && string(probe.Filters) != "null" {
		dec := json.NewDecoder(bytes.NewReader(probe.Filters))
		dec.DisallowUnknownFields()
		var f Filters
		if err := dec.Decode(&f); err != nil {
			return bp, []Issue{{"filters", "unknown_filter", "unsupported filter: " + err.Error()}}
		}
	}
	if bp.SchemaVersion == 0 {
		bp.SchemaVersion = 1
	}
	if bp.SchemaVersion > CurrentVersion {
		return bp, []Issue{{"schema_version", "unsupported_schema_version", fmt.Sprintf("blueprint version %d is newer than this server understands (%d)", bp.SchemaVersion, CurrentVersion)}}
	}
	bp.SchemaVersion = CurrentVersion
	return bp, nil
}

func maxIDs(field string, n int, issues *[]Issue) {
	if n > 200 {
		*issues = append(*issues, Issue{field, "too_many", "at most 200 ids allowed"})
	}
}

// Normalize validates the blueprint against lim and fills every default, so
// the stored/snapshotted blueprint is fully resolved.
func Normalize(bp *Blueprint, lim Limits) []Issue {
	var is []Issue
	add := func(field, code, msg string) { is = append(is, Issue{field, code, msg}) }

	if bp.CourseID == uuid.Nil {
		add("course_id", "required", "course_id is required")
	}
	if len([]rune(bp.Title)) > 120 {
		add("title", "too_long", "title must be at most 120 characters")
	}
	bp.Title = strings.TrimSpace(bp.Title)

	f := &bp.Filters
	maxIDs("filters.subject_ids", len(f.SubjectIDs), &is)
	maxIDs("filters.chapter_ids", len(f.ChapterIDs), &is)
	maxIDs("filters.topic_ids", len(f.TopicIDs), &is)
	maxIDs("filters.tag_ids", len(f.TagIDs), &is)
	maxIDs("filters.exclude_tag_ids", len(f.ExcludeTagIDs), &is)
	for _, d := range f.Difficulty {
		if !validate.OneOf(d, validate.Difficulties) {
			add("filters.difficulty", "bad_enum", "difficulty must be easy, medium or hard")
		}
	}
	for _, s := range f.Status {
		if !validate.OneOf(s, Statuses) {
			add("filters.status", "bad_enum", "status must be one of "+strings.Join(Statuses, ", "))
		}
	}
	if len(f.Status) > 0 && !lim.StatusFiltersEnabled {
		add("filters.status", "filter_unavailable", "question-status filters are not enabled yet")
	}
	if len(f.BookmarkCollectionIDs) > 0 && !validate.OneOf("bookmarked", f.Status) {
		add("filters.bookmark_collection_ids", "needs_bookmarked_status", "bookmark_collection_ids only applies together with status \"bookmarked\"")
	}
	// sources: intersect with what the pool is allowed to draw from
	for _, st := range f.SourceTypes {
		if !validate.OneOf(st, validate.SourceTypes) {
			add("filters.source_types", "bad_enum", "unknown source type: "+st)
		} else if !validate.OneOf(st, lim.AllowedSources) {
			add("filters.source_types", "source_not_allowed", st+" questions are not available for custom tests")
		}
	}
	if n := f.NCERT; n != nil {
		if n.PageFrom != nil && n.PageTo != nil && *n.PageFrom > *n.PageTo {
			add("filters.ncert", "bad_range", "page_from must be <= page_to")
		}
		if n.Class != nil && (*n.Class < 1 || *n.Class > 12) {
			add("filters.ncert.class", "out_of_range", "class must be between 1 and 12")
		}
	}
	if f.ExcludeAttemptedWithinDay < 0 || f.ExcludeAttemptedWithinDay > 365 {
		add("filters.exclude_attempted_within_days", "out_of_range", "must be between 0 and 365")
	}

	if bp.Count < lim.MinQuestions || bp.Count > lim.MaxQuestions {
		add("count", "out_of_range", fmt.Sprintf("count must be between %d and %d", lim.MinQuestions, lim.MaxQuestions))
	}
	if len(bp.DifficultyMix) > 0 {
		sum := 0.0
		for k, v := range bp.DifficultyMix {
			if !validate.OneOf(k, validate.Difficulties) || v < 0 || v > 1 {
				add("difficulty_mix", "invalid", "mix keys are easy/medium/hard with weights between 0 and 1")
			}
			sum += v
		}
		if math.Abs(sum-1) > 0.02 {
			add("difficulty_mix", "must_sum_to_one", "difficulty_mix weights must add up to 1")
		}
	}
	if len(bp.SubjectWeights) > 0 {
		var mode string
		if json.Unmarshal(bp.SubjectWeights, &mode) == nil {
			if mode != "even" && mode != "proportional" {
				add("subject_weights", "invalid", `subject_weights must be "even", "proportional" or a map of subject id → weight`)
			}
		} else {
			var m map[string]float64
			if err := json.Unmarshal(bp.SubjectWeights, &m); err != nil {
				add("subject_weights", "invalid", "subject_weights must be a map of subject id → weight")
			}
			for k, v := range m {
				if _, err := uuid.Parse(k); err != nil || v < 0 {
					add("subject_weights", "invalid", "weights are keyed by subject uuid with values >= 0")
				}
			}
		}
	}
	if bp.Order == "" {
		bp.Order = "random"
	}
	if !validate.OneOf(bp.Order, Orders) {
		add("order", "bad_enum", "order must be one of "+strings.Join(Orders, ", "))
	}
	if bp.Strategy == "" {
		bp.Strategy = "random"
	}
	if !validate.OneOf(bp.Strategy, Strategies) {
		add("strategy", "bad_enum", "strategy must be one of "+strings.Join(Strategies, ", "))
	}
	if bp.Fallback == "" {
		bp.Fallback = "fewer"
	}
	if !validate.OneOf(bp.Fallback, Fallbacks) {
		add("fallback", "bad_enum", "fallback must be fewer or fail")
	}
	if bp.Mode == "" {
		bp.Mode = "exam"
	}
	if !validate.OneOf(bp.Mode, validate.Modes) {
		add("mode", "bad_enum", "mode must be exam or tutor")
	} else if bp.Mode == "tutor" && !lim.TutorEnabled {
		add("mode", "mode_unavailable", "tutor mode is not enabled yet")
	}

	if bp.Timing.Timed {
		if bp.Timing.DurationMinutes < lim.MinDuration || bp.Timing.DurationMinutes > lim.MaxDuration {
			add("timing.duration_minutes", "out_of_range", fmt.Sprintf("duration must be between %d and %d minutes", lim.MinDuration, lim.MaxDuration))
		}
	} else {
		bp.Timing.DurationMinutes = 0
	}

	switch bp.Marking.Preset {
	case "", "neet":
		bp.Marking.Preset = "neet"
		c, w := 4.0, -1.0
		bp.Marking.Correct, bp.Marking.Wrong = &c, &w
	case "no_negative":
		c, w := 1.0, 0.0
		bp.Marking.Correct, bp.Marking.Wrong = &c, &w
	case "custom":
		if bp.Marking.Correct == nil || bp.Marking.Wrong == nil {
			add("marking", "required", "custom marking needs correct and wrong")
		} else if *bp.Marking.Correct <= 0 || *bp.Marking.Correct > 10 || *bp.Marking.Wrong > 0 || *bp.Marking.Wrong < -10 {
			add("marking", "out_of_range", "correct must be in (0, 10] and wrong in [-10, 0]")
		}
	default:
		add("marking.preset", "bad_enum", "preset must be neet, no_negative or custom")
	}
	return is
}

// Marks returns the resolved (correct, wrong) marks of a normalised blueprint.
func (b Blueprint) Marks() (float64, float64) {
	c, w := 4.0, -1.0
	if b.Marking.Correct != nil {
		c = *b.Marking.Correct
	}
	if b.Marking.Wrong != nil {
		w = *b.Marking.Wrong
	}
	return c, w
}

// SubjectWeightMode returns "even", "proportional", "custom" or "" (none).
func (b Blueprint) SubjectWeightMode() (string, map[uuid.UUID]float64) {
	if len(b.SubjectWeights) == 0 {
		return "", nil
	}
	var mode string
	if json.Unmarshal(b.SubjectWeights, &mode) == nil {
		return mode, nil
	}
	var m map[string]float64
	_ = json.Unmarshal(b.SubjectWeights, &m)
	out := map[uuid.UUID]float64{}
	for k, v := range m {
		if id, err := uuid.Parse(k); err == nil {
			out[id] = v
		}
	}
	return "custom", out
}

// JSON returns the canonical stored form.
func (b Blueprint) JSON() []byte {
	out, _ := json.Marshal(b)
	return out
}
