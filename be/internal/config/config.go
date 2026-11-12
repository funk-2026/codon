package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	// Server
	Port string
	Env  string

	// Database
	DatabaseURL string

	// Connection pool / safety net (0 = driver default / disabled)
	DBMaxOpenConns       int
	DBMaxIdleConns       int
	DBStatementTimeoutMs int

	// JWT
	JWTSecret     string
	JWTExpiryDays int

	// 2Factor.in OTP
	TwoFactorAPIKey string

	// Msg91 OTP
	Msg91AuthKey    string
	Msg91TemplateID string

	// Razorpay
	RazorpayKeyID         string
	RazorpayKeySecret     string
	RazorpayWebhookSecret string

	// AWS / S3 (Cloudflare R2)
	S3Endpoint        string
	S3Region          string
	S3Bucket          string
	S3AccessKeyID     string
	S3SecretAccessKey string

	// Bunny Stream (Video Streaming)
	BunnyStreamLibraryID string
	BunnyStreamAPIKey    string
	BunnyStreamCDNHost   string // e.g. "vz-abcdef-123.b-cdn.net"

	// OTP Rate Limit (per hour per phone)
	OTPRateLimitPerHour int

	// App store reviewer test login (empty = disabled). Lets Apple/Google
	// reviewers sign in with a fixed OTP since they can't receive real SMS.
	ReviewerPhoneNumber string
	ReviewerOTPCode     string

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
		DBMaxOpenConns:        getEnvInt("DB_MAX_OPEN_CONNS", 25),
		DBMaxIdleConns:        getEnvInt("DB_MAX_IDLE_CONNS", 10),
		DBStatementTimeoutMs:  getEnvInt("DB_STATEMENT_TIMEOUT_MS", 0),
		JWTSecret:             getEnv("JWT_SECRET", "change-me-in-production"),
		JWTExpiryDays:         getEnvInt("JWT_EXPIRY_DAYS", 90),
		TwoFactorAPIKey:       getEnv("TWO_FACTOR_API_KEY", ""),
		Msg91AuthKey:          getEnv("MSG91_AUTH_KEY", ""),
		Msg91TemplateID:       getEnv("MSG91_TEMPLATE_ID", ""),
		RazorpayKeyID:         getEnv("RAZORPAY_KEY_ID", ""),
		RazorpayKeySecret:     getEnv("RAZORPAY_KEY_SECRET", ""),
		RazorpayWebhookSecret: getEnv("RAZORPAY_WEBHOOK_SECRET", ""),
		S3Endpoint:            getEnv("S3_ENDPOINT", ""),
		S3Region:              getEnv("S3_REGION", "us-east-1"),
		S3Bucket:              getEnv("S3_BUCKET", "codon"),
		S3AccessKeyID:         getEnv("S3_ACCESS_KEY_ID", ""),
		S3SecretAccessKey:     getEnv("S3_SECRET_ACCESS_KEY", ""),
		BunnyStreamLibraryID:  getEnv("BUNNY_STREAM_LIBRARY_ID", ""),
		BunnyStreamAPIKey:     getEnv("BUNNY_STREAM_API_KEY", ""),
		BunnyStreamCDNHost:    getEnv("BUNNY_STREAM_CDN_HOST", ""),
		OTPRateLimitPerHour:   getEnvInt("OTP_RATE_LIMIT_PER_HOUR", 3),
		ReviewerPhoneNumber:   getEnv("REVIEWER_PHONE_NUMBER", ""),
		ReviewerOTPCode:       getEnv("REVIEWER_OTP_CODE", ""),
		WorkerPollSeconds:     getEnvInt("WORKER_POLL_SECONDS", 5),
	}
}

// Validate refuses to run in production with unsafe or missing settings.
// Outside production it only returns warnings' worth of nothing: dev keeps its
// stubs (console OTP, stub upload URLs).
func (c Config) Validate() error {
	if c.Env != "production" {
		return nil
	}
	var problems []string
	if c.JWTSecret == "" || c.JWTSecret == "change-me-in-production" || len(c.JWTSecret) < 32 {
		problems = append(problems, "JWT_SECRET must be set to a random string of at least 32 characters")
	}
	if c.RazorpayKeyID == "" || c.RazorpayKeySecret == "" || c.RazorpayWebhookSecret == "" {
		problems = append(problems, "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET are required")
	}
	if c.S3AccessKeyID == "" || c.S3SecretAccessKey == "" {
		problems = append(problems, "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required")
	}
	if len(problems) > 0 {
		return fmt.Errorf("invalid production configuration:\n - %s", strings.Join(problems, "\n - "))
	}
	return nil
}

// MustLoad loads the config and exits if it is invalid for the environment.
func MustLoad() {
	Load()
	if err := AppConfig.Validate(); err != nil {
		log.Fatalf("%v", err)
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
