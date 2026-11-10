package router_test

import (
	"context"
	"gorm.io/gorm"
	"sync"
	"testing"
	"time"

	"codon-backend/internal/clock"
	"codon-backend/internal/jobs"
	"codon-backend/internal/models"
	"codon-backend/internal/ratelimit"
	"codon-backend/internal/services"
)

// A job must run exactly once even when several workers poll at the same time.
func TestJobClaimIsExclusive(t *testing.T) {
	e := newEnv(t)
	var mu sync.Mutex
	runs := 0
	mk := func() *jobs.Worker {
		w := jobs.NewWorker(e.db, time.Second)
		w.RegisterHandler("noop", func(ctx context.Context, payload string) error {
			mu.Lock()
			runs++
			mu.Unlock()
			time.Sleep(50 * time.Millisecond)
			return nil
		})
		return w
	}
	if err := jobs.EnqueueJob(e.db, "noop", map[string]string{"a": "b"}); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); mk().ProcessOne(context.Background()) }()
	}
	wg.Wait()
	if runs != 1 {
		t.Fatalf("job ran %d times, want 1", runs)
	}
	var j models.BackgroundJob
	e.db.First(&j, "type = ?", "noop")
	if j.Status != models.JobDone || j.LockedAt != nil {
		t.Fatalf("job should be done and unlocked: %+v", j)
	}
}

// A job stuck in `processing` (crashed worker) is re-queued by the reaper.
func TestStuckJobIsRequeued(t *testing.T) {
	e := newEnv(t)
	old := time.Now().Add(-time.Hour)
	j := models.BackgroundJob{Type: "noop", Payload: "{}", Status: models.JobProcessing, RunAfter: old, LockedAt: &old, Attempts: 1}
	e.db.Create(&j)
	jobs.NewWorker(e.db, time.Second).ReapStuck(context.Background())
	e.db.First(&j, "id = ?", j.ID)
	if j.Status != models.JobPending {
		t.Fatalf("status = %s, want pending", j.Status)
	}
}

// A late payment.failed must never overwrite a captured payment.
func TestFailedWebhookCannotUndoCapture(t *testing.T) {
	e := newEnv(t)
	plan := models.SubscriptionPlan{Name: "P", CourseID: e.w.Course.ID, DurationDays: 30, PricePaise: 100, Currency: "INR", IsActive: true, CreatedBy: e.w.Admin.ID}
	e.db.Create(&plan)
	sub := models.Subscription{UserID: e.w.Student.ID, PlanID: plan.ID, CourseID: plan.CourseID, Status: models.SubPendingPayment}
	e.db.Create(&sub)
	sid := sub.ID
	pay := models.PaymentRecord{UserID: e.w.Student.ID, SubscriptionID: &sid, RazorpayOrderID: "order_1", AmountPaise: 100, Currency: "INR", Status: models.PayCreated}
	e.db.Create(&pay)

	svc := services.NewSubscriptionService(e.db)
	ctx := context.Background()
	if err := svc.ActivateSubscription(ctx, "order_1", "pay_1", ""); err != nil {
		t.Fatal(err)
	}
	if err := svc.MarkPaymentFailed(ctx, "order_1", "late failure"); err != nil {
		t.Fatal(err)
	}
	e.db.First(&pay, "id = ?", pay.ID)
	if pay.Status != models.PayCaptured {
		t.Fatalf("payment status = %s, want captured", pay.Status)
	}
	if pay.RazorpaySignature != nil {
		t.Fatalf("webhook activation must not store a fake signature")
	}
	// activating twice is a no-op
	if err := svc.ActivateSubscription(ctx, "order_1", "pay_1", ""); err != nil {
		t.Fatal(err)
	}
}

// Buying again while active extends from the current end date.
func TestRenewalExtendsActiveSubscription(t *testing.T) {
	e := newEnv(t)
	e.w.Subscribe(t, e.w.Student) // ends in ~24h
	plan := models.SubscriptionPlan{Name: "P2", CourseID: e.w.Course.ID, DurationDays: 30, PricePaise: 100, Currency: "INR", IsActive: true, CreatedBy: e.w.Admin.ID}
	e.db.Create(&plan)
	sub := models.Subscription{UserID: e.w.Student.ID, PlanID: plan.ID, CourseID: plan.CourseID, Status: models.SubPendingPayment}
	e.db.Create(&sub)
	sid := sub.ID
	e.db.Create(&models.PaymentRecord{UserID: e.w.Student.ID, SubscriptionID: &sid, RazorpayOrderID: "order_2", AmountPaise: 100, Currency: "INR", Status: models.PayCreated})
	if err := services.NewSubscriptionService(e.db).ActivateSubscription(context.Background(), "order_2", "pay_2", ""); err != nil {
		t.Fatal(err)
	}
	e.db.First(&sub, "id = ?", sub.ID)
	if sub.EndDate == nil || sub.EndDate.Before(time.Now().Add(29*24*time.Hour)) {
		t.Fatalf("renewal should extend past the old period, end=%v", sub.EndDate)
	}
}

// Activity at 01:00 IST belongs to that IST day, not the previous (UTC) one.
func TestDailyActivityUsesAppDay(t *testing.T) {
	e := newEnv(t)
	at := time.Date(2026, 3, 10, 1, 0, 0, 0, clock.AppZone) // 2026-03-09 19:30 UTC
	if err := services.RecordDailyActivity(e.db, e.w.Student.ID, at); err != nil {
		t.Fatal(err)
	}
	var d models.DailyActivity
	e.db.First(&d, "user_id = ?", e.w.Student.ID)
	if got := d.Date.Format("2006-01-02"); got != "2026-03-10" {
		t.Fatalf("activity date = %s, want 2026-03-10", got)
	}
	active, _ := services.ActiveDays(context.Background(), e.db, e.w.Student.ID, at, 30)
	if services.Streak(active, at) != 1 {
		t.Fatalf("streak should be 1")
	}
}

// Scores come from the marking scheme frozen at start, and the client cannot inflate time taken.
func TestScoringUsesSnapshotAndServerTime(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModuleQBank, 2, true) // +4 / -1
	qs, _ := services.LoadTestQuestions(context.Background(), e.db, test.ID)
	attemptID, _ := startAttempt(e, test)
	e.mustDo(200, "PUT", "/attempts/"+attemptID+"/answers/"+qs[0].ID.String(), &e.w.Student, map[string]interface{}{"selected_option": "B"})
	// teacher edits the marking scheme after the student started
	e.db.Model(&models.Test{}).Where("id = ?", test.ID).UpdateColumns(map[string]interface{}{"marks_per_correct": 10})
	out := e.mustDo(200, "POST", "/attempts/"+attemptID+"/submit", &e.w.Student, map[string]interface{}{"time_taken_seconds": 99999})
	if out["score"].(float64) != 4 {
		t.Fatalf("score = %v, want 4 (snapshot marks)", out["score"])
	}
	if out["time_taken_seconds"].(float64) > 60 {
		t.Fatalf("time taken must be the server-measured value, got %v", out["time_taken_seconds"])
	}
}

// Review workflow: one set of rules for every reviewable type.
func TestReviewWorkflowTransitions(t *testing.T) {
	e := newEnv(t)
	svc := services.NewReviewService(e.db)
	ctx := context.Background()
	test := e.w.Test(t, models.ModuleQBank, 1, true)
	e.db.Model(&models.Test{}).Where("id = ?", test.ID).Update("status", models.StatusDraft)

	// a stranger cannot submit someone else's test
	other := e.w.Student
	other.Role = models.RoleTeacher
	if err := svc.Submit(ctx, &other, services.ReviewTest, test.ID, nil); err == nil {
		t.Fatal("non-owner must not submit")
	}
	if err := svc.Submit(ctx, &e.w.Teacher, services.ReviewTest, test.ID, nil); err != nil {
		t.Fatal(err)
	}
	// cannot publish before approval
	if err := svc.Publish(ctx, &e.w.Teacher, services.ReviewTest, test.ID, nil); err == nil {
		t.Fatal("publish before approve must fail")
	}
	if err := svc.Approve(ctx, &e.w.Admin, services.ReviewTest, test.ID); err != nil {
		t.Fatal(err)
	}
	// approving twice fails (no longer pending)
	if err := svc.Approve(ctx, &e.w.Admin, services.ReviewTest, test.ID); err == nil {
		t.Fatal("double approve must fail")
	}
	if err := svc.Publish(ctx, &e.w.Teacher, services.ReviewTest, test.ID, nil); err != nil {
		t.Fatal(err)
	}
	var n int64
	e.db.Model(&models.Notification{}).Where("user_id = ? AND type = ?", e.w.Teacher.ID, "test_approved").Count(&n)
	if n != 1 {
		t.Fatalf("author should be notified of approval, got %d", n)
	}
}

// A question created with custom_eligible=false must stay false (GORM default trap).
func TestCustomEligibleFalseIsStored(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModuleQBank, 0, true)
	e.db.Model(&models.Test{}).Where("id = ?", test.ID).Update("status", models.StatusDraft)
	body := map[string]interface{}{
		"question_text": "Q?", "option_a": "a", "option_b": "b", "option_c": "c", "option_d": "d",
		"correct_option": "A", "custom_eligible": false,
	}
	out := e.mustDo(201, "POST", "/teacher/tests/"+test.ID.String()+"/questions", &e.w.Teacher, body)
	var q models.Question
	e.db.First(&q, "id = ?", str(out, "id"))
	if q.CustomEligible {
		t.Fatal("custom_eligible=false was stored as true")
	}
}

func TestRateLimitIsSharedAndSliding(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	for i := 0; i < 3; i++ {
		ok, err := ratelimit.Allow(ctx, e.db, "k", 3, time.Minute)
		if err != nil || !ok {
			t.Fatalf("call %d should pass: %v %v", i, ok, err)
		}
	}
	if ok, _ := ratelimit.Allow(ctx, e.db, "k", 3, time.Minute); ok {
		t.Fatal("4th call must be denied")
	}
	if ok, _ := ratelimit.Allow(ctx, e.db, "other", 3, time.Minute); !ok {
		t.Fatal("limits are per key")
	}
	e.db.Exec("UPDATE rate_events SET at = now() - interval '2 minutes'")
	if ok, _ := ratelimit.Allow(ctx, e.db, "k", 3, time.Minute); !ok {
		t.Fatal("old events must age out of the window")
	}
}

func TestAdminAttemptsDoNotSkewCohortStats(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModuleQBank, 1, true)
	qs, _ := services.LoadTestQuestions(context.Background(), e.db, test.ID)
	svc := services.NewScoringService(e.db)
	run := func(u *models.User) {
		res, err := svc.StartAttempt(context.Background(), u.ID, &test)
		if err != nil {
			t.Fatal(err)
		}
		if err := svc.UpsertAnswer(context.Background(), u.ID, res.Attempt.ID, qs[0].ID, services.AnswerInput{SelectedSet: true, Selected: ptrStr("B")}); err != nil {
			t.Fatal(err)
		}
		if _, err := svc.SubmitAttempt(context.Background(), res.Attempt.ID, u.ID, nil); err != nil {
			t.Fatal(err)
		}
	}
	run(&e.w.Student)
	run(&e.w.Admin)
	var st models.QuestionStats
	e.db.First(&st, "question_id = ?", qs[0].ID)
	if st.Attempts != 1 {
		t.Fatalf("question_stats.attempts = %d, want 1 (admin excluded)", st.Attempts)
	}
	// a full recompute agrees
	if err := services.RecomputeQuestionStats(context.Background(), e.db, qs[0].ID); err != nil {
		t.Fatal(err)
	}
	e.db.First(&st, "question_id = ?", qs[0].ID)
	if st.Attempts != 1 {
		t.Fatalf("recomputed attempts = %d, want 1", st.Attempts)
	}
}

func TestPurgeRemovesStudyDataButKeepsPayments(t *testing.T) {
	e := newEnv(t)
	test := e.w.Test(t, models.ModuleQBank, 1, true)
	qs, _ := services.LoadTestQuestions(context.Background(), e.db, test.ID)
	svc := services.NewScoringService(e.db)
	res, _ := svc.StartAttempt(context.Background(), e.w.Student.ID, &test)
	svc.UpsertAnswer(context.Background(), e.w.Student.ID, res.Attempt.ID, qs[0].ID, services.AnswerInput{SelectedSet: true, Selected: ptrStr("B")})
	svc.SubmitAttempt(context.Background(), res.Attempt.ID, e.w.Student.ID, nil)
	e.db.Create(&models.PaymentRecord{UserID: e.w.Student.ID, RazorpayOrderID: "o_keep", AmountPaise: 1, Currency: "INR", Status: models.PayCaptured})

	if err := e.db.Transaction(func(tx *gorm.DB) error { return services.PurgePersonalData(tx, e.w.Student.ID) }); err != nil {
		t.Fatal(err)
	}
	var attempts, answers, daily, pays int64
	e.db.Model(&models.StudentAttempt{}).Where("user_id = ?", e.w.Student.ID).Count(&attempts)
	e.db.Model(&models.AttemptAnswer{}).Count(&answers)
	e.db.Model(&models.DailyActivity{}).Where("user_id = ?", e.w.Student.ID).Count(&daily)
	e.db.Model(&models.PaymentRecord{}).Where("user_id = ?", e.w.Student.ID).Count(&pays)
	if attempts != 0 || answers != 0 || daily != 0 {
		t.Fatalf("study data left: attempts=%d answers=%d daily=%d", attempts, answers, daily)
	}
	if pays != 1 {
		t.Fatal("payment records must be retained")
	}
}

func ptrStr(s string) *string { return &s }
