// Package httpx holds the small request/response helpers every handler uses,
// so error shape and logging are identical across the API.
//
// Error envelope: {"error": "...", "code": "...", "details": ...}. Clients
// switch on `code`, never on the message.
package httpx

import (
	"errors"
	"log"
	"net/http"
	"strconv"

	"codon-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type errorBody struct {
	Error   string      `json:"error"`
	Code    string      `json:"code,omitempty"`
	Details interface{} `json:"details,omitempty"`
}

// Error writes a coded error response.
func Error(c *gin.Context, status int, code, msg string, details ...interface{}) {
	b := errorBody{Error: msg, Code: code}
	if len(details) > 0 {
		b.Details = details[0]
	}
	c.JSON(status, b)
}

// Fail maps any error to a response: coded service errors keep their status
// and code, "record not found" becomes 404, anything else is logged and
// returned as an opaque 500 (internal messages are never leaked to clients).
func Fail(c *gin.Context, err error) {
	var ce *services.CodedError
	switch {
	case errors.As(err, &ce):
		Error(c, ce.Status, ce.Code, ce.Msg, ce.Details)
	case errors.Is(err, gorm.ErrRecordNotFound):
		Error(c, http.StatusNotFound, "not_found", "not found")
	default:
		log.Printf("[http] %s %s: %v", c.Request.Method, c.Request.URL.Path, err)
		Error(c, http.StatusInternalServerError, "internal", "something went wrong")
	}
}

// BadRequest writes a 400 with the given code.
func BadRequest(c *gin.Context, code, msg string) { Error(c, http.StatusBadRequest, code, msg) }

// NotFound writes a 404 with the given code.
func NotFound(c *gin.Context, code, msg string) { Error(c, http.StatusNotFound, code, msg) }

// OK writes a 200 JSON body.
func OK(c *gin.Context, v interface{}) { c.JSON(http.StatusOK, v) }

// Created writes a 201 JSON body.
func Created(c *gin.Context, v interface{}) { c.JSON(http.StatusCreated, v) }

// Message writes {"message": msg}.
func Message(c *gin.Context, msg string) { c.JSON(http.StatusOK, gin.H{"message": msg}) }

// ParamUUID parses a path parameter; on failure it has already written a 400.
func ParamUUID(c *gin.Context, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(name))
	if err != nil {
		BadRequest(c, "invalid_id", "invalid "+name)
		return uuid.Nil, false
	}
	return id, true
}

// Bind decodes the JSON body into v; on failure it has already written a 400.
func Bind(c *gin.Context, v interface{}) bool {
	if err := c.ShouldBindJSON(v); err != nil {
		BadRequest(c, "bad_request", err.Error())
		return false
	}
	return true
}

// QueryInt reads an integer query parameter, falling back to def.
func QueryInt(c *gin.Context, name string, def int) int {
	n, err := strconv.Atoi(c.Query(name))
	if err != nil {
		return def
	}
	return n
}

// EscapeLike escapes %, _ and \ so user text is matched literally in LIKE.
func EscapeLike(s string) string {
	out := make([]rune, 0, len(s))
	for _, r := range s {
		if r == '%' || r == '_' || r == '\\' {
			out = append(out, '\\')
		}
		out = append(out, r)
	}
	return string(out)
}
