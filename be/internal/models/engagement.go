package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

type DailyActivity struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_user_date" json:"user_id"`
	User      User      `gorm:"foreignKey:UserID" json:"-"`
	Date      time.Time `gorm:"type:date;not null;uniqueIndex:idx_user_date" json:"date"`
	CreatedAt time.Time `json:"created_at"`
}

type BookmarkCollection struct {
	ID         uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Key        string     `gorm:"type:text;not null;index" json:"key"`
	Label      string     `gorm:"type:text;not null" json:"label"`
	OrderIndex int        `gorm:"not null;default:0" json:"order_index"`
	OwnerID    *uuid.UUID `gorm:"type:uuid;index" json:"owner_id,omitempty"` // null = system collection
	IsActive   bool       `gorm:"not null" json:"is_active"`
	CreatedAt  time.Time  `json:"created_at"`
}

type Bookmark struct {
	ID           uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID       uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_bookmark_item" json:"user_id"`
	ItemType     string    `gorm:"type:text;not null;uniqueIndex:idx_bookmark_item" json:"item_type"`
	ItemID       uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_bookmark_item" json:"item_id"`
	CollectionID uuid.UUID `gorm:"type:uuid;not null;index" json:"collection_id"`
	Note         *string   `gorm:"type:text" json:"note,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type ContentReport struct {
	ID             uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ReporterID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"reporter_id"`
	ItemType       string     `gorm:"type:text;not null" json:"item_type"`
	ItemID         uuid.UUID  `gorm:"type:uuid;not null;index" json:"item_id"`
	ItemVersion    *int       `json:"item_version,omitempty"`
	Reason         string     `gorm:"type:text;not null" json:"reason"`
	Note           *string    `gorm:"type:text" json:"note,omitempty"`
	Context        string     `gorm:"type:text" json:"context"`
	AttemptID      *uuid.UUID `gorm:"type:uuid" json:"attempt_id,omitempty"`
	Status         string     `gorm:"type:text;not null;default:'open';index" json:"status"`
	AssigneeID     *uuid.UUID `gorm:"type:uuid;index" json:"assignee_id,omitempty"`
	ResolvedBy     *uuid.UUID `gorm:"type:uuid" json:"resolved_by,omitempty"`
	ResolvedAt     *time.Time `json:"resolved_at,omitempty"`
	ResolutionNote *string    `gorm:"type:text" json:"resolution_note,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type Rating struct {
	UserID    uuid.UUID      `gorm:"type:uuid;primaryKey" json:"user_id"`
	ItemType  string         `gorm:"type:text;primaryKey" json:"item_type"`
	ItemID    uuid.UUID      `gorm:"type:uuid;primaryKey;index" json:"item_id"`
	Value     int            `gorm:"not null" json:"value"`
	Tags      pq.StringArray `gorm:"type:text[]" json:"tags,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}
