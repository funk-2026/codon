// Package generation turns a blueprint into a frozen custom test.
//
// It owns: entitlement (paid vs free vs admin), the eligible question pool
// query, the pluggable selection strategies, the reported (never silent)
// fallback policy, dry-run counting with bottleneck/suggestion analysis, and
// creation of the private generated test.
package generation

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"codon-backend/internal/blueprint"
	"codon-backend/internal/models"
	"codon-backend/internal/services"
	"codon-backend/internal/settings"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Tier string

const (
	TierAdmin Tier = "admin"
	TierPaid  Tier = "paid"
	TierFree  Tier = "free"
)

// Entitlement says what part of the pool a user may draw from.
type Entitlement struct {
	Tier     Tier      `json:"tier"`
	CourseID uuid.UUID `json:"course_id"`
}

type Engine struct {
	DB          *gorm.DB
	Sub         *services.SubscriptionService
	KYCRequired func() bool
}

func NewEngine(db *gorm.DB, sub *services.SubscriptionService, kyc func() bool) *Engine {
	if kyc == nil {
		kyc = func() bool { return false }
	}
	return &Engine{DB: db, Sub: sub, KYCRequired: kyc}
}

// EntitlementFor: admins see everything; a student with an active subscription
// (and approved KYC when the platform requires it) sees the whole course pool;
// everyone else gets the free tier — only questions from free-flagged tests.
func (e *Engine) EntitlementFor(ctx context.Context, user *models.User, courseID uuid.UUID) Entitlement {
	if user.Role == models.RoleAdmin {
		return Entitlement{TierAdmin, courseID}
	}
	sub, err := e.Sub.GetActiveSubscription(ctx, user.ID, courseID)
	if err == nil && sub != nil && (!e.KYCRequired() || user.KYCStatus == models.KYCApproved) {
		return Entitlement{TierPaid, courseID}
	}
	return Entitlement{TierFree, courseID}
}

// Limits reads the admin-tunable bounds.
func Limits() blueprint.Limits {
	return blueprint.Limits{
		MinQuestions: settings.Int("custom_test.min_questions"), MaxQuestions: settings.Int("custom_test.max_questions"),
		MinDuration: settings.Int("custom_test.min_duration_minutes"), MaxDuration: settings.Int("custom_test.max_duration_minutes"),
		AllowedSources: settings.List("custom_test.eligible_sources"),
		TutorEnabled:   settings.Bool("custom_test.tutor_mode"), StatusFiltersEnabled: settings.Bool("custom_test.status_filters"),
	}
}

// ── Pool query ────────────────────────────────────────────────────────────────

func inClause(vals interface{}) interface{} { return vals }

// pool builds the eligible-candidate query (table alias q) for a user.
func (e *Engine) pool(ctx context.Context, user *models.User, ent Entitlement, bp blueprint.Blueprint, fixedIDs []uuid.UUID) *gorm.DB {
	q := e.DB.WithContext(ctx).Table("questions q").
		Joins("JOIN tests t ON t.id = q.test_id").
		Where("t.status = 'published' AND t.origin = 'authored' AND t.archived_at IS NULL AND t.course_id = ?", ent.CourseID).
		Where("q.custom_eligible = true AND q.flag_status = 'active'")

	sources := settings.List("custom_test.eligible_sources")
	if len(bp.Filters.SourceTypes) > 0 {
		sources = bp.Filters.SourceTypes
	}
	q = q.Where("q.source_type IN ?", sources)
	if ent.Tier == TierFree {
		q = q.Where("t.requires_subscription = false")
	}
	if len(fixedIDs) > 0 {
		return q.Where("q.id IN ?", fixedIDs)
	}

	f := bp.Filters
	if len(f.SubjectIDs) > 0 {
		q = q.Where("q.subject_id IN ?", f.SubjectIDs)
	}
	if len(f.ChapterIDs) > 0 {
		q = q.Where("q.chapter_id IN ?", f.ChapterIDs)
	}
	if len(f.TopicIDs) > 0 {
		q = q.Where("q.topic_id IN ?", f.TopicIDs)
	}
	if len(f.Difficulty) > 0 {
		q = q.Where("q.difficulty IN ?", f.Difficulty)
	}
	if len(f.TagIDs) > 0 {
		q = q.Where("EXISTS (SELECT 1 FROM question_tags qt WHERE qt.question_id = q.id AND qt.tag_id IN ?)", f.TagIDs)
	}
	if len(f.ExcludeTagIDs) > 0 {
		q = q.Where("NOT EXISTS (SELECT 1 FROM question_tags qt WHERE qt.question_id = q.id AND qt.tag_id IN ?)", f.ExcludeTagIDs)
	}
	if n := f.NCERT; n != nil {
		if n.Class != nil {
			q = q.Where("q.ncert_class = ?", *n.Class)
		}
		if n.PageFrom != nil {
			q = q.Where("q.ncert_page >= ?", *n.PageFrom)
		}
		if n.PageTo != nil {
			q = q.Where("q.ncert_page <= ?", *n.PageTo)
		}
	}
	if len(f.Status) > 0 {
		var ors []string
		var args []interface{}
		for _, s := range f.Status {
			switch s {
			case "unattempted":
				ors = append(ors, "NOT EXISTS (SELECT 1 FROM student_question_states s WHERE s.user_id = ? AND s.question_id = q.id AND s.times_answered > 0)")
				args = append(args, user.ID)
			case "incorrect", "correct":
				ors = append(ors, "EXISTS (SELECT 1 FROM student_question_states s WHERE s.user_id = ? AND s.question_id = q.id AND s.last_result = ?)")
				args = append(args, user.ID, s)
			case "bookmarked":
				if len(f.BookmarkCollectionIDs) > 0 {
					ors = append(ors, "EXISTS (SELECT 1 FROM bookmarks b WHERE b.user_id = ? AND b.item_type = 'question' AND b.item_id = q.id AND b.collection_id IN ?)")
					args = append(args, user.ID, f.BookmarkCollectionIDs)
				} else {
					ors = append(ors, "EXISTS (SELECT 1 FROM bookmarks b WHERE b.user_id = ? AND b.item_type = 'question' AND b.item_id = q.id)")
					args = append(args, user.ID)
				}
			}
		}
		q = q.Where("("+strings.Join(ors, " OR ")+")", args...)
	}
	if f.ExcludeAttemptedWithinDay > 0 {
		q = q.Where("NOT EXISTS (SELECT 1 FROM student_question_states s WHERE s.user_id = ? AND s.question_id = q.id AND s.last_answered_at > ?)",
			user.ID, time.Now().AddDate(0, 0, -f.ExcludeAttemptedWithinDay))
	}
	return q
}

const dedupeExpr = "COALESCE(NULLIF(q.content_hash, ''), q.id::text)"

// CountResult is the dry-run answer.
type CountResult struct {
	Available     int           `json:"available"`
	Requested     int           `json:"requested"`
	FeasibleCount int           `json:"feasible_count"`
	BySubject     []CountBucket `json:"by_subject"`
	ByDifficulty  []CountBucket `json:"by_difficulty"`
	Bottleneck    *Bottleneck   `json:"bottleneck,omitempty"`
	Suggestions   []Suggestion  `json:"suggestions"`
	Entitlement   Entitlement   `json:"entitlement"`
	Clamped       *int          `json:"clamped_to,omitempty"`
}

type CountBucket struct {
	ID    *uuid.UUID `json:"id,omitempty"`
	Key   string     `json:"key,omitempty"`
	Name  string     `json:"name"`
	Count int        `json:"count"`
}

type Bottleneck struct {
	Filter  string `json:"filter"`
	Reason  string `json:"reason"`
	With    int    `json:"with_filter"`
	Without int    `json:"without_filter"`
}

type Suggestion struct {
	Code  string                 `json:"code"`
	Label string                 `json:"label"`
	Patch map[string]interface{} `json:"patch"`
	Gain  int                    `json:"gain"`
}

func (e *Engine) countAvailable(ctx context.Context, user *models.User, ent Entitlement, bp blueprint.Blueprint) int {
	var n int
	e.pool(ctx, user, ent, bp, nil).Select("count(DISTINCT " + dedupeExpr + ")").Scan(&n)
	return n
}

// Count is the dry run used by the builder: how many questions match, split by
// subject and difficulty, what is the tightest filter, and ready-to-apply
// suggestions (each verified to actually increase the match count).
func (e *Engine) Count(ctx context.Context, user *models.User, bp blueprint.Blueprint) (*CountResult, error) {
	ent := e.EntitlementFor(ctx, user, bp.CourseID)
	res := &CountResult{Requested: bp.Count, Entitlement: ent, Suggestions: []Suggestion{}}
	req := e.effectiveCount(&bp, ent)
	if req != bp.Count {
		res.Clamped = &req
	}

	// ONE scan answers everything: GROUPING SETS gives the exact de-duplicated
	// grand total (the empty set) plus the (subject, difficulty) buckets the
	// per-subject / per-difficulty views are folded from. (A question duplicated
	// across buckets can count in each bucket, but never in `available`.)
	var grp []struct {
		SubjectID *uuid.UUID
		Name      *string
		D         *string
		N         int
		Total     int
	}
	e.pool(ctx, user, ent, bp, nil).Joins("LEFT JOIN subjects sub ON sub.id = q.subject_id").
		Select("q.subject_id, sub.name AS name, q.difficulty AS d, count(DISTINCT " + dedupeExpr + ") AS n, GROUPING(q.subject_id, q.difficulty) AS total").
		Group("GROUPING SETS ((q.subject_id, sub.name, q.difficulty), ())").Scan(&grp)
	subIdx := map[string]int{}
	diffTot := map[string]int{}
	for _, g := range grp {
		if g.Total == 3 { // the grand-total row
			res.Available = g.N
			continue
		}
		dname := "unspecified"
		if g.D != nil {
			dname = *g.D
		}
		sname := "Unspecified"
		if g.Name != nil {
			sname = *g.Name
		}
		k := "none"
		if g.SubjectID != nil {
			k = g.SubjectID.String()
		}
		if i, ok := subIdx[k]; ok {
			res.BySubject[i].Count += g.N
		} else {
			subIdx[k] = len(res.BySubject)
			res.BySubject = append(res.BySubject, CountBucket{ID: g.SubjectID, Name: sname, Count: g.N})
		}
		diffTot[dname] += g.N
	}
	sort.Slice(res.BySubject, func(i, j int) bool { return res.BySubject[i].Name < res.BySubject[j].Name })
	dk := make([]string, 0, len(diffTot))
	for k := range diffTot {
		dk = append(dk, k)
	}
	sort.Strings(dk)
	for _, k := range dk {
		res.ByDifficulty = append(res.ByDifficulty, CountBucket{Key: k, Name: k, Count: diffTot[k]})
	}
	if res.BySubject == nil {
		res.BySubject = []CountBucket{}
	}
	if res.ByDifficulty == nil {
		res.ByDifficulty = []CountBucket{}
	}

	res.FeasibleCount = req
	if res.Available < req {
		res.FeasibleCount = res.Available
	}
	if res.Available < req {
		res.Bottleneck, res.Suggestions = e.analyse(ctx, user, ent, bp, res.Available)
	}
	return res, nil
}

// analyse relaxes one filter at a time to find the bottleneck and builds
// suggestions that are each verified to increase the match count.
func (e *Engine) analyse(ctx context.Context, user *models.User, ent Entitlement, bp blueprint.Blueprint, current int) (*Bottleneck, []Suggestion) {
	type relax struct {
		name  string
		label string
		apply func(b *blueprint.Blueprint)
		patch map[string]interface{}
		set   bool
	}
	f := bp.Filters
	rs := []relax{
		{"status", "Include questions you've already attempted", func(b *blueprint.Blueprint) { b.Filters.Status, b.Filters.BookmarkCollectionIDs = nil, nil },
			map[string]interface{}{"filters": map[string]interface{}{"status": []string{}}}, len(f.Status) > 0},
		{"exclude_attempted_within_days", "Don't skip recently attempted questions", func(b *blueprint.Blueprint) { b.Filters.ExcludeAttemptedWithinDay = 0 },
			map[string]interface{}{"filters": map[string]interface{}{"exclude_attempted_within_days": 0}}, f.ExcludeAttemptedWithinDay > 0},
		{"difficulty", "Include all difficulty levels", func(b *blueprint.Blueprint) { b.Filters.Difficulty = nil },
			map[string]interface{}{"filters": map[string]interface{}{"difficulty": []string{}}}, len(f.Difficulty) > 0},
		{"tags", "Remove the tag filter", func(b *blueprint.Blueprint) { b.Filters.TagIDs, b.Filters.ExcludeTagIDs = nil, nil },
			map[string]interface{}{"filters": map[string]interface{}{"tag_ids": []string{}, "exclude_tag_ids": []string{}}}, len(f.TagIDs)+len(f.ExcludeTagIDs) > 0},
		{"ncert", "Remove the NCERT page filter", func(b *blueprint.Blueprint) { b.Filters.NCERT = nil },
			map[string]interface{}{"filters": map[string]interface{}{"ncert": nil}}, f.NCERT != nil},
		{"source_types", "Include all question sources", func(b *blueprint.Blueprint) { b.Filters.SourceTypes = nil },
			map[string]interface{}{"filters": map[string]interface{}{"source_types": []string{}}}, len(f.SourceTypes) > 0},
		{"topics", "Include the whole chapter(s)", func(b *blueprint.Blueprint) { b.Filters.TopicIDs = nil },
			map[string]interface{}{"filters": map[string]interface{}{"topic_ids": []string{}}}, len(f.TopicIDs) > 0},
		{"chapters", "Include the whole subject(s)", func(b *blueprint.Blueprint) { b.Filters.ChapterIDs, b.Filters.TopicIDs = nil, nil },
			map[string]interface{}{"filters": map[string]interface{}{"chapter_ids": []string{}, "topic_ids": []string{}}}, len(f.ChapterIDs) > 0},
	}
	var best *Bottleneck
	var sugg []Suggestion
	for _, r := range rs {
		if !r.set {
			continue
		}
		cp := bp
		cp.Filters = bp.Filters
		r.apply(&cp)
		n := e.countAvailable(ctx, user, ent, cp)
		if n <= current {
			continue
		}
		sugg = append(sugg, Suggestion{Code: "relax_" + r.name, Label: r.label, Patch: r.patch, Gain: n - current})
		if best == nil || n-current > best.Without-best.With {
			best = &Bottleneck{Filter: r.name, With: current, Without: n,
				Reason: fmt.Sprintf("%s is the tightest filter: %d match with it, %d without it", strings.ReplaceAll(r.name, "_", " "), current, n)}
		}
	}
	sort.SliceStable(sugg, func(i, j int) bool { return sugg[i].Gain > sugg[j].Gain })
	if current >= settings.Int("custom_test.min_questions") {
		sugg = append([]Suggestion{{Code: "use_available", Label: fmt.Sprintf("Use %d questions", current), Patch: map[string]interface{}{"count": current}, Gain: 0}}, sugg...)
	}
	return best, sugg
}

// effectiveCount clamps the request for the free tier.
func (e *Engine) effectiveCount(bp *blueprint.Blueprint, ent Entitlement) int {
	n := bp.Count
	if ent.Tier == TierFree {
		if max := settings.Int("custom_test.free_max_questions"); n > max {
			n = max
		}
	}
	return n
}

// ── Selection ─────────────────────────────────────────────────────────────────

type cand struct {
	ID            uuid.UUID
	SubjectID     *uuid.UUID
	ChapterID     *uuid.UUID
	Difficulty    *string
	ContentHash   string
	OrderIndex    int
	SubOrder      int
	ChOrder       int
	TimesAnswered int
	LastResult    string
	SRSDueAt      *time.Time
	Prio          float64 // strategy priority (lower = earlier), computed in SQL
	HK            int64   // seeded pseudo-random tiebreak, computed in SQL
}

func (c cand) diff() string {
	if c.Difficulty == nil {
		return "unspecified"
	}
	return *c.Difficulty
}

// Relaxation records every deviation from the request — never silent.
type Relaxation struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type Selection struct {
	IDs         []uuid.UUID  `json:"question_ids"`
	Relaxations []Relaxation `json:"relaxations"`
	Available   int          `json:"available"`
	Seed        int64        `json:"seed"`
}

const candidateCap = 50000

// candidates fetches a bounded, strategy-ranked sample of the pool.
//
// Ranking and sampling happen in SQL: within each (subject, difficulty) bucket
// rows are ordered by the strategy priority then a seeded hash, and only the
// first K per bucket come back (K ≥ 4× the requested count, so quotas and
// duplicates can always be satisfied). That keeps a 100 000-question pool from
// being shipped to Go and sorted per request; the seed keeps it reproducible.
func (e *Engine) candidates(ctx context.Context, user *models.User, ent Entitlement, bp blueprint.Blueprint, fixed []uuid.UUID, want int, seed int64) ([]cand, error) {
	prio := "0.0"
	inner := e.pool(ctx, user, ent, bp, fixed).
		Joins("LEFT JOIN subjects sub ON sub.id = q.subject_id").
		Joins("LEFT JOIN chapters ch ON ch.id = q.chapter_id").
		Joins("LEFT JOIN student_question_states s ON s.user_id = ? AND s.question_id = q.id", user.ID)
	switch bp.Strategy {
	case "unseen_first":
		prio = "CASE WHEN COALESCE(s.times_answered, 0) = 0 THEN 0.0 ELSE 1.0 END"
	case "spaced":
		prio = "CASE WHEN s.srs_due_at IS NOT NULL AND s.srs_due_at <= now() THEN 0.0 WHEN COALESCE(s.times_answered, 0) = 0 THEN 1.0 ELSE 2.0 END"
	case "weak_first":
		inner = inner.Joins(`LEFT JOIN (
				SELECT q2.chapter_id, sum(s2.times_correct)::float8 / NULLIF(sum(s2.times_answered), 0) AS acc
				FROM student_question_states s2 JOIN questions q2 ON q2.id = s2.question_id
				WHERE s2.user_id = ? AND s2.times_answered > 0 GROUP BY q2.chapter_id) ca ON ca.chapter_id = q.chapter_id`, user.ID)
		prio = "COALESCE(ca.acc, 0.5)"
	}
	seedStr := strconv.FormatInt(seed, 10)
	k := 4 * want
	if k < 200 {
		k = 200
	}
	if len(fixed) > 0 {
		k = candidateCap
	}
	inner = inner.Select(`q.id AS id, q.subject_id, q.chapter_id, q.difficulty, q.content_hash, q.order_index,
			COALESCE(sub.order_index, 0) AS sub_order, COALESCE(ch.order_index, 0) AS ch_order,
			COALESCE(s.times_answered, 0) AS times_answered, COALESCE(s.last_result, '') AS last_result, s.srs_due_at,
			`+prio+` AS prio, hashtext(q.id::text || ?)::bigint AS hk,
			row_number() OVER (PARTITION BY q.subject_id, q.difficulty ORDER BY `+prio+`, hashtext(q.id::text || ?)) AS rn`, seedStr, seedStr)
	var rows []cand
	err := e.DB.WithContext(ctx).Table("(?) AS x", inner).Where("x.rn <= ?", k).Limit(candidateCap).Scan(&rows).Error
	return rows, err
}

// Select runs the strategy → dedupe → quota pipeline.
func (e *Engine) Select(ctx context.Context, user *models.User, ent Entitlement, bp blueprint.Blueprint, fixed []uuid.UUID) (*Selection, error) {
	seed := time.Now().UnixNano() % (1 << 50) // < 2^53: survives a JSON round-trip through JavaScript
	if bp.Seed != nil {
		seed = *bp.Seed
	}
	want := e.effectiveCount(&bp, ent)
	rows, err := e.candidates(ctx, user, ent, bp, fixed, want, seed)
	if err != nil {
		return nil, err
	}
	// global order: strategy priority, then the seeded hash (deterministic per seed)
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Prio != rows[j].Prio {
			return rows[i].Prio < rows[j].Prio
		}
		if rows[i].HK != rows[j].HK {
			return rows[i].HK < rows[j].HK
		}
		return bytes.Compare(rows[i].ID[:], rows[j].ID[:]) < 0
	})
	rng := rand.New(rand.NewSource(seed))

	// dedupe by content hash: keep the highest-priority copy
	seen := map[string]bool{}
	uniq := rows[:0:0]
	for _, r := range rows {
		key := r.ContentHash
		if key == "" {
			key = r.ID.String()
		}
		if !seen[key] {
			seen[key] = true
			uniq = append(uniq, r)
		}
	}
	sel := &Selection{Available: len(uniq), Seed: seed, Relaxations: []Relaxation{}}
	if want != bp.Count {
		sel.Relaxations = append(sel.Relaxations, Relaxation{"free_tier_clamp",
			fmt.Sprintf("Free plan: limited to %d questions (you asked for %d)", want, bp.Count)})
	}
	if len(fixed) > 0 && want > len(fixed) {
		want = len(fixed)
	}

	picked := e.quota(uniq, want, bp, sel)
	if len(picked) < want {
		if bp.Fallback == "fail" {
			return sel, nil // caller turns a short selection into pool_too_small
		}
		sel.Relaxations = append(sel.Relaxations, Relaxation{"fewer_than_requested",
			fmt.Sprintf("Only %d matching questions were available (you asked for %d)", len(picked), want)})
	}
	e.order(picked, bp.Order, rng)
	sel.IDs = make([]uuid.UUID, len(picked))
	for i, p := range picked {
		sel.IDs[i] = p.ID
	}
	return sel, nil
}

// alloc distributes `total` across groups by weight using largest remainder,
// capped by availability, redistributing any excess. It reports whether some
// group was capped (i.e. had to borrow).
func alloc(total int, weights map[string]float64, avail map[string]int) (out map[string]int, capped bool) {
	out = map[string]int{}
	keys := make([]string, 0, len(avail))
	for k := range avail {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	remaining := total
	active := map[string]bool{}
	for _, k := range keys {
		if avail[k] > 0 {
			active[k] = true
		}
	}
	for remaining > 0 && len(active) > 0 {
		sumW := 0.0
		for k := range active {
			sumW += weights[k]
		}
		if sumW <= 0 { // no weight left: spread by availability
			for k := range active {
				weights[k] = float64(avail[k] - out[k])
				sumW += weights[k]
			}
			if sumW <= 0 {
				break
			}
		}
		type frac struct {
			k string
			f float64
		}
		var fr []frac
		given := 0
		for _, k := range keys {
			if !active[k] {
				continue
			}
			share := float64(remaining) * weights[k] / sumW
			n := int(math.Floor(share))
			if room := avail[k] - out[k]; n > room {
				n = room
			}
			out[k] += n
			given += n
			fr = append(fr, frac{k, share - math.Floor(share)})
		}
		remaining -= given
		sort.SliceStable(fr, func(i, j int) bool { return fr[i].f > fr[j].f })
		for _, x := range fr {
			if remaining == 0 {
				break
			}
			if out[x.k] < avail[x.k] {
				out[x.k]++
				remaining--
			}
		}
		for k := range active {
			if out[k] >= avail[k] {
				delete(active, k)
				capped = true
			}
		}
		if given == 0 && remaining > 0 && len(active) == 0 {
			break
		}
	}
	return out, capped
}

func (e *Engine) quota(rows []cand, want int, bp blueprint.Blueprint, sel *Selection) []cand {
	if want <= 0 || len(rows) == 0 {
		return nil
	}
	if want > len(rows) {
		want = len(rows)
	}
	mode, custom := bp.SubjectWeightMode()
	bySubject := map[string][]cand{}
	for _, r := range rows {
		k := "none"
		if r.SubjectID != nil {
			k = r.SubjectID.String()
		}
		bySubject[k] = append(bySubject[k], r)
	}
	pickMix := func(list []cand, n int, label string) []cand {
		if len(bp.DifficultyMix) == 0 || n <= 0 {
			if n > len(list) {
				n = len(list)
			}
			return list[:n]
		}
		byD := map[string][]cand{}
		avail := map[string]int{}
		for _, r := range list {
			byD[r.diff()] = append(byD[r.diff()], r)
		}
		for k, v := range byD {
			avail[k] = len(v)
		}
		w := map[string]float64{}
		for k, v := range bp.DifficultyMix {
			w[k] = v
		}
		for k := range avail {
			if _, ok := w[k]; !ok {
				w[k] = 0.0001 // unspecified difficulty only as a last resort
			}
		}
		a, capped := alloc(n, w, avail)
		if capped {
			sel.Relaxations = append(sel.Relaxations, Relaxation{"difficulty_borrowed",
				"Some difficulty levels had too few questions" + label + " — the gap was filled from other levels"})
		}
		var out []cand
		keys := make([]string, 0, len(a))
		for k := range a {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			out = append(out, byD[k][:a[k]]...)
		}
		return out
	}

	if mode == "" || len(bySubject) <= 1 {
		return pickMix(rows, want, "")
	}
	weights := map[string]float64{}
	avail := map[string]int{}
	for k, v := range bySubject {
		avail[k] = len(v)
		switch mode {
		case "even":
			weights[k] = 1
		case "proportional":
			weights[k] = float64(len(v))
		case "custom":
			if id, err := uuid.Parse(k); err == nil {
				weights[k] = custom[id]
			}
		}
	}
	a, capped := alloc(want, weights, avail)
	if capped {
		sel.Relaxations = append(sel.Relaxations, Relaxation{"subject_borrowed", "Some subjects had too few questions — the gap was filled from the others"})
	}
	keys := make([]string, 0, len(a))
	for k := range a {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var out []cand
	for _, k := range keys {
		out = append(out, pickMix(bySubject[k], a[k], " in one subject")...)
	}
	return out
}

func (e *Engine) order(rows []cand, order string, rng *rand.Rand) {
	rng.Shuffle(len(rows), func(i, j int) { rows[i], rows[j] = rows[j], rows[i] })
	rank := map[string]int{"easy": 0, "medium": 1, "hard": 2, "unspecified": 3}
	switch order {
	case "syllabus":
		sort.SliceStable(rows, func(i, j int) bool {
			a, b := rows[i], rows[j]
			if a.SubOrder != b.SubOrder {
				return a.SubOrder < b.SubOrder
			}
			if a.ChOrder != b.ChOrder {
				return a.ChOrder < b.ChOrder
			}
			return a.OrderIndex < b.OrderIndex
		})
	case "easy_first":
		sort.SliceStable(rows, func(i, j int) bool { return rank[rows[i].diff()] < rank[rows[j].diff()] })
	case "hard_first":
		sort.SliceStable(rows, func(i, j int) bool { return rank[rows[i].diff()] > rank[rows[j].diff()] })
	case "unattempted_first":
		sort.SliceStable(rows, func(i, j int) bool { return rows[i].TimesAnswered == 0 && rows[j].TimesAnswered > 0 })
	}
}

// ── Generation ────────────────────────────────────────────────────────────────

type Result struct {
	Test        models.Test  `json:"test"`
	Relaxations []Relaxation `json:"relaxations"`
	Replayed    bool         `json:"replayed"`
}

var ist = time.FixedZone("IST", 5*3600+1800)

// StartOfISTDay returns today's 00:00 IST in UTC and the next reset time.
func StartOfISTDay(now time.Time) (time.Time, time.Time) {
	n := now.In(ist)
	start := time.Date(n.Year(), n.Month(), n.Day(), 0, 0, 0, 0, ist)
	return start.UTC(), start.AddDate(0, 0, 1).UTC()
}

func fail(status int, code, msg string, details ...interface{}) error {
	return services.Coded(status, code, msg, details...)
}

// Prepare validates a raw blueprint and checks the course.
func (e *Engine) Prepare(ctx context.Context, raw []byte) (blueprint.Blueprint, error) {
	bp, issues := blueprint.Parse(raw)
	if len(issues) == 0 {
		issues = blueprint.Normalize(&bp, Limits())
	}
	if len(issues) > 0 {
		return bp, fail(http.StatusUnprocessableEntity, "invalid_blueprint", "the blueprint is not valid", issues)
	}
	var course models.Course
	if err := e.DB.WithContext(ctx).First(&course, "id = ? AND is_active = true", bp.CourseID).Error; err != nil {
		return bp, fail(http.StatusUnprocessableEntity, "invalid_blueprint", "the blueprint is not valid",
			[]blueprint.Issue{{Field: "course_id", Code: "unknown_course", Message: "course not found"}})
	}
	return bp, nil
}

// Generate creates a private generated test. `fixed` (optional) restricts the
// pool to explicit question ids (used by "practise my mistakes").
func (e *Engine) Generate(ctx context.Context, user *models.User, bp blueprint.Blueprint, idemKey string, fixed []uuid.UUID) (*Result, error) {
	started := time.Now()
	// idempotent replay
	if idemKey != "" {
		var rq models.CustomTestRequest
		if e.DB.WithContext(ctx).First(&rq, "user_id = ? AND idempotency_key = ?", user.ID, idemKey).Error == nil {
			var t models.Test
			if e.DB.WithContext(ctx).First(&t, "id = ?", rq.TestID).Error == nil {
				return &Result{Test: t, Relaxations: []Relaxation{}, Replayed: true}, nil
			}
		}
	}
	ent := e.EntitlementFor(ctx, user, bp.CourseID)

	// quotas
	now := time.Now()
	var lastHour int64
	e.DB.WithContext(ctx).Model(&models.Test{}).Where("owner_user_id = ? AND origin = 'generated' AND created_at > ?", user.ID, now.Add(-time.Hour)).Count(&lastHour)
	if int(lastHour) >= settings.Int("custom_test.generate_rate_per_hour") {
		return nil, fail(http.StatusTooManyRequests, "rate_limited", "you're generating tests too quickly — try again shortly")
	}
	if ent.Tier == TierFree {
		start, reset := StartOfISTDay(now)
		var today int64
		e.DB.WithContext(ctx).Model(&models.Test{}).Where("owner_user_id = ? AND origin = 'generated' AND created_at >= ?", user.ID, start).Count(&today)
		if limit := settings.Int("custom_test.free_daily_generations"); int(today) >= limit {
			return nil, fail(http.StatusForbidden, "quota_exceeded", "you've used today's free custom tests",
				map[string]interface{}{"limit": limit, "resets_at": reset})
		}
	}
	var active int64
	e.DB.WithContext(ctx).Model(&models.Test{}).Where("owner_user_id = ? AND origin = 'generated' AND archived_at IS NULL", user.ID).Count(&active)
	if int(active) >= settings.Int("custom_test.max_active_generated") {
		return nil, fail(http.StatusConflict, "too_many_tests", "you have too many saved custom tests — delete some first")
	}

	sel, err := e.Select(ctx, user, ent, bp, fixed)
	if err != nil {
		return nil, err
	}
	min := settings.Int("custom_test.min_questions")
	if len(fixed) > 0 {
		min = 1
	}
	if len(sel.IDs) < min || (bp.Fallback == "fail" && len(sel.IDs) < e.effectiveCount(&bp, ent) && len(fixed) == 0) {
		cr, _ := e.Count(ctx, user, bp)
		var sug []Suggestion
		if cr != nil {
			sug = cr.Suggestions
		}
		Metrics.emptyPool.Add(1)
		return nil, fail(http.StatusUnprocessableEntity, "pool_too_small", "not enough questions match your choices",
			map[string]interface{}{"available": func() int {
				if cr != nil {
					return cr.Available
				}
				return sel.Available
			}(), "requested": bp.Count, "suggestions": sug, "bottleneck": func() *Bottleneck {
				if cr != nil {
					return cr.Bottleneck
				}
				return nil
			}()})
	}

	c, w := bp.Marks()
	bp.Seed = &sel.Seed
	title := bp.Title
	if title == "" {
		title = e.autoTitle(ctx, bp, len(sel.IDs))
	}
	bp.Title = title
	var dur *int
	if bp.Timing.Timed {
		d := bp.Timing.DurationMinutes
		dur = &d
	}
	sv := blueprint.CurrentVersion
	expires := now.AddDate(0, 0, settings.Int("custom_test.generated_ttl_days"))
	var test models.Test
	err = e.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		test = models.Test{
			Title: title, CourseID: bp.CourseID, ModuleType: models.ModuleCustom, RequiresSubscription: false,
			CreatedBy: user.ID, TotalQuestions: len(sel.IDs), DurationMinutes: dur, MarksPerCorrect: c, MarksPerWrong: w,
			Status: models.StatusPublished, Origin: models.OriginGenerated, OwnerUserID: &user.ID, Visibility: models.VisibilityPrivate,
			Blueprint: bp.JSON(), BlueprintSchemaVersion: &sv, Mode: bp.Mode, ExpiresAt: &expires,
		}
		if err := tx.Create(&test).Error; err != nil {
			return err
		}
		// GORM writes the default (true) for a false bool on a default:true column.
		// GORM also swaps a 0 marks_per_wrong for its default (-1) — write the real values back.
		if err := tx.Model(&test).UpdateColumns(map[string]interface{}{"requires_subscription": false, "marks_per_wrong": w, "marks_per_correct": c}).Error; err != nil {
			return err
		}
		test.RequiresSubscription, test.MarksPerWrong, test.MarksPerCorrect = false, w, c
		rows := make([]models.TestQuestion, len(sel.IDs))
		for i, id := range sel.IDs {
			rows[i] = models.TestQuestion{TestID: test.ID, QuestionID: id, Position: i + 1}
		}
		if err := tx.CreateInBatches(&rows, 200).Error; err != nil {
			return err
		}
		if idemKey != "" {
			return tx.Create(&models.CustomTestRequest{UserID: user.ID, IdempotencyKey: idemKey, TestID: test.ID}).Error
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	Metrics.record(time.Since(started), len(sel.Relaxations) > 0)
	return &Result{Test: test, Relaxations: sel.Relaxations}, nil
}

func (e *Engine) autoTitle(ctx context.Context, bp blueprint.Blueprint, n int) string {
	var names []string
	if len(bp.Filters.ChapterIDs) > 0 {
		e.DB.WithContext(ctx).Model(&models.Chapter{}).Where("id IN ?", bp.Filters.ChapterIDs).Order("name").Limit(2).Pluck("name", &names)
	} else if len(bp.Filters.SubjectIDs) > 0 {
		e.DB.WithContext(ctx).Model(&models.Subject{}).Where("id IN ?", bp.Filters.SubjectIDs).Order("name").Limit(2).Pluck("name", &names)
	}
	head := "Custom test"
	if len(names) > 0 {
		head = strings.Join(names, ", ")
	}
	return fmt.Sprintf("%s · %dQ", head, n)
}

// FixedFromAttempt returns the question ids of an attempt's wrong and/or
// unattempted answers ("practise my mistakes").
func (e *Engine) FixedFromAttempt(ctx context.Context, user *models.User, attemptID uuid.UUID, include string) ([]uuid.UUID, error) {
	var a models.StudentAttempt
	if err := e.DB.WithContext(ctx).First(&a, "id = ? AND user_id = ? AND status = ?", attemptID, user.ID, models.AttemptSubmitted).Error; err != nil {
		return nil, fail(http.StatusNotFound, "attempt_not_found", "attempt not found or not submitted")
	}
	cond := "aa.selected_option IS NOT NULL AND aa.is_correct IS NOT TRUE"
	switch include {
	case "unattempted":
		cond = "aa.selected_option IS NULL"
	case "both", "":
		cond = "(aa.selected_option IS NULL OR aa.is_correct IS NOT TRUE)"
	case "wrong":
	default:
		return nil, fail(http.StatusBadRequest, "invalid_include", "include must be wrong, unattempted or both")
	}
	var ids []uuid.UUID
	e.DB.WithContext(ctx).Raw("SELECT aa.question_id FROM attempt_answers aa WHERE aa.attempt_id = ? AND "+cond+" ORDER BY aa.position", attemptID).Scan(&ids)
	if len(ids) == 0 {
		return nil, fail(http.StatusUnprocessableEntity, "nothing_to_practise", "there are no matching questions in that attempt")
	}
	return ids, nil
}

// Blueprint returns a generated test's stored blueprint.
func BlueprintOf(t *models.Test) (blueprint.Blueprint, bool) {
	var bp blueprint.Blueprint
	if len(t.Blueprint) == 0 || json.Unmarshal(t.Blueprint, &bp) != nil {
		return bp, false
	}
	return bp, true
}

// PoolCounts are entitlement-aware eligible-question counts with no other filters.
type PoolCounts struct {
	BySubject    map[uuid.UUID]int
	ByChapter    map[uuid.UUID]int
	ByTopic      map[uuid.UUID]int
	ByDifficulty map[string]int
	Total        int
}

// PoolCounts feeds the builder's tree ("Thermodynamics · 184 questions").
func (e *Engine) PoolCounts(ctx context.Context, ent Entitlement) PoolCounts {
	pc := PoolCounts{BySubject: map[uuid.UUID]int{}, ByChapter: map[uuid.UUID]int{}, ByTopic: map[uuid.UUID]int{}, ByDifficulty: map[string]int{}}
	var rows []struct {
		SubjectID *uuid.UUID
		ChapterID *uuid.UUID
		TopicID   *uuid.UUID
		D         string
		N         int
	}
	blank := blueprint.Blueprint{}
	e.pool(ctx, &models.User{}, ent, blank, nil).
		Select("q.subject_id, q.chapter_id, q.topic_id, COALESCE(q.difficulty, 'unspecified') AS d, count(DISTINCT " + dedupeExpr + ") AS n").
		Group("q.subject_id, q.chapter_id, q.topic_id, q.difficulty").Scan(&rows)
	for _, r := range rows {
		if r.SubjectID != nil {
			pc.BySubject[*r.SubjectID] += r.N
		}
		if r.ChapterID != nil {
			pc.ByChapter[*r.ChapterID] += r.N
		}
		if r.TopicID != nil {
			pc.ByTopic[*r.TopicID] += r.N
		}
		pc.ByDifficulty[r.D] += r.N
	}
	pc.Total = e.countAvailable(ctx, &models.User{}, ent, blank)
	return pc
}
