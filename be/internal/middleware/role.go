package middleware

import (
	"net/http"

	"codon-backend/internal/models"

	"github.com/gin-gonic/gin"
)

// RequireRole returns a middleware that aborts if the authenticated user's role
// is not in the allowed set. Admin role is always granted access to all routes.
func RequireRole(roles ...models.UserRole) gin.HandlerFunc {
	allowed := make(map[models.UserRole]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}

	return func(c *gin.Context) {
		user := GetUser(c)
		if user == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			return
		}
		// Admin is a superuser and has unrestricted access to all routes
		if user.Role == models.RoleAdmin {
			c.Next()
			return
		}
		if _, ok := allowed[user.Role]; !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			return
		}
		c.Next()
	}
}
