# Backend refactor — what to do to ship it, and what the frontend must change

Branch: `feature/be-refactor`. Companion to [REFACTOR_AUDIT.md](REFACTOR_AUDIT.md) (the "why") and [../CONTRIBUTING.md](../CONTRIBUTING.md) (the rules going forward).

Contents
1. [Deploy runbook (backend / ops)](#1-deploy-runbook)
2. [Frontend changes](#2-frontend-changes) — mobile app (`fe/`) and any admin web
3. [Things still to do (not code in this branch)](#3-things-still-to-do)
4. [Behaviour changes at a glance](#4-behaviour-changes-at-a-glance)

---

## 1. Deploy runbook

### 1.1 Before you deploy

| # | Step | Why |
|---|---|---|
| 1 | **Back up the production database.** | Migrations `0003`/`0004` delete duplicate / orphan rows and add constraints. They are forward-only. |
| 2 | **Confirm `ENV=production` is set** on the API and the worker. | `ENV` defaults to `development`. Only `production` skips AutoMigrate, turns on config validation, disables stub upload URLs and enforces OTP rate limiting. If prod currently runs as `development`, fix this *first* and re-check the rest of this list. |
| 3 | Set / verify the **required secrets** (below). | In production the API and worker now **refuse to start** without them. |
| 4 | **Rehearse the migrations on a copy of production data** and run the preflight queries (§1.3). | See what will be cleaned up before it happens. |
| 5 | Set the Razorpay webhook to send **`payment.captured` and `payment.failed`** to `/api/v1/webhooks/razorpay`. | The handlers now rely on both being delivered in either order. |

**Required environment (production)**

| Variable | Rule |
|---|---|
| `ENV` | `production` |
| `JWT_SECRET` | ≥ 32 chars, random (`openssl rand -hex 32`), not the default. **Changing it logs everyone out** — only rotate if the current one is weak. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | all three non-empty |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (+ `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`) | non-empty |
| `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_CDN_HOST` | not validated at boot, but video uploads return **503 `storage_unavailable`** in production if blank |
| `MSG91_*` or `TWO_FACTOR_API_KEY` | OTP provider (otherwise the console stub is used — never in prod) |
| `DB_MAX_OPEN_CONNS` (25), `DB_MAX_IDLE_CONNS` (10) | new, optional. Keep `open conns × replicas` below Postgres `max_connections`. |
| `DB_STATEMENT_TIMEOUT_MS` | new, optional, default `0` (off). See §1.5 before enabling. |

### 1.2 Deploy order

1. Deploy the **API** first. On boot (under a Postgres advisory lock, so several replicas are safe) it runs, in order: baseline *(only on an empty DB)* → `0001` → `0002` → **`0003`** → **`0004`** → **`0005`**.
2. Deploy the **worker** after. It waits up to 2 minutes for all migrations to be recorded (`schema_migrations`) and then starts. You may run **more than one worker replica** now — jobs are claimed with `SKIP LOCKED` and periodic tasks are guarded by advisory locks.
3. Rolling deploy is fine: old pods keep working against the new schema (nothing was dropped or renamed). Old and new workers can briefly coexist.

What each new migration does

| File | Effect | Risk |
|---|---|---|
| `0003_integrity_and_queue.sql` | adds `background_jobs.locked_at`, `courses.default_requires_subscription` (NEET UG = true), `flashcard_decks.reviewed_by/at`; **de-duplicates** watch history, pending corrections, active KYC, test-question positions; adds unique indexes; adds `CHECK` constraints as `NOT VALID` | Duplicate rows are removed/rejected (older ones lose). Index builds take a short lock on small tables. |
| `0004_foreign_keys.sql` | **deletes orphan rows** in child tables, replaces FKs with `ON DELETE CASCADE` | Orphans are unreachable data, but run the preflight to see counts. Takes `ACCESS EXCLUSIVE` locks briefly per table. |
| `0005_rate_limits_and_seeds.sql` | creates `rate_events`; inserts courses, `kyc_required`, bookmark collections, default presets **only if missing** | None — never overwrites admin edits. |

### 1.3 Preflight queries (read-only — run on the rehearsal copy and on prod before deploying)

```sql
-- 0003 will remove/reject these:
SELECT count(*) AS dup_watch_rows FROM (SELECT 1 FROM user_watch_histories GROUP BY user_id, content_item_id HAVING count(*) > 1) x;
SELECT count(*) AS dup_pending_corrections FROM (SELECT 1 FROM question_revisions WHERE status='pending' GROUP BY question_id HAVING count(*) > 1) x;
SELECT count(*) AS users_with_2plus_active_kyc FROM (SELECT 1 FROM kyc_records WHERE status IN ('pending','approved') GROUP BY user_id HAVING count(*) > 1) x;
SELECT count(*) AS tests_with_dup_positions FROM (SELECT 1 FROM test_questions GROUP BY test_id, position HAVING count(*) > 1) x;
SELECT count(*) AS payments_sharing_a_payment_id FROM (SELECT 1 FROM payment_records WHERE razorpay_payment_id IS NOT NULL GROUP BY razorpay_payment_id HAVING count(*) > 1) x;  -- must be 0, the unique index would fail

-- 0004 will delete these orphans (each should be small / 0):
SELECT 'test_questions→tests'      , count(*) FROM test_questions   c WHERE NOT EXISTS (SELECT 1 FROM tests     p WHERE p.id=c.test_id);
SELECT 'test_questions→questions'  , count(*) FROM test_questions   c WHERE NOT EXISTS (SELECT 1 FROM questions p WHERE p.id=c.question_id);
SELECT 'attempt_answers→attempts'  , count(*) FROM attempt_answers  c WHERE NOT EXISTS (SELECT 1 FROM student_attempts p WHERE p.id=c.attempt_id);
SELECT 'attempt_answers→questions' , count(*) FROM attempt_answers  c WHERE NOT EXISTS (SELECT 1 FROM questions p WHERE p.id=c.question_id);
SELECT 'flashcards→decks'          , count(*) FROM flashcards       c WHERE NOT EXISTS (SELECT 1 FROM flashcard_decks p WHERE p.id=c.deck_id);
SELECT 'student_question_states→q' , count(*) FROM student_question_states c WHERE NOT EXISTS (SELECT 1 FROM questions p WHERE p.id=c.question_id);

-- Rows that violate the new CHECKs (they are NOT VALID, so these stay; see §1.6):
SELECT 'bad test status', count(*) FROM tests WHERE status NOT IN ('draft','pending_review','approved','rejected','published');
SELECT 'bad plan'       , count(*) FROM subscription_plans WHERE price_paise < 0 OR duration_days <= 0;
```

### 1.4 After deploy — verify

```sql
SELECT version FROM schema_migrations ORDER BY version;          -- expect 0001…0005
SELECT status, count(*) FROM background_jobs GROUP BY status;     -- no growing 'processing'
SELECT count(*) FROM courses WHERE default_requires_subscription; -- ≥ 1 (NEET UG)
```
* `GET /healthz` → 200, `GET /readyz` → 200 (new; use it for the load-balancer health check instead of `/healthz`).
* Worker log shows `ticker … ` runs shortly after start (daily jobs no longer wait 24 h) and, on a second worker, no duplicate `Processing job` lines for the same id.
* Place a **test payment** end to end (checkout → pay → `verify-payment`) and also let the webhook arrive; the subscription must be active exactly once.
* Log in with a phone that has an existing account (phone numbers are only whitespace-normalised, so existing users still match).

### 1.5 Optional hardening, once stable
* **`DB_STATEMENT_TIMEOUT_MS=15000` on the API.** The API runs migrations at boot on the same pool; enable the timeout only *after* the migrations above have applied, or a slow `0004` will be cancelled. Never set it on the worker (CSV imports, rescoring and media jobs legitimately run long).
* Put the `NOT VALID` `CHECK`s into force for old rows (§1.6).

### 1.6 Make the new CHECK constraints fully valid (later)
After cleaning any rows the preflight showed:
```sql
ALTER TABLE tests VALIDATE CONSTRAINT chk_test_status;
-- likewise: chk_user_role, chk_content_status, chk_attempt_status, chk_payment_status,
--           chk_subscription_status, chk_question_correct, chk_answer_selected, chk_plan_price, chk_plan_duration
```

### 1.7 Rollback
Code is rolled back by redeploying the previous image — the schema changes are additive/compatible (no column was dropped or renamed), so old binaries run fine on the new schema. The data cleanup in `0003`/`0004` is **not** reversible; that is what the backup is for. Do not roll the `JWT_SECRET` back and forth.

### 1.8 Local development
```bash
make test-db && make test        # needs Docker for Postgres (or any Postgres 16, TEST_DATABASE_URL)
make swagger                     # after changing handler annotations
make lint                        # golangci-lint, new code only
```
Local/dev (`ENV` ≠ production) still runs AutoMigrate + the Go seeds for convenience; production never does. **Any schema change now needs a numbered SQL file** in `internal/db/migrations` — `TestFreshDatabaseFromMigrationsMatchesModels` fails if a model gains a column the SQL doesn't create.

---

## 2. Frontend changes

Most changes are additive, so the current app keeps working. Items are ordered **must / should / nice**. File references are to `fe/` (the mobile app); the `(admin)` screens live in the same app, and `website/` is the marketing site (not affected).

### 2.1 MUST

**M1 — Paginated lists: handle `next_cursor`, expect a 200-row cap.**
These responses now include `next_cursor` (string or `null`) next to the existing array, and return at most **200** rows per call (override with `?limit=`, max 200; continue with `?cursor=`). Existing array keys are unchanged.

| Endpoint | Array key | Order |
|---|---|---|
| `GET /admin/users` | `users` | newest first |
| `GET /admin/payments` | `payments` | newest first |
| `GET /admin/content`, `GET /teacher/content` | `content` | newest first |
| `GET /admin/tests`, `GET /teacher/tests` | `tests` | newest first |
| `GET /admin/kyc` | `records` | **oldest first** (review queue) |
| `GET /me/attempts` | `attempts` | newest first |
| `GET /admin/brain-hacks`, `GET /teacher/brain-hacks` | `brain_hacks` | newest first |
| `GET /admin/flashcard-decks`, `GET /teacher/flashcard-decks` | `decks` | newest first |

* Update the types in `src/api/admin.ts`, `profile.ts`, `contentReview.ts`, `discover.ts`, `teacher.ts` to include `next_cursor?: string | null`.
* Screens that list "everything" (`kyc-queue.tsx`, `kyc-review-detail.tsx`, admin users/payments, teacher content/tests, my attempts) should either loop until `next_cursor` is null or add "load more". Until then they silently stop at 200.
* `kyc-review-detail.tsx` currently fetches three whole lists to find one record — fine under 200 each, but this is the first place that will break; ask for a `GET /admin/kyc/:id` (see §3) or page through.

**M2 — KYC platform toggle was broken; fix the contract.**
`setKYCRequired` in `src/api/admin.ts` sent `{ required }` but the server only read `{ enabled }` — **the admin toggle never actually changed the flag** (it always saved `false`). The server now accepts both names and returns both `kyc_required` and `required`, so the screen starts working immediately. Please also:
* send `{ enabled }`, type the response `{ kyc_required: boolean }`;
* `getPlatformSettingsKYC` should read `kyc_required` (it reads `required`, which the server now also returns — remove the alias later).
* After you ship this, **check the current value in production** (`SELECT * FROM platform_settings WHERE key='kyc_required'`) — nobody could have turned it on before.

**M3 — Error handling by `code`.**
Every error now has `{ error, code, details? }`; internal 500s return a generic message (`"something went wrong"`, `"internal error"` or `"failed to …"`) instead of the raw database/driver text. `ApiError.code` is already parsed in `client.ts`. Update screens that show `err.message` or compare status only:

| Where | Change |
|---|---|
| `app/phone-entry.tsx` | Rate limit is `429` + `code: "rate_limited"`. Keep as is; it currently shows a dev-only message — show the server message in production. New `400 invalid_phone` when empty. |
| `app/otp-verify.tsx` | Verify errors: `401 invalid_otp` (wrong), `401 otp_expired` (none/expired), **`429 otp_locked`** (too many tries — was 401). Show "request a new code" for `otp_expired`/`otp_locked`. |
| Checkout (`subscriptions.ts` callers) | `404 plan_not_found`, `502 checkout_failed` (retryable), `404 order_not_found` on verify if the order isn't the caller's. |
| Start attempt | unchanged: `403 subscription_required`, `409 attempt_expired`. Submit/answer on a finished attempt is now `403 attempt_not_active` (was a generic 400). |
| Content / test authoring forms | wrong course/subject/chapter combos are now **`422`** with `unknown_course`, `unknown_subject`, `unknown_chapter`, `chapter_subject_mismatch`, `chapter_course_mismatch`, `subject_course_mismatch` (before: silently ignored or a 500). `409 video_processing` when publishing a video that isn't transcoded. `400 invalid_title`, `invalid_duration`. |
| Admin queues | `?status=` must be `draft|pending_review|approved|rejected|published` → else `400 invalid_status`. |
| Progress | `?module=` must be `qbank|test_series|practice|custom` → else `400 invalid_module`. |
| Uploads | `503 storage_unavailable` in production when storage/Bunny isn't configured (before: a fake URL). |
| Review actions | `404 not_found / test_not_found / deck_not_found` when the item isn't in the expected state; reject reasons: hacks & decks need ≥3 chars (`400 reason_required`). |
| Generic | `413 body_too_large` (API bodies > 2 MiB — files must use presigned upload). |

**M4 — KYC submission: the document key must be your own upload.**
`POST /me/kyc` now requires `document_file_key` to look like `kyc_document/<your user id>/…` — i.e. exactly what `POST /uploads/presign` (`purpose: "kyc_document"`) returns. Don't reuse keys across users or invent them. Wrong key → `400 invalid_document`; empty number → `400 invalid_id_number`; already pending/approved → `409 kyc_exists`.
The `id_number` in the **user's own** KYC responses (`/me/kyc`) is now **masked** (`XXXXXX234F`) — don't prefill editable fields from it. The **admin** list still returns the full number.

### 2.2 SHOULD

**S1 — Subscriptions: renewals and multiple courses.**
* `GET /me` now also returns `active_subscriptions: Subscription[]` (one per course). `active_subscription` is kept (the one ending last). Use the array if a user can hold several courses.
* Buying a plan while one is active **extends** it: the new subscription's `start_date` is the old `end_date` (possibly in the future) and `end_date` = start + plan days. Show "valid till `end_date`" — don't show `start_date` as "started on". Don't assume `start_date ≤ now`.
* The checkout response is unchanged. After Razorpay returns, call `verify-payment` as before; the webhook may have activated already (idempotent).

**S2 — Attempt timing and scoring display.**
* `POST /attempts/:id/submit` → `time_taken_seconds` is the **server-measured** time (the value the app sends can only lower it). If you show elapsed time on the result screen, use the response, not the local timer.
* The score uses the marking scheme **frozen when the attempt started** (it no longer changes if a teacher edits the test afterwards). Nothing to change unless you recompute scores client-side — don't.

**S3 — Streaks and "today".**
The server defines a day as **IST midnight-to-midnight**. Use the server's `day_streak` / `last_7_days` (`GET /me/progress/breakdown`) rather than computing "today" from device time (a user abroad or a wrong device clock otherwise disagrees with push reminders).

**S4 — New / changed notification types** (`GET /me/notifications`): authors now receive `test_approved`, `test_rejected`, `content_approved`, `content_rejected` (data: `{ id }`), in addition to the existing `brain_hack_*`, `deck_*`, `correction_*`, `report_*`, `streak_nudge`. If the notification list maps `type → icon/route`, add these; unknown types should fall back to a generic row.

**S5 — Ratings.** Rating a draft/unpublished item now returns `403 not_eligible` (before, ids of unpublished items could be rated). No UI change expected.

**S6 — Admin analytics.** `GET /admin/analytics?range=` accepts only `7D`, `30D`, `ALL` (also `All Time`) — anything else is `400 invalid_range`. `ALL` returns 12 monthly bars. "active_subscriptions" = active subscriptions *created in the window*; relabel the card if it says "Active subscribers". (`adminAnalyticsOverview` has no screen yet in `fe/`.)

**S7 — Web clients / CORS.** `Idempotency-Key` is now an allowed request header (needed by browsers calling `POST /custom-tests`).

### 2.3 NICE / clean-up of contract mismatches found while auditing

| Item | Detail |
|---|---|
| `adminGetKYC` (`src/api/admin.ts`) | calls `GET /admin/kyc/:id`, which **does not exist**. It is unused; delete it, or ask for the endpoint (§3). |
| `getRecentContent` | `pct` is a placeholder (`50` for any in-progress item). Real % needs a `duration_seconds` on content (§3). |
| `UserProfile`/types | add `default_requires_subscription` only if you show per-course defaults (it is *not* serialised today — no change). |
| `src/api/client.ts` `Paginated<T>` | defines `{ items, next_cursor }`; the legacy lists above use their own array key + `next_cursor`. Consider a helper `pageOf(key)` to read both. |
| Heartbeat | `POST /content/:id/heartbeat` now `404`s for unknown content and `400 invalid_progress` for negatives; progress never goes backwards server-side, so you can send the current position freely. |
| Notification prefs | `PUT /me/notification-preferences` is now a plain upsert — same payload and response. |
| Phone numbers | the server strips spaces, dashes and brackets before use. Keep sending E.164 (`+91…`); the server does **not** add a country code. |

---

## 3. Things still to do

### 3.1 Backend work not done in this branch
| Item | Notes |
|---|---|
| `GET /admin/kyc/:id` | Lets the review screen load one record instead of three lists. Small. |
| Content `duration_seconds` | Bunny returns it; store on `content_items`, then compute real watch % in `GET /me/recent-content`. |
| Typed enums for all string columns | `Origin`, `Visibility`, `Mode`, flag/report/media statuses are still `string` constants (statuses with types now have `.Valid()`). Converting field types touches most handlers — do it module by module. |
| Remaining thin-handler work | Review, access, billing, progress, admin stats, KYC review are in services/helpers. Still handler-heavy: tests/content CRUD, curriculum, courses/plans, wellness, bookmarks, taxonomy, flashcards study queue. Follow `CONTRIBUTING.md`; migrate when you next touch each file. |
| Custom-test builder config cache | 60 s in-memory cache per API replica (the rate limiter is now shared in Postgres). Admin preset edits can take ≤ 60 s to show on other replicas — accepted; lower the TTL or drop the cache if that bothers you. |
| `settings` cache | 30 s per replica — same trade-off. |
| `Notify` in a few places | Still uses the caller's connection (push nudges, review service uses its tx). Writes that must be atomic already pass the transaction. |
| Go seeds | Production uses migration `0005`; the Go `SeedAll` is dev/test only. If you add reference data, add it to a new SQL migration (and keep the Go seed in step for tests). |
| Content-hash backfill | Moved to a worker ticker (daily, advisory-locked). Remove it after a release in which it logs `computed content_hash for 0`. |

### 3.2 Product / policy decisions (the code picked a default; confirm)
1. **Admin attempts** are now excluded from per-question stats (cohort %, difficulty). Their own history is kept. Confirm, or block admin attempts entirely.
2. **Purge personal data** now erases: all attempts & answers (every test), progress, notes, bookmarks, ratings, reports, preferences, devices, sessions, watch history, daily activity, feedback. It keeps: the user row, **payments** and **KYC** (financial/regulatory retention), and authored content. Confirm this meets your DPDP/legal reading, and decide whether the account itself should be anonymised.
3. **Renewals extend** the current period (instead of overlapping). Confirm refunds/upgrades policy (upgrade mid-term currently = extend).
4. **Teacher ↔ course assignment** — any teacher can author for any course today. Add `teacher_courses` if that should be restricted.
5. **Two upload systems** (`/uploads/presign` for KYC/video/CSV/photo/PDF vs `/media/presign` for validated images): no size limit or completion check on the first. Consider moving profile photos & KYC to the validated pipeline.
6. **KYC history**: rejected records are kept; a user can resubmit (only one pending/approved at a time).
7. **Dev rate limiting**: OTP rate limiting is skipped when `ENV=development`. If you have a *staging* environment, give it its own flag rather than relying on `ENV`.

### 3.3 Operations
* Point the load balancer/uptime check at **`/readyz`**; alert on `/readyz` failures and on `background_jobs` rows stuck in `processing` > 10 min or `failed` growing.
* Run **≥ 2 worker replicas** if you want redundancy (now safe).
* CI: add `go vet`, `make test` (with Postgres service), `make lint`, and a `make swagger && git diff --exit-code docs/` step.
* Remove the 66 MB `be/api` binary from **history** if repo size matters (`git filter-repo`); it is only untracked going forward.
* Rotate `JWT_SECRET` only if it was weak/default — it logs all users out.
* Consider a periodic `VACUUM`/retention check on `rate_events`, `notifications`, `background_jobs` (done rows) — only `rate_events` and old read notifications are swept today.

---

## 4. Behaviour changes at a glance

| Area | Before | Now |
|---|---|---|
| Job queue | duplicate runs possible; stuck jobs forever; 1 job / 5 s | exclusive claim, reaper (10 min), up to 5 jobs / tick, multi-replica safe |
| Periodic jobs | first run only after the full interval | run shortly after start, then on interval; one replica at a time |
| Payments | late `failed` could overwrite `captured`; unlocked activate; non-transactional checkout | guarded; locked; transactional; renewals extend; ownership check on verify |
| "Today" | UTC in some places, IST in others | IST everywhere (`internal/clock`) |
| Scoring | live test marks, client time | frozen marks, server time |
| Login | 3 DB calls/request + goroutine; racy 2-device limit; 429 for every OTP error | 2 reads + throttled write; locked limit; coded errors |
| Admin lists | unbounded | cursor-paginated, 200 cap |
| Errors | two shapes, internal text leaked | one shape with `code`, opaque 500s |
| Schema in prod | GORM AutoMigrate + SQL | SQL only (baseline + migrations); AutoMigrate dev-only |
| Deletes | hand-written cascades | FK `ON DELETE CASCADE` (+ `items.Cleanup` for polymorphic) |
| Reference data | Go seed on every API boot | SQL migration `0005` |
| Boot safety | could start with default secrets | production refuses weak/missing config |
| KYC | admin could re-decide any record; numbers shown in full to user; toggle ignored FE's field | pending-only transitions, masked for user, toggle fixed |
| Cohort stats | included admins | excluded |
