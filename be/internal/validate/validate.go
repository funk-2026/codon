// Package validate holds tiny, dependency-free input validators shared by
// handlers (enum membership, bounded lists, string caps).
package validate

import (
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
)

var (
	ModuleTypes  = []string{"qbank", "test_series", "practice", "custom"}
	Difficulties = []string{"easy", "medium", "hard"}
	SourceTypes  = []string{"qbank", "practice", "test_series", "pyq", "other"}
	Modes        = []string{"exam", "tutor"}
	Confidences  = []string{"sure", "unsure", "guess"}
)

// OneOf reports whether v is in set.
func OneOf(v string, set []string) bool {
	for _, s := range set {
		if v == s {
			return true
		}
	}
	return false
}

// EnumErr returns a descriptive error when v is not in set.
func EnumErr(field, v string, set []string) error {
	if OneOf(v, set) {
		return nil
	}
	return fmt.Errorf("%s must be one of: %s", field, strings.Join(set, ", "))
}

// MaxLen checks rune length.
func MaxLen(field, v string, max int) error {
	if utf8.RuneCountInString(v) > max {
		return fmt.Errorf("%s must be at most %d characters", field, max)
	}
	return nil
}

// UUIDs parses a list of UUID strings, bounded in size.
func UUIDs(field string, in []string, max int) ([]uuid.UUID, error) {
	if len(in) > max {
		return nil, fmt.Errorf("%s: at most %d ids allowed", field, max)
	}
	out := make([]uuid.UUID, 0, len(in))
	for _, s := range in {
		u, err := uuid.Parse(s)
		if err != nil {
			return nil, fmt.Errorf("%s: invalid id %q", field, s)
		}
		out = append(out, u)
	}
	return out, nil
}
