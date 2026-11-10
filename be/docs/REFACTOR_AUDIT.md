# Backend Audit & Refactor Plan (`be/`)

> Scope: every Go file under `be/` (cmd, internal/*, migrations, models, worker, config), read end-to-end.
> Status: **plan only — nothing implemented yet.**
> Goal: give the codebase a structure that stays **maintainable and deterministic** while the team ships fast. This is *not* an optimisation exercise: perf items are listed only where they are cheap or where they will bite at real scale.

> ## Implementation status
>
> Implemented on branch `feature/be-refactor`, verified with `go build`, `go vet` and the full integration suite against Postgres 16 (new regression tests in `internal/router/hardening_test.go`, `internal/app/app_test.go`, `internal/db/migrate_test.go`).
>
> **Done:** §A1 job queue (SKIP LOCKED claim, `locked_at` + reaper, multi-job ticks, lock-guarded tickers that also run at start, bounded drain) · §A2 · §A3 payments (status guard, row lock, transactional checkout, timeouts, ownership check, renewals extend, no fake signature) · §A4 single app-day via `internal/clock` · §A5 scoring (snapshot marks, server time, checked errors, coded errors) · §A6 sessions/OTP (locked 2-device limit, throttled `last_used_at`, atomic attempt counter, coded errors, phone whitespace normalisation) · §A7 KYC (guarded + transactional, key ownership, masked numbers) · §A8 (heartbeat upsert, N+1 breadcrumbs, streak in one query, URL/stub fallbacks, taxonomy validation, update validation, question-order lock, Explore sort, analytics bucketing in SQL, ratings only for published items) · §B1 `ReviewService` for tests/content/hacks/decks · §B2/B3 one KYC flag + batch `Access` · §B4 `ActiveAny` · §B5 `ResolveTaxonomy` · §B6 `internal/authz` · §B7 `items.MyRatings` · §B9 GORM default traps removed at the root (also fixes `custom_eligible=false`) · §B10 `courses.default_requires_subscription` · §B12 `internal/httpx` + all legacy error envelopes unified + write errors checked · §C1/C2/C3/C4/C11 · §D1 baseline + migrations-only production schema (AutoMigrate only outside production) · §D2 constraints (0003) · §D3 cascading FKs (0004) · §D4 read switch removed · §F binary untracked, production config validation, `/readyz`, body limit, pool/statement-timeout settings · §G dead code removed · routes moved out of `cmd/api` into `internal/router` + `internal/app`.
>
> **Second pass (also done):** seeds → SQL migration `0005` (Go seeds dev/test only) · content-hash backfill → worker ticker · rate limiter shared via Postgres (`internal/ratelimit`) · admin attempts excluded from cohort stats · purge scope widened · per-course subscriptions in `/me` · notifications/jobs written inside the business transaction · progress + admin stats moved into services · `models` split by domain + `.Valid()` helpers · KYC toggle contract fixed · KYC queue kept oldest-first.
>
> **Still open:** typed field enums (`Origin`, `Mode`, … remain strings) · the CRUD-heavy handlers (tests/content/curriculum/wellness/bookmarks/taxonomy/flashcard study) still mix HTTP and DB code · the 60 s custom-test config cache and 30 s settings cache are per replica · product decisions in §E (teacher↔course, unified uploads). See `DEPLOY_AND_FE_CHANGES.md` §3.
>
> **Behaviour changes to know about:** list endpoints return `next_cursor` and cap at 200 rows by default · `GET /admin/kyc` is now newest-first and paginated · `analytics?range=` accepts only `7D`, `30D`, `ALL` · uploads return 503 in production when storage is not configured · production refuses to boot with weak/missing secrets · approving/rejecting tests and content now notifies the author · new `DB_*` env vars (see `.env.example`).

---

## 0. TL;DR

The newer code (custom tests, generation engine, scoring service, corrections, reports, media, `items`, `settings`, `pagination`) is in good shape: coded errors, transactions, seeded/deterministic selection, parameterised SQL. The older code (auth, profile, payments, KYC, content, admin, tests handler, curriculum, wellness) is **handler-does-everything** with ignored errors and copy-pasted logic. The two styles coexist, which is the main maintainability problem.

**Top 12 things to fix, in order:**

| # | Severity | Problem | Where |
|---|---|---|---|
| 1 | 🔴 Bug | Background job claim is racy — two worker replicas can run the same job (e.g. a CSV import twice → duplicate questions). Jobs stuck in `processing` after a crash are never retried. | `internal/jobs/worker.go:152` |
| 2 | 🔴 Bug | Worker tickers only fire *after* their interval, and reset on every deploy → `retention_sweep` (24 h) and `orphan_media_gc` (6 h) may **never run** if you deploy daily. Shutdown waits 2 s while jobs have a 5 min timeout. | `cmd/worker/main.go` |
| 3 | 🔴 Bug | A late `payment.failed` webhook overwrites a `captured` payment (no status guard). | `services/subscription_service.go` `MarkPaymentFailed` |
| 4 | 🔴 Bug | "Today" is computed 3 different ways (UTC `Truncate(24h)`, IST, server local). Activity between 00:00–05:30 IST lands on the previous day → wrong streaks, wrong streak nudges. | `profile.go:273,404`, `scoring_service.go:582`, `push_service.go:156` |
| 5 | 🟠 Logic | Score is computed from **live** test marks + **client-supplied** `time_taken_seconds`, although a `config_snapshot` is stored at start. Not deterministic. | `scoring_service.go:438,469,484` |
| 6 | 🟠 Logic | Buying a plan while one is active starts the new one *now* (remaining days lost) and leaves two active rows; "active subscription" is then picked arbitrarily (`First` without `ORDER BY`, no course filter in `/me`). | `subscription_service.go:160`, `profile.go GetMe` |
| 7 | 🟠 Structure | Routes are split between `cmd/api/main.go` and `internal/router/router.go`; one route (`POST /tests/:id/attempts`) has business logic inline in the router. | `router.go:154` |
| 8 | 🟠 Structure | The review workflow (draft → pending → approved/rejected → published) is implemented **4 times** (tests, content, brain hacks, flashcard decks) with drifting rules. | see §B1 |
| 9 | 🟠 Structure | Schema has two sources of truth (GORM AutoMigrate + SQL files), FKs only on some tables, and cascades hand-coded in 3 places. | see §D |
| 10 | 🟡 Hygiene | `kyc_required` read 5 different ways; `"neet-ug"` slug hard-coded 4×; the GORM `default:true` workaround copy-pasted 6×. | see §B |
| 11 | 🟡 Hygiene | Two error envelope styles (`errorResponse{}` vs `respondErr`), ~150 ignored DB errors, `context` dropped in ~40% of queries. | all legacy handlers |
| 12 | 🟡 Hygiene | A 66 MB Linux binary (`be/api`) is committed to git. Production can boot with `JWT_SECRET=change-me-in-production` and stub upload URLs. | repo root, `config.go` |

Suggested order of work is in **§7 Phased plan**. A PR checklist to keep it clean afterwards is in **§8**.

---

## 1. How the backend is laid out today

```
cmd/api/main.go        wiring + ~60 routes + CORS + a kyc closure        (313 lines)
cmd/worker/main.go     wiring + job handlers + tickers
internal/
  router/router.go     ~140 more routes (newer modules), Deps container
  handlers/            25 files, ~10k lines. Mixed: some thin, most do SQL directly
  services/            newer business logic (scoring, questions, corrections, reports, csv, push, …)
  generation/          custom-test engine (good)
  blueprint/ richtext/ media/ items/ settings/ pagination/ validate/   shared libs (good)
  models/              2 files, all GORM structs
  db/                  connect, AutoMigrate, seeds, versioned SQL migrations
  jobs/                DB-backed queue + worker loop
  storage/ bunny/ razorpay/ otp/   external clients (package-level globals)
```

**What "good" looks like here already** (copy these patterns, don't invent new ones):

- `services.CodedError` + `respondService()` — stable `{error, code, details}` envelope.
- `ScoringService.submit` — row lock (`FOR UPDATE`) + single transaction + server-side scoring.
- `generation.Engine.Select` — seeded, tie-broken ordering → reproducible output.
- `items` package — single place that knows every "rateable/reportable" item type.
- `settings` package — typed, cached, defaults registry.
- `pagination` — keyset cursor pagination.

**What hurts**:

- Legacy handlers talk to GORM directly, ignore errors, and mix HTTP + business rules + SQL.
- Same rule implemented in many places (see §B), each slightly different.
- Package-level globals (`db.DB`, `storage.Client` *and* `storage.Store`, `rzp.DefaultClient`, `settings.Default`, `config.AppConfig`) make wiring implicit and tests order-dependent.

---

## 2. Target structure (deliberately small)

Don't introduce a repository interface for every table — with GORM that's ceremony. Use **three layers with one rule each**:

| Layer | Allowed to | Not allowed to |
|---|---|---|
| **Handler** (`internal/handlers`) | Parse/validate the request, call **one** service method, write the response with `httpx` helpers. | Open transactions, write SQL, contain business rules (`if course.Slug == …`), call `services.Notify`. |
| **Service** (`internal/services/<domain>`) | Business rules, transactions, call stores/other services, return `*CodedError`. | Know about `gin.Context`. |
| **Store / queries** (`internal/store` or a `queries.go` per service) | Reusable queries (`ActiveSubscription`, `MyRatings`, `OwnedScope`). | Business decisions. |

Proposed layout (moves, not rewrites):

```
cmd/api/main.go              → 20 lines: cfg := config.MustLoad(); app := app.New(cfg); app.RunHTTP()
cmd/worker/main.go           → 20 lines: app.New(cfg).RunWorker()
internal/
  app/                       NEW. The ONLY place that wires DB, clients, services, handlers, router, worker.
                             Tests call app.New(testCfg) → identical wiring to prod.
  httpx/                     NEW. Respond/Fail/Bind/ParamUUID/Page helpers + error mapping.
  router/                    ALL routes (move the ~60 from main.go here), grouped by role.
  middleware/                auth, role, flag, (new) request-id, body-limit.
  handlers/                  thin; one file per domain.
  services/
    auth/  billing/  kyc/  content/  assessment/ (tests, attempts, scoring)  questions/
    review/  (NEW shared workflow)  engagement/ (ratings, bookmarks, reports, notes)  notify/
  generation/ blueprint/ richtext/ media/ items/ settings/ pagination/ validate/   (keep)
  platform/                  external clients: storage, bunny, razorpay, otp, push (no globals; constructed in app/)
  clock/                     NEW tiny: Now(), AppDay(t) – single timezone rule (see §A4)
  models/                    split models.go by domain (users.go, billing.go, assessment.go, content.go, engagement.go)
  db/migrations/             the single source of truth for schema (see §D1)
```

You do **not** need to do the folder move in one go. The rules in the table above matter more than the folders; enforce them on every new PR and migrate legacy handlers opportunistically (§7).

---

## A. Correctness & determinism bugs (fix first)

### A1. Job queue claim is racy; stuck jobs never recover
`internal/jobs/worker.go:152` selects a pending job, then updates it, inside a READ COMMITTED transaction **without a row lock**. Two workers can read the same row; both `UPDATE` succeeds (the UPDATE has no `status = 'pending'` guard) → the job runs twice. A worker crash/deploy mid-job leaves the row in `processing` forever (no code ever resets it).

**How to fix**
```go
// claim atomically, skip rows another worker holds
err := w.DB.WithContext(ctx).Raw(`
  UPDATE background_jobs SET status='processing', attempts=attempts+1, locked_at=now(), updated_at=now()
  WHERE id = (
    SELECT id FROM background_jobs
    WHERE status='pending' AND run_after <= now() AND attempts < ?
    ORDER BY run_after, created_at
    FOR UPDATE SKIP LOCKED LIMIT 1)
  RETURNING *`, maxAttempts).Scan(&job).Error
```
- Add `locked_at timestamptz` column + a **reaper** ticker: `UPDATE background_jobs SET status='pending', run_after=now() WHERE status='processing' AND locked_at < now() - interval '10 minutes'`.
- Make CSV import idempotent per batch: at start of `Run`, if `batch.Applied` is true → return nil; and wrap a commit-mode import in **one** transaction (or record `batch_id` on created questions and delete them on retry).
- Process up to N jobs per tick (loop until no job or N reached) — today it's 1 job / 5 s = 12 jobs/min, and one slow CSV import blocks every video status check.
- `EnqueueJob` should accept a `tx` so "create batch + enqueue" is one transaction (`tests.go CSVImport`, `content.go CreateContent`).

### A2. Worker tickers & shutdown
`cmd/worker/main.go`: `time.NewTicker(every)` first fires after `every`. Daily/6-hourly jobs restart their clock on every deploy, so they can starve. Shutdown does `cancel(); time.Sleep(2s)` while jobs have a 5-minute context.

**How to fix**
- Run each ticker once at startup (after a small random jitter), then on the interval.
- Guard each ticker with a Postgres advisory lock (`pg_try_advisory_lock(hashtext(name))`) so N replicas don't all run `StreakNudges`/`RetentionSweep` (StreakNudges currently *can* double-notify across replicas).
- Better for daily jobs: store `last_run_at` per ticker in a tiny `scheduled_runs` table and run when `now - last_run_at >= every` → survives restarts deterministically.
- Shutdown: stop claiming, then wait on a `sync.WaitGroup` for in-flight jobs with a deadline (e.g. 60 s); jobs not finished go back to `pending` via the reaper.

### A3. Payments
`internal/services/subscription_service.go`, `internal/handlers/payments.go`
1. `MarkPaymentFailed` updates by `razorpay_order_id` with **no status guard**. Razorpay can send `payment.failed` (first card attempt) and `payment.captured` (retry) for the same order, in any order → a paid order can end up `failed`. Fix: `WHERE razorpay_order_id = ? AND status = 'created'`.
2. `ActivateSubscription` reads the payment without a lock; the client `verify-payment` and the webhook commonly race. Fix: `tx.Clauses(clause.Locking{Strength:"UPDATE"})` on the payment row; return early if already captured (already there, but only safe with the lock).
3. `Checkout` creates the Razorpay order, then a subscription, then a payment, with no transaction. Fix: wrap both inserts in one transaction (Razorpay call stays outside, before it). Also stop creating a new `pending_payment` subscription per click — create the subscription on capture, or reuse the pending one for the same (user, plan).
4. `VerifyPayment` doesn't check the order belongs to the caller. Signature makes forgery impossible, but add `user_id = caller` for clarity and to avoid cross-account activation by a shared client bug.
5. Razorpay client uses `http.DefaultClient` (no timeout) and no `context`. Give it `&http.Client{Timeout: 15*time.Second}` and `NewRequestWithContext`. Same in `otp/otp.go:49,102`.
6. Webhook passes the literal string `"webhook"` as the signature, which is then stored in `razorpay_signature`. Store `nil` instead.
7. Business decision needed — see §E1 (renewals / overlapping subscriptions).

### A4. One definition of "a day" (timezone)
Today:
- `RecordDailyActivity` → `at.Truncate(24*time.Hour)` → **UTC** day (`scoring_service.go:582`).
- `ContentHeartbeat` and streak calc → `time.Now().Truncate(24h)` → **UTC** day (`profile.go:273,404`).
- `StreakNudges` → **IST** day (`push_service.go:156`).
- Free-tier daily quota → **IST** day (`generation.go:692`).

A student practising at 01:00 IST gets the activity booked on the previous day, and the nudge job (IST) thinks they haven't practised today.

**How to fix** — add `internal/clock`:
```go
package clock
var AppZone = time.FixedZone("IST", 5*3600+1800) // or load from config
func Now() time.Time { return time.Now() }                 // swap in tests
func AppDay(t time.Time) time.Time {                        // date-only value for DATE columns
    l := t.In(AppZone); return time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, time.UTC)
}
func StartOfAppDay(t time.Time) time.Time { … }             // timestamptz boundary for created_at comparisons
```
Replace every `Truncate(24*time.Hour)`, `istZone`, `ist` with these. One-off data fix: none needed going forward; old rows are off by ≤ 1 day.

### A5. Scoring determinism
`internal/services/scoring_service.go`
1. `submit` uses `test.MarksPerCorrect/MarksPerWrong` (live) — but `StartAttempt` already stores them in `config_snapshot`. Score from the snapshot (fallback to test only for legacy rows with no snapshot). Same in `Reveal` (`:386`) and `RescoreQuestion` (`correction_service.go`), which joins `tests t` for marks.
2. `time_taken_seconds` from the client **overrides** the server value (`:484`). Use `min(client, server)` or ignore the client value entirely; it's displayed and used for analytics.
3. Per-question loop does 2–4 statements each (answer update, SQS upsert, first-SRS update, stats upsert) → ~300 statements for a 90-Q test, and **ignores errors** on the answer `Updates`. Fold the "first-time SRS" `UPDATE` into the `INSERT … VALUES` (set `srs_interval=1, srs_due_at=now+1d` when inserting an answered row), and check every error. Batching with `unnest()` is optional.
4. `submit` returns a plain `fmt.Errorf("attempt not found or not in progress")` → `respondService` maps it to `400 bad_request`. Return `Conflict("attempt_not_active", …)` so the app can react.
5. Comment on `AutoSubmitExpired` says "SKIP LOCKED" but the query doesn't use it. Either add `FOR UPDATE SKIP LOCKED` to the select or fix the comment.
6. `activeAttempt` auto-submits on expiry and **discards** the submit error (`_, _ = s.submit(...)`). Log it at least.

### A6. Auth / sessions
`internal/services/session_service.go`, `internal/middleware/auth.go`, `internal/services/otp_service.go`
1. Every authenticated request does **3 DB round-trips**: session lookup, user lookup, and a fire-and-forget `go s.DB.Model(&session).Update("last_used_at", …)` (`:127`) — an unbounded goroutine with no context per request. Fix: one query (`sessions JOIN users`), and only bump `last_used_at` if it's older than e.g. 5 minutes (`UPDATE … WHERE id=? AND last_used_at < now()-interval '5 min'`), synchronously.
2. Two-device limit has a race (two logins at once → 3 sessions) and deletes (`:45`) while `RevokedAt` exists but is never set. Pick one: hard delete (then drop `revoked_at`) or set `revoked_at`. Run the count+evict+insert in a transaction with `SELECT … FOR UPDATE` on the user row.
3. OTP `VerifyOTP` checks `record.Attempts` **before** the increment it just issued (off-by-one, 6 tries) and ignores the increment error. Use `UPDATE … SET attempts = attempts+1 … RETURNING attempts`.
4. `SendOTP` maps *every* error (including DB down) to HTTP 429. Return coded errors (`rate_limited` vs `internal`).
5. Rate limiting is skipped when `ENV=development`. Make it a separate flag; staging often runs with `ENV=development`.
6. No phone normalisation/validation: `" +91 98…"` and `"98…"` create two users. Normalise to E.164 in one helper used by send + verify.
7. JWT `Role` claim is issued but never trusted (middleware reloads the user) — fine, but then drop it from the claims to avoid someone relying on it later.

### A7. KYC
`internal/handlers/kyc.go`
- `ApproveKYC` / `RejectKYC` don't check the record is `pending`, ignore `Save` errors, and update the user in a separate statement (not transactional). Approving an old rejected record flips the user to approved.
- `SubmitKYC` doesn't validate `document_file_key` belongs to the caller (`kyc_document/<user_id>/…`), unlike lecture PDFs. Reuse `validLecturePDFKey`-style ownership check (generalise it, §B6).
- `id_number` (Aadhaar/PAN) is stored in plain text and **returned in API responses** (`json:"id_number"`). Mask it in responses (`XXXX-XXXX-1234`) and consider column encryption (pgcrypto or app-level AES-GCM with a key from env).

### A8. Other logic bugs found
| Where | Bug | Fix |
|---|---|---|
| `admin.go AnalyticsOverview` | Any `range` other than `7D`/`30D` falls into "All Time", but `bucketIndex` only uses month buckets when `rangeStr == "All Time"` → e.g. `ALL` gives 12 bars bucketed by *day*. "Active subscriptions" counts subs *created* in the window with status active, not active subs. Loads every user/payment row into memory to bucket. | Validate `range` ∈ {7D,30D,ALL}; bucket in SQL with `date_trunc` + `GROUP BY`; rename/define the metric. |
| `profile.go GetProgressBreakdown` | Streak loop is unbounded and issues one `COUNT` per day (365-day streak = 365 queries), plus 7 more for last-7-days. | One query: `SELECT date FROM daily_activities WHERE user_id=? AND date >= AppDay(now)-400 ORDER BY date DESC`, compute in Go. Share with `StreakNudges` (which has its own 60-query loop). |
| `profile.go GetRecentContent` | `pct = 50` mock for in-progress; N+1 chapter query per item. | Store `duration_seconds` on content (Bunny returns it) and compute real %; preload `Chapter.Subject`. |
| `profile.go ContentHeartbeat` | Doesn't check the content exists/is published; race creates duplicate watch-history rows (no unique index). | Upsert with `ON CONFLICT (user_id, content_item_id)` + `GREATEST(progress_seconds, EXCLUDED…)`; add unique index (§D). |
| `content.go resolveContentURL:357` | Falls back to `https://s3.amazonaws.com/codon-files/<key>` — a made-up public URL that leaks object keys. | Return `""` + log when storage isn't configured. |
| `uploads.go:79,115` | When Bunny/S3 aren't configured, returns **stub** upload URLs with HTTP 200 — in prod too. | Return 503 `storage_unavailable` unless `ENV=development`. |
| `content.go CreateContent/UpdateContent` | `chapter_id` is not checked to belong to `course_id`; `file_key` not ownership-checked (PDF keys are). Invalid `chapter_id` on update is silently ignored. | Reuse the taxonomy resolver from `QuestionService.resolveTaxonomy` (§B5). |
| `tests.go UpdateTest` | `CreateTest` validates duration (0–600) and title; `UpdateTest` validates nothing. Invalid subject/chapter IDs silently ignored. | One `validateTestInput` used by both. |
| `tests.go AddQuestion:463` | `services.LoadTags` called twice, first result discarded. | Delete the first call. |
| `question_service.go Create` | `MAX(order_index)+1` without lock → concurrent adds produce duplicate positions. | Lock the test row (`SELECT … FOR UPDATE` on `tests`) inside the tx, or compute from `test_questions` with the same lock. |
| `correction_service.go Submit` | "One pending correction per question" is check-then-insert (race). | Partial unique index `ON question_revisions(question_id) WHERE status='pending'` (§D). |
| `csv_import_service.go:689` | `if dup && mode != validate {fail} else if dup {fail}` — identical branches. | Collapse. |
| `extras.go Explore` | Hand-written O(n²) swap sort, ties unordered; chapters loaded without `ORDER BY` → order changes between calls. | `sort.SliceStable` with `(questions desc, chapter order_index, id)`. |
| `custom_tests.go` | In-memory `countLog` rate limiter and `cfgCache` are per process → with 2 API replicas limits double and cache invalidation (`InvalidateConfig`, only called from preset admin) misses the other replica. Comment says it's called on publish/correct — it isn't. | Rate limit in Postgres (like OTP) or accept per-instance semantics and document; drop the cache or give it a short TTL only. |
| `settings` cache | 30 s per-process TTL; `PATCH /admin/settings` invalidates only the local replica. `SetKYCRequired` bypasses `settings.Set` entirely. | Accept ≤30 s staleness and document it, or `LISTEN/NOTIFY`. Route **all** setting writes through `settings.Set`. |
| `ratings.go Put` | `items.Resolve` accepts drafts; for brain hacks/decks/documents `eligible` returns true → a student can rate an unpublished item by ID. | Add `Published` check to `items.Resolve` (or an `items.Visible` helper). |
| `retention.go`, `push_service.go`, `services.Notify` | Errors ignored; `Notify` has no context and is called outside the business transaction in many places. | Return errors; call `Notify` with the same `tx` so notifications are atomic with the change (outbox pattern you already have via `pushed_at`). |

---

## B. Repetition → shared building blocks

Each item lists **what is duplicated**, **where**, and **how to collapse it**.

### B1. Review / publish workflow (4 copies)
Same state machine in `tests.go` (Submit/Publish/AdminApprove/AdminReject), `content.go` (same 4), `brain_hacks.go` (Submit/Publish/Approve/Reject), `flashcards.go` (SubmitDeck/PublishDeck/AdminApproveDeck/AdminRejectDeck). Drift already visible:
- Tests/content: no author notification; hacks/decks notify.
- Decks don't set `reviewed_by/reviewed_at` (model lacks the columns).
- Reject reason: required ≥3 chars for hacks/decks; optional for tests/content.
- All do find-then-update (TOCTOU) and ignore `RowsAffected`/errors.

**How**: `internal/services/review`:
```go
type Reviewable struct {
    Table     string                         // "tests", "content_items", "brain_hacks", "flashcard_decks"
    OwnerCol  string                         // "created_by" | "uploaded_by" | "author_id"
    Kind      string                         // for notifications: "test", "content", …
    CanSubmit func(ctx, tx, id) error        // per-type gate (publish gate, card_count>0, video ready…)
    CanPublish func(ctx, tx, id) error
}
func (s *Service) Transition(ctx, actor *models.User, r Reviewable, id uuid.UUID, to models.ContentStatus, reason string) error
```
Implementation: one `UPDATE <table> SET status=?, reviewed_by=?, reviewed_at=?, rejection_reason=? WHERE id=? AND status IN (<allowed from>) [AND owner=? unless manage-all]` → `RowsAffected==0` ⇒ 404/409. Notify inside the same tx. Then each handler becomes 5 lines. Add `reviewed_by/reviewed_at` to `flashcard_decks`.

Allowed transitions table (single source):
```
draft|rejected → pending_review   (owner)
pending_review → approved|rejected (admin)
approved       → published         (owner)
```

### B2. "Can this user access this paid item?" (5 places, 2 implementations)
- `SubscriptionService.CheckAccess` (+ `kycRequired` arg) used by content, flashcards, router attempt start.
- `generation.Engine.EntitlementFor` re-implements the same subscription+KYC rule.
- `middleware.SubscriptionGateMiddleware` — **unused**.
- `GetChapterContent` and `StudentDecks` call `CheckAccess` **per item** → one subscription query per row.

**How**: `access.Service` with
```go
func (s) Entitlement(ctx, user, courseID) Tier          // admin | paid | free  (cached per request)
func (s) Allow(ctx, user, requiresSub bool, courseID) error
```
`kyc_required` read inside via `settings.Bool("kyc_required")` — callers stop passing it. Use a per-request memo (`map[courseID]Tier` stored on the context) to kill the N+1. Delete `SubscriptionGateMiddleware`. Move the inline closure in `router.go:154` into `AttemptHandler.StartAttempt` → `ScoringService.StartAttempt` (service checks access).

### B3. `kyc_required` (5 readers)
`cmd/api/main.go:181` closure, `handlers/kyc.go:29`, `handlers/profile.go:45`, `handlers/content.go:35` `kycRequired(db)`, plus `settings.Defaults["kyc_required"]`. **How**: `settings.Bool("kyc_required")` everywhere; `SetKYCRequired` calls `settings.Set`. Delete the closure and the helper; drop the `KYCRequired func() bool` fields from `Engine`, `FlashcardHandler`, `ExtrasHandler`, `router.Deps`.

### B4. Active subscription lookup (5 copies)
`SubscriptionService.GetActiveSubscription`, `profile.GetMe`, `profile.GetMySubscription`, `admin.GetUserSubscription`, `admin.DashboardSummary` — each with its own `status=active AND end_date >= NOW()` and **no ORDER BY**. **How**: `billing.ActiveSubscription(ctx, userID, courseID *uuid.UUID)` with `ORDER BY end_date DESC`; a `ListActive(userID)` for "/me" that returns one per course.

### B5. Course / subject / chapter / topic validation (4 copies)
`QuestionService.resolveTaxonomy` (complete, good), `FlashcardHandler.setTaxonomy`, `content.go` (none), `tests.go` (none, silently ignores bad IDs). **How**: extract `taxonomy.Resolve(ctx, db, courseID, subjectID, chapterID, topicID) (Resolved, error)` from `resolveTaxonomy` and use it in all four.

### B6. Ownership scope (`canManageAll…`) (5 copies)
`canManageAllContent` (content.go:29), `canManageAllTests` (tests.go:54, identical), `canReviewAll` (correction_service), inline checks in `csv_import_service.updateRow`, `reports.Resolve`, `teacher_questions.scope`. Plus file-key ownership: `validLecturePDFKey`, the `strings.Contains(k, "/"+teacher.ID+"/")` check in `CSVImport`, none for KYC/profile photo. **How**:
```go
// internal/authz
func ManagesAll(u *models.User) bool
func Scope(q *gorm.DB, u *models.User, ownerCol string) *gorm.DB   // adds "ownerCol = ?" unless ManagesAll
func OwnsUploadKey(u *models.User, purpose, key string) bool       // "<purpose>/<user_id>/…", no "..", admin bypass
```

### B7. "My ratings / my bookmarks for these IDs" (6 copies)
`tests.go:109`, `content.go:426`, `brain_hacks.go:411`, `flashcards.go:689`, `attempts.go:487-492` (+ `idSet` helper), each with its own `map[uuid]int` → `*int` dance. **How**: in `items` (or `engagement`):
```go
func MyRatings(ctx, db, userID, itemType string, ids []uuid.UUID) map[uuid.UUID]int
func MyBookmarks(ctx, db, userID, itemType string, ids []uuid.UUID) map[uuid.UUID]bool
func Ptr[T any](m map[uuid.UUID]T, id uuid.UUID) *T
```
Note `content.go` keys by `string`, the others by `uuid.UUID` — the JSON shape differs (`my_ratings` map vs per-item `my_rating`). Pick one shape for new endpoints.

### B8. Delete cascades for polymorphic items (3 copies)
`items.Cleanup` exists, but `tests.go DeleteTest` and `question_service.DeleteQuestionCascade` hard-code `{"bookmarks","content_reports","ratings"}` again, and `question_notes` / `media_refs` handling differs. When a 4th polymorphic table is added, someone will miss one. **How**: always call `items.Cleanup`; long-term replace hand cascades with FK `ON DELETE CASCADE` for non-polymorphic children (§D3).

### B9. GORM `default:true` / `default:-1` workaround (6 copies)
`CreateTest`, `CreateContent`, `CreateDeck`, `generation.Generate`, `PutPrefs`, `testutil` all do *Create → UpdateColumn(real value)*. That's two writes and a window where the row is wrong. **Root-cause fix**: remove `default:` from the GORM tags of those columns (keep the DB default in the SQL migration — §D1). GORM only substitutes defaults it knows about. Then delete every workaround. Columns: `tests.requires_subscription`, `tests.marks_per_correct`, `tests.marks_per_wrong`, `content_items.requires_subscription`, `flashcard_decks.requires_subscription`, `notification_prefs.*`, `questions.custom_eligible`, `bookmark_collections.is_active`, `courses.is_active`, `subscription_plans.is_active`, `home_updates.is_active`, `custom_test_presets.is_active`, `wellness_contents.is_active` (any `bool` with `default:true` or numeric with non-zero default — 14 tags today).

> ⚠️ `questions.custom_eligible` has **no** workaround today: `QuestionService.Create` (and therefore CSV import) with `custom_eligible: false` stores `true`, so a teacher who opts a question out of custom tests is silently opted back in. Same for creating a plan/preset/home update with `is_active: false`.

### B10. Hard-coded `"neet-ug"` as the paid-course rule (4 copies)
`content.go:86`, `tests.go:282`, `flashcards.go:109`, `db.go:189`. **How**: add `courses.default_requires_subscription bool` (seed true for NEET UG) and read it. No code change needed when a new paid course is added.

### B11. Small helpers re-implemented
`itoa` (analytics.go:306), `itoaSvc` (push_service.go:196) → `strconv.Itoa`. `atoiDefault` (analytics.go:247) → put in `httpx`. `contains` ×2 (uploads.go:138, media.go:584) → `slices.Contains` (Go 1.21+). IST zone ×2 → `clock`. Bunny GUID parsing from `file_key` ×2 (content.go Create/Update) → `bunny.GUIDFromKey(key)`.

### B12. Request plumbing in every handler
Every handler repeats `user := middleware.GetUser(c)`, `uuid.Parse(c.Param("id"))` + 400, `ShouldBindJSON` + 400, and chooses between `c.JSON(…, errorResponse{…})` and `respondErr`. **How** (`internal/httpx`):
```go
func ParamUUID(c *gin.Context, name string) (uuid.UUID, bool)   // writes 400 invalid_id on failure
func Bind[T any](c *gin.Context) (T, bool)                       // writes 400 bad_request on failure
func Fail(c *gin.Context, err error)                             // CodedError → its status; gorm.ErrRecordNotFound → 404; else 500 + log (never leak err.Error())
func OK(c *gin.Context, v any) / Created(c, v)
```
Then **delete `errorResponse{}` usage in handlers** (14 files) — everything goes through `Fail`. Today raw `err.Error()` strings leak to clients (e.g. `Checkout` returns Razorpay's error body).

---

## C. SQL audit

**Safety: good.** Every value is bound with `?`. All string-concatenated SQL concatenates **constants only** (table names from fixed maps, column names from switch statements): `pagination.go:62`, `items.go:129`, `tests.go DeleteTest`, `question_service.go:518,523`, `ratings.go recomputeRating`, `admin.go:321,331`, `generation.go:156,871`, `flashcards.go:646`. No injection found. Keep it that way: add a lint rule / review rule "no `+` or `Sprintf` into SQL unless the operand is a compile-time constant or comes from a whitelist map".

Issues worth fixing:

| # | Query | Problem | Fix |
|---|---|---|---|
| C1 | `correction_service.go:223` rescore: `FROM (SELECT attempt_id, … FROM attempt_answers GROUP BY attempt_id) agg WHERE agg.attempt_id = sa.id AND sa.id IN (…)` | Aggregates the **entire** `attempt_answers` table on every rescore; gets slower forever. | Move the filter inside: `… FROM attempt_answers WHERE attempt_id IN (SELECT attempt_id FROM attempt_answers WHERE question_id = ?) GROUP BY attempt_id`. |
| C2 | `correction_service.go RecomputeQuestionStats` | `fmt.Sprintf("%d", reports)` into SQL. Safe (int), but breaks the "always bind" rule. | Bind it as `?`, or compute `report_count` as a sub-select. |
| C3 | `push_service.Dispatch`: `WHERE pushed_at IS NULL AND created_at > ?` every 30 s | No index → seq scan of `notifications` (which grows with every user). Then per-notification N+1 for prefs and tokens. | Partial index `ON notifications(created_at) WHERE pushed_at IS NULL`; load prefs and tokens for all user IDs in two queries. |
| C4 | `admin.go ListUsers`, `payments.ListPayments`, `kyc.ListKYC`, `content.AdminListContent`, `tests.AdminListTests`, `ListTeacherContent`, `ListTeacherTests`, `profile.GetAttempts`, `brain_hacks.TeacherList/AdminList`, `flashcards.TeacherDecks/AdminDecks`, wellness lists | **Unbounded** `Find` (no LIMIT) — admin pages will time out as data grows; `GetAttempts` preloads every test. | Use `pagination.Apply/Page` (already exists) everywhere a list is returned. |
| C5 | `admin.go:48` search, `taxonomy.go:42,172`, `flashcards.go:650` | `LIKE '%'+q+'%'` without escaping `%`/`_`; leading `%` can't use an index. | `escapeLike(q)` helper; for phone search use prefix match. Fine to leave the leading `%` for admin-only screens. |
| C6 | `generation.pool` joins `tests t ON t.id = q.test_id` (legacy link), while reads elsewhere use `test_questions`. | Two notions of "which test owns a question". | Decide in §D4. |
| C7 | `profile.go GetProgressBreakdown`, `push_service.StreakNudges` | Per-day `COUNT` loops (N+1). | See §A8. |
| C8 | `scoring_service.submit` | 2–4 statements per question inside one tx. | See §A5.3. |
| C9 | `GetMe`, `GetMySubscription`, `admin.GetUserSubscription`, `subscription_service.GetActiveSubscription` | `First()` without `ORDER BY` — GORM orders by primary key (random UUID) → result can differ between calls when 2 rows match. | `Order("end_date DESC")`. Generally: **any `First` on a non-unique predicate must have an explicit `Order`.** |
| C10 | `retention.go`, `DashboardSummary`, `AnalyticsOverview`, `KYCHandler`, `wellness`, `curriculum` | Queries without `WithContext(ctx)` → not cancelled when the client disconnects; no timeout. | Lint rule: every DB call uses `WithContext`. Set a statement timeout on the pool (`?options=-c statement_timeout=15000` in `DATABASE_URL`) as a safety net. |
| C11 | Pool config | `gorm.Open` with no `SetMaxOpenConns/SetMaxIdleConns/SetConnMaxLifetime`. | Set them from config (e.g. 20/10/30m) in `db.Connect`. |
| C12 | Many write paths | `db.Model(…).Update(…)` / `Save` results ignored (`kyc.go`, `content.go`, `tests.go` approve/reject/publish, `flashcards.go` reorder/delete, `wellness.go`, `curriculum.go`, `courses.go`). Client gets 200 even if nothing was written. | Check `.Error` and `RowsAffected` (via `httpx.Fail`). |

---

## D. Schema audit

### D1. Two sources of truth
Structure comes from GORM `AutoMigrate` (struct tags), indexes/backfills from `db/migrations/*.sql`. AutoMigrate never drops/renames, can't express partial indexes/CHECKs, and silently changes column types if a tag changes. The README already hit the `default:` problem (§B9).

**How (incremental, low-risk)**
1. Generate a baseline: `pg_dump --schema-only` from a fresh DB → `0003_baseline.sql` guarded with `IF NOT EXISTS` (so existing DBs are no-ops).
2. From then on **every** schema change is a numbered SQL file. Keep `AutoMigrate` only behind `ENV=development` for a transition period, then delete it.
3. Add a CI test (you already have `migrate_test.go`) that runs migrations on an empty DB and compares against the GORM models (`gorm` `Migrator().HasColumn` per field) so models and SQL can't drift.
4. Consider `golang-migrate` or `goose` only if you need down-migrations; the current runner (advisory lock + per-file tx + `schema_migrations`) is fine.

### D2. Missing constraints (determinism lives in the DB)
| Table | Add | Why |
|---|---|---|
| `user_watch_histories` | `UNIQUE(user_id, content_item_id)` | Heartbeat race creates duplicates (§A8). |
| `question_revisions` | `UNIQUE(question_id) WHERE status='pending'` | One pending correction rule (§A8). |
| `subscriptions` | `UNIQUE(user_id, course_id) WHERE status='active'` *(after deciding §E1)* | Prevent overlapping active subs. |
| `payment_records` | `UNIQUE(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL` | Same payment can't activate two orders. |
| `kyc_records` | `UNIQUE(user_id) WHERE status IN ('pending','approved')` | Check-then-insert in `SubmitKYC`. |
| `test_questions` | `UNIQUE(test_id, position)` | Deterministic question order (today duplicates are possible, §A8). |
| `flashcards` | `UNIQUE(deck_id, position) DEFERRABLE` | Same, for reorder. |
| `background_jobs` | `locked_at`, index `(status, run_after)` | §A1. |
| `notifications` | `INDEX(created_at) WHERE pushed_at IS NULL` | §C3. |
| enum-ish text columns | `CHECK (status IN (…))` on `tests.status`, `content_items.status`, `student_attempts.status`, `payment_records.status`, `subscriptions.status`, `users.role`, `questions.correct_option`, `attempt_answers.selected_option` | Bad values are currently only blocked by handler code that differs per endpoint. |
| money/score | `CHECK (price_paise >= 0)`, `CHECK (duration_days > 0)` | Admin can create a 0-day / negative plan today. |

### D3. Foreign keys are inconsistent
Legacy models declare relation fields (`User`, `Course`, `Test`…) so AutoMigrate creates FKs **without `ON DELETE`**. Newer models (`TestQuestion`, `StudentQuestionState`, `QuestionTag`, `Bookmark`, `MediaRef`, `Flashcard`, `FlashcardState`, `VideoNote`, `QuestionNote`, …) have **no FKs at all**. That's why deletes are hand-cascaded in `DeleteTest`, `DeleteQuestionCascade`, `DeleteDeck`, `PurgePersonalData`, and why `CheckTestQuestionParity` exists.

**How**: add FKs with `ON DELETE CASCADE` for owned children (`test_questions→tests/questions`, `question_tags`, `attempt_answers→student_attempts`, `flashcards→flashcard_decks`, `flashcard_states→flashcards`, `student_question_states→questions`, `question_notes`, `question_stats`, `question_revisions`, `csv_import_row_errors→csv_import_batches`). Run an orphan-cleanup `DELETE … WHERE NOT EXISTS` in the same migration first. Polymorphic tables (`bookmarks`, `ratings`, `content_reports`, `media_refs`) can't have FKs → keep `items.Cleanup` as the single place.

Then shrink the hand cascades to just the polymorphic cleanup.

### D4. Finish the `questions.test_id` → `test_questions` migration
Today there are two memberships: legacy `questions.test_id`/`order_index` and `test_questions(test_id, question_id, position)`, kept in sync by dual writes, plus a runtime rollback flag `test_questions.read_via_join` and a parity checker. Generation and `items.Resolve` and corrections still use `q.test_id` ("home test"), runtime uses the join table.

**Decide** (recommend): `questions.test_id` = **home/authoring test** (owner), `test_questions` = **membership & order**. Rename the column to `home_test_id` (or document it), stop writing `order_index` (use `test_questions.position`), delete `readViaJoin()` and the `else` branches in `services/testq.go`, delete the `test_questions.read_via_join` setting and `CheckTestQuestionParity` once the parity test has been green in prod for a release.

### D5. Model hygiene
- Split `models.go` (561 lines) + `models_custom.go` (416) by domain. Delete unused `BaseModel`.
- Mixed enum styles: typed (`ContentStatus`, `UserRole`) vs untyped string consts (`OriginGenerated`, `ModeExam`, `ReportOpen`, `MediaReady`…). Pick typed strings for all, with a `Valid()` method — validation then lives next to the type instead of in `validate` lists and handler `if` chains.
- `UserRole` has a custom `Value/Scan`; the other enums don't need it either (`type X string` works with GORM). Remove for consistency.
- `CSVImportRowError.RawRowData string` with `type:jsonb`, `BackgroundJob.Payload string` with `type:jsonb` → use `models.JSONB`.
- `Session.RevokedAt` unused (§A6). `Subscription.AutoRenew` unused (one-time checkout only).
- `KYCRecord.IDNumber` plain text (§A7).
- Denormalised counters (`tests.total_questions`, `flashcard_decks.card_count`, `rating_avg/rating_count` ×4) — fine, but always recompute from source in the same tx (ratings already do; `total_questions` uses ±1 in some places and `count(*)` in CSV import → use `count(*)` everywhere).

---

## E. Business-logic questions to decide (product input needed)

These aren't bugs in code, but the code encodes an answer nobody wrote down:

1. **Renewals / overlapping plans.** Should buying while active extend from current `end_date` (common) or replace? Today: starts now, old one keeps running, two active rows. *Recommend:* extend — `start = max(now, current.end_date)`.
2. **Upgrading vs. multiple courses.** `/me` returns *one* "active_subscription" across all courses. Should it be a list per course?
3. **Free vs paid default per course** — currently `slug == "neet-ug"` (§B10).
4. **Admin role in student routes.** `RequireRole` lets admins through everything, and `CheckAccess` gives admins full access. Admins can therefore start attempts that pollute `question_stats`/cohort data. Exclude admins from stats, or block admin attempts.
5. **Purge personal data** keeps attempts on *authored* tests, watch history, daily activity, feedback and KYC. Is that the intended legal scope (DPDP Act)? If not, extend `PurgePersonalData`.
6. **KYC re-submission** after rejection: allowed today (rejected isn't in the conflict list). Old records stay — keep all history or one row per user?
7. **Teacher can create content/tests for any course** — no teacher↔course assignment. Intended?
8. **Two upload systems**: `/uploads/presign` (KYC, video, CSV, profile photo, lecture PDF — no size limits, no completion step) and `/media/presign` (images — validated, sized, processed). Should profile photos/KYC move to the validated pipeline?

---

## F. Config, ops & repo hygiene

| Item | Fix |
|---|---|
| `be/api` — 66 MB ELF binary tracked in git | `git rm --cached be/api`, add `be/api`, `be/worker`, `bin/` to `.gitignore`. (History still holds it; rewrite only if repo size matters.) |
| `JWT_SECRET` default `change-me-in-production`; Razorpay/S3/Bunny may be empty in prod | `config.MustLoad()` → `Validate()`: in `ENV=production` fail fast if JWT secret is default/short (<32 bytes), Razorpay keys or webhook secret empty, storage/Bunny unconfigured. |
| `config.AppConfig` global read from deep inside services (`otp_service`, `session_service`, `razorpay`) | Pass the needed values into constructors in `app/`. |
| Globals: `db.DB`, `storage.Client` **and** `storage.Store` (two handles to the same thing), `rzp.DefaultClient`, `settings.Default`, `bunny` package config | Construct once in `app/`, inject. Keep `storage.Store` (interface) and delete `storage.Client`. |
| `/healthz` doesn't check the DB | Add `/readyz` that pings DB with a 1 s timeout. |
| No request ID / structured logs; `log.Printf` everywhere | `slog` with a request-id middleware; include request id in 500 responses. |
| No global body-size limit (only `readBody` in custom tests) | `http.MaxBytesReader` middleware (e.g. 1 MB; webhook route excluded). |
| CORS `*` | Fine for a bearer-token mobile API; restrict for the admin web origin if cookies are ever introduced. |
| `gin.Default()` in prod logs every request at info | Use `gin.New()` + recovery + your slog middleware. |
| Seeds run on every API boot (`SeedAll`) incl. per-course preset `COUNT` loops | Move seeds into SQL migrations (`INSERT … ON CONFLICT DO NOTHING`); boot does nothing but migrate. |
| `go services.BackfillAllContentHashes(…)` at every API boot | One-off: move to a migration or a CLI command (`cmd/tools backfill-hashes`). |
| No linter | Add `golangci-lint` with `errcheck`, `govet`, `staticcheck`, `unused`, `contextcheck`, `gocritic` (start with `--new-from-rev=dev` so only new code is enforced). |
| Swagger comments are ~30% of handler lines | Keep, but generate in CI (`make swagger` + `git diff --exit-code docs/`) so it never drifts. |

---

## G. Dead code to delete

Verified no non-test callers:

- `middleware.SubscriptionGateMiddleware`, `middleware.GetUserID`
- `services.ScoringService.GetOrCreateAttempt`
- `services.NewStreamStatusService`, `StreamStatusService` alias, `HandleStreamStatusCheck`, `jobs.JobTypeStreamStatusCheck`, `jobs.StreamStatusCheckPayload`
- `storage.BuildObjectKey`
- `generation.inClause`
- `models.BaseModel`
- `handlers.asCoded` (one call; replace with `errors.As`)
- `services.ProcessCSVReader` (only tooling/tests — move to `testutil` if tests need it)
- Swagger-only request types that drifted from reality (`addQuestionRequest` vs real `questionRequest`, `testQuestionsResponse`, `getMeResponse`) — either use them in the handler or delete.
- After §D4: `readViaJoin`, legacy branches in `testq.go`, `CheckTestQuestionParity`, setting `test_questions.read_via_join`.

---

## 7. Phased plan

Each phase is independently shippable. The integration tests in `internal/router/*_test.go` (real Postgres) are the safety net — run `make test-db && make test` after every step.

### Phase 0 — Guardrails (½–1 day)
1. Remove `be/api` from git; update `.gitignore`.
2. `config.Validate()` fail-fast in production (§F).
3. Add `golangci-lint` (new code only) + `go vet` + `make swagger` diff to CI.
4. Add `internal/httpx` (`Fail`, `Bind`, `ParamUUID`, `OK`) — no handler changes yet.
5. Add `internal/clock` (§A4).

*Verify:* CI green; app boots locally; boot fails with default JWT secret and `ENV=production`.

### Phase 1 — Correctness (2–3 days)
1. Worker: `SKIP LOCKED` claim, `locked_at` + reaper, multi-job per tick, tickers run at start + advisory lock, graceful drain (§A1, §A2).
2. Payments: status guard on failed, row lock on activate, transactional checkout, HTTP timeouts (§A3.1–5).
3. Replace all day computations with `clock.AppDay` (§A4).
4. Scoring from snapshot; server-side time; checked errors; coded "not active" (§A5).
5. Auth: single-query session load, throttled `last_used_at`, OTP attempt fix, coded OTP errors, phone normalisation (§A6).
6. KYC transitions guarded + transactional; mask `id_number` in responses (§A7).
7. Fix the §A8 table items.
8. Migration `0003`: constraints from §D2 (after de-duplicating existing rows in the same file).

*Verify:* add tests for: two workers + one job → runs once; `payment.failed` after `captured` keeps captured; activity at 01:00 IST counts for that IST day; submit with client `time_taken=1` → server time used; concurrent heartbeat → one row.

### Phase 2 — Structure (3–5 days, can be spread across feature work)
1. Move all routes from `cmd/api/main.go` into `internal/router`; create `internal/app` and make both `cmd/*` thin. Tests use `app.New`.
2. `review` service and migrate tests/content/hacks/decks to it (§B1).
3. `access` service; delete `kycRequired` duplicates and `SubscriptionGateMiddleware`; move attempt-start check into the service (§B2, §B3).
4. `billing.ActiveSubscription`, `taxonomy.Resolve`, `authz` helpers, `items.MyRatings/MyBookmarks` (§B4–B7).
5. Remove `default:` GORM tags + delete the 6 workarounds (§B9); `courses.default_requires_subscription` (§B10).
6. Convert legacy handlers to `httpx` + a service method, one file per PR: payments → kyc → profile → admin → content → courses/curriculum → wellness → tests. Delete `errorResponse{}` use as each file is done.
7. Delete dead code (§G).

*Verify:* existing router tests pass unchanged (the HTTP contract must not change, except: error bodies gain a `code`, and 200-on-failure becomes a real error).

### Phase 3 — Schema single-source (2–3 days)
1. Baseline SQL migration; stop running `AutoMigrate` outside development (§D1).
2. FKs with `ON DELETE CASCADE` + orphan cleanup; shrink hand cascades (§D3).
3. Finish `test_questions` migration (§D4).
4. Seeds and content-hash backfill into migrations/CLI (§F).
5. Split model files, typed enums (§D5).

### Phase 4 — Cheap perf & pagination (1–2 days)
Paginate all list endpoints (§C4), rescore subquery (§C1), notifications index + batched dispatch (§C3), streak single query (§A8), per-request entitlement memo (§B2), pool settings + statement timeout (§C10, §C11), analytics bucketing in SQL (§A8).

---

## 8. Conventions — PR checklist for fast-paced dev

Put this in `be/CONTRIBUTING.md` (or the PR template) once Phase 2 starts:

**Handlers**
- [ ] Handler only binds, calls one service method, responds via `httpx`. No `tx`, no raw SQL, no `services.Notify`.
- [ ] Errors go through `httpx.Fail(c, err)`; services return `*CodedError` with a stable `code`.
- [ ] Every list endpoint is paginated (`pagination.Apply/Page`).

**Services / SQL**
- [ ] Every DB call has `.WithContext(ctx)` and its `.Error` is checked.
- [ ] Multi-row writes are in one transaction. State changes use `UPDATE … WHERE id=? AND status IN (allowed)` and check `RowsAffected`.
- [ ] Any `First()` on a non-unique filter has an explicit `Order(…)`.
- [ ] SQL values are always bound (`?`). Never `+`/`Sprintf` a non-constant into SQL.
- [ ] "Today"/day boundaries use `clock.AppDay`. Time comes from `clock.Now()`.
- [ ] Random/ordering logic is seeded or has a deterministic tie-breaker (`…, id`).
- [ ] Notifications are written with the same `tx` as the change that caused them.
- [ ] Background work = `EnqueueJob(tx, …)` inside the same transaction; job handlers are idempotent.

**Schema**
- [ ] New table/column ⇒ new numbered SQL migration (not just a struct tag).
- [ ] Owned child tables have FK `ON DELETE CASCADE`; polymorphic references are cleaned in `items.Cleanup`.
- [ ] Uniqueness/state rules that matter are DB constraints (unique/partial unique/CHECK), not only handler checks.
- [ ] No `default:` GORM tag on bool/number columns whose zero value is meaningful.

**Cross-cutting**
- [ ] Access to paid content goes through `access.Allow` — never re-implement subscription/KYC checks.
- [ ] Authoring ownership goes through `authz.Scope` / `authz.OwnsUploadKey`.
- [ ] New reviewable entity ⇒ register a `review.Reviewable`; new rateable/bookmarkable type ⇒ add to `items`.
- [ ] New tunable ⇒ add to `settings.Defaults` (and app-config if the client needs it); never read `platform_settings` directly.
- [ ] Swagger regenerated (`make swagger`).

---

## Appendix — file-by-file notes (quick reference)

| File | Lines | State | Main actions |
|---|---|---|---|
| `cmd/api/main.go` | 313 | wiring + routes | move routes to router, wiring to `app` |
| `cmd/worker/main.go` | 104 | ok-ish | tickers/shutdown (§A2) |
| `handlers/tests.go` | 1202 | legacy+new mix | review svc, validation, `httpx`, delete dup LoadTags |
| `handlers/flashcards.go` | 916 | newer, but SQL in handler | review svc, access memo, extract service |
| `handlers/custom_tests.go` | 879 | good | per-process cache/limiter decision |
| `handlers/extras.go` | 713 | mixed bag | split: video notes / push+prefs / home updates / explore / **share (belongs to custom_tests)** |
| `handlers/content.go` | 692 | legacy | review svc, access svc, taxonomy, URL fallback |
| `handlers/analytics.go` | 620 | ok | move SQL to service; itoa helpers |
| `handlers/attempts.go` | 575 | good | `items.MyRatings` |
| `handlers/admin.go` | 525 | legacy | pagination, SQL bucketing, metric definitions |
| `handlers/brain_hacks.go` | 473 | newer | review svc |
| `handlers/profile.go` | 450 | legacy | streak, heartbeat upsert, subscription helper |
| `handlers/teacher_questions.go` | 434 | good | authz.Scope |
| `handlers/bookmarks.go` | 396 | good | — |
| `handlers/curriculum.go` | 344 | legacy | error checks, `httpx` |
| `handlers/kyc.go` | 277 | legacy | §A7 |
| `handlers/payments.go` | 254 | legacy | §A3 |
| `services/scoring_service.go` | 671 | good | §A5 |
| `services/question_service.go` | 582 | good | order race, taxonomy extract |
| `services/csv_import_service.go` | 816 | good | idempotency (§A1) |
| `services/correction_service.go` | 262 | good | rescore SQL (§C1), snapshot marks |
| `services/subscription_service.go` | 178 | legacy | §A3, §E1 |
| `services/session_service.go` | 147 | legacy | §A6 |
| `services/otp_service.go` | 136 | ok | §A6 |
| `services/push_service.go` | 206 | ok | N+1, IST, streak dedupe |
| `jobs/worker.go` | 229 | **bug** | §A1 |
| `generation/generation.go` | 924 | good | use `access` for entitlement; legacy `q.test_id` join |
| `db/db.go`, `db/migrate.go` | 350 | ok | §D1 |
| `models/*.go` | 977 | ok | §D5 |
