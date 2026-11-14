package router_test

import (
	"testing"
	"time"

	"codon-backend/internal/models"

	"github.com/google/uuid"
)

// Role changes: nobody changes their own role, the change is audited, and other admins can demote an admin.
func TestRoleChangeSafeguardsAndAudit(t *testing.T) {
	e := newEnv(t)
	admin := e.w.Admin
	other := e.w.User(t, models.RoleAdmin)

	if code, _ := e.do("PATCH", "/admin/users/"+admin.ID.String()+"/role", &admin, map[string]string{"role": "student"}); code != 409 {
		t.Fatalf("changing your own role must be refused, got %d", code)
	}

	e.mustDo(200, "PATCH", "/admin/users/"+e.w.Student.ID.String()+"/role", &admin, map[string]string{"role": "teacher"})
	var u models.User
	e.db.First(&u, "id = ?", e.w.Student.ID)
	if u.Role != models.RoleTeacher {
		t.Fatalf("role = %s, want teacher", u.Role)
	}
	var n int64
	e.db.Model(&models.AdminAuditLog{}).Where("action = ? AND target = ?", "user.role_change", "user:"+e.w.Student.ID.String()).Count(&n)
	if n != 1 {
		t.Fatalf("role change must write one audit row, got %d", n)
	}

	// another admin may demote this one while a second admin remains
	e.mustDo(200, "PATCH", "/admin/users/"+admin.ID.String()+"/role", &other, map[string]string{"role": "teacher"})
	// ...but now `other` is the last admin and cannot be demoted by anyone else; a non-admin cannot try
	if code, _ := e.do("PATCH", "/admin/users/"+other.ID.String()+"/role", &e.w.Teacher, map[string]string{"role": "student"}); code != 403 {
		t.Fatalf("non-admin role change must be 403, got %d", code)
	}
}

// Suspending ends every session and is audited; you cannot suspend yourself; reactivating clears it.
func TestSuspendAndReactivate(t *testing.T) {
	e := newEnv(t)
	admin, student := e.w.Admin, e.w.Student
	e.db.Create(&models.Session{ID: uuid.New(), UserID: student.ID, DeviceID: "d1", ExpiresAt: time.Now().Add(24 * time.Hour)})

	if code, _ := e.do("POST", "/admin/users/"+admin.ID.String()+"/suspend", &admin, map[string]string{"reason": "testing"}); code != 409 {
		t.Fatalf("self-suspend must be refused, got %d", code)
	}
	if code, _ := e.do("POST", "/admin/users/"+student.ID.String()+"/suspend", &admin, map[string]string{"reason": "x"}); code != 400 {
		t.Fatalf("a too-short reason must be 400, got %d", code)
	}
	e.mustDo(200, "POST", "/admin/users/"+student.ID.String()+"/suspend", &admin, map[string]string{"reason": "chargeback dispute"})

	var u models.User
	e.db.First(&u, "id = ?", student.ID)
	if u.SuspendedAt == nil {
		t.Fatal("suspended_at must be set")
	}
	var sessions int64
	e.db.Model(&models.Session{}).Where("user_id = ?", student.ID).Count(&sessions)
	if sessions != 0 {
		t.Fatalf("suspending must end every session, %d left", sessions)
	}

	e.mustDo(200, "POST", "/admin/users/"+student.ID.String()+"/reactivate", &admin, nil)
	var after models.User
	e.db.First(&after, "id = ?", student.ID)
	if after.SuspendedAt != nil {
		t.Fatal("reactivate must clear suspended_at")
	}
}

// The feedback inbox lists what users sent, with who sent it, and lets an admin resolve it.
func TestFeedbackInbox(t *testing.T) {
	e := newEnv(t)
	e.mustDo(201, "POST", "/feedback", &e.w.Student, map[string]string{"category": "bug", "message": "The timer freezes"})

	out := e.mustDo(200, "GET", "/admin/feedback", &e.w.Admin, nil)
	items, _ := out["items"].([]interface{})
	if len(items) != 1 {
		t.Fatalf("want 1 feedback item, got %d: %v", len(items), out)
	}
	first := items[0].(map[string]interface{})
	if first["status"] != "new" || first["user_phone"] != e.w.Student.PhoneNumber {
		t.Fatalf("unexpected entry: %v", first)
	}
	if code, _ := e.do("GET", "/admin/feedback", &e.w.Student, nil); code != 403 {
		t.Fatalf("students must not read feedback, got %d", code)
	}

	e.mustDo(200, "PATCH", "/admin/feedback/"+first["id"].(string), &e.w.Admin, map[string]interface{}{"status": "resolved", "note": "fixed in 1.0.1"})
	var f models.UserFeedback
	e.db.First(&f, "id = ?", first["id"])
	if f.Status != "resolved" || f.ResolvedAt == nil {
		t.Fatalf("feedback not resolved: %+v", f)
	}
}

// Only published items can be taken down; the author sees why, and it is audited.
func TestTakedown(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModuleQBank, 2, true) // the helper creates it published
	e.db.Model(&models.Test{}).Where("id = ?", test.ID).Update("status", models.StatusDraft)
	if code, _ := e.do("POST", "/admin/takedown/tests/"+test.ID.String(), &e.w.Admin, map[string]string{"reason": "wrong key"}); code != 409 {
		t.Fatalf("an unpublished test cannot be taken down, got %d", code)
	}
	e.db.Model(&models.Test{}).Where("id = ?", test.ID).Update("status", models.StatusPublished)

	e.mustDo(200, "POST", "/admin/takedown/tests/"+test.ID.String(), &e.w.Admin, map[string]string{"reason": "wrong answer key"})
	var got models.Test
	e.db.First(&got, "id = ?", test.ID)
	if got.Status != models.StatusRejected || got.RejectionReason == nil || *got.RejectionReason != "Taken down: wrong answer key" {
		t.Fatalf("takedown not applied: %s %v", got.Status, got.RejectionReason)
	}
	if code, _ := e.do("POST", "/admin/takedown/nonsense/"+test.ID.String(), &e.w.Admin, map[string]string{"reason": "abc"}); code != 400 {
		t.Fatalf("unknown kind must be 400, got %d", code)
	}
}

// status=all and the creator filter on the admin test list.
func TestAdminTestListAllStatuses(t *testing.T) {
	e := newEnv(t)
	e.w.Test(t, models.ModuleQBank, 1, true) // published, so the default pending list must not include it

	pending := e.mustDo(200, "GET", "/admin/tests", &e.w.Admin, nil)
	all := e.mustDo(200, "GET", "/admin/tests?status=all", &e.w.Admin, nil)
	if len(all["tests"].([]interface{})) <= len(pending["tests"].([]interface{})) {
		t.Fatalf("status=all must list more than the default pending list")
	}
	none := e.mustDo(200, "GET", "/admin/tests?status=all&creator_id="+uuid.NewString(), &e.w.Admin, nil)
	if len(none["tests"].([]interface{})) != 0 {
		t.Fatalf("an unknown creator must match nothing")
	}
}

// Grant access starts a subscription without a payment, then extends it.
func TestGrantAccess(t *testing.T) {
	e := newEnv(t)
	plan := models.SubscriptionPlan{Name: "Pro", CourseID: e.w.Course.ID, DurationDays: 30, PricePaise: 49900, Currency: "INR", IsActive: true, CreatedBy: e.w.Admin.ID}
	if err := e.db.Create(&plan).Error; err != nil {
		t.Fatal(err)
	}
	path := "/admin/users/" + e.w.Student.ID.String() + "/subscription/grant"
	first := e.mustDo(200, "POST", path, &e.w.Admin, map[string]interface{}{"plan_id": plan.ID.String(), "reason": "payment failed but they paid"})
	if first["subscription"] == nil {
		t.Fatalf("no subscription returned: %v", first)
	}
	e.mustDo(200, "POST", path, &e.w.Admin, map[string]interface{}{"plan_id": plan.ID.String(), "days": 10, "reason": "goodwill extension"})
	var subs int64
	e.db.Model(&models.Subscription{}).Where("user_id = ?", e.w.Student.ID).Count(&subs)
	if subs != 1 {
		t.Fatalf("a second grant must extend, not add: %d subscriptions", subs)
	}
	var payments int64
	e.db.Model(&models.PaymentRecord{}).Where("user_id = ?", e.w.Student.ID).Count(&payments)
	if payments != 0 {
		t.Fatalf("granting access must not create a payment record")
	}
}

// A teacher can be created by phone number before they sign in; an existing number is refused.
func TestInviteTeacher(t *testing.T) {
	e := newEnv(t)
	body := map[string]string{"phone_number": "+91 90000-11122", "name": "Asha"}
	out := e.mustDo(201, "POST", "/admin/users/invite", &e.w.Admin, body)
	if out["role"] != "teacher" || out["phone_number"] != "+919000011122" {
		t.Fatalf("unexpected invited user: %v", out)
	}
	if code, _ := e.do("POST", "/admin/users/invite", &e.w.Admin, body); code != 409 {
		t.Fatalf("an existing number must be 409, got %d", code)
	}
	if code, _ := e.do("POST", "/admin/users/invite", &e.w.Teacher, body); code != 403 {
		t.Fatalf("only admins may invite, got %d", code)
	}
}

// Courses can be created (a name only once); empty chapters can be deleted, used ones cannot.
func TestCourseAndChapterManagement(t *testing.T) {
	e := newEnv(t)
	e.mustDo(201, "POST", "/admin/courses", &e.w.Admin, map[string]string{"name": "NEET PG 2027"})
	if code, _ := e.do("POST", "/admin/courses", &e.w.Admin, map[string]string{"name": "NEET PG 2027"}); code != 409 {
		t.Fatalf("a duplicate course must be 409, got %d", code)
	}

	empty := e.mustDo(201, "POST", "/admin/subjects/"+e.w.Subject.ID.String()+"/chapters", &e.w.Admin, map[string]string{"name": "Scratch"})
	e.mustDo(200, "DELETE", "/admin/chapters/"+empty["id"].(string), &e.w.Admin, nil)

	e.w.Test(t, models.ModuleQBank, 1, true) // puts a test (and question) in the world's chapter
	if code, _ := e.do("DELETE", "/admin/chapters/"+e.w.Chapter.ID.String(), &e.w.Admin, nil); code != 409 {
		t.Fatalf("a chapter in use must not be deleted, got %d", code)
	}
	if code, _ := e.do("DELETE", "/admin/subjects/"+e.w.Subject.ID.String(), &e.w.Admin, nil); code != 409 {
		t.Fatalf("a subject with chapters must not be deleted, got %d", code)
	}
}

// An announcement reaches only the chosen audience, and its route must be a student screen.
func TestAnnouncement(t *testing.T) {
	e := newEnv(t)
	aud := e.mustDo(200, "GET", "/admin/announcements/audience?audience=students", &e.w.Admin, nil)
	if aud["count"].(float64) < 1 {
		t.Fatalf("the world has a student, got %v", aud)
	}
	if code, _ := e.do("POST", "/admin/announcements", &e.w.Admin, map[string]string{"audience": "students", "title": "Hello", "route": "/(admin)/(tabs)/review"}); code != 400 {
		t.Fatalf("an admin route must be refused, got %d", code)
	}
	e.mustDo(200, "POST", "/admin/announcements", &e.w.Admin, map[string]string{"audience": "students", "title": "New batch starts", "body": "Monday"})
	var forStudent, forTeacher int64
	e.db.Model(&models.Notification{}).Where("user_id = ? AND type = ?", e.w.Student.ID, "announcement").Count(&forStudent)
	e.db.Model(&models.Notification{}).Where("user_id = ? AND type = ?", e.w.Teacher.ID, "announcement").Count(&forTeacher)
	if forStudent != 1 || forTeacher != 0 {
		t.Fatalf("student got %d, teacher got %d (want 1 and 0)", forStudent, forTeacher)
	}
}

// Exports are admin-only.
func TestExportsAdminOnly(t *testing.T) {
	e := newEnv(t)
	for _, p := range []string{"/admin/export/users.csv", "/admin/export/payments.csv"} {
		if code, _ := e.do("GET", p, &e.w.Admin, nil); code != 200 {
			t.Fatalf("%s as admin → %d", p, code)
		}
		if code, _ := e.do("GET", p, &e.w.Student, nil); code != 403 {
			t.Fatalf("%s as student → %d, want 403", p, code)
		}
	}
}

// Approving a submission is written to the audit log.
func TestReviewDecisionIsAudited(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModuleQBank, 1, true)
	e.db.Model(&models.Test{}).Where("id = ?", test.ID).Update("status", models.StatusPendingReview)
	e.mustDo(200, "POST", "/admin/tests/"+test.ID.String()+"/approve", &e.w.Admin, nil)
	var n int64
	e.db.Model(&models.AdminAuditLog{}).Where("action = ? AND target = ?", "review.test.approved", "tests:"+test.ID.String()).Count(&n)
	if n != 1 {
		t.Fatalf("approval must write one audit row, got %d", n)
	}
}
