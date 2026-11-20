package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm/clause"

	"codon-backend/internal/httpx"
	"codon-backend/internal/media"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
)

const homeMessageSlot = "main"

type homeMessageRequest struct {
	Name     *string `json:"name"`
	Quote    *string `json:"quote"`
	MediaID  *string `json:"media_id"`
	IsActive *bool   `json:"is_active"`
}

func (h *ExtrasHandler) loadHomeMessage() (*models.HomeMessage, bool) {
	var m models.HomeMessage
	if h.DB.First(&m, "slot = ?", homeMessageSlot).Error != nil {
		return nil, false
	}
	return &m, true
}

func (h *ExtrasHandler) homeMessageView(c *gin.Context, m *models.HomeMessage) gin.H {
	mc := media.NewCollector()
	if m != nil {
		mc.AddID(m.MediaID)
	}
	return gin.H{"message": m, "media": media.NewService(h.DB).ResolveCollector(c.Request.Context(), mc, media.URLTTL(nil))}
}

// HomeMessage godoc
//
//	@Summary		The Home "message" card
//	@Description	`message` is null when none is set or it is switched off, and the app then hides the card.
//	@Tags			HomeUpdates
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/home/message [get]
func (h *ExtrasHandler) HomeMessage(c *gin.Context) {
	m, ok := h.loadHomeMessage()
	if !ok || !m.IsActive {
		c.JSON(http.StatusOK, gin.H{"message": nil, "media": gin.H{}})
		return
	}
	c.JSON(http.StatusOK, h.homeMessageView(c, m))
}

// AdminHomeMessage godoc
//
//	@Summary		The Home message card, including when switched off (Admin)
//	@Tags			HomeUpdates
//	@Security		BearerAuth
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/admin/home-message [get]
func (h *ExtrasHandler) AdminHomeMessage(c *gin.Context) {
	m, _ := h.loadHomeMessage()
	c.JSON(http.StatusOK, h.homeMessageView(c, m))
}

// AdminSetHomeMessage godoc
//
//	@Summary		Set the Home message card (Admin)
//	@Description	Creates the card on first use. The quote is kept short: at most 60 words.
//	@Tags			HomeUpdates
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		homeMessageRequest	true	"Fields"
//	@Success		200		{object}	map[string]interface{}
//	@Router			/api/v1/admin/home-message [put]
func (h *ExtrasHandler) AdminSetHomeMessage(c *gin.Context) {
	admin := middleware.GetUser(c)
	var req homeMessageRequest
	if c.ShouldBindJSON(&req) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	m, exists := h.loadHomeMessage()
	if !exists {
		m = &models.HomeMessage{Slot: homeMessageSlot, IsActive: true}
		if req.Name == nil || req.Quote == nil {
			respondErr(c, http.StatusBadRequest, "bad_request", "name and quote are required the first time")
			return
		}
	}
	if req.Name != nil {
		n := strings.TrimSpace(*req.Name)
		if n == "" || len([]rune(n)) > 80 {
			respondErr(c, http.StatusBadRequest, "invalid_name", "name must be 1-80 characters")
			return
		}
		m.Name = n
	}
	if req.Quote != nil {
		q := strings.TrimSpace(*req.Quote)
		if q == "" || len(strings.Fields(q)) > 60 {
			respondErr(c, http.StatusBadRequest, "invalid_quote", "the quote must be 1-60 words")
			return
		}
		m.Quote = q
	}
	if req.MediaID != nil {
		if *req.MediaID == "" {
			m.MediaID = nil
		} else {
			id, err := uuid.Parse(*req.MediaID)
			if err != nil {
				respondErr(c, http.StatusBadRequest, "invalid_id", "invalid media_id")
				return
			}
			if err := media.CheckOwned(c.Request.Context(), h.DB, admin, id, "home_message_photo"); err != nil {
				respondService(c, err)
				return
			}
			m.MediaID = &id
		}
	}
	if req.IsActive != nil {
		m.IsActive = *req.IsActive
	}
	m.UpdatedAt = time.Now()
	if err := h.DB.Clauses(clause.OnConflict{UpdateAll: true}).Select("*").Create(m).Error; err != nil {
		httpx.Fail(c, err)
		return
	}
	_ = auditAdmin(h.DB.WithContext(c.Request.Context()), admin, "home_message.set", "home_message:main", nil, nil)
	c.JSON(http.StatusOK, h.homeMessageView(c, m))
}
