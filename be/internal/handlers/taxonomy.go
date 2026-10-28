package handlers

import (
	"net/http"
	"strings"

	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TaxonomyHandler manages topics and tags (question taxonomy beyond
// subject/chapter).
type TaxonomyHandler struct{ DB *gorm.DB }

func NewTaxonomyHandler(db *gorm.DB) *TaxonomyHandler { return &TaxonomyHandler{DB: db} }

// ListTags godoc
//
//	@Summary		Tag autocomplete
//	@Description	Canonical tags (aliases excluded) matching `q` by prefix or substring, most-used first. Max 20.
//	@Tags			Taxonomy
//	@Security		BearerAuth
//	@Produce		json
//	@Param			q	query		string	false	"Search text"
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/tags [get]
func (h *TaxonomyHandler) ListTags(c *gin.Context) {
	q := services.TagSlug(c.Query("q"))
	var rows []struct {
		models.Tag
		Uses int `json:"uses"`
	}
	tx := h.DB.WithContext(c.Request.Context()).Table("tags").
		Select("tags.*, (SELECT count(*) FROM question_tags qt WHERE qt.tag_id = tags.id) AS uses").
		Where("tags.alias_of IS NULL")
	if q != "" {
		tx = tx.Where("tags.slug LIKE ? OR tags.slug LIKE ?", q+"%", "%"+q+"%")
	}
	tx.Order("uses DESC, tags.slug ASC").Limit(20).Scan(&rows)
	c.JSON(http.StatusOK, gin.H{"tags": rows})
}

// ListTopics godoc
//
//	@Summary		List topics of a course (optionally one chapter)
//	@Tags			Taxonomy
//	@Security		BearerAuth
//	@Produce		json
//	@Param			id			path		string	true	"Course UUID"
//	@Param			chapter_id	query		string	false	"Chapter UUID"
//	@Success		200			{object}	map[string]interface{}
//	@Router			/api/v1/courses/{id}/topics [get]
func (h *TaxonomyHandler) ListTopics(c *gin.Context) {
	q := h.DB.WithContext(c.Request.Context()).Model(&models.Topic{}).
		Joins("JOIN chapters ON chapters.id = topics.chapter_id").
		Joins("JOIN subjects ON subjects.id = chapters.subject_id").Where("subjects.course_id = ?", c.Param("id"))
	if v := c.Query("chapter_id"); v != "" {
		q = q.Where("topics.chapter_id = ?", v)
	}
	var topics []models.Topic
	q.Order("topics.order_index ASC, topics.name ASC").Find(&topics)
	c.JSON(http.StatusOK, gin.H{"topics": topics})
}

type topicRequest struct {
	Name       *string `json:"name"`
	OrderIndex *int    `json:"order_index"`
}

// CreateTopic godoc
//
//	@Summary		Create a topic under a chapter (Teacher/Admin)
//	@Tags			Taxonomy
//	@Security		BearerAuth
//	@Accept			json
//	@Param			chapter_id	path	string			true	"Chapter UUID"
//	@Param			body		body	topicRequest	true	"Topic"
//	@Success		201			{object}	models.Topic
//	@Router			/api/v1/teacher/chapters/{chapter_id}/topics [post]
func (h *TaxonomyHandler) CreateTopic(c *gin.Context) {
	chID, err := uuid.Parse(c.Param("chapter_id"))
	var req topicRequest
	if err != nil || c.ShouldBindJSON(&req) != nil || req.Name == nil || strings.TrimSpace(*req.Name) == "" || len(*req.Name) > 120 {
		respondErr(c, http.StatusBadRequest, "bad_request", "chapter id and a name (max 120 chars) are required")
		return
	}
	var ch models.Chapter
	if h.DB.First(&ch, "id = ?", chID).Error != nil {
		respondErr(c, http.StatusNotFound, "chapter_not_found", "chapter not found")
		return
	}
	t := models.Topic{ChapterID: chID, Name: strings.TrimSpace(*req.Name)}
	if req.OrderIndex != nil {
		t.OrderIndex = *req.OrderIndex
	}
	h.DB.Create(&t)
	c.JSON(http.StatusCreated, t)
}

// UpdateTopic godoc
//
//	@Summary		Rename / reorder a topic (Admin)
//	@Tags			Taxonomy
//	@Security		BearerAuth
//	@Param			id		path	string			true	"Topic UUID"
//	@Param			body	body	topicRequest	true	"Fields"
//	@Success		200		{object}	models.Topic
//	@Router			/api/v1/admin/topics/{id} [patch]
func (h *TaxonomyHandler) UpdateTopic(c *gin.Context) {
	var t models.Topic
	if h.DB.First(&t, "id = ?", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "topic_not_found", "topic not found")
		return
	}
	var req topicRequest
	if c.ShouldBindJSON(&req) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	up := map[string]interface{}{}
	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		up["name"] = strings.TrimSpace(*req.Name)
	}
	if req.OrderIndex != nil {
		up["order_index"] = *req.OrderIndex
	}
	h.DB.Model(&t).Updates(up)
	h.DB.First(&t, "id = ?", t.ID)
	c.JSON(http.StatusOK, t)
}

// DeleteTopic godoc
//
//	@Summary		Delete a topic (Admin) — 409 if questions still use it
//	@Tags			Taxonomy
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Topic UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/admin/topics/{id} [delete]
func (h *TaxonomyHandler) DeleteTopic(c *gin.Context) {
	var n int64
	h.DB.Model(&models.Question{}).Where("topic_id = ?", c.Param("id")).Count(&n)
	if n > 0 {
		respondErr(c, http.StatusConflict, "topic_in_use", "questions still use this topic")
		return
	}
	h.DB.Delete(&models.Topic{}, "id = ?", c.Param("id"))
	c.JSON(http.StatusOK, messageResponse{Message: "topic deleted"})
}

// AdminListTags godoc
//
//	@Summary		List all tags with usage (Admin)
//	@Tags			Taxonomy
//	@Security		BearerAuth
//	@Produce		json
//	@Param			q	query	string	false	"Search"
//	@Success		200	{object}	map[string]interface{}
//	@Router			/api/v1/admin/tags [get]
func (h *TaxonomyHandler) AdminListTags(c *gin.Context) {
	var rows []struct {
		models.Tag
		Uses int `json:"uses"`
	}
	tx := h.DB.Table("tags").Select("tags.*, (SELECT count(*) FROM question_tags qt WHERE qt.tag_id = tags.id) AS uses")
	if q := services.TagSlug(c.Query("q")); q != "" {
		tx = tx.Where("tags.slug LIKE ?", "%"+q+"%")
	}
	tx.Order("uses DESC, slug ASC").Limit(200).Scan(&rows)
	c.JSON(http.StatusOK, gin.H{"tags": rows})
}

type mergeTagRequest struct {
	IntoID string `json:"into_id"`
}

// MergeTag godoc
//
//	@Summary		Merge a tag into another (Admin)
//	@Description	Re-points every question of the source tag to the target, then turns the source into an alias so future `#source` input resolves to the target.
//	@Tags			Taxonomy
//	@Security		BearerAuth
//	@Param			id		path	string				true	"Source tag UUID"
//	@Param			body	body	mergeTagRequest		true	"Target"
//	@Success		200		{object}	messageResponse
//	@Router			/api/v1/admin/tags/{id}/merge [post]
func (h *TaxonomyHandler) MergeTag(c *gin.Context) {
	admin := middleware.GetUser(c)
	var req mergeTagRequest
	src, e1 := uuid.Parse(c.Param("id"))
	dst, e2 := uuid.Parse(req.IntoID)
	if c.ShouldBindJSON(&req) != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "into_id required")
		return
	}
	dst, e2 = uuid.Parse(req.IntoID)
	if e1 != nil || e2 != nil || src == dst {
		respondErr(c, http.StatusBadRequest, "bad_request", "valid, different source and target tag ids are required")
		return
	}
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		var s, d models.Tag
		if tx.First(&s, "id = ?", src).Error != nil || tx.First(&d, "id = ?", dst).Error != nil {
			return gorm.ErrRecordNotFound
		}
		if d.AliasOf != nil {
			return services.Invalid("target_is_alias", "merge into a canonical tag, not an alias")
		}
		if err := tx.Exec(`INSERT INTO question_tags (question_id, tag_id)
			SELECT question_id, ? FROM question_tags WHERE tag_id = ? ON CONFLICT DO NOTHING`, dst, src).Error; err != nil {
			return err
		}
		if err := tx.Where("tag_id = ?", src).Delete(&models.QuestionTag{}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Tag{}).Where("alias_of = ?", src).Update("alias_of", dst).Error; err != nil {
			return err
		}
		if err := tx.Model(&s).Update("alias_of", dst).Error; err != nil {
			return err
		}
		return tx.Create(&models.AdminAuditLog{ActorID: admin.ID, Action: "tag.merge", Target: "tag:" + src.String() + "->" + dst.String()}).Error
	})
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			respondErr(c, http.StatusNotFound, "tag_not_found", "tag not found")
			return
		}
		respondService(c, err)
		return
	}
	c.JSON(http.StatusOK, messageResponse{Message: "tags merged"})
}

type renameTagRequest struct {
	Label string `json:"label"`
}

// RenameTag godoc
//
//	@Summary		Change a tag's display label (Admin)
//	@Tags			Taxonomy
//	@Security		BearerAuth
//	@Param			id		path	string				true	"Tag UUID"
//	@Param			body	body	renameTagRequest	true	"Label"
//	@Success		200		{object}	models.Tag
//	@Router			/api/v1/admin/tags/{id} [patch]
func (h *TaxonomyHandler) RenameTag(c *gin.Context) {
	var req renameTagRequest
	var t models.Tag
	if c.ShouldBindJSON(&req) != nil || strings.TrimSpace(req.Label) == "" || h.DB.First(&t, "id = ?", c.Param("id")).Error != nil {
		respondErr(c, http.StatusBadRequest, "bad_request", "an existing tag and a label are required")
		return
	}
	h.DB.Model(&t).Update("label", strings.TrimSpace(req.Label))
	c.JSON(http.StatusOK, t)
}

// DeleteTag godoc
//
//	@Summary		Delete an unused tag (Admin)
//	@Tags			Taxonomy
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Tag UUID"
//	@Success		200	{object}	messageResponse
//	@Router			/api/v1/admin/tags/{id} [delete]
func (h *TaxonomyHandler) DeleteTag(c *gin.Context) {
	var n int64
	h.DB.Model(&models.QuestionTag{}).Where("tag_id = ?", c.Param("id")).Count(&n)
	if n > 0 {
		respondErr(c, http.StatusConflict, "tag_in_use", "tag is still used by questions — merge it instead")
		return
	}
	h.DB.Delete(&models.Tag{}, "id = ?", c.Param("id"))
	c.JSON(http.StatusOK, messageResponse{Message: "tag deleted"})
}
