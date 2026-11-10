package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "codon-backend/docs" // swagger docs
	"codon-backend/internal/app"
	"codon-backend/internal/config"
	"codon-backend/internal/db"
	rzp "codon-backend/internal/razorpay"
	"codon-backend/internal/settings"
	"codon-backend/internal/storage"
)

func main() {
	config.MustLoad()

	// The API process owns schema changes; the worker waits for it.
	if err := db.Connect(); err != nil {
		log.Fatalf("DB connect: %v", err)
	}
	// Production schema comes from versioned SQL only (baseline + db/migrations).
	// AutoMigrate stays as a convenience for local/dev databases.
	if config.AppConfig.Env != "production" {
		if err := db.AutoMigrateAll(); err != nil {
			log.Fatalf("AutoMigrate: %v", err)
		}
	}
	if err := db.RunMigrations(db.DB); err != nil {
		log.Fatalf("RunMigrations: %v", err)
	}
	// Reference data (courses, flags, presets) is created by SQL migration 0005;
	// the Go seeds only remain as a convenience for dev databases.
	if config.AppConfig.Env != "production" {
		if err := db.SeedAll(db.DB); err != nil {
			log.Fatalf("Seed: %v", err)
		}
	}
	settings.Init(db.DB)

	if config.AppConfig.S3AccessKeyID != "" {
		if err := storage.Init(); err != nil {
			log.Printf("Warning: S3 init failed: %v (presigned URLs will use stub)", err)
		}
	}
	rzp.Init()

	srv := &http.Server{
		Addr:         ":" + config.AppConfig.Port,
		Handler:      app.NewEngine(db.DB, config.AppConfig),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}
	go func() {
		log.Printf("Codon API server starting on :%s (env=%s)", config.AppConfig.Port, config.AppConfig.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Forced shutdown: %v", err)
	}
	log.Println("Server exited")
}
