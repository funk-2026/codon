// Package handlers contains shared request/response types used across all
// Gin handlers. These are also picked up by swaggo for OpenAPI schema generation.
package handlers

import (
	"codon-backend/internal/httpx"

	"github.com/gin-gonic/gin"
)

// errorResponse is the standard error envelope returned by all endpoints on failure.
// Machine-readable failures additionally carry a stable `code` (and optional
// `details`); clients must switch on `code`, never on the message text.
type errorResponse struct {
	Error   string      `json:"error" example:"descriptive error message"`
	Code    string      `json:"code,omitempty" example:"pool_too_small"`
	Details interface{} `json:"details,omitempty"`
}

// messageResponse is the standard success envelope for operations that don't return data.
type messageResponse struct {
	Message string `json:"message" example:"operation successful"`
}

// respondErr writes a coded error: {error, code, details}. It is the same
// envelope as httpx.Error; handlers use whichever reads better.
func respondErr(c *gin.Context, status int, code, msg string, details ...interface{}) {
	httpx.Error(c, status, code, msg, details...)
}
