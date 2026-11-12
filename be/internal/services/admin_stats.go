package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"codon-backend/internal/clock"
	"codon-backend/internal/models"

	"gorm.io/gorm"
)

// AdminStats computes the admin dashboard numbers.
type AdminStats struct{ DB *gorm.DB }

func NewAdminStats(db *gorm.DB) *AdminStats { return &AdminStats{DB: db} }

type DashboardSummary struct {
	TotalUsers            int64 `json:"total_users"             example:"1420"`
	ActiveSubscriptions   int64 `json:"active_subscriptions"    example:"830"`
	PendingKYC            int64 `json:"pending_kyc"             example:"12"`
	PendingTestReviews    int64 `json:"pending_test_reviews"    example:"5"`
	PendingContentReviews int64 `json:"pending_content_reviews" example:"3"`
}

type AnalyticsOverview struct {
	NewUsers            int64  `json:"new_users"`
	NewUsersDelta       string `json:"new_users_delta"`
	NewUsersPositive    bool   `json:"new_users_positive"`
	Revenue             int64  `json:"revenue"`
	RevenueDelta        string `json:"revenue_delta"`
	RevenuePositive     bool   `json:"revenue_positive"`
	ActiveSubscriptions int64  `json:"active_subscriptions"`
	ActiveSubDelta      string `json:"active_subscriptions_delta"`
	ActiveSubPositive   bool   `json:"active_subscriptions_positive"`
	TestsAttempted      int64  `json:"tests_attempted"`
	TestsAttemptedDelta string `json:"tests_attempted_delta"`
	TestsAttemptedPos   bool   `json:"tests_attempted_positive"`
	RevenueBars         []int  `json:"revenue_bars"`
	StudentBars         []int  `json:"student_bars"`
	TeacherBars         []int  `json:"teacher_bars"`
	PublishedTests      int64  `json:"published_tests"`
	PublishedContent    int64  `json:"published_content"`
	PublishedBrainHacks int64  `json:"published_brain_hacks"`
	PendingReviews      int64  `json:"pending_reviews"`
}

func calcDelta(current, previous int64) (string, bool) {
	if previous == 0 {
		if current == 0 {
			return "0%", true
		}
		return "+100%", true
	}
	diff := float64(current - previous)
	pct := (diff / float64(previous)) * 100
	positive := pct >= 0
	sign := "+"
	if !positive {
		sign = "" // float format handles minus
	}
	return fmt.Sprintf("%s%.0f%%", sign, pct), positive
}

// Dashboard returns the headline counters.
func (s *AdminStats) Dashboard(ctx context.Context) (*DashboardSummary, error) {
	db := s.DB.WithContext(ctx)
	var out DashboardSummary
	counts := []struct {
		dst *int64
		q   *gorm.DB
	}{
		{&out.TotalUsers, db.Model(&models.User{})},
		{&out.ActiveSubscriptions, db.Model(&models.Subscription{}).Where("status = ? AND end_date >= NOW()", models.SubActive)},
		{&out.PendingKYC, db.Model(&models.KYCRecord{}).Where("status = ?", models.KYCPending)},
		{&out.PendingTestReviews, db.Model(&models.Test{}).Where("status = ?", models.StatusPendingReview)},
		{&out.PendingContentReviews, db.Model(&models.ContentItem{}).Where("status = ?", models.StatusPendingReview)},
	}
	for _, c := range counts {
		if err := c.q.Count(c.dst).Error; err != nil {
			return nil, err
		}
	}
	return &out, nil
}

// Overview computes the analytics page for range 7D, 30D or ALL (also accepts
// "All Time"). "active_subscriptions" is the number of ACTIVE subscriptions
// that were created in the window.
func (s *AdminStats) Overview(ctx context.Context, rangeStr string, now time.Time) (*AnalyticsOverview, error) {
	rangeStr = strings.ToUpper(strings.ReplaceAll(rangeStr, " ", ""))
	if rangeStr == "ALLTIME" {
		rangeStr = "ALL"
	}
	var days, numBars int
	switch rangeStr {
	case "7D":
		days, numBars = 7, 7
	case "30D":
		days, numBars = 30, 30
	case "ALL":
		numBars = 12 // last 12 months
	default:
		return nil, Coded(400, "invalid_range", "range must be 7D, 30D or ALL")
	}
	var start, prevStart time.Time
	hasPrev := days > 0
	if hasPrev {
		start = now.AddDate(0, 0, -days)
		prevStart = start.AddDate(0, 0, -days)
	}
	db := s.DB.WithContext(ctx)
	cur := func(model interface{}, col string) *gorm.DB {
		q := db.Model(model)
		if !start.IsZero() {
			q = q.Where(col+" >= ?", start)
		}
		return q
	}
	prev := func(model interface{}, col string) *gorm.DB {
		if !hasPrev {
			return db.Model(model).Where("1 = 0")
		}
		return db.Model(model).Where(col+" >= ? AND "+col+" < ?", prevStart, start)
	}

	var out AnalyticsOverview
	var userN, prevUserN, subN, prevSubN, attN, prevAttN int64
	steps := []struct {
		dst *int64
		q   *gorm.DB
	}{
		{&userN, cur(&models.User{}, "created_at")},
		{&prevUserN, prev(&models.User{}, "created_at")},
		{&subN, cur(&models.Subscription{}, "created_at").Where("status = ?", models.SubActive)},
		{&prevSubN, prev(&models.Subscription{}, "created_at").Where("status = ?", models.SubActive)},
		{&attN, cur(&models.StudentAttempt{}, "started_at")},
		{&prevAttN, prev(&models.StudentAttempt{}, "started_at")},
		{&out.PublishedTests, db.Model(&models.Test{}).Where("status = ? AND origin = ?", models.StatusPublished, models.OriginAuthored)},
		{&out.PublishedContent, db.Model(&models.ContentItem{}).Where("status = ?", models.StatusPublished)},
		{&out.PublishedBrainHacks, db.Model(&models.BrainHack{}).Where("status = ?", models.StatusPublished)},
	}
	for _, st := range steps {
		if err := st.q.Count(st.dst).Error; err != nil {
			return nil, err
		}
	}
	var pending [3]int64
	for i, m := range []interface{}{&models.Test{}, &models.ContentItem{}, &models.BrainHack{}} {
		if err := db.Model(m).Where("status = ?", models.StatusPendingReview).Count(&pending[i]).Error; err != nil {
			return nil, err
		}
	}
	out.PendingReviews = pending[0] + pending[1] + pending[2]

	var rev, prevRev struct{ Total int64 }
	if err := cur(&models.PaymentRecord{}, "created_at").Select("COALESCE(SUM(amount_paise), 0) AS total").Where("status = ?", models.PayCaptured).Scan(&rev).Error; err != nil {
		return nil, err
	}
	if err := prev(&models.PaymentRecord{}, "created_at").Select("COALESCE(SUM(amount_paise), 0) AS total").Where("status = ?", models.PayCaptured).Scan(&prevRev).Error; err != nil {
		return nil, err
	}
	out.NewUsers, out.Revenue, out.ActiveSubscriptions, out.TestsAttempted = userN, rev.Total/100, subN, attN
	out.NewUsersDelta, out.NewUsersPositive = calcDelta(userN, prevUserN)
	out.RevenueDelta, out.RevenuePositive = calcDelta(rev.Total/100, prevRev.Total/100)
	out.ActiveSubDelta, out.ActiveSubPositive = calcDelta(subN, prevSubN)
	out.TestsAttemptedDelta, out.TestsAttemptedPos = calcDelta(attN, prevAttN)
	if !hasPrev {
		out.NewUsersDelta, out.NewUsersPositive = "0%", true
		out.RevenueDelta, out.RevenuePositive = "0%", true
		out.ActiveSubDelta, out.ActiveSubPositive = "0%", true
		out.TestsAttemptedDelta, out.TestsAttemptedPos = "0%", true
	}

	monthly := rangeStr == "ALL"
	out.RevenueBars, out.StudentBars, out.TeacherBars = make([]int, numBars), make([]int, numBars), make([]int, numBars)
	fill := func(rows []bucketRow, bars []int) {
		for _, r := range rows {
			if idx := bucketIndex(r.B, now, numBars, monthly); idx >= 0 {
				bars[idx] += int(r.N)
			}
		}
	}
	fill(s.bucketCounts(ctx, "users", "created_at", "role = 'student'", "count(*)", start, monthly), out.StudentBars)
	fill(s.bucketCounts(ctx, "users", "created_at", "role = 'teacher'", "count(*)", start, monthly), out.TeacherBars)
	fill(s.bucketCounts(ctx, "payment_records", "created_at", "status = 'captured'", "COALESCE(sum(amount_paise), 0) / 100", start, monthly), out.RevenueBars)
	return &out, nil
}

type bucketRow struct {
	B time.Time
	N int64
}

// bucketCounts aggregates `agg` per app-day (or month) since `from`, in SQL.
// table, tsCol, where and agg are compile-time constants at every call site.
func (s *AdminStats) bucketCounts(ctx context.Context, table, tsCol, where, agg string, from time.Time, monthly bool) []bucketRow {
	unit := "day"
	if monthly {
		unit = "month"
	}
	q := "SELECT date_trunc('" + unit + "', " + tsCol + " AT TIME ZONE 'Asia/Kolkata') AS b, " + agg + " AS n FROM " + table + " WHERE " + where
	args := []interface{}{}
	if !from.IsZero() {
		q += " AND " + tsCol + " >= ?"
		args = append(args, from)
	}
	q += " GROUP BY 1"
	var rows []bucketRow
	s.DB.WithContext(ctx).Raw(q, args...).Scan(&rows)
	return rows
}

// bucketIndex maps a bucket start to its slot in a bar chart of numBars slots
// ending today (days) or this month (months); -1 when outside the window.
func bucketIndex(b, now time.Time, numBars int, monthly bool) int {
	local := now.In(clock.AppZone)
	var diff int
	if monthly {
		diff = (local.Year()-b.Year())*12 + int(local.Month()) - int(b.Month())
	} else {
		today := clock.AppDay(now)
		bd := time.Date(b.Year(), b.Month(), b.Day(), 0, 0, 0, 0, time.UTC)
		diff = int(today.Sub(bd).Hours() / 24)
	}
	idx := (numBars - 1) - diff
	if idx < 0 || idx >= numBars {
		return -1
	}
	return idx
}
