// Package authz holds the ownership rules for authored content (tests,
// content items, decks, hacks) and uploaded files, so every handler applies
// the same rule.
package authz

import (
	"strings"

	"codon-backend/internal/models"

	"gorm.io/gorm"
)

// ManagesAll reports whether u may act on content authored by anyone:
// admins and teachers granted can_manage_all_content.
func ManagesAll(u *models.User) bool {
	return u != nil && (u.Role == models.RoleAdmin || u.CanManageAllContent)
}

// Scope restricts q to rows owned by u (ownerCol = u.id) unless u manages all.
func Scope(q *gorm.DB, u *models.User, ownerCol string) *gorm.DB {
	if ManagesAll(u) {
		return q
	}
	return q.Where(ownerCol+" = ?", u.ID)
}

// OwnsUploadKey accepts only object keys of the form
// "<purpose>/<user id>/<file>" produced by the presign endpoints, so a request
// can never point at somebody else's private upload. Users who manage all
// content may reference any key of that purpose.
func OwnsUploadKey(u *models.User, purpose, key string) bool {
	if u == nil || !strings.HasPrefix(key, purpose+"/") || strings.Contains(key, "..") {
		return false
	}
	return ManagesAll(u) || strings.HasPrefix(key, purpose+"/"+strings.ToLower(u.ID.String())+"/")
}
