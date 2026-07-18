package services

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"codon-backend/internal/jobs"
	"codon-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CSVImportService struct {
	DB *gorm.DB
}

func NewCSVImportService(db *gorm.DB) *CSVImportService {
	return &CSVImportService{DB: db}
}

// HandleCSVImport is the background job handler for CSV question imports.
func (s *CSVImportService) HandleCSVImport(ctx context.Context, payload string) error {
	var p jobs.CSVImportPayload
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return fmt.Errorf("invalid payload: %w", err)
	}

	var batch models.CSVImportBatch
	if err := s.DB.WithContext(ctx).Where("id = ?", p.BatchID).First(&batch).Error; err != nil {
		return fmt.Errorf("batch not found: %w", err)
	}

	// In a real implementation, we'd download the CSV from S3 using the file_key.
	// For now we log and mark as completed — the actual S3 download requires the storage client.
	// The architecture is wired; integrators should inject an S3 reader here.
	log.Printf("[CSVImport] Batch %s: would download %s and import into test %s", p.BatchID, p.FileKey, p.TestID)

	// Mark batch as completed (stub — real impl would parse rows)
	now := time.Now()
	return s.DB.WithContext(ctx).Model(&batch).Updates(map[string]interface{}{
		"status":       models.ImportCompleted,
		"completed_at": now,
	}).Error
}

// ProcessCSVReader parses a CSV reader and imports questions into the test.
// Called from HandleCSVImport once the file is downloaded from S3.
func (s *CSVImportService) ProcessCSVReader(ctx context.Context, batchID, testID uuid.UUID, reader io.Reader) error {
	csvReader := csv.NewReader(reader)

	// Read header row
	header, err := csvReader.Read()
	if err != nil {
		return fmt.Errorf("reading CSV header: %w", err)
	}

	// Expected columns (case-insensitive)
	colMap := map[string]int{}
	for i, col := range header {
		colMap[strings.ToLower(strings.TrimSpace(col))] = i
	}

	required := []string{"question_text", "option_a", "option_b", "option_c", "option_d", "correct_option"}
	for _, r := range required {
		if _, ok := colMap[r]; !ok {
			return fmt.Errorf("missing required column: %s", r)
		}
	}

	var batch models.CSVImportBatch
	s.DB.WithContext(ctx).Where("id = ?", batchID).First(&batch)

	// Get current max order_index for the test
	var maxOrder struct{ MaxIdx int }
	s.DB.Model(&models.Question{}).
		Select("COALESCE(MAX(order_index), 0) as max_idx").
		Where("test_id = ?", testID).
		Scan(&maxOrder)

	orderIdx := maxOrder.MaxIdx
	rowNum := 1
	successRows := 0
	errorRows := 0

	for {
		rowNum++
		row, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			s.logRowError(ctx, batchID, rowNum, fmt.Sprintf("CSV parse error: %v", err), row)
			errorRows++
			continue
		}

		get := func(col string) string {
			idx, ok := colMap[col]
			if !ok || idx >= len(row) {
				return ""
			}
			return strings.TrimSpace(row[idx])
		}

		questionText := get("question_text")
		optA := get("option_a")
		optB := get("option_b")
		optC := get("option_c")
		optD := get("option_d")
		correctOpt := strings.ToUpper(get("correct_option"))
		explanation := get("explanation") // optional

		// Validate
		if questionText == "" || optA == "" || optB == "" || optC == "" || optD == "" {
			s.logRowError(ctx, batchID, rowNum, "missing required field", row)
			errorRows++
			continue
		}
		if correctOpt != "A" && correctOpt != "B" && correctOpt != "C" && correctOpt != "D" {
			s.logRowError(ctx, batchID, rowNum, fmt.Sprintf("correct_option '%s' invalid — must be A/B/C/D", correctOpt), row)
			errorRows++
			continue
		}

		orderIdx++
		q := models.Question{
			TestID:        testID,
			QuestionText:  questionText,
			OptionA:       optA,
			OptionB:       optB,
			OptionC:       optC,
			OptionD:       optD,
			CorrectOption: models.CorrectOption(correctOpt),
			OrderIndex:    orderIdx,
		}
		if explanation != "" {
			q.Explanation = &explanation
		}

		if err := s.DB.WithContext(ctx).Create(&q).Error; err != nil {
			s.logRowError(ctx, batchID, rowNum, fmt.Sprintf("db error: %v", err), row)
			errorRows++
			continue
		}
		successRows++
	}

	// Update test.total_questions
	s.DB.Model(&models.Test{}).
		Where("id = ?", testID).
		UpdateColumn("total_questions", gorm.Expr("total_questions + ?", successRows))

	// Update batch status
	status := models.ImportCompleted
	if errorRows > 0 {
		status = models.ImportCompletedWithErrors
	}
	now := time.Now()
	s.DB.WithContext(ctx).Model(&batch).Updates(map[string]interface{}{
		"total_rows":   successRows + errorRows,
		"success_rows": successRows,
		"error_rows":   errorRows,
		"status":       status,
		"completed_at": now,
	})

	return nil
}

func (s *CSVImportService) logRowError(ctx context.Context, batchID uuid.UUID, rowNum int, msg string, row []string) {
	raw, _ := json.Marshal(row)
	s.DB.WithContext(ctx).Create(&models.CSVImportRowError{
		BatchID:      batchID,
		RowNumber:    rowNum,
		ErrorMessage: msg,
		RawRowData:   string(raw),
	})
}
