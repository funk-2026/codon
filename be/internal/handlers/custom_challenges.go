package handlers

import (
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm/clause"

	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
)

// canSeeModule: the creator, or a student who opened it with its code.
func (h *CustomTestHandler) canSeeModule(userID uuid.UUID, t *models.Test) bool {
	if t.OwnerUserID != nil && *t.OwnerUserID == userID {
		return true
	}
	var n int64
	h.DB.Model(&models.CustomModuleOpen{}).Where("user_id = ? AND test_id = ?", userID, t.ID).Count(&n)
	return n > 0
}

// OpenByCode lets a student open a friend's custom module (or their own) with its code. They may then solve it.
func (h *CustomTestHandler) OpenByCode(c *gin.Context) {
	user := middleware.GetUser(c)
	var r struct {
		Code string `json:"code"`
	}
	if c.ShouldBindJSON(&r) != nil || strings.TrimSpace(r.Code) == "" {
		respondErr(c, http.StatusBadRequest, "invalid_body", "enter a code")
		return
	}
	code := strings.ToUpper(strings.TrimSpace(r.Code))
	var t models.Test
	if h.DB.Where("share_code = ? AND archived_at IS NULL", code).First(&t).Error != nil {
		respondErr(c, http.StatusNotFound, "code_not_found", "no custom module has that code")
		return
	}
	mine := t.OwnerUserID != nil && *t.OwnerUserID == user.ID
	if !mine {
		h.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&models.CustomModuleOpen{UserID: user.ID, TestID: t.ID, OpenedAt: time.Now()})
	}
	c.JSON(http.StatusOK, gin.H{"test_id": t.ID, "title": t.Title, "questions": t.TotalQuestions, "mine": mine, "code": code})
}

type challengeRow struct {
	TestID   uuid.UUID `json:"test_id"`
	Title    string    `json:"title"`
	Code     string    `json:"code"`
	At       time.Time `json:"at"`
	Marker   string    `json:"marker"` // white | red | green
	MyPct    *int      `json:"my_pct,omitempty"`
	Attempts int       `json:"attempts"`
}

// Challenges is the test history: modules I created and modules shared with me, newest first, each with a marker:
// white = nobody has attempted it, red = shared with me, green = mine and attempted (open it to see the leaderboard).
func (h *CustomTestHandler) Challenges(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	rows := []challengeRow{}
	h.DB.WithContext(ctx).Raw(`
		SELECT t.id AS test_id, t.title, t.share_code AS code, t.created_at AS at, 'mine' AS marker
		FROM tests t WHERE t.owner_user_id = ? AND t.origin = 'generated' AND t.share_code IS NOT NULL AND t.archived_at IS NULL
		UNION ALL
		SELECT t.id, t.title, t.share_code, o.opened_at, 'opened'
		FROM custom_module_opens o JOIN tests t ON t.id = o.test_id WHERE o.user_id = ? AND t.archived_at IS NULL`, user.ID, user.ID).Scan(&rows)
	for i := range rows {
		var n int64
		h.DB.WithContext(ctx).Raw(`SELECT count(DISTINCT user_id) FROM student_attempts WHERE test_id = ? AND status = 'submitted'`, rows[i].TestID).Scan(&n)
		rows[i].Attempts = int(n)
		var pct []float64
		h.DB.WithContext(ctx).Raw(`SELECT (score * 100 / total_marks)::float8 FROM student_attempts WHERE test_id = ? AND user_id = ? AND status = 'submitted' AND official AND total_marks > 0`, rows[i].TestID, user.ID).Scan(&pct)
		if len(pct) > 0 {
			v := int(pct[0] + 0.5)
			rows[i].MyPct = &v
		}
		switch {
		case rows[i].Marker == "opened":
			rows[i].Marker = "red"
		case n > 0:
			rows[i].Marker = "green"
		default:
			rows[i].Marker = "white"
		}
	}
	sort.SliceStable(rows, func(a, b int) bool { return rows[a].At.After(rows[b].At) })
	c.JSON(http.StatusOK, gin.H{"items": rows})
}

type moduleBoardEntry struct {
	Rank int    `json:"rank"`
	Name string `json:"name"`
	Pct  int    `json:"pct"`
	Me   bool   `json:"me"`
}

// Board is the leaderboard of one module: my rank and percentage, my previous score, and the top five. The first
// attempt of each student counts; a re-attempt through the code never changes it.
func (h *CustomTestHandler) Board(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	var t models.Test
	if h.DB.Where("id = ? AND origin = 'generated' AND archived_at IS NULL", c.Param("id")).First(&t).Error != nil || !h.canSeeModule(user.ID, &t) {
		respondErr(c, http.StatusNotFound, "not_found", "module not found")
		return
	}
	var all []struct {
		UserID uuid.UUID
		Name   *string
		Pct    float64
		Secs   int
	}
	h.DB.WithContext(ctx).Raw(`
		SELECT a.user_id, u.name, (a.score * 100 / a.total_marks)::float8 AS pct, COALESCE(a.time_taken_seconds, 0) AS secs
		FROM student_attempts a JOIN users u ON u.id = a.user_id
		WHERE a.test_id = ? AND a.status = 'submitted' AND a.official AND a.total_marks > 0
		ORDER BY pct DESC, secs ASC`, t.ID).Scan(&all)
	top := []moduleBoardEntry{}
	mine := gin.H{}
	for i, r := range all {
		e := moduleBoardEntry{Rank: i + 1, Name: shortName(r.Name), Pct: int(r.Pct + 0.5), Me: r.UserID == user.ID}
		if i < 5 {
			top = append(top, e)
		}
		if e.Me {
			mine = gin.H{"rank": e.Rank, "pct": e.Pct}
		}
	}
	var prev []float64
	h.DB.WithContext(ctx).Raw(`SELECT (score * 100 / total_marks)::float8 FROM student_attempts WHERE test_id = ? AND user_id = ? AND status = 'submitted' AND NOT official AND total_marks > 0 ORDER BY submitted_at DESC LIMIT 1`, t.ID, user.ID).Scan(&prev)
	if len(prev) > 0 {
		mine["previous_pct"] = int(prev[0] + 0.5)
	}
	code := ""
	if t.ShareCode != nil {
		code = *t.ShareCode
	}
	c.JSON(http.StatusOK, gin.H{"title": t.Title, "code": code, "total": len(all), "mine": mine, "top": top})
}
