package models

import (
	"time"

	"github.com/google/uuid"
)

// AnalyticsEvent is one product-analytics event sent by the app (when collection is switched on).
type AnalyticsEvent struct {
	ID         uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID     *uuid.UUID `gorm:"type:uuid;index" json:"user_id,omitempty"`
	Name       string     `gorm:"type:text;not null;index" json:"name"`
	Props      JSONB      `gorm:"type:jsonb" json:"props,omitempty"`
	AppVersion string     `gorm:"type:text" json:"app_version,omitempty"`
	Platform   string     `gorm:"type:text" json:"platform,omitempty"`
	At         time.Time  `gorm:"not null;index" json:"at"`
}
