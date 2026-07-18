package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"math/big"
	"time"

	"codon-backend/internal/models"
	"codon-backend/internal/otp"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

const (
	otpLength      = 6
	otpExpiry      = 5 * time.Minute
	maxOTPAttempts = 5
)

type OTPService struct {
	DB          *gorm.DB
	Redis       *redis.Client
	Provider    otp.OTPProvider
	RateLimitPerHour int
}

func NewOTPService(db *gorm.DB, redisClient *redis.Client, provider otp.OTPProvider, rateLimitPerHour int) *OTPService {
	return &OTPService{
		DB:               db,
		Redis:            redisClient,
		Provider:         provider,
		RateLimitPerHour: rateLimitPerHour,
	}
}

// GenerateOTP creates a random N-digit OTP string.
func generateOTP(length int) (string, error) {
	max := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(length)), nil)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%0*d", length, n), nil
}

func hashOTP(code string) string {
	h := sha256.Sum256([]byte(code))
	return fmt.Sprintf("%x", h)
}

func otpRateKey(phone string) string {
	return fmt.Sprintf("otp_rate:%s", phone)
}

// SendOTP generates, stores (hashed), rate-limits, and dispatches the OTP.
func (s *OTPService) SendOTP(ctx context.Context, phone string) error {
	// Rate-limit check
	key := otpRateKey(phone)
	count, err := s.Redis.Get(ctx, key).Int()
	if err != nil && err != redis.Nil {
		return fmt.Errorf("redis rate check: %w", err)
	}
	if count >= s.RateLimitPerHour {
		return fmt.Errorf("OTP rate limit exceeded — try again later")
	}

	code, err := generateOTP(otpLength)
	if err != nil {
		return fmt.Errorf("generating OTP: %w", err)
	}

	// Persist OTP record (invalidate any old ones by ignoring them — new one takes priority)
	record := models.OTPRequest{
		PhoneNumber: phone,
		OTPCodeHash: hashOTP(code),
		ExpiresAt:   time.Now().Add(otpExpiry),
	}
	if err := s.DB.WithContext(ctx).Create(&record).Error; err != nil {
		return fmt.Errorf("storing OTP: %w", err)
	}

	// Increment rate counter (reset hourly)
	pipe := s.Redis.Pipeline()
	pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, time.Hour)
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("redis rate increment: %w", err)
	}

	// Send via provider
	return s.Provider.SendOTP(ctx, phone, code)
}

// VerifyOTP checks the code against the latest valid OTP record.
func (s *OTPService) VerifyOTP(ctx context.Context, phone, code string) error {
	var record models.OTPRequest
	err := s.DB.WithContext(ctx).
		Where("phone_number = ? AND consumed_at IS NULL AND expires_at > ?", phone, time.Now()).
		Order("created_at DESC").
		First(&record).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("OTP not found or expired")
		}
		return fmt.Errorf("fetching OTP: %w", err)
	}

	// Increment attempt count
	s.DB.WithContext(ctx).Model(&record).UpdateColumn("attempts", gorm.Expr("attempts + 1"))

	if record.Attempts >= maxOTPAttempts {
		return fmt.Errorf("too many failed OTP attempts")
	}

	if hashOTP(code) != record.OTPCodeHash {
		return fmt.Errorf("invalid OTP code")
	}

	// Mark consumed
	now := time.Now()
	return s.DB.WithContext(ctx).Model(&record).Update("consumed_at", now).Error
}
