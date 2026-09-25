// Package richtext implements "rich text v1": a small, CLOSED subset of
// markdown used for question stems, options, explanations and other authored
// content. There is no HTML and no link syntax, so there is no injection
// surface; unknown syntax degrades to literal text.
//
// The grammar and golden test vectors live in contracts/rich-text-v1 and are
// shared with the mobile app's parser so the two can never drift.
package richtext

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
	"golang.org/x/text/unicode/norm"
)

const (
	FormatPlain  = "plain"
	FormatRichV1 = "rich_v1"
)

// Node is one AST node (block or inline). Field use depends on Type:
//
//	blocks : paragraph{Children} · list{Ordered,Items} · math_block{Tex} · image_block{MediaID,Alt}
//	inlines: text{Text,Bold,Italic} · sub{Text} · sup{Text} · math{Tex} · image{MediaID,Alt} · break
type Node struct {
	Type     string   `json:"type"`
	Text     string   `json:"text,omitempty"`
	Bold     bool     `json:"bold,omitempty"`
	Italic   bool     `json:"italic,omitempty"`
	Tex      string   `json:"tex,omitempty"`
	MediaID  string   `json:"media_id,omitempty"`
	Alt      string   `json:"alt,omitempty"`
	Ordered  bool     `json:"ordered,omitempty"`
	Children []Node   `json:"children,omitempty"`
	Items    [][]Node `json:"items,omitempty"`
}

// Parse returns the block AST. Plain-format content is a single text paragraph
// (never interpreted). Parse never fails.
func Parse(text, format string) []Node {
	if format != FormatRichV1 {
		if text == "" {
			return []Node{}
		}
		return []Node{{Type: "paragraph", Children: []Node{{Type: "text", Text: text}}}}
	}
	return parseBlocks(strings.ReplaceAll(text, "\r\n", "\n"))
}

var (
	listRe  = regexp.MustCompile(`^\s{0,3}(?:([-*])|(\d{1,3})\.)\s+(.*)$`)
	imageRe = regexp.MustCompile(`^!\[([^\]]*)\]\(media:([0-9a-fA-F-]{36})\)$`)
)

func parseBlocks(text string) []Node {
	lines := strings.Split(text, "\n")
	blocks := []Node{}
	var para []string
	var list *Node

	flushPara := func() {
		if len(para) == 0 {
			return
		}
		joined := strings.Join(para, "\n")
		para = nil
		trimmed := strings.TrimSpace(joined)
		if m := imageRe.FindStringSubmatch(trimmed); m != nil {
			if _, err := uuid.Parse(m[2]); err == nil {
				blocks = append(blocks, Node{Type: "image_block", MediaID: strings.ToLower(m[2]), Alt: m[1]})
				return
			}
		}
		blocks = append(blocks, Node{Type: "paragraph", Children: parseInline(joined, false, false)})
	}
	flushList := func() {
		if list != nil {
			blocks = append(blocks, *list)
			list = nil
		}
	}

	for i := 0; i < len(lines); i++ {
		line := lines[i]
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			flushPara()
			flushList()
			continue
		}
		// Block math: $$ … $$ (single or multi-line).
		if strings.HasPrefix(trimmed, "$$") {
			rest := trimmed[2:]
			if end := strings.Index(rest, "$$"); end >= 0 && strings.TrimSpace(rest[end+2:]) == "" {
				if tex := strings.TrimSpace(rest[:end]); tex != "" {
					flushPara()
					flushList()
					blocks = append(blocks, Node{Type: "math_block", Tex: tex})
					continue
				}
			} else if end < 0 {
				// multi-line: look ahead for a line ending with $$
				var buf []string
				buf = append(buf, rest)
				closed := false
				j := i + 1
				for ; j < len(lines); j++ {
					lt := strings.TrimSpace(lines[j])
					if strings.HasSuffix(lt, "$$") {
						buf = append(buf, strings.TrimSuffix(lt, "$$"))
						closed = true
						break
					}
					buf = append(buf, lines[j])
				}
				if tex := strings.TrimSpace(strings.Join(buf, "\n")); closed && tex != "" {
					flushPara()
					flushList()
					blocks = append(blocks, Node{Type: "math_block", Tex: tex})
					i = j
					continue
				}
			}
		}
		if m := listRe.FindStringSubmatch(line); m != nil {
			flushPara()
			ordered := m[2] != ""
			if list == nil || list.Ordered != ordered {
				flushList()
				list = &Node{Type: "list", Ordered: ordered}
			}
			list.Items = append(list.Items, parseInline(m[3], false, false))
			continue
		}
		flushList()
		para = append(para, line)
	}
	flushPara()
	flushList()
	return blocks
}

func isSpace(b byte) bool { return b == ' ' || b == '\t' || b == '\n' }

// escapable are the characters a backslash may escape.
const escapable = "\\*~^$![]_"

func parseInline(s string, bold, italic bool) []Node {
	var out []Node
	var buf strings.Builder
	flush := func() {
		if buf.Len() > 0 {
			out = append(out, Node{Type: "text", Text: buf.String(), Bold: bold, Italic: italic})
			buf.Reset()
		}
	}
	i := 0
	for i < len(s) {
		c := s[i]
		switch {
		case c == '\\' && i+1 < len(s) && strings.IndexByte(escapable, s[i+1]) >= 0:
			buf.WriteByte(s[i+1])
			i += 2
		case c == '\n':
			flush()
			out = append(out, Node{Type: "break"})
			i++
		case c == '!' && i+1 < len(s) && s[i+1] == '[':
			if n, node := tryImage(s[i:]); n > 0 {
				flush()
				out = append(out, node)
				i += n
			} else {
				buf.WriteByte(c)
				i++
			}
		case c == '*' && i+1 < len(s) && s[i+1] == '*':
			if j := findClose(s, i+2, "**"); j > 0 {
				flush()
				out = append(out, parseInline(s[i+2:j], true, italic)...)
				i = j + 2
			} else {
				buf.WriteString("**")
				i += 2
			}
		case c == '*':
			if j := findItalicClose(s, i+1); j > 0 {
				flush()
				out = append(out, parseInline(s[i+1:j], bold, true)...)
				i = j + 1
			} else {
				buf.WriteByte(c)
				i++
			}
		case c == '~' || c == '^':
			if j := findScript(s, i+1, c); j > 0 {
				flush()
				t := "sub"
				if c == '^' {
					t = "sup"
				}
				out = append(out, Node{Type: t, Text: s[i+1 : j]})
				i = j + 1
			} else {
				buf.WriteByte(c)
				i++
			}
		case c == '$':
			if j := findMathClose(s, i+1); j > 0 {
				flush()
				out = append(out, Node{Type: "math", Tex: s[i+1 : j]})
				i = j + 1
			} else {
				buf.WriteByte(c)
				i++
			}
		default:
			buf.WriteByte(c)
			i++
		}
	}
	flush()
	return mergeText(out)
}

// findClose finds a closing delimiter d at or after start; content must be
// non-empty, not start with a space, and not end with one.
func findClose(s string, start int, d string) int {
	if start >= len(s) || isSpace(s[start]) {
		return -1
	}
	for j := start + 1; j+len(d) <= len(s); j++ {
		if s[j] == '\\' {
			j++
			continue
		}
		if strings.HasPrefix(s[j:], d) && !isSpace(s[j-1]) {
			return j
		}
	}
	return -1
}

func findItalicClose(s string, start int) int {
	if start >= len(s) || isSpace(s[start]) || s[start] == '*' {
		return -1
	}
	for j := start + 1; j < len(s); j++ {
		if s[j] == '\\' {
			j++
			continue
		}
		if s[j] == '*' && !isSpace(s[j-1]) && s[j-1] != '*' && (j+1 >= len(s) || s[j+1] != '*') {
			return j
		}
	}
	return -1
}

// findScript: sub/sup content is a run of non-space chars up to the closing marker.
func findScript(s string, start int, marker byte) int {
	for j := start; j < len(s); j++ {
		if isSpace(s[j]) {
			return -1
		}
		if s[j] == marker {
			if j == start {
				return -1
			}
			return j
		}
	}
	return -1
}

func findMathClose(s string, start int) int {
	if start >= len(s) || isSpace(s[start]) || s[start] == '$' {
		return -1
	}
	for j := start + 1; j < len(s); j++ {
		if s[j] == '\n' {
			return -1
		}
		if s[j] == '\\' {
			j++
			continue
		}
		if s[j] == '$' && !isSpace(s[j-1]) {
			if j+1 < len(s) && s[j+1] >= '0' && s[j+1] <= '9' { // "$5 and $10" is currency
				continue
			}
			return j
		}
	}
	return -1
}

func tryImage(s string) (int, Node) {
	// s starts with "!["
	end := strings.Index(s, "](")
	if end < 0 || strings.ContainsAny(s[2:end], "]\n") {
		return 0, Node{}
	}
	closeIdx := strings.IndexByte(s[end+2:], ')')
	if closeIdx < 0 {
		return 0, Node{}
	}
	src := s[end+2 : end+2+closeIdx]
	if !strings.HasPrefix(src, "media:") {
		return 0, Node{}
	}
	id := strings.TrimPrefix(src, "media:")
	if _, err := uuid.Parse(id); err != nil {
		return 0, Node{}
	}
	return end + 2 + closeIdx + 1, Node{Type: "image", MediaID: strings.ToLower(id), Alt: s[2:end]}
}

func mergeText(in []Node) []Node {
	var out []Node
	for _, n := range in {
		if n.Type == "text" && len(out) > 0 {
			last := &out[len(out)-1]
			if last.Type == "text" && last.Bold == n.Bold && last.Italic == n.Italic {
				last.Text += n.Text
				continue
			}
		}
		out = append(out, n)
	}
	return out
}

// ── Projections ───────────────────────────────────────────────────────────────

// PlainText flattens content to searchable text: math becomes its TeX, images
// become "[image]", list items and paragraphs are newline separated.
func PlainText(text, format string) string {
	if format != FormatRichV1 {
		return text
	}
	var lines []string
	var inline func(ns []Node) string
	inline = func(ns []Node) string {
		var b strings.Builder
		for _, n := range ns {
			switch n.Type {
			case "text", "sub", "sup":
				b.WriteString(n.Text)
			case "math":
				b.WriteString(n.Tex)
			case "image":
				b.WriteString("[image]")
			case "break":
				b.WriteString("\n")
			}
		}
		return b.String()
	}
	for _, b := range Parse(text, format) {
		switch b.Type {
		case "paragraph":
			lines = append(lines, inline(b.Children))
		case "list":
			for _, it := range b.Items {
				lines = append(lines, inline(it))
			}
		case "math_block":
			lines = append(lines, b.Tex)
		case "image_block":
			lines = append(lines, "[image]")
		}
	}
	return strings.Join(lines, "\n")
}

var wsRe = regexp.MustCompile(`\s+`)

// Normalize is the canonical form used for content hashing: plain text,
// Unicode NFKC, lower-cased, whitespace collapsed.
func Normalize(text, format string) string {
	p := norm.NFKC.String(PlainText(text, format))
	return strings.TrimSpace(wsRe.ReplaceAllString(strings.ToLower(p), " "))
}

var refRe = regexp.MustCompile(`!\[[^\]]*\]\(media:([0-9a-fA-F-]{36})\)`)

// ExtractMediaRefs returns the unique media ids referenced by rich content.
// Plain-format content never references media.
func ExtractMediaRefs(format string, texts ...string) []uuid.UUID {
	if format != FormatRichV1 {
		return nil
	}
	seen := map[uuid.UUID]bool{}
	var out []uuid.UUID
	for _, t := range texts {
		for _, m := range refRe.FindAllStringSubmatch(t, -1) {
			id, err := uuid.Parse(m[1])
			if err != nil || seen[id] {
				continue
			}
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}

// CountImages counts image nodes in a rich-text value.
func CountImages(text string) int { return len(refRe.FindAllString(text, -1)) }

// ── Validation ────────────────────────────────────────────────────────────────

type Issue struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

var (
	htmlRe   = regexp.MustCompile(`(?i)<\s*/?\s*(script|iframe|object|embed|style|svg|img|a|link|meta|form|input|button|html|body|div|span|video|audio|source|base)\b`)
	schemeRe = regexp.MustCompile(`(?i)\]\(\s*(javascript|data|vbscript|https?|ftp|file):`)
	linkRe   = regexp.MustCompile(`(?:^|[^!])\[[^\]]*\]\(\s*[a-zA-Z][a-zA-Z0-9+.-]*://`)
	imgAnyRe = regexp.MustCompile(`!\[[^\]]*\]\(([^)]*)\)`)
)

// Limits bound a single field.
type Limits struct {
	MaxChars  int
	MaxImages int
}

// Validate checks a rich-text value against the closed grammar. Plain-format
// content is only length-checked (it is never interpreted).
func Validate(text, format string, lim Limits) []Issue {
	var issues []Issue
	if lim.MaxChars > 0 && utf8.RuneCountInString(text) > lim.MaxChars {
		issues = append(issues, Issue{"TOO_LONG", fmt.Sprintf("at most %d characters allowed", lim.MaxChars)})
	}
	if format != FormatRichV1 {
		return issues
	}
	if htmlRe.MatchString(text) {
		issues = append(issues, Issue{"HTML_NOT_ALLOWED", "raw HTML is not allowed"})
	}
	// Image syntax is checked separately below (UNKNOWN_MEDIA_SCHEME); strip it
	// here so an external image isn't reported twice as a "link".
	noImages := imgAnyRe.ReplaceAllString(text, "")
	if schemeRe.MatchString(noImages) || linkRe.MatchString(noImages) {
		issues = append(issues, Issue{"LINKS_NOT_ALLOWED", "links and external URLs are not allowed"})
	}
	imgs := 0
	for _, m := range imgAnyRe.FindAllStringSubmatch(text, -1) {
		imgs++
		src := strings.TrimSpace(m[1])
		if !strings.HasPrefix(src, "media:") {
			issues = append(issues, Issue{"UNKNOWN_MEDIA_SCHEME", "images must reference uploaded media (media:<id>)"})
			continue
		}
		if _, err := uuid.Parse(strings.TrimPrefix(src, "media:")); err != nil {
			issues = append(issues, Issue{"BAD_MEDIA_ID", "invalid media id"})
		}
	}
	if lim.MaxImages > 0 && imgs > lim.MaxImages {
		issues = append(issues, Issue{"TOO_MANY_IMAGES", fmt.Sprintf("at most %d images allowed here", lim.MaxImages)})
	}
	return issues
}

// HasText reports whether the value contains any visible content (text, math
// or an image) — used to reject empty stems/options.
func HasText(text, format string) bool {
	if strings.TrimSpace(text) == "" {
		return false
	}
	if format != FormatRichV1 {
		return true
	}
	for _, b := range Parse(text, format) {
		if b.Type == "image_block" || b.Type == "math_block" {
			return true
		}
		if strings.IndexFunc(PlainText(text, format), func(r rune) bool { return !unicode.IsSpace(r) }) >= 0 {
			return true
		}
	}
	return false
}
