// Package pagination implements keyset (cursor) pagination on
// (created_at DESC, id DESC) — stable under concurrent inserts, unlike offsets.
package pagination

import (
	"encoding/base64"
	"encoding/json"
	"strconv"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	DefaultLimit = 25
	MaxLimit     = 100
)

type Cursor struct {
	T  time.Time `json:"t"`
	ID uuid.UUID `json:"i"`
}

func (c Cursor) Encode() string {
	b, _ := json.Marshal(c)
	return base64.RawURLEncoding.EncodeToString(b)
}

// Decode returns nil for an empty or malformed cursor (treated as page one).
func Decode(s string) *Cursor {
	if s == "" {
		return nil
	}
	b, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return nil
	}
	var c Cursor
	if json.Unmarshal(b, &c) != nil || c.ID == uuid.Nil {
		return nil
	}
	return &c
}

// Limit parses a ?limit= value, clamped to [1, MaxLimit].
func Limit(raw string) int {
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return DefaultLimit
	}
	if n > MaxLimit {
		return MaxLimit
	}
	return n
}

// Apply adds the keyset WHERE + ORDER + LIMIT(limit+1) to q for a table whose
// timestamp column is `<table>.created_at` and id column `<table>.id`.
func Apply(q *gorm.DB, table string, cur *Cursor, limit int) *gorm.DB {
	if cur != nil {
		q = q.Where("("+table+".created_at, "+table+".id) < (?, ?)", cur.T, cur.ID)
	}
	return q.Order(table + ".created_at DESC, " + table + ".id DESC").Limit(limit + 1)
}

// Page trims the +1 look-ahead row and returns the next cursor (or "").
func Page[T any](items []T, limit int, key func(T) (time.Time, uuid.UUID)) ([]T, string) {
	if len(items) <= limit {
		return items, ""
	}
	items = items[:limit]
	t, id := key(items[len(items)-1])
	return items, Cursor{T: t, ID: id}.Encode()
}
