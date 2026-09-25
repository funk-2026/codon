package services

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"path"
	"strconv"
	"strings"
	"time"

	"codon-backend/internal/jobs"
	"codon-backend/internal/models"
	"codon-backend/internal/richtext"
	"codon-backend/internal/settings"
	"codon-backend/internal/storage"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ImageIngestor is implemented by the media service; it is an interface here
// so services does not import media (media imports services).
type ImageIngestor interface {
	IngestValidate(data []byte) error
	IngestCreate(ctx context.Context, ownerID uuid.UUID, fileName string, data []byte) (uuid.UUID, error)
	LibraryLookup(ctx context.Context, ownerID uuid.UUID, fileName string) (uuid.UUID, bool)
}

type CSVImportService struct {
	DB     *gorm.DB
	QS     *QuestionService
	Images ImageIngestor
}

func NewCSVImportService(db *gorm.DB) *CSVImportService {
	return &CSVImportService{DB: db, QS: NewQuestionService(db)}
}

// Import modes.
const (
	ImportModeValidate = "validate"
	ImportModeCommit   = "commit"
	ImportModeUpdate   = "update"
)

// Row error codes.
const (
	CodeMissingColumn     = "MISSING_COLUMN"
	CodeMissingField      = "MISSING_FIELD"
	CodeBadEnum           = "BAD_ENUM"
	CodeBadNumber         = "BAD_NUMBER"
	CodeUnknownChapter    = "UNKNOWN_CHAPTER"
	CodeUnknownSubject    = "UNKNOWN_SUBJECT"
	CodeUnknownTopic      = "UNKNOWN_TOPIC"
	CodeMissingImage      = "MISSING_IMAGE"
	CodeImageInvalid      = "IMAGE_INVALID"
	CodeImageTooLarge     = "IMAGE_TOO_LARGE"
	CodeDuplicateInFile   = "DUPLICATE_IN_FILE"
	CodePossibleDuplicate = "POSSIBLE_DUPLICATE"
	CodeInvalidContent    = "INVALID_CONTENT"
	CodeNotFound          = "QUESTION_NOT_FOUND"
	CodeContentLocked     = "CONTENT_UPDATE_NOT_ALLOWED"
	CodeParse             = "CSV_PARSE_ERROR"
	CodeDBError           = "DB_ERROR"
	CodeUnusedImage       = "UNREFERENCED_IMAGE"
)

// v2-only columns (presence switches the file to template v2).
var v2Columns = []string{"subject", "chapter", "topic", "difficulty", "ncert_class", "ncert_page", "tags", "source_type", "source_year",
	"custom_eligible", "question_id", "question_image", "option_a_image", "option_b_image", "option_c_image", "option_d_image",
	"explanation_image", "question_image_alt", "option_a_image_alt", "option_b_image_alt", "option_c_image_alt", "option_d_image_alt", "explanation_image_alt"}

// TemplateColumn documents one column for the template endpoint.
type TemplateColumn struct {
	Name        string   `json:"name"`
	Required    bool     `json:"required"`
	Description string   `json:"description"`
	Allowed     []string `json:"allowed,omitempty"`
	Example     string   `json:"example"`
}

// TemplateSpec returns the documented columns for a template version.
func TemplateSpec(version int) []TemplateColumn {
	v1 := []TemplateColumn{
		{"question_text", true, "The question stem", nil, "Which organelle is the powerhouse of the cell?"},
		{"option_a", true, "Option A", nil, "Nucleus"}, {"option_b", true, "Option B", nil, "Mitochondria"},
		{"option_c", true, "Option C", nil, "Ribosome"}, {"option_d", true, "Option D", nil, "Golgi body"},
		{"correct_option", true, "Correct option", []string{"A", "B", "C", "D"}, "B"},
		{"explanation", false, "Shown after the test", nil, "Mitochondria make ATP."},
	}
	if version < 2 {
		return v1
	}
	return append(v1, []TemplateColumn{
		{"subject", false, "Subject name or id (defaults to the test's)", nil, "Biology"},
		{"chapter", false, "Chapter name or id (defaults to the test's)", nil, "Cell Structure"},
		{"topic", false, "Topic name within the chapter", nil, "Organelles"},
		{"difficulty", false, "Required to submit a Q Bank/Practice test for review", []string{"easy", "medium", "hard"}, "medium"},
		{"ncert_class", false, "NCERT class 1-12", nil, "11"}, {"ncert_page", false, "NCERT page number", nil, "132"},
		{"tags", false, "Pipe-separated tags", nil, "cell|organelle"},
		{"source_type", false, "Where the question comes from", []string{"qbank", "practice", "test_series", "pyq", "other"}, "pyq"},
		{"source_year", false, "Year, for previous-year questions", nil, "2021"},
		{"custom_eligible", false, "Allow use in students' custom tests", []string{"true", "false"}, "true"},
		{"question_image", false, "Image file name (from the ZIP or your media library) shown under the stem", nil, "cell.png"},
		{"option_a_image", false, "Image for option A", nil, ""}, {"option_b_image", false, "Image for option B", nil, ""},
		{"option_c_image", false, "Image for option C", nil, ""}, {"option_d_image", false, "Image for option D", nil, ""},
		{"explanation_image", false, "Image shown in the explanation", nil, ""},
		{"question_image_alt", false, "Alt text for the stem image (recommended)", nil, "Cross-section of a cell"},
		{"question_id", false, "Update mode only: the question to update", nil, ""},
	}...)
}

type importSummary struct {
	Rows            int            `json:"rows"`
	OK              int            `json:"ok"`
	Errors          int            `json:"errors"`
	Warnings        int            `json:"warnings"`
	ByCode          map[string]int `json:"by_code"`
	ImagesFound     int            `json:"images_found"`
	ImagesMissing   []string       `json:"images_missing"`
	UnusedImages    []string       `json:"unreferenced_images"`
	TemplateVersion int            `json:"template_version"`
}

// HandleCSVImport is the background job handler.
func (s *CSVImportService) HandleCSVImport(ctx context.Context, payload string) error {
	var p jobs.CSVImportPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("invalid payload: %w", err)
	}
	var batch models.CSVImportBatch
	if err := s.DB.WithContext(ctx).Where("id = ?", p.BatchID).First(&batch).Error; err != nil {
		return fmt.Errorf("batch not found: %w", err)
	}
	if storage.Store == nil {
		return fmt.Errorf("storage not configured — cannot download %s", batch.FileKey)
	}
	if err := s.Run(ctx, &batch); err != nil {
		now := time.Now()
		s.DB.WithContext(ctx).Model(&batch).Updates(map[string]interface{}{"status": models.ImportFailed, "completed_at": now})
		s.logRowError(ctx, batch.ID, 0, "", "", "error", CodeParse, err.Error(), nil)
		return nil // reported on the batch; retrying a broken file won't help
	}
	return nil
}

// Run executes an import batch (validate / commit / update).
func (s *CSVImportService) Run(ctx context.Context, batch *models.CSVImportBatch) error {
	var test models.Test
	if err := s.DB.WithContext(ctx).First(&test, "id = ?", batch.TestID).Error; err != nil {
		return fmt.Errorf("test not found")
	}
	var teacher models.User
	if err := s.DB.WithContext(ctx).First(&teacher, "id = ?", batch.TeacherID).Error; err != nil {
		return fmt.Errorf("uploader not found")
	}

	// ── Load the CSV (and optional image bundle) ──
	var csvBytes []byte
	images := map[string][]byte{} // lower-cased base name → bytes
	var bundleErr error
	if batch.BundleKey != nil && *batch.BundleKey != "" {
		zbytes, err := readAll(ctx, *batch.BundleKey)
		if err != nil {
			return fmt.Errorf("downloading bundle: %w", err)
		}
		csvBytes, images, bundleErr = s.unzip(zbytes)
		if bundleErr != nil {
			return bundleErr
		}
	}
	if batch.FileKey != "" {
		b, err := readAll(ctx, batch.FileKey)
		if err != nil {
			return fmt.Errorf("downloading CSV: %w", err)
		}
		csvBytes = b
	}
	if len(csvBytes) == 0 {
		return fmt.Errorf("no CSV found (upload a CSV, or a ZIP containing questions.csv)")
	}
	sum := sha256.Sum256(csvBytes)
	hash := hex.EncodeToString(sum[:])
	if batch.Mode == ImportModeCommit && batch.ParentBatchID != nil {
		var parent models.CSVImportBatch
		if s.DB.WithContext(ctx).First(&parent, "id = ?", *batch.ParentBatchID).Error == nil && parent.FileSHA256 != "" && parent.FileSHA256 != hash {
			return fmt.Errorf("the file changed since it was validated — validate again before committing")
		}
	}

	r := csv.NewReader(bytes.NewReader(csvBytes))
	r.FieldsPerRecord = -1
	r.LazyQuotes = true
	header, err := r.Read()
	if err != nil {
		return fmt.Errorf("reading CSV header: %w", err)
	}
	col := map[string]int{}
	for i, h := range header {
		col[strings.ToLower(strings.TrimSpace(strings.TrimPrefix(h, "\uFEFF")))] = i
	}
	version := 1
	for _, c := range v2Columns {
		if _, ok := col[c]; ok {
			version = 2
		}
	}
	if batch.Mode == ImportModeUpdate {
		if _, ok := col["question_id"]; !ok {
			if _, ok := col["question_text"]; !ok {
				return fmt.Errorf("update mode needs a question_id column (or question_text to match by content)")
			}
		}
		version = 2
	} else {
		for _, req := range []string{"question_text", "option_a", "option_b", "option_c", "option_d", "correct_option"} {
			if _, ok := col[req]; !ok {
				return fmt.Errorf("missing required column: %s", req)
			}
		}
	}

	sumry := importSummary{ByCode: map[string]int{}, TemplateVersion: version}
	maxRows := settings.Int("import.max_rows")
	env := &importEnv{s: s, ctx: ctx, batch: batch, test: &test, teacher: &teacher, col: col, images: images,
		version: version, usedImages: map[string]bool{}, seenHash: map[string]int{}, sum: &sumry, imgCache: map[string]imageResult{}}
	env.loadCourseTaxonomy()

	rowNum := 1
	for {
		row, err := r.Read()
		if err == io.EOF {
			break
		}
		rowNum++
		if err != nil {
			env.fail(rowNum, "", CodeParse, fmt.Sprintf("CSV parse error: %v", err), row)
			continue
		}
		if rowNum-1 > maxRows {
			env.fail(rowNum, "", CodeParse, fmt.Sprintf("too many rows — at most %d per import", maxRows), row)
			break
		}
		if isBlank(row) {
			continue
		}
		sumry.Rows++
		switch batch.Mode {
		case ImportModeUpdate:
			env.updateRow(rowNum, row)
		default:
			env.createRow(rowNum, row)
		}
	}

	for name := range images {
		if !env.usedImages[name] {
			sumry.UnusedImages = append(sumry.UnusedImages, name)
		}
	}
	for _, n := range sumry.UnusedImages {
		s.logRowError(ctx, batch.ID, 0, "images", n, "warning", CodeUnusedImage, "image in the ZIP is not referenced by any row", nil)
		sumry.Warnings++
	}

	if batch.Mode == ImportModeCommit && sumry.OK > 0 {
		s.DB.WithContext(ctx).Model(&models.Test{}).Where("id = ?", test.ID).
			UpdateColumn("total_questions", gorm.Expr("(SELECT count(*) FROM test_questions WHERE test_id = ?)", test.ID))
	}
	status := models.ImportCompleted
	if sumry.Errors > 0 {
		status = models.ImportCompletedWithErrors
	}
	raw, _ := json.Marshal(sumry)
	now := time.Now()
	return s.DB.WithContext(ctx).Model(batch).Updates(map[string]interface{}{
		"total_rows": sumry.OK + sumry.Errors, "success_rows": sumry.OK, "error_rows": sumry.Errors, "warning_rows": sumry.Warnings,
		"status": status, "completed_at": now, "file_sha256": hash, "template_version": version, "summary": models.JSONB(raw),
		"applied": batch.Mode != ImportModeValidate,
	}).Error
}

func readAll(ctx context.Context, key string) ([]byte, error) {
	rc, err := storage.Store.DownloadObject(ctx, key)
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return io.ReadAll(rc)
}

func isBlank(row []string) bool {
	for _, c := range row {
		if strings.TrimSpace(c) != "" {
			return false
		}
	}
	return true
}

// unzip extracts questions.csv and images with zip-slip, entry-count,
// uncompressed-size and compression-ratio (bomb) protection.
func (s *CSVImportService) unzip(data []byte) (csvBytes []byte, images map[string][]byte, err error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, nil, fmt.Errorf("bundle is not a valid zip file")
	}
	maxFiles := settings.Int("import.max_bundle_files")
	if len(zr.File) > maxFiles {
		return nil, nil, fmt.Errorf("bundle has too many files (max %d)", maxFiles)
	}
	perFile := settings.Int64("media.max_bytes") * 4
	var total int64
	totalCap := int64(500 << 20)
	images = map[string][]byte{}
	for _, f := range zr.File {
		name := f.Name
		if f.FileInfo().IsDir() {
			continue
		}
		if strings.Contains(name, "..") || strings.HasPrefix(name, "/") || strings.Contains(name, "\\") {
			return nil, nil, fmt.Errorf("bundle contains an unsafe path: %q", name)
		}
		if strings.HasPrefix(path.Base(name), ".") || strings.HasPrefix(name, "__MACOSX") {
			continue
		}
		if f.UncompressedSize64 > uint64(perFile) {
			return nil, nil, fmt.Errorf("%q is too large", name)
		}
		if f.CompressedSize64 > 0 && f.UncompressedSize64/f.CompressedSize64 > 200 {
			return nil, nil, fmt.Errorf("%q has a suspicious compression ratio", name)
		}
		total += int64(f.UncompressedSize64)
		if total > totalCap {
			return nil, nil, fmt.Errorf("bundle is too large when extracted")
		}
		rc, err := f.Open()
		if err != nil {
			return nil, nil, err
		}
		b, err := io.ReadAll(io.LimitReader(rc, perFile+1))
		rc.Close()
		if err != nil || int64(len(b)) > perFile {
			return nil, nil, fmt.Errorf("%q could not be read safely", name)
		}
		base := strings.ToLower(path.Base(name))
		if base == "questions.csv" {
			csvBytes = b
			continue
		}
		images[base] = b
	}
	return csvBytes, images, nil
}

// ── Row processing ───────────────────────────────────────────────────────────

type imageResult struct {
	id  uuid.UUID
	err *CodedError
}

type importEnv struct {
	s          *CSVImportService
	ctx        context.Context
	batch      *models.CSVImportBatch
	test       *models.Test
	teacher    *models.User
	col        map[string]int
	images     map[string][]byte
	version    int
	usedImages map[string]bool
	seenHash   map[string]int
	sum        *importSummary
	imgCache   map[string]imageResult

	subjects map[string]models.Subject // by lower name and id
	chapters map[string]models.Chapter
	topics   map[string]models.Topic // key chapterID|lowername
}

func (e *importEnv) loadCourseTaxonomy() {
	e.subjects, e.chapters, e.topics = map[string]models.Subject{}, map[string]models.Chapter{}, map[string]models.Topic{}
	var subs []models.Subject
	e.s.DB.WithContext(e.ctx).Where("course_id = ?", e.test.CourseID).Find(&subs)
	var subIDs []uuid.UUID
	for _, sb := range subs {
		e.subjects[strings.ToLower(sb.Name)] = sb
		e.subjects[sb.ID.String()] = sb
		subIDs = append(subIDs, sb.ID)
	}
	if len(subIDs) == 0 {
		return
	}
	var chs []models.Chapter
	e.s.DB.WithContext(e.ctx).Where("subject_id IN ?", subIDs).Find(&chs)
	var chIDs []uuid.UUID
	for _, c := range chs {
		e.chapters[strings.ToLower(c.Name)+"|"+c.SubjectID.String()] = c
		e.chapters[c.ID.String()] = c
		chIDs = append(chIDs, c.ID)
	}
	var tps []models.Topic
	e.s.DB.WithContext(e.ctx).Where("chapter_id IN ?", chIDs).Find(&tps)
	for _, t := range tps {
		e.topics[t.ChapterID.String()+"|"+strings.ToLower(t.Name)] = t
	}
}

func (e *importEnv) get(row []string, name string) string {
	i, ok := e.col[name]
	if !ok || i >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[i])
}

func (e *importEnv) fail(rowNum int, field, code, msg string, row []string) {
	e.sum.Errors++
	e.sum.ByCode[code]++
	e.s.logRowError(e.ctx, e.batch.ID, rowNum, field, "", "error", code, msg, row)
}

func (e *importEnv) warn(rowNum int, field, code, msg string, row []string) {
	e.sum.Warnings++
	e.sum.ByCode[code]++
	e.s.logRowError(e.ctx, e.batch.ID, rowNum, field, "", "warning", code, msg, row)
}

// image resolves an image column to a media id (creating the asset in
// commit/update mode; only validating in validate mode).
func (e *importEnv) image(rowNum int, field, name string, row []string) (uuid.UUID, bool) {
	key := strings.ToLower(path.Base(name))
	if res, ok := e.imgCache[key]; ok {
		if res.err != nil {
			e.fail(rowNum, field, imgCode(res.err), res.err.Msg+": "+name, row)
			return uuid.Nil, false
		}
		return res.id, true
	}
	if data, ok := e.images[key]; ok {
		e.usedImages[key] = true
		e.sum.ImagesFound++
		if e.s.Images == nil {
			e.fail(rowNum, field, CodeImageInvalid, "image storage is not available", row)
			return uuid.Nil, false
		}
		if err := e.s.Images.IngestValidate(data); err != nil {
			ce, _ := err.(*CodedError)
			if ce == nil {
				ce = Coded(422, "corrupt_image", err.Error())
			}
			e.imgCache[key] = imageResult{err: ce}
			e.fail(rowNum, field, imgCode(ce), ce.Msg+": "+name, row)
			return uuid.Nil, false
		}
		if e.batch.Mode == ImportModeValidate {
			id := uuid.New() // placeholder — nothing is stored in validate mode
			e.imgCache[key] = imageResult{id: id}
			return id, true
		}
		id, err := e.s.Images.IngestCreate(e.ctx, e.teacher.ID, name, data)
		if err != nil {
			ce, _ := err.(*CodedError)
			if ce == nil {
				ce = Coded(422, "corrupt_image", err.Error())
			}
			e.imgCache[key] = imageResult{err: ce}
			e.fail(rowNum, field, imgCode(ce), ce.Msg+": "+name, row)
			return uuid.Nil, false
		}
		e.imgCache[key] = imageResult{id: id}
		return id, true
	}
	if e.s.Images != nil {
		if id, ok := e.s.Images.LibraryLookup(e.ctx, e.teacher.ID, name); ok {
			e.imgCache[key] = imageResult{id: id}
			e.sum.ImagesFound++
			return id, true
		}
	}
	e.sum.ImagesMissing = appendUnique(e.sum.ImagesMissing, name)
	e.imgCache[key] = imageResult{err: Coded(422, "missing", "image not found in the ZIP or your media library")}
	e.fail(rowNum, field, CodeMissingImage, "image not found in the ZIP or your media library: "+name, row)
	return uuid.Nil, false
}

func imgCode(ce *CodedError) string {
	if ce.Code == "too_large" || ce.Code == "too_large_dimensions" {
		return CodeImageTooLarge
	}
	return CodeImageInvalid
}

func appendUnique(list []string, v string) []string {
	for _, x := range list {
		if x == v {
			return list
		}
	}
	return append(list, v)
}

// compose joins text and an optional image into one rich-text value.
func compose(text string, imgID *uuid.UUID, alt string) string {
	if imgID == nil {
		return text
	}
	img := fmt.Sprintf("![%s](media:%s)", strings.NewReplacer("]", "", "\n", " ").Replace(alt), imgID.String())
	if strings.TrimSpace(text) == "" {
		return img
	}
	return text + "\n\n" + img
}

var truthy = map[string]bool{"true": true, "1": true, "yes": true, "y": true}
var falsy = map[string]bool{"false": true, "0": true, "no": true, "n": true}

// metadata parses the optional v2 metadata columns into a QuestionInput.
func (e *importEnv) metadata(rowNum int, row []string) (QuestionInput, bool) {
	var in QuestionInput
	ok := true
	bad := func(field, code, msg string) { e.fail(rowNum, field, code, msg, row); ok = false }

	sub := e.get(row, "subject")
	if sub != "" {
		if s, found := e.subjects[strings.ToLower(sub)]; found {
			in.SubjectID = &s.ID
		} else {
			bad("subject", CodeUnknownSubject, "subject not found in this course: "+sub)
		}
	}
	if ch := e.get(row, "chapter"); ch != "" {
		var found *models.Chapter
		if c, ok2 := e.chapters[ch]; ok2 { // by id
			found = &c
		} else {
			subID := ""
			if in.SubjectID != nil {
				subID = in.SubjectID.String()
			} else if e.test.SubjectID != nil {
				subID = e.test.SubjectID.String()
			}
			if subID != "" {
				if c, ok2 := e.chapters[strings.ToLower(ch)+"|"+subID]; ok2 {
					found = &c
				}
			} else {
				for k, c := range e.chapters {
					if strings.HasPrefix(k, strings.ToLower(ch)+"|") {
						cc := c
						found = &cc
						break
					}
				}
			}
		}
		if found == nil {
			bad("chapter", CodeUnknownChapter, "chapter not found: "+ch)
		} else {
			in.ChapterID = &found.ID
			in.SubjectID = &found.SubjectID
		}
	}
	if tp := e.get(row, "topic"); tp != "" {
		chID := ""
		if in.ChapterID != nil {
			chID = in.ChapterID.String()
		} else if e.test.ChapterID != nil {
			chID = e.test.ChapterID.String()
		}
		if t, found := e.topics[chID+"|"+strings.ToLower(tp)]; found && chID != "" {
			in.TopicID = &t.ID
		} else {
			bad("topic", CodeUnknownTopic, "topic not found in the chapter: "+tp)
		}
	}
	if d := strings.ToLower(e.get(row, "difficulty")); d != "" {
		if d != "easy" && d != "medium" && d != "hard" {
			bad("difficulty", CodeBadEnum, "difficulty must be easy, medium or hard")
		} else {
			in.Difficulty = &d
		}
	}
	num := func(field string, dst **int) {
		if v := e.get(row, field); v != "" {
			n, err := strconv.Atoi(v)
			if err != nil {
				bad(field, CodeBadNumber, field+" must be a whole number")
				return
			}
			*dst = &n
		}
	}
	num("ncert_class", &in.NCERTClass)
	num("ncert_page", &in.NCERTPage)
	num("source_year", &in.SourceYear)
	if v := strings.ToLower(e.get(row, "source_type")); v != "" {
		switch v {
		case "qbank", "practice", "test_series", "pyq", "other":
			in.SourceType = &v
		default:
			bad("source_type", CodeBadEnum, "source_type must be qbank, practice, test_series, pyq or other")
		}
	}
	if v := strings.ToLower(e.get(row, "custom_eligible")); v != "" {
		switch {
		case truthy[v]:
			t := true
			in.CustomEligible = &t
		case falsy[v]:
			f := false
			in.CustomEligible = &f
		default:
			bad("custom_eligible", CodeBadEnum, "custom_eligible must be true or false")
		}
	}
	if v := e.get(row, "tags"); v != "" {
		tags := strings.Split(v, "|")
		in.Tags = &tags
	}
	return in, ok
}

func (e *importEnv) createRow(rowNum int, row []string) {
	stem, expl := e.get(row, "question_text"), e.get(row, "explanation")
	opts := [4]string{e.get(row, "option_a"), e.get(row, "option_b"), e.get(row, "option_c"), e.get(row, "option_d")}
	correct := strings.ToUpper(e.get(row, "correct_option"))

	var imgs = map[string]*uuid.UUID{}
	imageOK := true
	if e.version >= 2 {
		for _, f := range []string{"question_image", "option_a_image", "option_b_image", "option_c_image", "option_d_image", "explanation_image"} {
			if name := e.get(row, f); name != "" {
				if id, ok := e.image(rowNum, f, name, row); ok {
					idc := id
					imgs[f] = &idc
				} else {
					imageOK = false
				}
			}
		}
	}
	if !imageOK {
		return
	}

	format := richtext.FormatPlain // v1 files stay plain: never reinterpret legacy text
	if e.version >= 2 {
		format = richtext.FormatRichV1
		stem = compose(stem, imgs["question_image"], e.get(row, "question_image_alt"))
		expl = compose(expl, imgs["explanation_image"], e.get(row, "explanation_image_alt"))
		for i, k := range []string{"option_a_image", "option_b_image", "option_c_image", "option_d_image"} {
			opts[i] = compose(opts[i], imgs[k], e.get(row, k+"_alt"))
		}
	}
	if strings.TrimSpace(stem) == "" || strings.TrimSpace(opts[0]) == "" || strings.TrimSpace(opts[1]) == "" || strings.TrimSpace(opts[2]) == "" || strings.TrimSpace(opts[3]) == "" {
		e.fail(rowNum, "", CodeMissingField, "missing required field", row)
		return
	}
	if correct != "A" && correct != "B" && correct != "C" && correct != "D" {
		e.fail(rowNum, "correct_option", CodeBadEnum, fmt.Sprintf("correct_option '%s' invalid — must be A/B/C/D", correct), row)
		return
	}
	in := QuestionInput{QuestionText: &stem, OptionA: &opts[0], OptionB: &opts[1], OptionC: &opts[2], OptionD: &opts[3], CorrectOption: &correct, ContentFormat: &format}
	if expl != "" {
		in.Explanation = &expl
	}
	if e.version >= 2 {
		md, ok := e.metadata(rowNum, row)
		if !ok {
			return
		}
		md.QuestionText, md.OptionA, md.OptionB, md.OptionC, md.OptionD = in.QuestionText, in.OptionA, in.OptionB, in.OptionC, in.OptionD
		md.CorrectOption, md.ContentFormat, md.Explanation = in.CorrectOption, in.ContentFormat, in.Explanation
		in = md
	}

	// Duplicate detection (in file + against the pool).
	probe := models.Question{QuestionText: stem, OptionA: opts[0], OptionB: opts[1], OptionC: opts[2], OptionD: opts[3], ContentFormat: format}
	hash := ContentHash(e.ctx, e.s.DB, &probe)
	if first, dup := e.seenHash[hash]; dup && e.batch.Mode != ImportModeValidate {
		e.fail(rowNum, "", CodeDuplicateInFile, fmt.Sprintf("same question as row %d", first), row)
		return
	} else if dup {
		e.fail(rowNum, "", CodeDuplicateInFile, fmt.Sprintf("same question as row %d", first), row)
		return
	}
	e.seenHash[hash] = rowNum
	if e.batch.Mode == ImportModeValidate {
		// validate mode must judge content exactly as commit would
		if issues := richtext.Validate(stem, format, richtext.Limits{MaxChars: settings.Int("richtext.max_stem_chars")}); len(issues) > 0 && format == richtext.FormatRichV1 {
			e.fail(rowNum, "question_text", CodeInvalidContent, issues[0].Message, row)
			return
		}
		if len(e.s.QS.FindDuplicates(e.ctx, hash, uuid.Nil, 1)) > 0 {
			e.warn(rowNum, "", CodePossibleDuplicate, "an identical question already exists", row)
		}
		e.sum.OK++
		return
	}

	_, warnings, err := e.s.QS.Create(e.ctx, e.teacher, e.test, in)
	if err != nil {
		code, msg := CodeDBError, err.Error()
		if ce, ok := err.(*CodedError); ok {
			code, msg = CodeInvalidContent, ce.Msg
			if ce.Code == "unknown_chapter" || ce.Code == "chapter_subject_mismatch" || ce.Code == "chapter_course_mismatch" {
				code = CodeUnknownChapter
			}
		}
		e.fail(rowNum, "", code, msg, row)
		return
	}
	for _, w := range warnings {
		e.warn(rowNum, "", CodePossibleDuplicate, w.Message, row)
	}
	e.sum.OK++
}

// updateRow implements metadata backfill (and, when explicitly allowed,
// content updates on editable tests) by question_id or content hash.
func (e *importEnv) updateRow(rowNum int, row []string) {
	var q models.Question
	found := false
	if id := e.get(row, "question_id"); id != "" {
		if uid, err := uuid.Parse(id); err == nil {
			found = e.s.DB.WithContext(e.ctx).First(&q, "id = ?", uid).Error == nil
		}
	} else if stem := e.get(row, "question_text"); stem != "" {
		probe := models.Question{QuestionText: stem, OptionA: e.get(row, "option_a"), OptionB: e.get(row, "option_b"),
			OptionC: e.get(row, "option_c"), OptionD: e.get(row, "option_d"), ContentFormat: richtext.FormatRichV1}
		for _, f := range []string{richtext.FormatRichV1, richtext.FormatPlain} {
			probe.ContentFormat = f
			if d := e.s.QS.FindDuplicates(e.ctx, ContentHash(e.ctx, e.s.DB, &probe), uuid.Nil, 1); len(d) == 1 {
				q, found = d[0], true
				break
			}
		}
	}
	if !found {
		e.fail(rowNum, "question_id", CodeNotFound, "no matching question", row)
		return
	}
	var qt models.Test
	if e.s.DB.WithContext(e.ctx).First(&qt, "id = ?", q.TestID).Error != nil || (qt.CreatedBy != e.teacher.ID && !(e.teacher.Role == models.RoleAdmin || e.teacher.CanManageAllContent)) {
		e.fail(rowNum, "question_id", CodeNotFound, "no matching question", row) // don't reveal others' questions
		return
	}
	in, ok := e.metadata(rowNum, row)
	if !ok {
		return
	}
	if e.batch.AllowContentUpdate {
		if v := e.get(row, "question_text"); v != "" {
			in.QuestionText = &v
		}
		if v := e.get(row, "explanation"); v != "" {
			in.Explanation = &v
		}
	}
	if in.ContentChanged() && qt.Status != models.StatusDraft && qt.Status != models.StatusRejected {
		e.fail(rowNum, "", CodeContentLocked, "content of live questions can't be updated by import — use a correction", row)
		return
	}
	if e.batch.Mode == ImportModeValidate {
		e.sum.OK++
		return
	}
	if _, err := e.s.QS.Update(e.ctx, e.teacher, &q, &qt, in); err != nil {
		msg := err.Error()
		e.fail(rowNum, "", CodeInvalidContent, msg, row)
		return
	}
	e.sum.OK++
}

func (s *CSVImportService) logRowError(ctx context.Context, batchID uuid.UUID, rowNum int, field, _ string, severity, code, msg string, row []string) {
	raw, _ := json.Marshal(row)
	if row == nil {
		raw = []byte("[]")
	}
	s.DB.WithContext(ctx).Create(&models.CSVImportRowError{
		BatchID: batchID, RowNumber: rowNum, ErrorMessage: msg, RawRowData: string(raw), Code: code, Field: field, Severity: severity,
	})
}

// ProcessCSVReader keeps the old entry point (used by tests / tooling): a
// synchronous commit-mode import of raw CSV bytes into a test.
func (s *CSVImportService) ProcessCSVReader(ctx context.Context, batchID, testID uuid.UUID, reader io.Reader) error {
	data, err := io.ReadAll(reader)
	if err != nil {
		return err
	}
	key := "inline/" + batchID.String() + ".csv"
	if storage.Store == nil {
		return fmt.Errorf("storage not configured")
	}
	if err := storage.Store.PutObject(ctx, key, "text/csv", data); err != nil {
		return err
	}
	var batch models.CSVImportBatch
	if err := s.DB.WithContext(ctx).First(&batch, "id = ?", batchID).Error; err != nil {
		return err
	}
	s.DB.WithContext(ctx).Model(&batch).Update("file_key", key)
	batch.FileKey = key
	return s.Run(ctx, &batch)
}
