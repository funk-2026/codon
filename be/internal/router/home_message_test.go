package router_test

import (
	"strings"
	"testing"

	"codon-backend/internal/models"
)

func TestHomeMessageCard(t *testing.T) {
	e := newEnv(t)
	s, a := &e.w.Student, &e.w.Admin

	// nothing set: students get null, so the card is hidden
	if out := e.mustDo(200, "GET", "/home/message", s, nil); out["message"] != nil {
		t.Fatalf("expected no message, got %v", out)
	}
	// first save needs both fields
	if code, _ := e.do("PUT", "/admin/home-message", a, map[string]interface{}{"name": "Dr. Test"}); code != 400 {
		t.Fatalf("first save needs a quote: %d", code)
	}
	// too long
	long := strings.Repeat("word ", 61)
	if code, _ := e.do("PUT", "/admin/home-message", a, map[string]interface{}{"name": "Dr. Test", "quote": long}); code != 400 {
		t.Fatalf("quote over 60 words: %d", code)
	}
	// students and teachers cannot edit
	for _, u := range []*models.User{s, &e.w.Teacher} {
		if code, _ := e.do("PUT", "/admin/home-message", u, map[string]interface{}{"name": "x", "quote": "y"}); code != 403 {
			t.Fatalf("admin only: %d", code)
		}
	}
	e.mustDo(200, "PUT", "/admin/home-message", a, map[string]interface{}{"name": "Dr. Test", "quote": "Keep going. You are closer than you think."})
	got := e.mustDo(200, "GET", "/home/message", s, nil)
	if str(got, "message", "name") != "Dr. Test" {
		t.Fatalf("student sees the card: %v", got)
	}
	// switching it off hides it from students but not from the admin
	e.mustDo(200, "PUT", "/admin/home-message", a, map[string]interface{}{"is_active": false})
	if out := e.mustDo(200, "GET", "/home/message", s, nil); out["message"] != nil {
		t.Fatalf("hidden when off: %v", out)
	}
	if out := e.mustDo(200, "GET", "/admin/home-message", a, nil); str(out, "message", "name") != "Dr. Test" {
		t.Fatalf("admin still sees it: %v", out)
	}
}
