package handlers

import (
	"time"

	"codon-backend/internal/pagination"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	defaultListLimit = 200
	maxListLimit     = 200
)

// paged runs q as a newest-first keyset page (?limit=&cursor=) over `table`
// and returns the rows plus the next cursor ("" on the last page). Existing
// clients that send no parameters get the first 200 rows and ignore the cursor.
func paged[T any](c *gin.Context, q *gorm.DB, table string, key func(T) (time.Time, uuid.UUID)) ([]T, string, error) {
	limit := pagination.LimitOr(c.Query("limit"), defaultListLimit, maxListLimit)
	var out []T
	if err := pagination.Apply(q, table, pagination.Decode(c.Query("cursor")), limit).Find(&out).Error; err != nil {
		return nil, "", err
	}
	out, next := pagination.Page(out, limit, key)
	return out, next, nil
}
