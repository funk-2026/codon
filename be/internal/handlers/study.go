package handlers

import (
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"codon-backend/internal/middleware"
	"codon-backend/internal/models"
)

// StudyHandler serves Pulse (one-minute revision items) and Schema (syllabus topics with a status per student).
type StudyHandler struct{ DB *gorm.DB }

func NewStudyHandler(db *gorm.DB) *StudyHandler { return &StudyHandler{DB: db} }

func subjectRank(name string) int {
	switch strings.ToLower(name) {
	case "biology":
		return 0
	case "chemistry":
		return 1
	case "physics":
		return 2
	}
	return 3
}

// ── Pulse ────────────────────────────────────────────────────────────────────

type pulseRow struct {
	ID           uuid.UUID `json:"id"`
	Title        string    `json:"title"`
	Body         string    `json:"body"`
	SubjectID    uuid.UUID `json:"subject_id"`
	SubjectName  string    `json:"subject_name"`
	ChapterID    uuid.UUID `json:"chapter_id"`
	ChapterName  string    `json:"chapter_name"`
	ChapterOrder int       `json:"chapter_order"`
	OrderIndex   int       `json:"order_index"`
	Read         bool      `json:"read"`
}

const pulseSelect = `SELECT p.id, p.title, p.body, p.subject_id, s.name AS subject_name, p.chapter_id, ch.name AS chapter_name,
	ch.order_index AS chapter_order, p.order_index, (r.item_id IS NOT NULL) AS read
	FROM pulse_items p JOIN subjects s ON s.id = p.subject_id JOIN chapters ch ON ch.id = p.chapter_id
	LEFT JOIN pulse_reads r ON r.item_id = p.id AND r.user_id = ?`

// PulseList is every active Pulse item of the course, in chapter order, with whether I have read it.
func (h *StudyHandler) PulseList(c *gin.Context) {
	user := middleware.GetUser(c)
	rows := []pulseRow{}
	q := pulseSelect + " WHERE p.is_active"
	args := []interface{}{user.ID}
	if cid := c.Query("course_id"); cid != "" {
		q += " AND p.course_id = ?"
		args = append(args, cid)
	}
	h.DB.WithContext(c.Request.Context()).Raw(q+" ORDER BY ch.order_index, ch.name, p.order_index, p.created_at", args...).Scan(&rows)
	c.JSON(http.StatusOK, gin.H{"items": rows})
}

// PulseRead notes that I read an item. Only the first read counts.
func (h *StudyHandler) PulseRead(c *gin.Context) {
	user := middleware.GetUser(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondErr(c, http.StatusBadRequest, "invalid_id", "bad id")
		return
	}
	var n int64
	h.DB.Model(&models.PulseItem{}).Where("id = ? AND is_active", id).Count(&n)
	if n == 0 {
		respondErr(c, http.StatusNotFound, "not_found", "item not found")
		return
	}
	h.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&models.PulseRead{UserID: user.ID, ItemID: id, ReadAt: time.Now()})
	c.JSON(http.StatusOK, gin.H{"read": true})
}

type pulseDone struct {
	ID          uuid.UUID `json:"id"`
	Title       string    `json:"title"`
	SubjectName string    `json:"subject"`
	ChapterName string    `json:"chapter"`
	ReadAt      time.Time `json:"read_at"`
}

// MyPulseReads feeds the Pulse graph: each item I read, with the time.
func (h *StudyHandler) MyPulseReads(c *gin.Context) {
	user := middleware.GetUser(c)
	rows := []pulseDone{}
	h.DB.WithContext(c.Request.Context()).Raw(`SELECT p.id, p.title, s.name AS subject_name, ch.name AS chapter_name, r.read_at
		FROM pulse_reads r JOIN pulse_items p ON p.id = r.item_id JOIN subjects s ON s.id = p.subject_id JOIN chapters ch ON ch.id = p.chapter_id
		WHERE r.user_id = ? ORDER BY r.read_at`, user.ID).Scan(&rows)
	c.JSON(http.StatusOK, gin.H{"items": rows})
}

type pulseReq struct {
	CourseID  string  `json:"course_id"`
	SubjectID string  `json:"subject_id"`
	ChapterID string  `json:"chapter_id"`
	Title     *string `json:"title"`
	Body      *string `json:"body"`
}

// TeacherPulseCreate adds an item. Teachers and admins publish straight away; Pulse items are short and carry no answer key.
func (h *StudyHandler) TeacherPulseCreate(c *gin.Context) {
	user := middleware.GetUser(c)
	var r pulseReq
	if c.ShouldBindJSON(&r) != nil || r.Title == nil || strings.TrimSpace(*r.Title) == "" {
		respondErr(c, http.StatusBadRequest, "invalid_body", "a title is needed")
		return
	}
	course, e1 := uuid.Parse(r.CourseID)
	subject, e2 := uuid.Parse(r.SubjectID)
	chapter, e3 := uuid.Parse(r.ChapterID)
	if e1 != nil || e2 != nil || e3 != nil {
		respondErr(c, http.StatusBadRequest, "invalid_body", "choose the course, subject and chapter")
		return
	}
	var ch models.Chapter
	if h.DB.Where("id = ? AND subject_id = ?", chapter, subject).First(&ch).Error != nil {
		respondErr(c, http.StatusBadRequest, "invalid_chapter", "that chapter is not in that subject")
		return
	}
	var next int
	h.DB.Model(&models.PulseItem{}).Where("chapter_id = ?", chapter).Select("COALESCE(max(order_index), 0) + 1").Scan(&next)
	item := models.PulseItem{CourseID: course, SubjectID: subject, ChapterID: chapter, Title: strings.TrimSpace(*r.Title), AuthorID: &user.ID, OrderIndex: next, IsActive: true}
	if r.Body != nil {
		item.Body = strings.TrimSpace(*r.Body)
	}
	if err := h.DB.Create(&item).Error; err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "could not save")
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *StudyHandler) TeacherPulseList(c *gin.Context) {
	user := middleware.GetUser(c)
	rows := []pulseRow{}
	q := pulseSelect + " WHERE p.is_active"
	args := []interface{}{user.ID}
	if cid := c.Query("course_id"); cid != "" {
		q += " AND p.course_id = ?"
		args = append(args, cid)
	}
	h.DB.WithContext(c.Request.Context()).Raw(q+" ORDER BY s.name, ch.order_index, p.order_index", args...).Scan(&rows)
	c.JSON(http.StatusOK, gin.H{"items": rows})
}

func (h *StudyHandler) TeacherPulseUpdate(c *gin.Context) {
	var item models.PulseItem
	if h.DB.First(&item, "id = ?", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "not_found", "item not found")
		return
	}
	var r pulseReq
	if c.ShouldBindJSON(&r) != nil {
		respondErr(c, http.StatusBadRequest, "invalid_body", "bad body")
		return
	}
	if r.Title != nil && strings.TrimSpace(*r.Title) != "" {
		item.Title = strings.TrimSpace(*r.Title)
	}
	if r.Body != nil {
		item.Body = strings.TrimSpace(*r.Body)
	}
	h.DB.Save(&item)
	c.JSON(http.StatusOK, item)
}

func (h *StudyHandler) TeacherPulseDelete(c *gin.Context) {
	id := c.Param("id")
	h.DB.Where("item_id = ?", id).Delete(&models.PulseRead{})
	h.DB.Delete(&models.PulseItem{}, "id = ?", id)
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

// ── Schema ───────────────────────────────────────────────────────────────────

type schemaTopicOut struct {
	ID     uuid.UUID      `json:"id"`
	Name   string         `json:"name"`
	Total  int            `json:"total"`
	ByYear map[string]int `json:"by_year"`
	Status string         `json:"status"`
}
type schemaChapterOut struct {
	ID     uuid.UUID        `json:"id"`
	Name   string           `json:"name"`
	Topics []schemaTopicOut `json:"topics"`
}
type schemaSubjectOut struct {
	ID       uuid.UUID          `json:"id"`
	Name     string             `json:"name"`
	Chapters []schemaChapterOut `json:"chapters"`
}

func yearLabel(year int, re bool) string {
	if re {
		return strconv.Itoa(year) + " Re"
	}
	return strconv.Itoa(year)
}

// SchemaOverview is the whole syllabus tree with my status on each topic and the questions asked per year, in one response.
func (h *StudyHandler) SchemaOverview(c *gin.Context) {
	user := middleware.GetUser(c)
	ctx := c.Request.Context()
	cid := c.Query("course_id")
	tq := h.DB.WithContext(ctx).Model(&models.SchemaTopic{})
	if cid != "" {
		tq = tq.Where("course_id = ?", cid)
	}
	var topics []models.SchemaTopic
	tq.Order("order_index, name").Find(&topics)
	out := []schemaSubjectOut{}
	if len(topics) == 0 {
		c.JSON(http.StatusOK, gin.H{"subjects": out, "years": []string{}})
		return
	}
	ids := make([]uuid.UUID, len(topics))
	subIDs, chIDs := map[uuid.UUID]bool{}, map[uuid.UUID]bool{}
	for i, t := range topics {
		ids[i] = t.ID
		subIDs[t.SubjectID], chIDs[t.ChapterID] = true, true
	}
	var subs []models.Subject
	h.DB.WithContext(ctx).Where("id IN ?", keysOf(subIDs)).Find(&subs)
	var chs []models.Chapter
	h.DB.WithContext(ctx).Where("id IN ?", keysOf(chIDs)).Order("order_index, name").Find(&chs)
	var yrs []models.SchemaYear
	h.DB.WithContext(ctx).Where("topic_id IN ?", ids).Find(&yrs)
	var sts []models.SchemaStatus
	h.DB.WithContext(ctx).Where("user_id = ? AND topic_id IN ?", user.ID, ids).Find(&sts)
	status := map[uuid.UUID]string{}
	for _, s := range sts {
		status[s.TopicID] = s.Status
	}
	byYear := map[uuid.UUID]map[string]int{}
	totals := map[uuid.UUID]int{}
	yearSet := map[string][2]int{}
	for _, y := range yrs {
		l := yearLabel(y.Year, y.ReExam)
		if byYear[y.TopicID] == nil {
			byYear[y.TopicID] = map[string]int{}
		}
		byYear[y.TopicID][l] += y.Questions
		totals[y.TopicID] += y.Questions
		re := 0
		if y.ReExam {
			re = 1
		}
		yearSet[l] = [2]int{y.Year, re}
	}
	topicsByChapter := map[uuid.UUID][]schemaTopicOut{}
	for _, t := range topics {
		st := status[t.ID]
		if st == "" {
			st = models.SchemaYetToRead
		}
		by := byYear[t.ID]
		if by == nil {
			by = map[string]int{}
		}
		topicsByChapter[t.ChapterID] = append(topicsByChapter[t.ChapterID], schemaTopicOut{ID: t.ID, Name: t.Name, Total: totals[t.ID], ByYear: by, Status: st})
	}
	chaptersBySubject := map[uuid.UUID][]schemaChapterOut{}
	for _, ch := range chs {
		chaptersBySubject[ch.SubjectID] = append(chaptersBySubject[ch.SubjectID], schemaChapterOut{ID: ch.ID, Name: ch.Name, Topics: topicsByChapter[ch.ID]})
	}
	for _, s := range subs {
		out = append(out, schemaSubjectOut{ID: s.ID, Name: s.Name, Chapters: chaptersBySubject[s.ID]})
	}
	sort.SliceStable(out, func(i, j int) bool { return subjectRank(out[i].Name) < subjectRank(out[j].Name) })
	labels := make([]string, 0, len(yearSet))
	for l := range yearSet {
		labels = append(labels, l)
	}
	sort.Slice(labels, func(i, j int) bool {
		a, b := yearSet[labels[i]], yearSet[labels[j]]
		if a[0] != b[0] {
			return a[0] > b[0]
		}
		return a[1] < b[1]
	})
	c.JSON(http.StatusOK, gin.H{"subjects": out, "years": labels})
}

func keysOf(m map[uuid.UUID]bool) []uuid.UUID {
	out := make([]uuid.UUID, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

type schemaRow struct {
	Year      string `json:"year"`
	Subtopic  string `json:"subtopic"`
	Questions int    `json:"questions"`
}

// SchemaTopicDetail is one topic: the path, the total and the Year | Subtopic | Qs rows, newest year first.
func (h *StudyHandler) SchemaTopicDetail(c *gin.Context) {
	var t models.SchemaTopic
	if h.DB.First(&t, "id = ?", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "not_found", "topic not found")
		return
	}
	var sub models.Subject
	var ch models.Chapter
	h.DB.First(&sub, "id = ?", t.SubjectID)
	h.DB.First(&ch, "id = ?", t.ChapterID)
	var ys []models.SchemaYear
	h.DB.Where("topic_id = ?", t.ID).Order("year DESC, re_exam ASC, subtopic ASC").Find(&ys)
	rows := make([]schemaRow, len(ys))
	total := 0
	for i, y := range ys {
		rows[i] = schemaRow{Year: yearLabel(y.Year, y.ReExam), Subtopic: y.Subtopic, Questions: y.Questions}
		total += y.Questions
	}
	c.JSON(http.StatusOK, gin.H{"id": t.ID, "name": t.Name, "subject": sub.Name, "chapter": ch.Name, "total": total, "rows": rows})
}

// SetSchemaStatus saves my status on a topic. Moving to Confident stamps the day; moving away clears it.
func (h *StudyHandler) SetSchemaStatus(c *gin.Context) {
	user := middleware.GetUser(c)
	topic, err := uuid.Parse(c.Param("id"))
	var r struct {
		Status string `json:"status"`
	}
	if err != nil || c.ShouldBindJSON(&r) != nil || (r.Status != models.SchemaYetToRead && r.Status != models.SchemaYetToRevise && r.Status != models.SchemaConfident) {
		respondErr(c, http.StatusBadRequest, "invalid_status", "status must be yet_to_read, yet_to_revise or confident")
		return
	}
	var n int64
	h.DB.Model(&models.SchemaTopic{}).Where("id = ?", topic).Count(&n)
	if n == 0 {
		respondErr(c, http.StatusNotFound, "not_found", "topic not found")
		return
	}
	now := time.Now()
	row := models.SchemaStatus{UserID: user.ID, TopicID: topic, Status: r.Status, UpdatedAt: now}
	var prev models.SchemaStatus
	hadConfident := h.DB.Where("user_id = ? AND topic_id = ?", user.ID, topic).First(&prev).Error == nil && prev.Status == models.SchemaConfident && prev.ConfidentAt != nil
	switch {
	case r.Status == models.SchemaConfident && hadConfident:
		row.ConfidentAt = prev.ConfidentAt
	case r.Status == models.SchemaConfident:
		row.ConfidentAt = &now
	}
	h.DB.Save(&row)
	c.JSON(http.StatusOK, gin.H{"status": r.Status})
}

type schemaDone struct {
	ID      uuid.UUID `json:"id"`
	Name    string    `json:"name"`
	Subject string    `json:"subject"`
	Chapter string    `json:"chapter"`
	At      time.Time `json:"at"`
}

// MySchemaCompletions feeds the Schema graph: topics that are Confident now, with the day they became so.
func (h *StudyHandler) MySchemaCompletions(c *gin.Context) {
	user := middleware.GetUser(c)
	rows := []schemaDone{}
	h.DB.WithContext(c.Request.Context()).Raw(`SELECT t.id, t.name, s.name AS subject, ch.name AS chapter, st.confident_at AS at
		FROM schema_statuses st JOIN schema_topics t ON t.id = st.topic_id JOIN subjects s ON s.id = t.subject_id JOIN chapters ch ON ch.id = t.chapter_id
		WHERE st.user_id = ? AND st.status = 'confident' AND st.confident_at IS NOT NULL ORDER BY st.confident_at`, user.ID).Scan(&rows)
	c.JSON(http.StatusOK, gin.H{"items": rows})
}

type schemaImportRow struct {
	Subject   string `json:"subject"`
	Chapter   string `json:"chapter"`
	Topic     string `json:"topic"`
	Year      string `json:"year"`
	Subtopic  string `json:"subtopic"`
	Questions int    `json:"questions"`
}

// parseYear reads "2022" or "2022 Re".
func parseYear(s string) (int, bool, bool) {
	f := strings.Fields(s)
	if len(f) == 0 || len(f) > 2 {
		return 0, false, false
	}
	y, err := strconv.Atoi(f[0])
	if err != nil || y < 1990 || y > 2100 {
		return 0, false, false
	}
	if len(f) == 2 {
		return y, strings.EqualFold(f[1], "re"), strings.EqualFold(f[1], "re")
	}
	return y, false, true
}

// AdminSchemaImport loads the schema table: one row per topic, year and subtopic. Subjects must exist; chapters are created when missing.
// The year rows of every topic named in the upload are replaced, so a corrected table can be uploaded again.
func (h *StudyHandler) AdminSchemaImport(c *gin.Context) {
	var r struct {
		CourseID string            `json:"course_id"`
		Rows     []schemaImportRow `json:"rows"`
	}
	var course uuid.UUID
	var err error
	if c.ShouldBindJSON(&r) != nil {
		respondErr(c, http.StatusBadRequest, "invalid_body", "bad body")
		return
	}
	if course, err = uuid.Parse(r.CourseID); err != nil || len(r.Rows) == 0 || len(r.Rows) > 20000 {
		respondErr(c, http.StatusBadRequest, "invalid_body", "choose a course and send between 1 and 20000 rows")
		return
	}
	problems := []string{}
	var subs []models.Subject
	h.DB.Where("course_id = ?", course).Find(&subs)
	subByName := map[string]models.Subject{}
	for _, s := range subs {
		subByName[strings.ToLower(s.Name)] = s
	}
	for i, row := range r.Rows {
		if _, ok := subByName[strings.ToLower(strings.TrimSpace(row.Subject))]; !ok {
			problems = append(problems, "row "+strconv.Itoa(i+1)+": unknown subject '"+row.Subject+"'")
		}
		if strings.TrimSpace(row.Chapter) == "" || strings.TrimSpace(row.Topic) == "" {
			problems = append(problems, "row "+strconv.Itoa(i+1)+": chapter and topic are required")
		}
		if _, _, ok := parseYear(row.Year); !ok {
			problems = append(problems, "row "+strconv.Itoa(i+1)+": year must look like 2022 or 2022 Re")
		}
		if len(problems) >= 20 {
			break
		}
	}
	if len(problems) > 0 {
		respondErr(c, http.StatusUnprocessableEntity, "invalid_rows", "fix these rows and upload again", problems)
		return
	}
	created, topicsTouched := 0, map[uuid.UUID]bool{}
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		chapters := map[string]models.Chapter{}
		topics := map[string]models.SchemaTopic{}
		cleared := map[uuid.UUID]bool{}
		for _, row := range r.Rows {
			sub := subByName[strings.ToLower(strings.TrimSpace(row.Subject))]
			chName := strings.TrimSpace(row.Chapter)
			ck := sub.ID.String() + "|" + strings.ToLower(chName)
			ch, ok := chapters[ck]
			if !ok {
				if tx.Where("subject_id = ? AND lower(name) = ?", sub.ID, strings.ToLower(chName)).First(&ch).Error != nil {
					var next int
					tx.Model(&models.Chapter{}).Where("subject_id = ?", sub.ID).Select("COALESCE(max(order_index), 0) + 1").Scan(&next)
					ch = models.Chapter{SubjectID: sub.ID, Name: chName, OrderIndex: next}
					if err := tx.Create(&ch).Error; err != nil {
						return err
					}
				}
				chapters[ck] = ch
			}
			tName := strings.TrimSpace(row.Topic)
			tk := ch.ID.String() + "|" + strings.ToLower(tName)
			t, ok := topics[tk]
			if !ok {
				if tx.Where("chapter_id = ? AND lower(name) = ?", ch.ID, strings.ToLower(tName)).First(&t).Error != nil {
					var next int
					tx.Model(&models.SchemaTopic{}).Where("chapter_id = ?", ch.ID).Select("COALESCE(max(order_index), 0) + 1").Scan(&next)
					t = models.SchemaTopic{CourseID: course, SubjectID: sub.ID, ChapterID: ch.ID, Name: tName, OrderIndex: next}
					if err := tx.Create(&t).Error; err != nil {
						return err
					}
					created++
				}
				topics[tk] = t
			}
			if !cleared[t.ID] {
				if err := tx.Where("topic_id = ?", t.ID).Delete(&models.SchemaYear{}).Error; err != nil {
					return err
				}
				cleared[t.ID] = true
			}
			y, re, _ := parseYear(row.Year)
			if err := tx.Create(&models.SchemaYear{TopicID: t.ID, Year: y, ReExam: re, Subtopic: strings.TrimSpace(row.Subtopic), Questions: row.Questions}).Error; err != nil {
				return err
			}
			topicsTouched[t.ID] = true
		}
		return nil
	})
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "the import failed and nothing was saved")
		return
	}
	c.JSON(http.StatusOK, gin.H{"rows": len(r.Rows), "topics": len(topicsTouched), "new_topics": created})
}

type cardDone struct {
	ID      uuid.UUID `json:"id"`
	Name    string    `json:"name"`
	Subject string    `json:"subject"`
	Chapter string    `json:"chapter"`
	At      time.Time `json:"at"`
}

// MyFlashcardActivity feeds the Flashcards graph: each card with the last day I reviewed it.
func (h *StudyHandler) MyFlashcardActivity(c *gin.Context) {
	user := middleware.GetUser(c)
	rows := []cardDone{}
	h.DB.WithContext(c.Request.Context()).Raw(`SELECT f.id, d.title AS name, COALESCE(s.name, '') AS subject, COALESCE(ch.name, '') AS chapter, st.updated_at AS at
		FROM flashcard_states st JOIN flashcards f ON f.id = st.card_id JOIN flashcard_decks d ON d.id = f.deck_id
		LEFT JOIN subjects s ON s.id = d.subject_id LEFT JOIN chapters ch ON ch.id = d.chapter_id
		WHERE st.user_id = ? AND st.reps > 0 ORDER BY st.updated_at`, user.ID).Scan(&rows)
	c.JSON(http.StatusOK, gin.H{"items": rows})
}

// ── Schema management (teachers and admins) ─────────────────────────────────

type schemaListRow struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	SubjectID uuid.UUID `json:"subject_id"`
	Subject   string    `json:"subject"`
	ChapterID uuid.UUID `json:"chapter_id"`
	Chapter   string    `json:"chapter"`
	Total     int       `json:"total"`
	Rows      int       `json:"rows"`
}

// ManageSchemaList lists every topic of a course with its totals, for editing.
func (h *StudyHandler) ManageSchemaList(c *gin.Context) {
	rows := []schemaListRow{}
	q := `SELECT t.id, t.name, t.subject_id, s.name AS subject, t.chapter_id, ch.name AS chapter,
		COALESCE(sum(y.questions), 0)::int AS total, count(y.id)::int AS rows
		FROM schema_topics t JOIN subjects s ON s.id = t.subject_id JOIN chapters ch ON ch.id = t.chapter_id
		LEFT JOIN schema_years y ON y.topic_id = t.id WHERE 1 = 1`
	args := []interface{}{}
	if cid := c.Query("course_id"); cid != "" {
		q += " AND t.course_id = ?"
		args = append(args, cid)
	}
	h.DB.WithContext(c.Request.Context()).Raw(q+" GROUP BY t.id, s.name, ch.name, ch.order_index ORDER BY s.name, ch.order_index, t.order_index, t.name", args...).Scan(&rows)
	c.JSON(http.StatusOK, gin.H{"topics": rows})
}

type schemaTopicReq struct {
	CourseID  string  `json:"course_id"`
	SubjectID string  `json:"subject_id"`
	ChapterID string  `json:"chapter_id"`
	Name      *string `json:"name"`
}

func (h *StudyHandler) ManageSchemaCreate(c *gin.Context) {
	var r schemaTopicReq
	if c.ShouldBindJSON(&r) != nil || r.Name == nil || strings.TrimSpace(*r.Name) == "" {
		respondErr(c, http.StatusBadRequest, "invalid_body", "a topic name is needed")
		return
	}
	course, e1 := uuid.Parse(r.CourseID)
	subject, e2 := uuid.Parse(r.SubjectID)
	chapter, e3 := uuid.Parse(r.ChapterID)
	if e1 != nil || e2 != nil || e3 != nil {
		respondErr(c, http.StatusBadRequest, "invalid_body", "choose the course, subject and chapter")
		return
	}
	var ch models.Chapter
	if h.DB.Where("id = ? AND subject_id = ?", chapter, subject).First(&ch).Error != nil {
		respondErr(c, http.StatusBadRequest, "invalid_chapter", "that chapter is not in that subject")
		return
	}
	var next int
	h.DB.Model(&models.SchemaTopic{}).Where("chapter_id = ?", chapter).Select("COALESCE(max(order_index), 0) + 1").Scan(&next)
	t := models.SchemaTopic{CourseID: course, SubjectID: subject, ChapterID: chapter, Name: strings.TrimSpace(*r.Name), OrderIndex: next}
	if err := h.DB.Create(&t).Error; err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "could not save")
		return
	}
	c.JSON(http.StatusCreated, t)
}

// ManageSchemaUpdate renames a topic, and may move it to another chapter of the same subject.
func (h *StudyHandler) ManageSchemaUpdate(c *gin.Context) {
	var t models.SchemaTopic
	if h.DB.First(&t, "id = ?", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "not_found", "topic not found")
		return
	}
	var r schemaTopicReq
	if c.ShouldBindJSON(&r) != nil {
		respondErr(c, http.StatusBadRequest, "invalid_body", "bad body")
		return
	}
	if r.Name != nil {
		n := strings.TrimSpace(*r.Name)
		if n == "" {
			respondErr(c, http.StatusBadRequest, "invalid_body", "a topic name is needed")
			return
		}
		t.Name = n
	}
	if r.ChapterID != "" && r.ChapterID != t.ChapterID.String() {
		var ch models.Chapter
		if h.DB.Where("id = ? AND subject_id = ?", r.ChapterID, t.SubjectID).First(&ch).Error != nil {
			respondErr(c, http.StatusBadRequest, "invalid_chapter", "that chapter is not in this topic's subject")
			return
		}
		t.ChapterID = ch.ID
	}
	h.DB.Save(&t)
	c.JSON(http.StatusOK, t)
}

// ManageSchemaDelete removes a topic with its year rows and every student's status on it.
func (h *StudyHandler) ManageSchemaDelete(c *gin.Context) {
	id := c.Param("id")
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("topic_id = ?", id).Delete(&models.SchemaYear{}).Error; err != nil {
			return err
		}
		if err := tx.Where("topic_id = ?", id).Delete(&models.SchemaStatus{}).Error; err != nil {
			return err
		}
		return tx.Delete(&models.SchemaTopic{}, "id = ?", id).Error
	})
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "could not delete")
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

// ManageSchemaYears replaces a topic's Year | Subtopic | Qs rows.
func (h *StudyHandler) ManageSchemaYears(c *gin.Context) {
	var t models.SchemaTopic
	if h.DB.First(&t, "id = ?", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "not_found", "topic not found")
		return
	}
	var r struct {
		Rows []struct {
			Year      string `json:"year"`
			Subtopic  string `json:"subtopic"`
			Questions int    `json:"questions"`
		} `json:"rows"`
	}
	if c.ShouldBindJSON(&r) != nil || len(r.Rows) > 500 {
		respondErr(c, http.StatusBadRequest, "invalid_body", "send up to 500 rows")
		return
	}
	var out []models.SchemaYear
	for i, row := range r.Rows {
		y, re, ok := parseYear(row.Year)
		if !ok || row.Questions < 0 {
			respondErr(c, http.StatusUnprocessableEntity, "invalid_rows", "row "+strconv.Itoa(i+1)+": the year must look like 2022 or 2022 Re, and questions must be 0 or more")
			return
		}
		out = append(out, models.SchemaYear{TopicID: t.ID, Year: y, ReExam: re, Subtopic: strings.TrimSpace(row.Subtopic), Questions: row.Questions})
	}
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("topic_id = ?", t.ID).Delete(&models.SchemaYear{}).Error; err != nil {
			return err
		}
		if len(out) > 0 {
			return tx.Create(&out).Error
		}
		return nil
	})
	if err != nil {
		respondErr(c, http.StatusInternalServerError, "internal", "could not save")
		return
	}
	c.JSON(http.StatusOK, gin.H{"rows": len(out)})
}

// PulseMove swaps an item with its neighbour in the same chapter (direction "up" or "down").
func (h *StudyHandler) TeacherPulseMove(c *gin.Context) {
	var it models.PulseItem
	if h.DB.First(&it, "id = ?", c.Param("id")).Error != nil {
		respondErr(c, http.StatusNotFound, "not_found", "item not found")
		return
	}
	var r struct {
		Direction string `json:"direction"`
	}
	if c.ShouldBindJSON(&r) != nil || (r.Direction != "up" && r.Direction != "down") {
		respondErr(c, http.StatusBadRequest, "invalid_body", "direction must be up or down")
		return
	}
	var peers []models.PulseItem
	h.DB.Where("chapter_id = ? AND is_active", it.ChapterID).Order("order_index, created_at").Find(&peers)
	idx := -1
	for i, p := range peers {
		if p.ID == it.ID {
			idx = i
		}
	}
	j := idx - 1
	if r.Direction == "down" {
		j = idx + 1
	}
	if idx >= 0 && j >= 0 && j < len(peers) {
		peers[idx], peers[j] = peers[j], peers[idx]
	}
	for i := range peers {
		h.DB.Model(&models.PulseItem{}).Where("id = ?", peers[i].ID).Update("order_index", i+1)
	}
	c.JSON(http.StatusOK, gin.H{"moved": true})
}
