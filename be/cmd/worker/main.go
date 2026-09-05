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
	"codon-backend/internal/services"
	"codon-backend/internal/storage"
)

func main() {
	config.Load()

	if err := db.Connect(); err != nil {
		log.Fatalf("Worker DB connect: %v", err)
	}

	if err := db.AutoMigrateAll(); err != nil {
		log.Fatalf("Worker AutoMigrate: %v", err)
	}

	if config.AppConfig.S3AccessKeyID != "" {
		if err := storage.Init(); err != nil {
			log.Printf("Warning: S3 init failed: %v (CSV import will fail until this is fixed)", err)
		}
	}

	// Create service instances
	csvImportSvc := services.NewCSVImportService(db.DB)
	transcodeSvc := services.NewTranscodeService(db.DB)
	streamStatusSvc := services.NewStreamStatusService(db.DB)

	// Create worker
	pollInterval := time.Duration(config.AppConfig.WorkerPollSeconds) * time.Second
	worker := jobs.NewWorker(db.DB, pollInterval)

	// Register job handlers
	worker.RegisterHandler(jobs.JobTypeCSVImport, csvImportSvc.HandleCSVImport)
	worker.RegisterHandler(jobs.JobTypeTranscode, transcodeSvc.HandleTranscode)
	worker.RegisterHandler(jobs.JobTypeStreamStatusCheck, streamStatusSvc.HandleStreamStatusCheck)
	worker.RegisterExhaustionHandler(jobs.JobTypeStreamStatusCheck, streamStatusSvc.HandleExhausted)

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
