package middleware

import (
	"net/http"
	"strings"

	"codon-backend/internal/models"
	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	ContextUser    = "user"
	ContextSession = "session"
	ContextUserID  = "user_id"
)

// AuthMiddleware verifies the JWT and loads the user into context.
func AuthMiddleware(sessionSvc *services.SessionService, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid Authorization header"})
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, session, err := sessionSvc.ValidateToken(c.Request.Context(), tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		// Load the full user from DB
		var user models.User
		if err := db.WithContext(c.Request.Context()).
			Where("id = ?", claims.UserID).First(&user).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
			return
		}

		c.Set(ContextUser, &user)
		c.Set(ContextSession, session)
		c.Set(ContextUserID, user.ID)
		c.Next()
	}
}

// GetUser extracts the authenticated user from the gin context.
func GetUser(c *gin.Context) *models.User {
	u, _ := c.Get(ContextUser)
	user, _ := u.(*models.User)
	return user
}

// GetSession extracts the session from context.
func GetSession(c *gin.Context) *models.Session {
	s, _ := c.Get(ContextSession)
	session, _ := s.(*models.Session)
	return session
}

// GetUserID extracts the user ID from context.
func GetUserID(c *gin.Context) uuid.UUID {
	id, _ := c.Get(ContextUserID)
	uid, _ := id.(uuid.UUID)
	return uid
}
