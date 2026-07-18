package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	// Server
	Port string
	Env  string

	// Database
	DatabaseURL string

	// Redis
	RedisURL string

	// JWT
	JWTSecret         string
	JWTExpiryDays     int

	// 2Factor.in OTP
	TwoFactorAPIKey string

	// Razorpay
	RazorpayKeyID     string
	RazorpayKeySecret string
	RazorpayWebhookSecret string

	// AWS / S3
	S3Endpoint        string
	S3Region          string
	S3Bucket          string
	S3AccessKeyID     string
	S3SecretAccessKey string

	// OTP Rate Limit (per hour per phone)
	OTPRateLimitPerHour int

	// Misc
	WorkerPollSeconds int
}

var AppConfig Config

func Load() {
	// Load .env if present (ignore error — in prod envs it won't exist)
	_ = godotenv.Load()

	AppConfig = Config{
		Port:                  getEnv("PORT", "8080"),
		Env:                   getEnv("ENV", "development"),
		DatabaseURL:           getEnv("DATABASE_URL", "postgres://codon:codon@localhost:5432/codon?sslmode=disable"),
		RedisURL:              getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:             getEnv("JWT_SECRET", "change-me-in-production"),
		JWTExpiryDays:         getEnvInt("JWT_EXPIRY_DAYS", 90),
		TwoFactorAPIKey:       getEnv("TWO_FACTOR_API_KEY", ""),
		RazorpayKeyID:         getEnv("RAZORPAY_KEY_ID", ""),
		RazorpayKeySecret:     getEnv("RAZORPAY_KEY_SECRET", ""),
		RazorpayWebhookSecret: getEnv("RAZORPAY_WEBHOOK_SECRET", ""),
		S3Endpoint:            getEnv("S3_ENDPOINT", ""),
		S3Region:              getEnv("S3_REGION", "us-east-1"),
		S3Bucket:              getEnv("S3_BUCKET", "codon"),
		S3AccessKeyID:         getEnv("S3_ACCESS_KEY_ID", ""),
		S3SecretAccessKey:     getEnv("S3_SECRET_ACCESS_KEY", ""),
		OTPRateLimitPerHour:   getEnvInt("OTP_RATE_LIMIT_PER_HOUR", 3),
		WorkerPollSeconds:     getEnvInt("WORKER_POLL_SECONDS", 5),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	i, err := strconv.Atoi(v)
	if err != nil {
		log.Printf("Warning: invalid value for %s: %s, using default %d", key, v, fallback)
		return fallback
	}
	return i
}
