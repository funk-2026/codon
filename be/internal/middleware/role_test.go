package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"codon-backend/internal/middleware"
	"codon-backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func setupTestRouter(handlerRole models.UserRole, allowedRoles ...models.UserRole) (*httptest.ResponseRecorder, *http.Request) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	r.GET("/test-endpoint", func(c *gin.Context) {
		if handlerRole != "" {
			c.Set(middleware.ContextUser, &models.User{
				ID:   uuid.New(),
				Role: handlerRole,
			})
		}
		c.Next()
	}, middleware.RequireRole(allowedRoles...), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/test-endpoint", nil)
	r.ServeHTTP(w, req)
	return w, req
}

func TestRequireRole_Unauthenticated(t *testing.T) {
	w, _ := setupTestRouter("", models.RoleStudent)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, w.Code)
	}
}

func TestRequireRole_StudentAccess(t *testing.T) {
	// Student accessing student route -> OK
	w, _ := setupTestRouter(models.RoleStudent, models.RoleStudent)
	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	// Student accessing teacher route -> Forbidden
	w, _ = setupTestRouter(models.RoleStudent, models.RoleTeacher)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, w.Code)
	}

	// Student accessing admin route -> Forbidden
	w, _ = setupTestRouter(models.RoleStudent, models.RoleAdmin)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, w.Code)
	}
}

func TestRequireRole_TeacherAccess(t *testing.T) {
	// Teacher accessing teacher route -> OK
	w, _ := setupTestRouter(models.RoleTeacher, models.RoleTeacher)
	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	// Teacher accessing student-only route -> Forbidden
	w, _ = setupTestRouter(models.RoleTeacher, models.RoleStudent)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, w.Code)
	}

	// Teacher accessing admin-only route -> Forbidden
	w, _ = setupTestRouter(models.RoleTeacher, models.RoleAdmin)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, w.Code)
	}
}

func TestRequireRole_AdminAccessSuperuser(t *testing.T) {
	// Admin accessing student-only route -> OK (allowed as superuser)
	w, _ := setupTestRouter(models.RoleAdmin, models.RoleStudent)
	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	// Admin accessing teacher-only route -> OK (allowed as superuser)
	w, _ = setupTestRouter(models.RoleAdmin, models.RoleTeacher)
	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	// Admin accessing admin route -> OK
	w, _ = setupTestRouter(models.RoleAdmin, models.RoleAdmin)
	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, w.Code)
	}
}

