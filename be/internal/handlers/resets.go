package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"codon-backend/internal/middleware"
	"codon-backend/internal/services"
)

// ResetStatus godoc
//
//	@Summary		When each kind of study data was last reset and may be reset again
//	@Tags			Profile
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/me/resets [get]
func (h *ProfileHandler) ResetStatus(c *gin.Context) {
	user := middleware.GetUser(c)
	c.JSON(http.StatusOK, gin.H{"resets": services.ResetStatuses(c.Request.Context(), h.DB, user.ID, time.Now())})
}

// ResetContent godoc
//
//	@Summary		Clear my bookmarks, QBank, flashcards or Pulse data
//	@Description	Once per cooldown (90 days by default) for each of the four. The old rows are archived, not destroyed. 409 `reset_cooldown` says when it can be done again.
//	@Tags			Profile
//	@Security		BearerAuth
//	@Produce		json
//	@Param			scope	path		string	true	"bookmarks, qbank, flashcards or pulse"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/me/resets/{scope} [post]
func (h *ProfileHandler) ResetContent(c *gin.Context) {
	user := middleware.GetUser(c)
	removed, err := services.ResetContent(c.Request.Context(), h.DB, user.ID, c.Param("scope"), time.Now())
	if err != nil {
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"removed": removed, "resets": services.ResetStatuses(c.Request.Context(), h.DB, user.ID, time.Now())})
}
