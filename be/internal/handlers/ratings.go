package handlers

import (
	"net/http"

	"codon-backend/internal/items"
	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/settings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type RatingHandler struct{ DB *gorm.DB }

func NewRatingHandler(db *gorm.DB) *RatingHandler { return &RatingHandler{DB: db} }

// ratingTags is the closed vocabulary — ratings carry no free text (abuse surface).
var ratingTags = []string{"helpful", "clear", "great_explanation", "too_easy", "too_hard", "confusing"}

var aggregateTable = map[string]string{
	items.Test: "tests", items.Content: "content_items", items.BrainHack: "brain_hacks", items.FlashcardDeck: "flashcard_decks",
}

type putRatingRequest struct {
	ItemType string   `json:"item_type" enums:"test,content,brain_hack,flashcard_deck,question"`
	ItemID   string   `json:"item_id"`
	Value    int      `json:"value"`
	Tags     []string `json:"tags"`
}

func validRating(typ string, v int) bool {
	if typ == items.Question {
		return v == -1 || v == 1
	}
	return v >= 1 && v <= 5
}

// eligible enforces "only rate what you've actually done".
func (h *RatingHandler) eligible(c *gin.Context, user *models.User, typ string, id uuid.UUID) bool {
	ctx := c.Request.Context()
	var n int64
	switch typ {
	case items.Test:
		h.DB.WithContext(ctx).Model(&models.StudentAttempt{}).Where("user_id = ? AND test_id = ? AND status = ?", user.ID, id, models.AttemptSubmitted).Count(&n)
		return n > 0
	case items.Content:
		var ct models.ContentItem
		if h.DB.WithContext(ctx).Select("id", "content_type").First(&ct, "id = ?", id).Error != nil {
			return false
		}
		if ct.ContentType != models.ContentVideo {
			return true // documents have no watch signal
		}
		h.DB.WithContext(ctx).Model(&models.UserWatchHistory{}).
			Where("user_id = ? AND content_item_id = ? AND (is_completed = true OR progress_seconds >= ?)", user.ID, id, settings.Int("ratings.min_watch_seconds")).Count(&n)
		return n > 0
	case items.Question:
		return items.Exposed(ctx, h.DB, user.ID, typ, id)
	}
	return true
}

// Put godoc
//
//	@Summary		Rate an item (create or change)
//	@Description	Stars 1-5 for tests, videos/documents, brain hacks and flashcard decks; thumbs (-1/+1) for a question's explanation. Only after the student actually did the thing (submitted the test, watched the video, saw the question) — else 403 `not_eligible`. No free text; `tags` come from a fixed list. Rating twice updates the rating.
//	@Tags			Ratings
//	@Security		BearerAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		putRatingRequest	true	"Rating"
//	@Success		200		{object}	map[string]interface{}
//	@Failure		403		{object}	errorResponse
//	@Router			/api/v1/ratings [put]
func (h *RatingHandler) Put(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	var req putRatingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", err.Error())
		return
	}
	id, err := uuid.Parse(req.ItemID)
	if err != nil || !items.Known(req.ItemType) || req.ItemType == items.Flashcard {
		respondErr(c, http.StatusBadRequest, "bad_request", "unsupported item_type or invalid item_id")
		return
	}
	if !validRating(req.ItemType, req.Value) {
		respondErr(c, http.StatusBadRequest, "invalid_value", "stars must be 1-5; question feedback must be -1 or 1")
		return
	}
	for _, t := range req.Tags {
		if !contains(ratingTags, t) {
			respondErr(c, http.StatusBadRequest, "invalid_tag", "unknown rating tag: "+t)
			return
		}
	}
	if _, ok := items.Resolve(ctx, h.DB, req.ItemType, id); !ok {
		respondErr(c, http.StatusNotFound, "item_not_found", "item not found")
		return
	}
	if !h.eligible(c, user, req.ItemType, id) {
		respondErr(c, http.StatusForbidden, "not_eligible", "finish it first — you can rate once you've actually done it")
		return
	}
	r := models.Rating{UserID: user.ID, ItemType: req.ItemType, ItemID: id, Value: req.Value, Tags: pq.StringArray(req.Tags)}
	err = h.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "item_type"}, {Name: "item_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"value", "tags", "updated_at"}),
		}).Create(&r).Error; err != nil {
			return err
		}
		return recomputeRating(tx, req.ItemType, id)
	})
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "failed to save rating")
		return
	}
	c.JSON(http.StatusOK, gin.H{"rating": r, "aggregate": aggregateOf(h.DB, req.ItemType, id)})
}

// Delete godoc
//
//	@Summary		Remove my rating
//	@Tags			Ratings
//	@Security		BearerAuth
//	@Param			item_type	path	string	true	"Item type"
//	@Param			item_id		path	string	true	"Item UUID"
//	@Success		200			{object}	messageResponse
//	@Router			/api/v1/ratings/{item_type}/{item_id} [delete]
func (h *RatingHandler) Delete(c *gin.Context) {
	user := middleware.GetUser(c)
	id, err := uuid.Parse(c.Param("item_id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "invalid item id")
		return
	}
	h.DB.Transaction(func(tx *gorm.DB) error {
		tx.Where("user_id = ? AND item_type = ? AND item_id = ?", user.ID, c.Param("item_type"), id).Delete(&models.Rating{})
		return recomputeRating(tx, c.Param("item_type"), id)
	})
	c.JSON(http.StatusOK, messageResponse{Message: "rating removed"})
}

// recomputeRating rebuilds the denormalised average/count of a container item
// from scratch, so it can never drift.
func recomputeRating(tx *gorm.DB, typ string, id uuid.UUID) error {
	table, ok := aggregateTable[typ]
	if !ok {
		return nil
	}
	return tx.Exec(`UPDATE `+table+` SET
		rating_avg = COALESCE((SELECT round(avg(value)::numeric, 2) FROM ratings WHERE item_type = ? AND item_id = ?), 0),
		rating_count = (SELECT count(*) FROM ratings WHERE item_type = ? AND item_id = ?)
		WHERE id = ?`, typ, id, typ, id, id).Error
}

func aggregateOf(db *gorm.DB, typ string, id uuid.UUID) gin.H {
	table, ok := aggregateTable[typ]
	if !ok {
		var up, down int64
		db.Model(&models.Rating{}).Where("item_type = ? AND item_id = ? AND value = 1", typ, id).Count(&up)
		db.Model(&models.Rating{}).Where("item_type = ? AND item_id = ? AND value = -1", typ, id).Count(&down)
		return gin.H{"up": up, "down": down}
	}
	var row struct {
		RatingAvg   float64
		RatingCount int
	}
	db.Table(table).Select("rating_avg, rating_count").Where("id = ?", id).Scan(&row)
	return gin.H{"rating_avg": row.RatingAvg, "rating_count": row.RatingCount}
}
