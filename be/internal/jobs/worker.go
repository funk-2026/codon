package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"codon-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	JobTypeCSVImport         = "csv_import"
	JobTypeTranscode         = "video_transcode"
	JobTypeStreamStatusCheck = "stream_status_check"
)

// EnqueueJob inserts a background job into the DB queue.
func EnqueueJob(db *gorm.DB, jobType string, payload interface{}) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshalling job payload: %w", err)
	}

	job := models.BackgroundJob{
		Type:     jobType,
		Payload:  string(raw),
		Status:   models.JobPending,
		RunAfter: time.Now(),
	}
	return db.Create(&job).Error
}

// CSVImportPayload is the payload for a CSV import job.
type CSVImportPayload struct {
	BatchID uuid.UUID `json:"batch_id"`
	FileKey string    `json:"file_key"`
	TestID  uuid.UUID `json:"test_id"`
}

// TranscodePayload is the payload for a video transcode job.
type TranscodePayload struct {
	ContentItemID uuid.UUID `json:"content_item_id"`
	FileKey       string    `json:"file_key"`
}

// StreamStatusCheckPayload is the payload for polling a Cloudflare Stream
// video's transcode status until it's ready to play.
type StreamStatusCheckPayload struct {
	ContentItemID uuid.UUID `json:"content_item_id"`
	VideoUID      string    `json:"video_uid"`
}

// Worker polls for pending jobs and processes them.
type Worker struct {
	DB           *gorm.DB
	PollInterval time.Duration
	handlers     map[string]func(ctx context.Context, payload string) error
}

func NewWorker(db *gorm.DB, pollInterval time.Duration) *Worker {
	return &Worker{
		DB:           db,
		PollInterval: pollInterval,
		handlers:     make(map[string]func(ctx context.Context, payload string) error),
	}
}

func (w *Worker) RegisterHandler(jobType string, fn func(ctx context.Context, payload string) error) {
	w.handlers[jobType] = fn
}

func (w *Worker) Run(ctx context.Context) {
	log.Printf("[Worker] Starting — polling every %v", w.PollInterval)
	ticker := time.NewTicker(w.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("[Worker] Shutting down")
			return
		case <-ticker.C:
			w.processNextJob(ctx)
		}
	}
}

func (w *Worker) processNextJob(ctx context.Context) {
	var job models.BackgroundJob
	err := w.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Pick one pending job that's due. Capped at 30 attempts (~30 minutes
		// at the 1-minute backoff below) rather than the original 5 (~5
		// minutes) — long enough for a Cloudflare Stream status-check job to
		// poll until transcoding finishes, not just for quick one-shot jobs.
		res := tx.Where("status = ? AND run_after <= ? AND attempts < 30", models.JobPending, time.Now()).
			Order("created_at ASC").
			First(&job)
		if res.Error != nil {
			if res.Error == gorm.ErrRecordNotFound {
				return nil // no work
			}
			return res.Error
		}

		// Claim it
		return tx.Model(&job).Updates(map[string]interface{}{
			"status":   models.JobProcessing,
			"attempts": gorm.Expr("attempts + 1"),
		}).Error
	})
	if err != nil {
		log.Printf("[Worker] error claiming job: %v", err)
		return
	}
	if job.ID == uuid.Nil {
		return // nothing to do
	}

	log.Printf("[Worker] Processing job %s type=%s", job.ID, job.Type)

	handler, ok := w.handlers[job.Type]
	if !ok {
		errMsg := fmt.Sprintf("no handler for job type: %s", job.Type)
		w.DB.Model(&job).Updates(map[string]interface{}{
			"status":     models.JobFailed,
			"last_error": errMsg,
		})
		return
	}

	jobCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	if err := handler(jobCtx, job.Payload); err != nil {
		log.Printf("[Worker] Job %s failed: %v", job.ID, err)
		errMsg := err.Error()
		nextRun := time.Now().Add(1 * time.Minute) // backoff
		w.DB.Model(&job).Updates(map[string]interface{}{
			"status":     models.JobPending,
			"last_error": errMsg,
			"run_after":  nextRun,
		})
		return
	}

	now := time.Now()
	w.DB.Model(&job).Updates(map[string]interface{}{
		"status":     models.JobDone,
		"updated_at": now,
	})
	log.Printf("[Worker] Job %s done", job.ID)
}
