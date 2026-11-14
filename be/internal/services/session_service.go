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
	"gorm.io/gorm/clause"
)

const (
	maxDevices = 2
	touchEvery = 5 * time.Minute
)

type SessionService struct {
	DB *gorm.DB
}

func NewSessionService(db *gorm.DB) *SessionService {
	return &SessionService{DB: db}
}

// Claims is the JWT payload.
type Claims struct {
	UserID   uuid.UUID       `json:"user_id"`
	Role     models.UserRole `json:"role"`
	DeviceID string          `json:"device_id"`
	jwt.RegisteredClaims
}

// CreateSession enforces the two-device limit, creates the sessions row,
// and returns a signed JWT.
func (s *SessionService) CreateSession(ctx context.Context, user *models.User, deviceID, deviceInfo string) (string, *models.Session, error) {
	jti := uuid.New()
	expiry := time.Now().Add(time.Duration(config.AppConfig.JWTExpiryDays) * 24 * time.Hour)
	session := models.Session{
		ID:         jti,
		UserID:     user.ID,
		DeviceID:   deviceID,
		LastUsedAt: time.Now(),
		ExpiresAt:  expiry,
	}
	if deviceInfo != "" {
		info := deviceInfo
		session.DeviceInfo = &info
	}

	// Two-device limit. The user row is locked so two simultaneous logins
	// cannot both see "1 active session" and end up with three.
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Select("id").First(&models.User{}, "id = ?", user.ID).Error; err != nil {
			return err
		}
		// Signing in again on the same device replaces that device's old session, so a phone can never
		// use up both slots (and push the user's other phone out).
		if deviceID != "" {
			if err := tx.Where("user_id = ? AND device_id = ?", user.ID, deviceID).Delete(&models.Session{}).Error; err != nil {
				return err
			}
		}
		var active []models.Session
		if err := tx.Where("user_id = ? AND revoked_at IS NULL AND expires_at > ?", user.ID, time.Now()).
			Order("last_used_at ASC").Find(&active).Error; err != nil {
			return err
		}
		// Evict the oldest sessions so that, with the new one, at most 2 remain.
		for i := 0; i < len(active)-(maxDevices-1); i++ {
			if err := tx.Delete(&active[i]).Error; err != nil {
				return err
			}
		}
		return tx.Create(&session).Error
	})
	if err != nil {
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

	// Touch last_used_at at most every few minutes (one cheap guarded UPDATE,
	// no per-request goroutine, no write on most requests).
	if time.Since(session.LastUsedAt) > touchEvery {
		s.DB.WithContext(ctx).Model(&models.Session{}).
			Where("id = ? AND last_used_at < ?", session.ID, time.Now().Add(-touchEvery)).
			Update("last_used_at", time.Now())
	}

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
