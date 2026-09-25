package blueprint

import (
	"encoding/json"
	"os"
	"reflect"
	"sort"
	"testing"
)

type vec struct {
	Name       string          `json:"name"`
	Input      json.RawMessage `json:"input"`
	Valid      bool            `json:"valid"`
	IssueCodes []string        `json:"issue_codes"`
	Resolved   *struct {
		SchemaVersion   int     `json:"schema_version"`
		Order           string  `json:"order"`
		Strategy        string  `json:"strategy"`
		Fallback        string  `json:"fallback"`
		Mode            string  `json:"mode"`
		MarkingCorrect  float64 `json:"marking_correct"`
		MarkingWrong    float64 `json:"marking_wrong"`
		DurationMinutes int     `json:"duration_minutes"`
	} `json:"resolved"`
}

func TestGoldenVectors(t *testing.T) {
	b, err := os.ReadFile("../../../contracts/blueprint-v1/vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	var f struct {
		Limits struct {
			MinQuestions         int      `json:"min_questions"`
			MaxQuestions         int      `json:"max_questions"`
			MinDuration          int      `json:"min_duration"`
			MaxDuration          int      `json:"max_duration"`
			AllowedSources       []string `json:"allowed_sources"`
			TutorEnabled         bool     `json:"tutor_enabled"`
			StatusFiltersEnabled bool     `json:"status_filters_enabled"`
		} `json:"limits"`
		Vectors []vec `json:"vectors"`
	}
	if err := json.Unmarshal(b, &f); err != nil {
		t.Fatal(err)
	}
	lim := Limits{f.Limits.MinQuestions, f.Limits.MaxQuestions, f.Limits.MinDuration, f.Limits.MaxDuration, f.Limits.AllowedSources, f.Limits.TutorEnabled, f.Limits.StatusFiltersEnabled}
	for _, v := range f.Vectors {
		t.Run(v.Name, func(t *testing.T) {
			bp, issues := Parse(v.Input)
			if len(issues) == 0 {
				issues = Normalize(&bp, lim)
			}
			var codes []string
			for _, i := range issues {
				codes = append(codes, i.Code)
			}
			sort.Strings(codes)
			want := append([]string{}, v.IssueCodes...)
			sort.Strings(want)
			if (len(issues) == 0) != v.Valid {
				t.Fatalf("valid=%v want %v (issues %v)", len(issues) == 0, v.Valid, codes)
			}
			if !v.Valid && !reflect.DeepEqual(dedupe(codes), dedupe(want)) {
				t.Fatalf("codes %v want %v", codes, want)
			}
			if v.Resolved != nil {
				c, w := bp.Marks()
				r := v.Resolved
				if bp.SchemaVersion != r.SchemaVersion || bp.Order != r.Order || bp.Strategy != r.Strategy || bp.Fallback != r.Fallback || bp.Mode != r.Mode ||
					c != r.MarkingCorrect || w != r.MarkingWrong || bp.Timing.DurationMinutes != r.DurationMinutes {
					t.Fatalf("resolved defaults: %+v marks %v/%v", bp, c, w)
				}
			}
		})
	}
}

func dedupe(in []string) []string {
	var out []string
	for i, s := range in {
		if i == 0 || s != in[i-1] {
			out = append(out, s)
		}
	}
	return out
}

func TestSubjectWeightModes(t *testing.T) {
	bp, _ := Parse([]byte(`{"course_id":"11111111-1111-1111-1111-111111111111","subject_weights":"even"}`))
	if m, _ := bp.SubjectWeightMode(); m != "even" {
		t.Fatal(m)
	}
	bp, _ = Parse([]byte(`{"subject_weights":{"22222222-2222-2222-2222-222222222222":2}}`))
	m, w := bp.SubjectWeightMode()
	if m != "custom" || len(w) != 1 {
		t.Fatal(m, w)
	}
}
