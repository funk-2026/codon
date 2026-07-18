// Package handlers contains shared request/response types used across all
// Gin handlers. These are also picked up by swaggo for OpenAPI schema generation.
package handlers

// errorResponse is the standard error envelope returned by all endpoints on failure.
type errorResponse struct {
	Error string `json:"error" example:"descriptive error message"`
}

// messageResponse is the standard success envelope for operations that don't return data.
type messageResponse struct {
	Message string `json:"message" example:"operation successful"`
}
