package middleware

import (
	"net/http"

	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SubscriptionGateMiddleware checks whether the authenticated student can access
// the test or content item identified by the route param (id).
// It reads `requires_subscription` and `course_id` from the item and verifies
// the student has an active subscription (and approved KYC if required).
//
// The caller must pass a resolver func that extracts (requiresSubscription, courseID)
// from the DB given the item's ID from the route.
type AccessResolver func(db *gorm.DB, itemID uuid.UUID) (requiresSubscription bool, courseID uuid.UUID, err error)

func SubscriptionGateMiddleware(
	db *gorm.DB,
	subSvc *services.SubscriptionService,
	paramName string,
	resolver AccessResolver,
	kycRequired func() bool,
) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetUser(c)
		if user == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			return
		}

		itemIDStr := c.Param(paramName)
		itemID, err := uuid.Parse(itemIDStr)
		if err != nil {
			// If param is missing/invalid, let the handler deal with it
			c.Next()
			return
		}

		requiresSub, courseID, err := resolver(db, itemID)
		if err != nil {
			c.Next() // item not found — handler will return 404
			return
		}

		if err := subSvc.CheckAccess(c.Request.Context(), user, requiresSub, courseID, kycRequired()); err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}

		c.Next()
	}
}
