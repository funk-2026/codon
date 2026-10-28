package services

import (
	"encoding/json"
	"net/http"

	"codon-backend/internal/models"
)

// CodedError is a service-layer failure carrying an HTTP status and a stable
// machine-readable code. Handlers translate it to {error, code, details}.
type CodedError struct {
	Status  int
	Code    string
	Msg     string
	Details interface{}
}

func (e *CodedError) Error() string { return e.Msg }

func Coded(status int, code, msg string, details ...interface{}) *CodedError {
	e := &CodedError{Status: status, Code: code, Msg: msg}
	if len(details) > 0 {
		e.Details = details[0]
	}
	return e
}

func NotFound(code, msg string) *CodedError  { return Coded(http.StatusNotFound, code, msg) }
func Forbidden(code, msg string) *CodedError { return Coded(http.StatusForbidden, code, msg) }
func Conflict(code, msg string) *CodedError  { return Coded(http.StatusConflict, code, msg) }
func Invalid(code, msg string, details ...interface{}) *CodedError {
	return Coded(http.StatusUnprocessableEntity, code, msg, details...)
}

func jsonBytes(v interface{}) models.JSONB {
	b, _ := json.Marshal(v)
	return models.JSONB(b)
}
