package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"codon-backend/internal/config"
	"codon-backend/internal/db"
	"codon-backend/internal/jobs"
	"codon-backend/internal/media"
	"codon-backend/internal/services"
	"codon-backend/internal/settings"
	"codon-backend/internal/storage"
)

func main() {
	config.Load()

	if err := db.Connect(); err != nil {
		log.Fatalf("Worker DB connect: %v", err)
	}

	// The API process owns schema changes (AutoMigrate + versioned SQL). The
	// worker only waits for it, so the two can't race on start-up.
	if err := db.WaitForSchema(db.DB, 2*time.Minute); err != nil {
		log.Fatalf("Worker: %v", err)
	}
	settings.Init(db.DB)

	if config.AppConfig.S3AccessKeyID != "" {
		if err := storage.Init(); err != nil {
			log.Printf("Warning: S3 init failed: %v (CSV import will fail until this is fixed)", err)
		}
	}

	// Create service instances
	csvImportSvc := services.NewCSVImportService(db.DB)
	mediaSvc := media.NewService(db.DB)
	csvImportSvc.Images = mediaSvc
	csvImportSvc.QS.RefSaver = media.QuestionRefSaver
	transcodeSvc := services.NewTranscodeService(db.DB)
	streamStatusSvc := services.NewStreamStatusService(db.DB)

	// Create worker
	pollInterval := time.Duration(config.AppConfig.WorkerPollSeconds) * time.Second
	worker := jobs.NewWorker(db.DB, pollInterval)

	// Register job handlers
	worker.RegisterHandler(jobs.JobTypeCSVImport, csvImportSvc.HandleCSVImport)
	worker.RegisterHandler(jobs.JobTypeMediaProcess, mediaSvc.HandleProcessJob)
	corrSvc := services.NewCorrectionService(db.DB, services.NewQuestionService(db.DB))
	worker.RegisterHandler(jobs.JobTypeRescoreQuestion, corrSvc.HandleRescoreQuestion)
	worker.RegisterHandler(jobs.JobTypeTranscode, transcodeSvc.HandleTranscode)
	worker.RegisterHandler(jobs.JobTypeStreamStatusCheck, streamStatusSvc.HandleStreamStatusCheck)
	worker.RegisterExhaustionHandler(jobs.JobTypeStreamStatusCheck, streamStatusSvc.HandleExhausted)

	// Recurring maintenance
	scoringSvc := services.NewScoringService(db.DB)
	worker.RegisterTicker("attempt_autosubmit", 60*time.Second, func(ctx context.Context) {
		if n, err := scoringSvc.AutoSubmitExpired(ctx, 200); err != nil {
			log.Printf("[Worker] attempt_autosubmit: %v", err)
		} else if n > 0 {
			log.Printf("[Worker] auto-submitted %d expired attempts", n)
		}
	})
	pushSvc := services.NewPushService(db.DB, services.NewExpoSender())
	worker.RegisterTicker("push_dispatch", 30*time.Second, func(ctx context.Context) {
		if n, err := pushSvc.Dispatch(ctx, 200); err != nil {
			log.Printf("[Worker] push_dispatch: %v", err)
		} else if n > 0 {
			log.Printf("[Worker] pushed %d notifications", n)
		}
	})
	worker.RegisterTicker("streak_nudges", time.Hour, func(ctx context.Context) {
		if n := pushSvc.StreakNudges(ctx, time.Now()); n > 0 {
			log.Printf("[Worker] created %d streak nudges", n)
		}
	})
	worker.RegisterTicker("retention_sweep", 24*time.Hour, func(ctx context.Context) { services.RetentionSweep(ctx, db.DB) })
	worker.RegisterTicker("orphan_media_gc", 6*time.Hour, func(ctx context.Context) {
		if n, err := mediaSvc.GCOrphans(ctx, false); err != nil {
			log.Printf("[Worker] orphan_media_gc: %v", err)
		} else if n > 0 {
			log.Printf("[Worker] removed %d orphaned media assets", n)
		}
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go worker.Run(ctx)

	<-quit
	log.Println("[Worker] Received shutdown signal")
	cancel()
	time.Sleep(2 * time.Second) // allow in-flight jobs to complete
	log.Println("[Worker] Stopped")
}
