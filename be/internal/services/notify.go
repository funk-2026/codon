package services

import (
	"github.com/google/uuid"
	"gorm.io/gorm"

	"codon-backend/internal/models"
)

// Notify writes an in-app notification row (push delivery, when enabled,
// picks unsent rows up later — see the push sender).
func Notify(db *gorm.DB, userID uuid.UUID, typ, title, body string, data map[string]interface{}) {
	n := models.Notification{UserID: userID, Type: typ, Title: title, Body: body}
	if data != nil {
		n.Data = jsonBytes(data)
	}
	db.Create(&n)
}
