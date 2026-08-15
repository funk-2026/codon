package services

import (
	"context"
	"fmt"
	"time"

	"codon-backend/internal/config"
	"codon-backend/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SessionService struct {
	DB *gorm.DB
}

func NewSessionService(db *gorm.DB) *SessionService {
	return &SessionService{DB: db}
}

// Claims is the JWT payload.
type Claims struct {
	UserID   uuid.UUID        `json:"user_id"`
	Role     models.UserRole  `json:"role"`
	DeviceID string           `json:"device_id"`
	jwt.RegisteredClaims
}

// CreateSession enforces the two-device limit, creates the sessions row,
// and returns a signed JWT.
func (s *SessionService) CreateSession(ctx context.Context, user *models.User, deviceID, deviceInfo string) (string, *models.Session, error) {
	// Two-device limit: count active sessions
	var activeSessions []models.Session
	s.DB.WithContext(ctx).
		Where("user_id = ? AND revoked_at IS NULL AND expires_at > ?", user.ID, time.Now()).
		Order("last_used_at ASC").
		Find(&activeSessions)

	// Evict oldest if already at 2
	if len(activeSessions) >= 2 {
		oldest := activeSessions[0]
		s.DB.WithContext(ctx).Delete(&oldest)
	}

	// Create new session record
	jti := uuid.New()
	expiry := time.Now().Add(time.Duration(config.AppConfig.JWTExpiryDays) * 24 * time.Hour)

	info := deviceInfo
	session := models.Session{
		ID:         jti,
		UserID:     user.ID,
		DeviceID:   deviceID,
		DeviceInfo: &info,
		LastUsedAt: time.Now(),
		ExpiresAt:  expiry,
	}
	if deviceInfo == "" {
		session.DeviceInfo = nil
	}

	if err := s.DB.WithContext(ctx).Create(&session).Error; err != nil {
		return "", nil, fmt.Errorf("creating session: %w", err)
	}

	// Issue JWT
	claims := Claims{
		UserID:   user.ID,
		Role:     user.Role,
		DeviceID: deviceID,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti.String(),
			Subject:   user.ID.String(),
			ExpiresAt: jwt.NewNumericDate(expiry),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(config.AppConfig.JWTSecret))
	if err != nil {
		return "", nil, fmt.Errorf("signing JWT: %w", err)
	}

	return signed, &session, nil
}

// ValidateToken parses and validates the JWT, then looks up the sessions row.
func (s *SessionService) ValidateToken(ctx context.Context, tokenStr string) (*Claims, *models.Session, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(config.AppConfig.JWTSecret), nil
	})
	if err != nil {
		return nil, nil, fmt.Errorf("invalid JWT: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, nil, fmt.Errorf("invalid JWT claims")
	}

	// Lookup session by jti
	jti, err := uuid.Parse(claims.ID)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid jti in JWT")
	}

	var session models.Session
	if err := s.DB.WithContext(ctx).Where("id = ?", jti).First(&session).Error; err != nil {
		return nil, nil, fmt.Errorf("session not found")
	}

	if session.RevokedAt != nil {
		return nil, nil, fmt.Errorf("session revoked")
	}
	if time.Now().After(session.ExpiresAt) {
		return nil, nil, fmt.Errorf("session expired")
	}

	// Update last_used_at (best-effort, non-blocking)
	go s.DB.Model(&session).Update("last_used_at", time.Now())

	return claims, &session, nil
}

// RevokeSession deletes a session from the DB to keep the table clean.
func (s *SessionService) RevokeSession(ctx context.Context, sessionID uuid.UUID) error {
	return s.DB.WithContext(ctx).
		Where("id = ?", sessionID).
		Delete(&models.Session{}).Error
}

// ListActiveSessions returns active sessions for a user.
func (s *SessionService) ListActiveSessions(ctx context.Context, userID uuid.UUID) ([]models.Session, error) {
	var sessions []models.Session
	err := s.DB.WithContext(ctx).
		Where("user_id = ? AND revoked_at IS NULL AND expires_at > ?", userID, time.Now()).
		Order("last_used_at DESC").
		Find(&sessions).Error
	return sessions, err
}
