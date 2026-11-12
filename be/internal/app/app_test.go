package app_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"codon-backend/internal/app"
	"codon-backend/internal/config"
	"codon-backend/internal/models"
	"codon-backend/internal/services"
	"codon-backend/internal/testutil"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Building the engine registers every route; gin panics on conflicting routes,
// so this catches wiring mistakes that unit tests of single handlers cannot.
func TestEngineWiring(t *testing.T) {
	db := testutil.DB(t)
	r := app.NewEngine(db, config.Config{Env: "development"})

	cases := []struct {
		path string
		want int
	}{
		{"/healthz", http.StatusOK},
		{"/readyz", http.StatusOK},
		{"/api/v1/courses", http.StatusOK},
		{"/api/v1/subscription-plans", http.StatusOK},
		{"/api/v1/platform-settings/kyc-required", http.StatusOK},
		{"/api/v1/me", http.StatusUnauthorized},
		{"/api/v1/admin/users", http.StatusUnauthorized},
		{"/api/v1/custom-tests", http.StatusUnauthorized},
	}
	for _, c := range cases {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, c.path, nil))
		if w.Code != c.want {
			t.Errorf("GET %s = %d, want %d (%s)", c.path, w.Code, c.want, w.Body.String())
		}
	}
}

// bearer issues a real session token for u, as the OTP login would.
func bearer(t *testing.T, db *gorm.DB, u *models.User) string {
	t.Helper()
	config.AppConfig.JWTSecret = "test-secret-test-secret-test-secret-123"
	config.AppConfig.JWTExpiryDays = 1
	tok, _, err := services.NewSessionService(db).CreateSession(context.Background(), u, "dev-"+u.ID.String()[:6], "test")
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func call(r http.Handler, method, path, token string, body interface{}) (int, map[string]interface{}) {
	var rd *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	} else {
		rd = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, rd)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	var out map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func TestKYCFlowThroughRealAuth(t *testing.T) {
	db := testutil.DB(t)
	w := testutil.NewWorld(t, db)
	r := app.NewEngine(db, config.Config{Env: "development"})
	student, admin := bearer(t, db, &w.Student), bearer(t, db, &w.Admin)
	own := "kyc_document/" + strings.ToLower(w.Student.ID.String()) + "/id.jpg"

	// someone else's file key is refused
	code, _ := call(r, "POST", "/api/v1/me/kyc", student, map[string]string{"id_type": "pan", "id_number": "ABCDE1234F", "document_file_key": "kyc_document/" + uuid.NewString() + "/x.jpg"})
	if code != 400 {
		t.Fatalf("foreign document key: %d", code)
	}
	code, rec := call(r, "POST", "/api/v1/me/kyc", student, map[string]string{"id_type": "pan", "id_number": "ABCDE1234F", "document_file_key": own})
	if code != 201 || rec["id_number"] != "XXXXXX234F" {
		t.Fatalf("submit: %d %v (number must be masked for the owner)", code, rec)
	}
	if code, _ = call(r, "POST", "/api/v1/me/kyc", student, map[string]string{"id_type": "pan", "id_number": "ABCDE1234F", "document_file_key": own}); code != 409 {
		t.Fatalf("second submission should conflict, got %d", code)
	}
	// admin sees the full number, oldest first, and can decide once
	code, list := call(r, "GET", "/api/v1/admin/kyc?status=pending", admin, nil)
	recs, _ := list["records"].([]interface{})
	if code != 200 || len(recs) != 1 || recs[0].(map[string]interface{})["id_number"] != "ABCDE1234F" {
		t.Fatalf("admin list: %d %v", code, list)
	}
	id := recs[0].(map[string]interface{})["id"].(string)
	if code, _ = call(r, "POST", "/api/v1/admin/kyc/"+id+"/approve", admin, nil); code != 200 {
		t.Fatalf("approve: %d", code)
	}
	if code, _ = call(r, "POST", "/api/v1/admin/kyc/"+id+"/reject", admin, map[string]string{"reason": "late"}); code != 404 {
		t.Fatalf("rejecting an already-approved record must fail, got %d", code)
	}
	var u models.User
	db.First(&u, "id = ?", w.Student.ID)
	if u.KYCStatus != models.KYCApproved {
		t.Fatalf("user kyc_status = %s", u.KYCStatus)
	}

	// platform flag: both the new and the legacy request field work, both response names are returned
	code, out := call(r, "PATCH", "/api/v1/admin/settings/kyc-required", admin, map[string]bool{"required": true})
	if code != 200 || out["kyc_required"] != true || out["required"] != true {
		t.Fatalf("toggle: %d %v", code, out)
	}
	_, out = call(r, "GET", "/api/v1/platform-settings/kyc-required", "", nil)
	if out["required"] != true {
		t.Fatalf("read: %v", out)
	}
}

func TestOTPErrorsAreCoded(t *testing.T) {
	db := testutil.DB(t)
	r := app.NewEngine(db, config.Config{Env: "development"})
	code, out := call(r, "POST", "/api/v1/auth/otp/verify", "", map[string]string{"phone_number": "+919999900000", "otp_code": "123456", "device_id": "d"})
	if code != 401 || out["code"] != "otp_expired" {
		t.Fatalf("verify without OTP: %d %v", code, out)
	}
}
