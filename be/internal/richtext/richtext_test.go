package richtext

import (
	"encoding/json"
	"math/rand"
	"os"
	"reflect"
	"sort"
	"strings"
	"testing"
)

type vector struct {
	Name   string        `json:"name"`
	Format string        `json:"format"`
	Input  string        `json:"input"`
	AST    []interface{} `json:"ast"`
	Plain  string        `json:"plain"`
	Refs   []string      `json:"refs"`
	Issues []string      `json:"issues"`
}

func loadVectors(t *testing.T) []vector {
	t.Helper()
	b, err := os.ReadFile("../../../contracts/rich-text-v1/vectors.json")
	if err != nil {
		t.Fatalf("read vectors: %v", err)
	}
	var f struct {
		Vectors []vector `json:"vectors"`
	}
	if err := json.Unmarshal(b, &f); err != nil {
		t.Fatal(err)
	}
	return f.Vectors
}

func TestGoldenVectors(t *testing.T) {
	for _, v := range loadVectors(t) {
		t.Run(v.Name, func(t *testing.T) {
			got := Parse(v.Input, v.Format)
			raw, _ := json.Marshal(got)
			var gotAny []interface{}
			json.Unmarshal(raw, &gotAny)
			want := v.AST
			if want == nil {
				want = []interface{}{}
			}
			if gotAny == nil {
				gotAny = []interface{}{}
			}
			if !reflect.DeepEqual(gotAny, want) {
				t.Errorf("AST mismatch\n got: %s\nwant: %s", raw, mustJSON(want))
			}
			if p := PlainText(v.Input, v.Format); p != v.Plain {
				t.Errorf("plain = %q, want %q", p, v.Plain)
			}
			var refs []string
			for _, id := range ExtractMediaRefs(v.Format, v.Input) {
				refs = append(refs, id.String())
			}
			if len(refs) != len(v.Refs) || (len(refs) > 0 && !reflect.DeepEqual(refs, v.Refs)) {
				t.Errorf("refs = %v, want %v", refs, v.Refs)
			}
			if v.Issues != nil {
				var codes []string
				for _, is := range Validate(v.Input, v.Format, Limits{}) {
					codes = append(codes, is.Code)
				}
				sort.Strings(codes)
				want := append([]string{}, v.Issues...)
				sort.Strings(want)
				if !reflect.DeepEqual(codes, want) {
					t.Errorf("issues = %v, want %v", codes, want)
				}
			}
		})
	}
}

func mustJSON(v interface{}) string { b, _ := json.Marshal(v); return string(b) }

func TestValidateLimits(t *testing.T) {
	long := strings.Repeat("a", 51)
	if is := Validate(long, FormatRichV1, Limits{MaxChars: 50}); len(is) != 1 || is[0].Code != "TOO_LONG" {
		t.Fatalf("want TOO_LONG, got %v", is)
	}
	img := "![a](media:11111111-1111-1111-1111-111111111111) ![b](media:22222222-2222-2222-2222-222222222222)"
	if is := Validate(img, FormatRichV1, Limits{MaxImages: 1}); len(is) != 1 || is[0].Code != "TOO_MANY_IMAGES" {
		t.Fatalf("want TOO_MANY_IMAGES, got %v", is)
	}
	// legacy plain text with markup-looking characters is only length-checked
	if is := Validate("<script>x</script> $5", FormatPlain, Limits{MaxChars: 100}); len(is) != 0 {
		t.Fatalf("plain content must not be interpreted, got %v", is)
	}
}

func TestNormalizeIgnoresMarkupAndCase(t *testing.T) {
	a := Normalize("Find **the**   Value of $x$", FormatRichV1)
	b := Normalize("find the value of x", FormatPlain)
	if a != b {
		t.Fatalf("normalize mismatch: %q vs %q", a, b)
	}
}

func TestHasText(t *testing.T) {
	if HasText("   ", FormatRichV1) || HasText("", FormatPlain) {
		t.Fatal("blank must have no text")
	}
	if !HasText("![](media:11111111-1111-1111-1111-111111111111)", FormatRichV1) {
		t.Fatal("an image-only option counts as content")
	}
}

// The parser must never panic, whatever it is fed.
func TestFuzzNoPanic(t *testing.T) {
	alphabet := []rune("ab *_~^$!\\[]()\n-1.:media<>/")
	r := rand.New(rand.NewSource(1))
	for i := 0; i < 20000; i++ {
		n := r.Intn(40)
		var sb strings.Builder
		for j := 0; j < n; j++ {
			sb.WriteRune(alphabet[r.Intn(len(alphabet))])
		}
		s := sb.String()
		Parse(s, FormatRichV1)
		PlainText(s, FormatRichV1)
		Normalize(s, FormatRichV1)
		Validate(s, FormatRichV1, Limits{MaxChars: 30, MaxImages: 2})
	}
}
