package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	"codon-backend/internal/models"
	"codon-backend/internal/richtext"
	"codon-backend/internal/validate"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// QuestionService owns every write to a question: validation, taxonomy
// resolution, content hashing, tag handling and the test_questions dual-write.
type QuestionService struct {
	DB *gorm.DB
	// RefSaver validates+stores media references (injected by the media
	// package's SaveRefs to avoid an import cycle). nil = no media support.
	RefSaver func(ctx context.Context, tx *gorm.DB, actor *models.User, ownerType string, ownerID uuid.UUID, format string, fields []RichField) error
}

// RichField is one rich-text field of a question (mirrors media.Field).
type RichField struct {
	Name string
	Text string
	Kind string
}

func NewQuestionService(db *gorm.DB) *QuestionService { return &QuestionService{DB: db} }

// QuestionInput is a create request or a patch. Pointer fields = "set if present".
type QuestionInput struct {
	QuestionText  *string
	OptionA       *string
	OptionB       *string
	OptionC       *string
	OptionD       *string
	CorrectOption *string
	Explanation   *string // empty string clears
	ContentFormat *string

	SubjectID      *uuid.UUID
	ChapterID      *uuid.UUID
	TopicID        *uuid.UUID
	ClearTopic     bool
	Difficulty     *string // "" clears
	NCERTClass     *int
	NCERTPage      *int
	SourceType     *string
	SourceYear     *int
	SourceLabel    *string
	CustomEligible *bool
	Tags           *[]string // replace the tag set when non-nil
}

// ContentChanged reports whether the patch touches what students see/score.
func (in QuestionInput) ContentChanged() bool {
	return in.QuestionText != nil || in.OptionA != nil || in.OptionB != nil || in.OptionC != nil ||
		in.OptionD != nil || in.CorrectOption != nil || in.Explanation != nil || in.ContentFormat != nil
}

type Warning struct {
	Code       string    `json:"code"`
	QuestionID uuid.UUID `json:"question_id,omitempty"`
	Message    string    `json:"message"`
}

// ── Hashing & duplicates ──────────────────────────────────────────────────────

// ContentHash is sha256(stem ⟂ A ⟂ B ⟂ C ⟂ D ⟂ sorted media hashes) over the
// normalised text (lower-case, NFKC, markup stripped) — so the same question
// re-typed with different spacing/markup hashes equal, and the same image
// uploaded twice counts as one.
func ContentHash(ctx context.Context, db *gorm.DB, q *models.Question) string {
	f := q.ContentFormat
	parts := []string{
		richtext.Normalize(q.QuestionText, f), richtext.Normalize(q.OptionA, f), richtext.Normalize(q.OptionB, f),
		richtext.Normalize(q.OptionC, f), richtext.Normalize(q.OptionD, f),
	}
	ids := richtext.ExtractMediaRefs(f, q.QuestionText, q.OptionA, q.OptionB, q.OptionC, q.OptionD)
	if len(ids) > 0 && db != nil {
		var shas []string
		db.WithContext(ctx).Model(&models.MediaAsset{}).Where("id IN ?", ids).Pluck("sha256", &shas)
		sort.Strings(shas)
		parts = append(parts, shas...)
	}
	sum := sha256.Sum256([]byte(strings.Join(parts, "\x1f")))
	return hex.EncodeToString(sum[:])
}

// FindDuplicates returns other questions with the same content hash.
func (s *QuestionService) FindDuplicates(ctx context.Context, hash string, exclude uuid.UUID, limit int) []models.Question {
	var out []models.Question
	q := s.DB.WithContext(ctx).Where("content_hash = ?", hash)
	if exclude != uuid.Nil {
		q = q.Where("id <> ?", exclude)
	}
	q.Limit(limit).Find(&out)
	return out
}

func dupWarnings(dups []models.Question) []Warning {
	var w []Warning
	for _, d := range dups {
		w = append(w, Warning{Code: "possible_duplicate", QuestionID: d.ID, Message: "an identical question already exists"})
	}
	return w
}

// ── Tags ──────────────────────────────────────────────────────────────────────

var slugRe = regexp.MustCompile(`[^a-z0-9\-]+`)

// TagSlug normalises a free-form tag: "#NEET  Bio" → "neet-bio".
func TagSlug(label string) string {
	s := strings.ToLower(strings.TrimSpace(label))
	s = strings.TrimLeft(s, "#")
	s = strings.Join(strings.Fields(s), "-")
	s = slugRe.ReplaceAllString(s, "")
	return strings.Trim(s, "-")
}

// ResolveTags maps labels to canonical tag rows, creating unknown ones and
// following aliases.
func ResolveTags(tx *gorm.DB, labels []string) ([]models.Tag, error) {
	seen := map[uuid.UUID]bool{}
	var out []models.Tag
	for _, l := range labels {
		slug := TagSlug(l)
		if slug == "" {
			continue
		}
		var t models.Tag
		err := tx.Where("slug = ?", slug).First(&t).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			t = models.Tag{Slug: slug, Label: strings.TrimSpace(strings.TrimLeft(strings.TrimSpace(l), "#"))}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&t).Error; err != nil {
				return nil, err
			}
			if err := tx.Where("slug = ?", slug).First(&t).Error; err != nil {
				return nil, err
			}
		} else if err != nil {
			return nil, err
		}
		if t.AliasOf != nil {
			var canon models.Tag
			if err := tx.First(&canon, "id = ?", *t.AliasOf).Error; err == nil {
				t = canon
			}
		}
		if !seen[t.ID] {
			seen[t.ID] = true
			out = append(out, t)
		}
	}
	return out, nil
}

func setQuestionTags(tx *gorm.DB, qid uuid.UUID, labels []string) error {
	tags, err := ResolveTags(tx, labels)
	if err != nil {
		return err
	}
	if len(tags) > 10 {
		return Invalid("too_many_tags", "at most 10 tags per question")
	}
	if err := tx.Where("question_id = ?", qid).Delete(&models.QuestionTag{}).Error; err != nil {
		return err
	}
	for _, t := range tags {
		if err := tx.Create(&models.QuestionTag{QuestionID: qid, TagID: t.ID}).Error; err != nil {
			return err
		}
	}
	return nil
}

// LoadTags attaches Tags to the given questions.
func LoadTags(ctx context.Context, db *gorm.DB, qs []models.Question) {
	if len(qs) == 0 {
		return
	}
	ids := make([]uuid.UUID, len(qs))
	idx := map[uuid.UUID]int{}
	for i, q := range qs {
		ids[i] = q.ID
		idx[q.ID] = i
	}
	var rows []struct {
		QuestionID uuid.UUID
		models.Tag
	}
	db.WithContext(ctx).Table("question_tags qt").
		Select("qt.question_id, tags.*").Joins("JOIN tags ON tags.id = qt.tag_id").
		Where("qt.question_id IN ?", ids).Scan(&rows)
	for _, r := range rows {
		i := idx[r.QuestionID]
		qs[i].Tags = append(qs[i].Tags, r.Tag)
	}
}

// ── Validation & resolution ───────────────────────────────────────────────────

func (s *QuestionService) resolveTaxonomy(ctx context.Context, q *models.Question, test *models.Test, in QuestionInput) error {
	if in.ChapterID != nil {
		q.ChapterID = in.ChapterID
	}
	if in.SubjectID != nil {
		q.SubjectID = in.SubjectID
	}
	// Inherit from the parent test when unset.
	if q.ChapterID == nil && test != nil {
		q.ChapterID = test.ChapterID
	}
	if q.SubjectID == nil && test != nil {
		q.SubjectID = test.SubjectID
	}
	if q.ChapterID != nil {
		var ch models.Chapter
		if err := s.DB.WithContext(ctx).Preload("Subject").First(&ch, "id = ?", *q.ChapterID).Error; err != nil {
			return Invalid("unknown_chapter", "chapter not found")
		}
		if q.SubjectID != nil && *q.SubjectID != ch.SubjectID {
			return Invalid("chapter_subject_mismatch", "chapter does not belong to the given subject")
		}
		sid := ch.SubjectID
		q.SubjectID = &sid
		if test != nil && ch.Subject.CourseID != test.CourseID {
			return Invalid("chapter_course_mismatch", "chapter belongs to a different course than the test")
		}
	} else if q.SubjectID != nil {
		var sub models.Subject
		if err := s.DB.WithContext(ctx).First(&sub, "id = ?", *q.SubjectID).Error; err != nil {
			return Invalid("unknown_subject", "subject not found")
		}
		if test != nil && sub.CourseID != test.CourseID {
			return Invalid("subject_course_mismatch", "subject belongs to a different course than the test")
		}
	}
	if in.ClearTopic {
		q.TopicID = nil
	}
	if in.TopicID != nil {
		var tp models.Topic
		if err := s.DB.WithContext(ctx).First(&tp, "id = ?", *in.TopicID).Error; err != nil {
			return Invalid("unknown_topic", "topic not found")
		}
		if q.ChapterID != nil && tp.ChapterID != *q.ChapterID {
			return Invalid("topic_chapter_mismatch", "topic does not belong to the chapter")
		}
		q.TopicID = in.TopicID
	}
	return nil
}

func applyScalars(q *models.Question, in QuestionInput) error {
	set := func(dst *string, src *string) {
		if src != nil {
			*dst = *src
		}
	}
	set(&q.QuestionText, in.QuestionText)
	set(&q.OptionA, in.OptionA)
	set(&q.OptionB, in.OptionB)
	set(&q.OptionC, in.OptionC)
	set(&q.OptionD, in.OptionD)
	if in.CorrectOption != nil {
		opt := strings.ToUpper(strings.TrimSpace(*in.CorrectOption))
		if opt != "A" && opt != "B" && opt != "C" && opt != "D" {
			return Coded(http.StatusBadRequest, "invalid_option", "correct_option must be A, B, C, or D")
		}
		q.CorrectOption = models.CorrectOption(opt)
	}
	if in.Explanation != nil {
		if strings.TrimSpace(*in.Explanation) == "" {
			q.Explanation = nil
		} else {
			e := *in.Explanation
			q.Explanation = &e
		}
	}
	if in.ContentFormat != nil {
		if *in.ContentFormat != richtext.FormatPlain && *in.ContentFormat != richtext.FormatRichV1 {
			return Coded(http.StatusBadRequest, "invalid_format", "content_format must be plain or rich_v1")
		}
		q.ContentFormat = *in.ContentFormat
	}
	if in.Difficulty != nil {
		if *in.Difficulty == "" {
			q.Difficulty = nil
		} else {
			if err := validate.EnumErr("difficulty", *in.Difficulty, validate.Difficulties); err != nil {
				return Coded(http.StatusBadRequest, "invalid_difficulty", err.Error())
			}
			d := *in.Difficulty
			q.Difficulty = &d
		}
	}
	if in.NCERTClass != nil {
		if *in.NCERTClass < 0 || *in.NCERTClass > 12 {
			return Coded(http.StatusBadRequest, "invalid_ncert", "ncert_class must be between 1 and 12")
		}
		q.NCERTClass = in.NCERTClass
	}
	if in.NCERTPage != nil {
		if *in.NCERTPage < 0 || *in.NCERTPage > 2000 {
			return Coded(http.StatusBadRequest, "invalid_ncert", "ncert_page out of range")
		}
		q.NCERTPage = in.NCERTPage
	}
	if in.SourceType != nil {
		if err := validate.EnumErr("source_type", *in.SourceType, validate.SourceTypes); err != nil {
			return Coded(http.StatusBadRequest, "invalid_source_type", err.Error())
		}
		q.SourceType = *in.SourceType
	}
	if in.SourceYear != nil {
		if *in.SourceYear < 1900 || *in.SourceYear > time.Now().Year()+1 {
			return Coded(http.StatusBadRequest, "invalid_source_year", "source_year out of range")
		}
		q.SourceYear = in.SourceYear
	}
	if in.SourceLabel != nil {
		q.SourceLabel = in.SourceLabel
	}
	if in.CustomEligible != nil {
		q.CustomEligible = *in.CustomEligible
	}
	return nil
}

func (s *QuestionService) validateContent(q *models.Question) error {
	for name, v := range map[string]string{"question_text": q.QuestionText, "option_a": q.OptionA, "option_b": q.OptionB, "option_c": q.OptionC, "option_d": q.OptionD} {
		if !richtext.HasText(v, q.ContentFormat) {
			return Invalid("missing_content", name+" must not be empty", map[string]string{"field": name})
		}
	}
	if q.CorrectOption == "" {
		return Coded(http.StatusBadRequest, "invalid_option", "correct_option must be A, B, C, or D")
	}
	return nil
}

func (s *QuestionService) richFields(q *models.Question) []RichField {
	fs := []RichField{
		{"question_text", q.QuestionText, "stem"}, {"option_a", q.OptionA, "option"}, {"option_b", q.OptionB, "option"},
		{"option_c", q.OptionC, "option"}, {"option_d", q.OptionD, "option"},
	}
	if q.Explanation != nil {
		fs = append(fs, RichField{"explanation", *q.Explanation, "explanation"})
	}
	return fs
}

// prepare applies a patch to q and validates the result (no persistence).
func (s *QuestionService) prepare(ctx context.Context, q *models.Question, test *models.Test, in QuestionInput) error {
	if err := applyScalars(q, in); err != nil {
		return err
	}
	if err := s.resolveTaxonomy(ctx, q, test, in); err != nil {
		return err
	}
	return s.validateContent(q)
}

// ── Create / Update / Delete ──────────────────────────────────────────────────

// Create adds a question to a (draft/rejected) test. Returns duplicate warnings.
func (s *QuestionService) Create(ctx context.Context, actor *models.User, test *models.Test, in QuestionInput) (*models.Question, []Warning, error) {
	q := models.Question{
		TestID: test.ID, ContentFormat: richtext.FormatRichV1, SourceType: sourceTypeFor(test), CustomEligible: true,
		QuestionType: "mcq_single", Version: 1, Lang: "en", FlagStatus: models.FlagActive,
	}
	if err := applyScalars(&q, in); err != nil {
		return nil, nil, err
	}
	if err := s.resolveTaxonomy(ctx, &q, test, in); err != nil {
		return nil, nil, err
	}
	if err := s.validateContent(&q); err != nil {
		return nil, nil, err
	}
	var warnings []Warning
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var maxOrder struct{ MaxIdx int }
		tx.Model(&models.Question{}).Select("COALESCE(MAX(order_index), 0) AS max_idx").Where("test_id = ?", test.ID).Scan(&maxOrder)
		q.OrderIndex = maxOrder.MaxIdx + 1
		q.ID = uuid.New()
		if s.RefSaver != nil {
			if err := s.RefSaver(ctx, tx, actor, "question", q.ID, q.ContentFormat, s.richFields(&q)); err != nil {
				return err
			}
		}
		q.ContentHash = ContentHash(ctx, tx, &q)
		if err := tx.Create(&q).Error; err != nil {
			return err
		}
		if err := AddQuestionToTest(tx, test.ID, q.ID, q.OrderIndex); err != nil {
			return err
		}
		if in.Tags != nil {
			if err := setQuestionTags(tx, q.ID, *in.Tags); err != nil {
				return err
			}
		}
		if err := tx.Model(&models.Test{}).Where("id = ?", test.ID).
			UpdateColumn("total_questions", gorm.Expr("total_questions + 1")).Error; err != nil {
			return err
		}
		warnings = dupWarnings(s.FindDuplicates(ctx, q.ContentHash, q.ID, 3))
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	return &q, warnings, nil
}

func sourceTypeFor(t *models.Test) string {
	switch t.ModuleType {
	case models.ModuleTestSeries:
		return "test_series"
	case models.ModulePractice:
		return "practice"
	}
	return "qbank"
}

// Update applies a patch. Content changes require the parent test to be
// draft/rejected; metadata-only patches are allowed on live questions.
func (s *QuestionService) Update(ctx context.Context, actor *models.User, q *models.Question, test *models.Test, in QuestionInput) ([]Warning, error) {
	editable := test.Status == models.StatusDraft || test.Status == models.StatusRejected
	if in.ContentChanged() && !editable {
		return nil, Conflict("question_locked", "this question is live — submit a correction instead of editing it directly")
	}
	before := *q
	if err := applyScalars(q, in); err != nil {
		return nil, err
	}
	if err := s.resolveTaxonomy(ctx, q, test, in); err != nil {
		return nil, err
	}
	if err := s.validateContent(q); err != nil {
		return nil, err
	}
	var warnings []Warning
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if in.ContentChanged() && s.RefSaver != nil {
			if err := s.RefSaver(ctx, tx, actor, "question", q.ID, q.ContentFormat, s.richFields(q)); err != nil {
				return err
			}
		}
		q.ContentHash = ContentHash(ctx, tx, q)
		if err := tx.Save(q).Error; err != nil {
			return err
		}
		if in.Tags != nil {
			if err := setQuestionTags(tx, q.ID, *in.Tags); err != nil {
				return err
			}
		}
		if !in.ContentChanged() && !editable {
			// metadata edit on a live question — audited.
			return tx.Create(&models.AdminAuditLog{ActorID: actor.ID, Action: "question.metadata_update",
				Target: "question:" + q.ID.String(), Before: metaJSON(&before), After: metaJSON(q)}).Error
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if q.ContentHash != before.ContentHash {
		warnings = dupWarnings(s.FindDuplicates(ctx, q.ContentHash, q.ID, 3))
	}
	return warnings, nil
}

func metaJSON(q *models.Question) models.JSONB {
	m := map[string]interface{}{
		"subject_id": q.SubjectID, "chapter_id": q.ChapterID, "topic_id": q.TopicID, "difficulty": q.Difficulty,
		"ncert_class": q.NCERTClass, "ncert_page": q.NCERTPage, "source_type": q.SourceType, "custom_eligible": q.CustomEligible,
	}
	return jsonBytes(m)
}

// Delete removes a question and everything that hangs off it (draft tests only).
func (s *QuestionService) Delete(ctx context.Context, q *models.Question, test *models.Test) error {
	if test.Status != models.StatusDraft && test.Status != models.StatusRejected {
		return Conflict("question_locked", "questions can only be deleted while the test is in draft or rejected state")
	}
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return DeleteQuestionCascade(tx, q.ID, test.ID)
	})
}

// DeleteQuestionCascade removes a question and its dependents inside tx.
func DeleteQuestionCascade(tx *gorm.DB, questionID, testID uuid.UUID) error {
	for _, stmt := range []struct {
		table string
		col   string
	}{
		{"attempt_answers", "question_id"}, {"test_questions", "question_id"}, {"question_tags", "question_id"},
		{"student_question_states", "question_id"}, {"question_notes", "question_id"}, {"question_stats", "question_id"},
		{"question_revisions", "question_id"},
	} {
		if err := tx.Exec(fmt.Sprintf("DELETE FROM %s WHERE %s = ?", stmt.table, stmt.col), questionID).Error; err != nil {
			return err
		}
	}
	for _, t := range []string{"bookmarks", "content_reports", "ratings"} {
		if err := tx.Exec(fmt.Sprintf("DELETE FROM %s WHERE item_type = 'question' AND item_id = ?", t), questionID).Error; err != nil {
			return err
		}
	}
	if err := tx.Exec("DELETE FROM media_refs WHERE owner_type = 'question' AND owner_id = ?", questionID).Error; err != nil {
		return err
	}
	if err := tx.Delete(&models.Question{}, "id = ?", questionID).Error; err != nil {
		return err
	}
	return tx.Model(&models.Test{}).Where("id = ?", testID).
		UpdateColumn("total_questions", gorm.Expr("GREATEST(total_questions - 1, 0)")).Error
}

// ── Publish gate ──────────────────────────────────────────────────────────────

type MissingQuestion struct {
	QuestionID uuid.UUID `json:"question_id"`
	Fields     []string  `json:"fields"`
}

// CheckPublishGate enforces D16 for Q Bank/Practice tests: at least one
// question, every question has a chapter + difficulty, all images are ready.
// Test Series tests are exempt from the metadata requirement.
func (s *QuestionService) CheckPublishGate(ctx context.Context, test *models.Test) error {
	qs, err := LoadTestQuestions(ctx, s.DB, test.ID)
	if err != nil {
		return err
	}
	if len(qs) == 0 {
		return Invalid("incomplete_questions", "add at least one question before submitting", map[string]interface{}{"missing": []MissingQuestion{}})
	}
	var missing []MissingQuestion
	if test.ModuleType != models.ModuleTestSeries {
		for _, q := range qs {
			var f []string
			if q.ChapterID == nil {
				f = append(f, "chapter")
			}
			if q.Difficulty == nil {
				f = append(f, "difficulty")
			}
			if len(f) > 0 {
				missing = append(missing, MissingQuestion{q.ID, f})
			}
		}
	}
	// every referenced image must be ready
	var notReady []uuid.UUID
	s.DB.WithContext(ctx).Raw(`SELECT DISTINCT r.owner_id FROM media_refs r JOIN media_assets m ON m.id = r.media_id
		WHERE r.owner_type = 'question' AND m.status <> 'ready'
		  AND r.owner_id IN (SELECT question_id FROM test_questions WHERE test_id = ?)`, test.ID).Scan(&notReady)
	for _, id := range notReady {
		missing = append(missing, MissingQuestion{id, []string{"image_not_ready"}})
	}
	if len(missing) > 0 {
		return Invalid("incomplete_questions", "some questions are missing required details", map[string]interface{}{"missing": missing})
	}
	return nil
}
