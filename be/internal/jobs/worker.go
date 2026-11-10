package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"sync"
	"time"

	"codon-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	JobTypeCSVImport        = "csv_import"
	JobTypeVideoStatusCheck = "video_status_check"
	JobTypeMediaProcess     = "media_process"
	JobTypeRescoreQuestion  = "rescore_question"
)

// maxAttempts caps how many times a job is retried before it's abandoned.
// 30 attempts at the 1-minute backoff below gives ~30 minutes of headroom —
// long enough for a video status-check job to poll until
// transcoding finishes, not just for quick one-shot jobs like CSV import.
const maxAttempts = 30

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

// VideoStatusCheckPayload is the payload for polling a Bunny Stream
// video's transcode status until it's ready to play.
type VideoStatusCheckPayload struct {
	ContentItemID uuid.UUID `json:"content_item_id"`
	VideoGUID     string    `json:"video_guid"`
	VideoUID      string    `json:"video_uid,omitempty"`
}

func (p *VideoStatusCheckPayload) GUID() string {
	if p.VideoGUID != "" {
		return p.VideoGUID
	}
	return p.VideoUID
}

// Worker polls for pending jobs and processes them.
type Worker struct {
	DB           *gorm.DB
	PollInterval time.Duration
	handlers     map[string]func(ctx context.Context, payload string) error
	onExhausted  map[string]func(ctx context.Context, payload string)
	tickers      []ticker
}

type ticker struct {
	name  string
	every time.Duration
	fn    func(ctx context.Context)
}

// RegisterTicker runs fn every `every` for as long as the worker runs. Use it
// for recurring maintenance (sweepers, GC) that is idempotent and safe to run
// from several worker replicas at once; it needs no rows in background_jobs.
func (w *Worker) RegisterTicker(name string, every time.Duration, fn func(ctx context.Context)) {
	w.tickers = append(w.tickers, ticker{name, every, fn})
}

func NewWorker(db *gorm.DB, pollInterval time.Duration) *Worker {
	return &Worker{
		DB:           db,
		PollInterval: pollInterval,
		handlers:     make(map[string]func(ctx context.Context, payload string) error),
		onExhausted:  make(map[string]func(ctx context.Context, payload string)),
	}
}

func (w *Worker) RegisterHandler(jobType string, fn func(ctx context.Context, payload string) error) {
	w.handlers[jobType] = fn
}

// RegisterExhaustionHandler registers a callback invoked when a job of this
// type permanently runs out of retries (see maxAttempts) without ever
// succeeding — e.g. to mark whatever record it was processing as failed,
// since otherwise it would silently stop being retried with no visible
// failure state anywhere.
func (w *Worker) RegisterExhaustionHandler(jobType string, fn func(ctx context.Context, payload string)) {
	w.onExhausted[jobType] = fn
}

// Run processes jobs and runs tickers until ctx is cancelled, then waits for
// in-flight work (up to drainTimeout) before returning.
func (w *Worker) Run(ctx context.Context) {
	log.Printf("[Worker] Starting — polling every %v", w.PollInterval)
	var wg sync.WaitGroup
	for _, t := range w.tickers {
		wg.Add(1)
		go func(t ticker) {
			defer wg.Done()
			w.runTicker(ctx, t)
		}(t)
	}
	reaper := time.NewTicker(time.Minute)
	defer reaper.Stop()
	poll := time.NewTicker(w.PollInterval)
	defer poll.Stop()

	var inflight sync.WaitGroup
loop:
	for {
		select {
		case <-ctx.Done():
			break loop
		case <-reaper.C:
			w.ReapStuck(ctx)
		case <-poll.C:
			// drain up to batchPerTick jobs per tick so one slow job doesn't starve the rest
			for i := 0; i < batchPerTick && ctx.Err() == nil; i++ {
				inflight.Add(1)
				ok := w.ProcessOne(ctx)
				inflight.Done()
				if !ok {
					break
				}
			}
		}
	}
	log.Println("[Worker] Shutting down — waiting for in-flight work")
	done := make(chan struct{})
	go func() { inflight.Wait(); wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(drainTimeout):
		log.Println("[Worker] drain timeout — unfinished jobs will be re-queued by the reaper")
	}
}

const (
	batchPerTick = 5
	drainTimeout = 60 * time.Second
	// A job in `processing` longer than this is assumed to belong to a dead worker.
	stuckAfter = 10 * time.Minute
)

// runTicker runs fn once shortly after start-up (so a restart never skips a
// daily job) and then every t.every. A Postgres advisory lock makes sure only
// one replica runs a given tick at a time.
func (w *Worker) runTicker(ctx context.Context, t ticker) {
	select {
	case <-ctx.Done():
		return
	case <-time.After(time.Duration(rand.Intn(10_000)) * time.Millisecond):
	}
	run := func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[Worker] ticker %s panicked: %v", t.name, r)
			}
		}()
		w.withAdvisoryLock(ctx, t.name, func() { t.fn(ctx) })
	}
	run()
	tk := time.NewTicker(t.every)
	defer tk.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tk.C:
			run()
		}
	}
}

// withAdvisoryLock runs fn only if this process wins a session-level advisory
// lock for name; otherwise another replica is already running it.
func (w *Worker) withAdvisoryLock(ctx context.Context, name string, fn func()) {
	sqlDB, err := w.DB.DB()
	if err != nil {
		fn()
		return
	}
	conn, err := sqlDB.Conn(ctx)
	if err != nil {
		log.Printf("[Worker] ticker %s: no connection: %v", name, err)
		return
	}
	defer conn.Close()
	var got bool
	if err := conn.QueryRowContext(ctx, "SELECT pg_try_advisory_lock(hashtext($1))", "codon.ticker."+name).Scan(&got); err != nil || !got {
		return
	}
	defer conn.ExecContext(context.Background(), "SELECT pg_advisory_unlock(hashtext($1))", "codon.ticker."+name)
	fn()
}

// ReapStuck re-queues jobs a crashed worker left in `processing`.
func (w *Worker) ReapStuck(ctx context.Context) {
	res := w.DB.WithContext(ctx).Exec(
		`UPDATE background_jobs SET status = 'pending', run_after = now(), updated_at = now()
		 WHERE status = 'processing' AND locked_at < ?`, time.Now().Add(-stuckAfter))
	if res.Error != nil {
		log.Printf("[Worker] reaper: %v", res.Error)
	} else if res.RowsAffected > 0 {
		log.Printf("[Worker] re-queued %d stuck jobs", res.RowsAffected)
	}
}

// claimNext atomically takes one due job (FOR UPDATE SKIP LOCKED) so several
// workers never run the same job.
func (w *Worker) claimNext(ctx context.Context) (*models.BackgroundJob, error) {
	var jobs []models.BackgroundJob
	err := w.DB.WithContext(ctx).Raw(`
		UPDATE background_jobs SET status = 'processing', attempts = attempts + 1,
		       locked_at = now(), updated_at = now()
		WHERE id = (
			SELECT id FROM background_jobs
			WHERE status = 'pending' AND run_after <= now() AND attempts < ?
			ORDER BY run_after, created_at
			FOR UPDATE SKIP LOCKED LIMIT 1)
		RETURNING *`, maxAttempts).Scan(&jobs).Error
	if err != nil || len(jobs) == 0 {
		return nil, err
	}
	return &jobs[0], nil
}

// ProcessOne claims and runs one due job. It reports whether a job was found.
func (w *Worker) ProcessOne(ctx context.Context) bool {
	job, err := w.claimNext(ctx)
	if err != nil {
		log.Printf("[Worker] error claiming job: %v", err)
		return false
	}
	if job == nil {
		return false
	}
	log.Printf("[Worker] Processing job %s type=%s", job.ID, job.Type)

	handler, ok := w.handlers[job.Type]
	if !ok {
		w.finish(job, models.JobFailed, fmt.Sprintf("no handler for job type: %s", job.Type), nil)
		return true
	}

	jobCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	if err := handler(jobCtx, job.Payload); err != nil {
		log.Printf("[Worker] Job %s failed: %v", job.ID, err)
		// attempts was already incremented by the claim.
		if job.Attempts >= maxAttempts {
			log.Printf("[Worker] Job %s exhausted %d attempts — giving up", job.ID, job.Attempts)
			w.finish(job, models.JobFailed, err.Error(), nil)
			if fn, ok := w.onExhausted[job.Type]; ok {
				fn(context.Background(), job.Payload)
			}
			return true
		}
		next := time.Now().Add(1 * time.Minute) // backoff
		w.finish(job, models.JobPending, err.Error(), &next)
		return true
	}
	w.finish(job, models.JobDone, "", nil)
	log.Printf("[Worker] Job %s done", job.ID)
	return true
}

// finish records the outcome. It uses a fresh context so a cancelled worker
// still records what happened to the job it was running.
func (w *Worker) finish(job *models.BackgroundJob, status models.JobStatus, lastErr string, runAfter *time.Time) {
	upd := map[string]interface{}{"status": status, "locked_at": nil, "updated_at": time.Now()}
	if lastErr != "" {
		upd["last_error"] = lastErr
	}
	if runAfter != nil {
		upd["run_after"] = *runAfter
	}
	if err := w.DB.WithContext(context.Background()).Model(&models.BackgroundJob{}).Where("id = ?", job.ID).Updates(upd).Error; err != nil {
		log.Printf("[Worker] could not record outcome of job %s: %v", job.ID, err)
	}
}
