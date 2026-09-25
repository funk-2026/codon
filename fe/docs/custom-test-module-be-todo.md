# Custom Test Module — Backend TODO (handoff to backend owner)

| | |
|---|---|
| **Companion docs** | Feature spec: [custom-test-module.md](custom-test-module.md) (feature IDs `CM-*`, audit findings `A#`, decisions `D#`) · Frontend plan: [custom-test-module-fe-todo.md](custom-test-module-fe-todo.md) |
| **Who does this** | Backend owner. The frontend owner does **not** edit `be/`; this document is the request + the contract the FE builds against. |
| **Grounded against** | `be/` at branch `dev` @ `0cc39f3` (read-only review). File/function names below are real. |
| **Status** | Draft v0.2 — decisions D1–D22 from the spec are the basis. ⚑ items (D19 bookmark categories, D20 rating UX, D22 authoring surface) are pending confirmation and only affect copy/UX, not the schema below. |

---

## 0. How to read this

**Task format:** `- [ ] **BE-<milestone>.<n> · Title** — <size> · deps · unblocks` then acceptance criteria (AC).

**Sizes (rough, one backend dev, includes tests + swagger):** `S` ≈ 1 day · `M` ≈ 2–3 days · `L` ≈ 1 week · `XL` ≈ 2 weeks. These are relative sizing aids, **not commitments** — please re-estimate.

**Priority** is by milestone: M0/M1 gate everything; M2–M3 are the Custom Test MVP + platform features; M4 is "Marrow-class"; M5 are follow-on epics from `notes.md`.

**Progress legend (added during implementation):** `[x]` done and covered by automated tests · `[~]` done with caveats (see *Notes*) · `[ ]` not done / skipped. Each finished task has a **Business overview** (what changed, in plain terms) and **How to test**. Backend tests: `TEST_DATABASE_URL=… go test ./...` (see BE-0.6).

**Global rules for every task** (not repeated below):
1. Swagger annotations + regenerated `docs/` (see BE-0.7).
2. Go tests for new logic (see BE-0.6); no untested selection/scoring code.
3. New tables/columns only via versioned migrations (BE-0.2).
4. Every new list endpoint is cursor-paginated (BE-0.9).
5. Every payload that contains rich text also returns the resolved `media` map (§1.3).
6. Every new tunable lives in `PlatformSetting` (§4), not a constant.
7. Nothing is ever returned to students that includes `correct_option`/`explanation` before the attempt is submitted (or, in tutor mode, after that question is locked + revealed).

---

## 1. Contract summary (what the FE builds against)

### 1.1 Conventions
- Errors: existing `{ "error": "message" }`. New machine-readable errors add `code`: `{ "error": "...", "code": "pool_too_small", "details": {...} }`. FE switches on `code`, never on the message.
- Pagination: `?limit=&cursor=` → `{ items: [...], next_cursor: string|null }`. (Existing list endpoints stay as-is until touched.)
- IDs: UUID strings. Times: RFC 3339 UTC. Money: paise (unchanged).
- Idempotency: `Idempotency-Key` header on `POST /custom-tests` and `POST /reports`.
- Versioning: additive changes only within `/api/v1`. Blueprint and rich-text formats carry their own `schema_version` / `content_format`.

### 1.2 Data model deltas (conceptual — final DDL is the backend owner's)

| Table | Change |
|---|---|
| **`media_assets`** (new) | `id`, `owner_id`, `purpose`, `storage_key`, `display_key`, `thumb_key`, `mime`, `bytes`, `width`, `height`, `sha256`, `alt_text`, `status` (`pending`\|`processing`\|`ready`\|`rejected`), `reject_reason`, `created_at`, `ready_at`. Unique `(owner_id, sha256)`. |
| **`media_refs`** (new) | `media_id`, `owner_type` (`question`\|`brain_hack`\|`wellness`\|`flashcard`\|…), `owner_id`, `field`. PK `(media_id, owner_type, owner_id, field)`. |
| **`questions`** | + `content_format` (`plain` default \| `rich_v1`), `subject_id`, `chapter_id`, `topic_id?`, `difficulty?` (`easy`\|`medium`\|`hard`), `ncert_class?`, `ncert_page?`, `source_type` (`qbank`\|`practice`\|`test_series`\|`pyq`\|`other`), `source_year?`, `source_label?`, `custom_eligible` (default true), `content_hash`, `question_type` (default `mcq_single`), `version` (default 1), `lang` (default `en`), `flag_status` (`active`\|`under_review`\|`retired`). `test_id` stays as the **home test**. |
| **`test_questions`** (new, D1-B) | `test_id`, `question_id`, `position`. PK `(test_id, question_id)`; index `(question_id)`. Source of truth for "which questions are in this test". |
| **`tests`** | + `origin` (`authored` default \| `generated`), `owner_user_id?`, `visibility` (`public` default \| `private`), `blueprint jsonb?`, `blueprint_schema_version?`, `expires_at?`, `archived_at?`; `module_type` gains `custom`. |
| **`student_attempts`** | + `mode` (`exam` default \| `tutor`), `expires_at?` (server deadline), `config_snapshot jsonb`, `attempt_no`, `auto_submitted bool`. |
| **`attempt_answers`** | + `position`, `marked_for_review bool`, `time_spent_seconds?`, `confidence?` (`sure`\|`unsure`\|`guess`), `revealed_at?`. |
| **`student_question_state`** (new) | PK `(user_id, question_id)`; `times_seen`, `times_correct`, `last_result` (`correct`\|`incorrect`\|`unattempted`), `first_seen_at`, `last_seen_at`. (P2 adds SRS: `srs_due_at`, `srs_interval_days`.) |
| **`topics`** (new) | `id`, `chapter_id`, `name`, `order_index`. |
| **`tags`**, **`question_tags`** (new) | `tags(id, slug unique, label, alias_of?)`; `question_tags(question_id, tag_id)`. |
| **`bookmark_collections`**, **`bookmarks`** (new) | `bookmark_collections(id, key, label, order_index, owner_id? (null=system), is_active)`; `bookmarks(id, user_id, item_type, item_id, collection_id, note?, created_at)`, unique `(user_id, item_type, item_id)`. |
| **`content_reports`** (new) | `id`, `reporter_id`, `item_type`, `item_id`, `item_version?`, `reason`, `note?`, `context` (`runtime`\|`review`\|`tutor`), `attempt_id?`, `status` (`open`\|`fixed`\|`no_change`\|`dismissed`), `resolved_by?`, `resolved_at?`, `resolution_note?`, `created_at`. Partial unique on open `(reporter_id, item_type, item_id)`. |
| **`question_revisions`** (new) | `id`, `question_id`, `version_from`, `proposed jsonb`, `reason`, `status` (`pending`\|`approved`\|`rejected`), `rescore bool`, `created_by`, `reviewed_by?`, `reviewed_at?`, `snapshot_before jsonb`. |
| **`ratings`** (new) | `user_id`, `item_type`, `item_id`, `value smallint`, `tags text[]?`, `created_at`, `updated_at`. PK `(user_id, item_type, item_id)`. Aggregates denormalised onto `tests`/`content_items` (`rating_avg`, `rating_count`) or a `rating_stats` table. |
| **`custom_test_presets`** (new) | `id`, `course_id`, `title`, `description`, `blueprint jsonb`, `order_index`, `is_active`. |
| **`custom_test_templates`** (new) | per-user saved blueprints. |
| **`custom_test_requests`** (new) | idempotency store `(user_id, idempotency_key) → test_id`. |
| **`csv_import_batches`** | + `mode` (`validate`\|`commit`\|`update`), `template_version`, `bundle_key?`, `file_sha256`, `parent_batch_id?`. `csv_import_row_errors` + `code`, `field`. |
| **`question_stats`** (new, M4) | `question_id`, `attempts`, `correct`, `avg_time_seconds`, `report_count`, `empirical_difficulty`, `updated_at`. |
| **`admin_audit_log`** (new, M4) | `id`, `actor_id`, `action`, `target`, `before jsonb`, `after jsonb`, `created_at`. |

### 1.3 The `media` map convention (critical)

Any response containing a rich-text field (question stem/options/explanation, brain hack body, …) includes **one** top-level map resolving every `media:<uuid>` reference in that response:

```jsonc
{
  "questions": [
    { "id": "…", "content_format": "rich_v1",
      "question_text": "Identify the structure:\n\n![Cross-section](media:7c1e…)",
      "option_a": "![](media:a1…)", "option_b": "Xylem", … }
  ],
  "media": {
    "7c1e…": { "id": "7c1e…", "url": "https://…signed…", "thumb_url": "https://…signed…",
               "width": 1200, "height": 800, "alt": "Cross-section of a stem" },
    "a1…":   { … }
  }
}
```

- `url` is the **display** variant (≤ 1600 px), `thumb_url` ≤ 400 px. Both presigned GET; TTL = `max(2h, test_duration + 30min)` for attempt payloads.
- Signed URLs change each request; the FE caches by `id`. **Do not** try to make URLs stable.
- A reference to an unknown/not-ready id is never sent to a student; it is a save-time error (BE-1.6).

### 1.4 Endpoint summary

`S` = student · `T` = teacher (own content unless `can_manage_all_content`) · `A` = admin.

| Area | Endpoint | Role | Task |
|---|---|---|---|
| Config | `GET /app-config` (flags, limits, report reasons, rating rules) | any authed | BE-0.8 |
| Media | `POST /media/presign` · `POST /media/:id/complete` · `GET /media/:id` | T/A (authoring purposes) | 1.2, 1.3 |
| Media | `GET /teacher/media` · `PATCH /teacher/media/:id` · `DELETE /teacher/media/:id` | T | 1.7 |
| Questions | `GET /teacher/questions` (paged, filters, `missing=`) · `POST /teacher/tests/:id/questions` · `PATCH /teacher/questions/:id` · `DELETE …` | T | 1.13 |
| Questions | `POST /teacher/questions:bulk-update` · `POST /teacher/questions/check-duplicate` · `GET /teacher/questions/completeness` | T | 1.14, 1.12, 1.15 |
| Import | `GET /teacher/csv-template?version=2` · `POST /teacher/tests/:id/csv-import` (`mode`, `bundle_key`) · `GET /teacher/csv-imports/:id` · `POST /teacher/csv-imports/:id/commit` | T | 1.17–1.20 |
| Corrections | `POST /teacher/questions/:id/corrections` · `GET /teacher/corrections` · `GET /admin/corrections` · `POST /admin/corrections/:id/approve\|reject` | T/A | 2.5 |
| Taxonomy | `GET /tags?q=` · `GET /courses/:id/topics` · admin CRUD for tags/topics | any / A | 1.11 |
| Bookmarks | `GET /me/bookmark-collections` · `PUT /me/bookmarks` · `DELETE /me/bookmarks/:item_type/:item_id` · `GET /me/bookmarks` · `GET /me/bookmarks/ids?item_type=` | S | 2.2 |
| Reports | `POST /reports` · `GET /me/reports` · `GET /teacher/reports` · `POST /teacher/reports/:id/resolve` · `GET /admin/reports` · `POST /admin/reports/:id/resolve\|dismiss\|reassign` | S/T/A | 2.4 |
| Ratings | `PUT /ratings` · `DELETE /ratings/:item_type/:item_id`; `rating_avg/count/my_rating` on tests + content; `sort=rating` | S | 2.6 |
| Custom | `GET /custom-tests/builder-config?course_id=` · `POST /custom-tests/count` · `POST /custom-tests` · `GET /custom-tests` · `GET/PATCH/DELETE /custom-tests/:id` · `POST /custom-tests/:id/regenerate` · `POST /custom-tests/from-attempt/:attempt_id` · templates CRUD | S | 3.x, 4.x |
| Attempts | `POST /tests/:id/attempts` (→ `{attempt(+test), answers[], server_now}`) · `PUT /attempts/:id/answers/:qid` (accepts `null`, `time_spent_seconds`, `marked_for_review`, `confidence`) · `PUT /attempts/:id/answers` (batch) · `POST /attempts/:id/answers/:qid/reveal` · `GET /attempts/:id/result` (+`breakdown`) · `GET /attempts/:id/review?filter=&cursor=` | S | 0.4, 0.5, 3.12–3.14, 4.1, 4.2 |
| Analytics | `GET /me/analytics/mastery\|coverage\|weak-areas\|trend` · `GET /me/recommendations` | S | 4.4, 4.6 |
| Admin | `GET /admin/pool-health` · `GET/PATCH /admin/settings/custom-test` · presets CRUD · `bookmark-collections` PATCH · audit log | A | 3.11, 4.9, 4.10, 2.3 |

### 1.5 Blueprint schema v1 (the heart of the module)

```jsonc
{
  "schema_version": 1,
  "course_id": "uuid",
  "title": "Physics · Thermodynamics · 20Q",       // optional; server can auto-title
  "filters": {
    "subject_ids": ["uuid"], "chapter_ids": ["uuid"], "topic_ids": ["uuid"],
    "difficulty": ["easy","medium","hard"],
    "status": ["unattempted","incorrect","correct","bookmarked"],   // union
    "bookmark_collection_ids": ["uuid"],
    "tag_ids": ["uuid"], "exclude_tag_ids": ["uuid"],
    "source_types": ["qbank","practice","pyq"],
    "ncert": { "class": 11, "page_from": 40, "page_to": 60 },
    "exclude_attempted_within_days": 7
  },
  "count": 20,
  "difficulty_mix": { "easy": 0.3, "medium": 0.5, "hard": 0.2 },   // optional
  "subject_weights": "even" | "proportional" | { "<subject_id>": 0.5 },
  "order": "random" | "syllabus" | "easy_first" | "hard_first" | "unattempted_first",
  "strategy": "random" | "weak_first" | "unseen_first" | "spaced",  // pluggable
  "mode": "exam" | "tutor",
  "timing": { "timed": true, "duration_minutes": 20 },
  "marking": { "preset": "neet" | "no_negative" | "custom", "correct": 4, "wrong": -1 },
  "seed": 12345                                                       // optional
}
```

Unknown fields are ignored; unknown *filter keys inside `filters`* or invalid values → `422 { code: "invalid_blueprint", details: [...] }`. Old `schema_version`s are migrated forward on read.

---

## 2. Milestones & tasks

Legend for the dependency line: `deps` = must be done first; `unblocks` = FE tasks (see FE doc) that cannot ship without it.

### M0 — Foundations (gates everything)

- [~] **BE-0.1 · Verify FE↔BE contract against the *deployed* API** — `S` · deps: none · unblocks: FE-0.8, FE-4.14
  - The FE expects `POST /tests/:id/attempts` → `{ attempt (with `test` preloaded), answers[] }` (`fe/src/api/attempts.ts`, `test-question.tsx`), but the repo's `AttemptHandler.StartAttempt` returns a bare `StudentAttempt` and `ScoringService.GetOrCreateAttempt` never preloads `Test` (spec A28). Either prod is ahead of the repo or the runtime is broken in this checkout.
  - AC: written diff of every endpoint the FE calls vs. actual responses on the deployed instance; repo brought in line with what's deployed (or vice-versa); one contract test per endpoint the runtime uses.
  - **Status:** ⚠️ Partly done
  - **Business overview:** The repo's attempt/test endpoints now return exactly the shapes the mobile app already reads: `POST /tests/:id/attempts` → `{attempt (with test), answers, server_now}`, `GET /tests/:id` → `{test}`, `GET /attempts/:id/result` → `{attempt, breakdown}`. Before, the repo returned bare objects, so the app's runtime could not have worked against this code.
  - **How to test:** Automated: `TestStartAttemptContract` (go test ./internal/router). Manual: start an attempt in Swagger and check `attempt.test.duration_minutes` is present.
  - **Notes / bugs / deviations:** I have no access to the deployed server, so I could NOT diff against production; the alignment is to the app's expectations. Someone with prod access should confirm the deployed responses match. `POST /tests/:id/questions` etc. keep flattened bodies so old app builds still work.

- [~] **BE-0.2 · Versioned SQL migrations (D17)** — `M` · deps: none · unblocks: everything schema-related
  - Today `db.AutoMigrateAll()` runs on **both** `cmd/api` and `cmd/worker` start-up; `db.go` itself notes prod should use `golang-migrate` (spec A29). No `migrations/` dir exists.
  - AC: baseline migration reproducing the current schema; `migrate up` in deploy pipeline (or single-runner with advisory lock); `AutoMigrateAll` removed from prod paths (kept for tests only); rollback tested on staging copy; documented in `be/README.md`.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Database changes are now versioned: SQL files in `internal/db/migrations` are applied in order, once each, under a Postgres advisory lock (safe with two API replicas), and recorded in `schema_migrations`. The worker no longer migrates — it waits for the API to finish (`WaitForSchema`). Backfills (question metadata, `test_questions`, per-student state) run as migrations.
  - **How to test:** `go test ./internal/db` (migrations idempotent, backfill correctness). Start the API twice against an empty DB: second start logs no `[migrate] applied` lines.
  - **Notes / bugs / deviations:** Deviation: I did NOT replace GORM AutoMigrate with a hand-written baseline of the existing schema — I can't see the production DDL, so a guessed baseline could drift. AutoMigrate still creates table/column structure (API process only); versioned SQL owns indexes, partial-unique indexes, backfills. Used a small in-repo runner instead of the golang-migrate library (which is only an indirect dependency).

- [x] **BE-0.3 · Input/enum validation hardening (CM-S8)** — `S` · deps: none
  - `CreateTest` casts `req.ModuleType` straight into the enum with no validation (A12). Add a small `internal/validate` helper: enum membership (`module_type` incl. `custom`, `status`, `difficulty`, `source_type`), UUID lists ≤ bound, string length caps.
  - AC: invalid `module_type` → 400 `invalid_module_type`; table-driven tests.
  - **Status:** ✅ Done
  - **Business overview:** Bad input is now refused with a clear machine code instead of being stored: unknown/`custom` module types, negative or absurd durations, empty/oversized titles, invalid enums (difficulty, source type, confidence), oversized id lists.
  - **How to test:** POST /teacher/tests with `module_type: custom` or `banana` → 400 `invalid_module_type` (`TestCreateTestValidationAndFreeFlag`); `internal/validate` helpers covered in `TestValidateAndPaginationHelpers`.
  - **Notes / bugs / deviations:** BUG FIXED while testing: creating a test/content item with `requires_subscription: false` silently stored `true` (GORM replaces a false bool on a `default:true` column with the default). Every 'free' test/content created through the API was actually paid. Fixed in `CreateTest` and `CreateContent`; existing rows created before the fix may still be wrongly paid — worth a one-off data check.

- [x] **BE-0.4 · Attempt endpoint hardening** — `M` · deps: BE-0.1 · unblocks: FE-0.8, FE-4.15, FE-4.14
  - `UpsertAnswer` must verify `question_id` belongs to the attempt's test (A10) — today it accepts any UUID and `GetReview` will then return that question's key.
  - Accept `selected_option: null` to **clear** (A8); accept and persist `time_taken_seconds` (A7, currently dropped by `upsertAnswerRequest`).
  - `GetReview` gets an explicit `ORDER BY` question position (A11) and only returns rows for the attempt's questions.
  - `StartAttempt` returns `{ attempt (with test), answers[], server_now }`.
  - AC: tests for foreign-question upsert (403/422), clear answer, ordering; existing FE runtime works unchanged.
  - **Status:** ✅ Done
  - **Business overview:** Answers are safer and richer: an answer can only be saved for a question that belongs to that attempt's test (previously any question id was accepted, leaking its answer key in review); sending `selected_option: null` clears an answer (previously a 400, so the app's 'Clear response' never worked); `time_spent_seconds` is stored (previously dropped); marking for review never wipes the chosen option; review is ordered by question position and can be filtered/paginated.
  - **How to test:** `TestAnswerLifecycleAndScoring`; in Swagger: PUT /attempts/{id}/answers/{qid} with a question from another test → 422 `invalid_question`; `{selected_option:null}` clears; GET review?filter=wrong.
  - **Notes / bugs / deviations:** Older app builds send `time_taken_seconds`; still accepted as an alias.

- [x] **BE-0.5 · Server-authoritative timer + auto-submit (A6)** — `M` · deps: BE-0.2, BE-0.4 · unblocks: FE-4.14
  - Set `student_attempts.expires_at = started_at + duration` when the test is timed; return `expires_at` + `server_now` (lets the FE correct clock skew).
  - Reject `UpsertAnswer` after `expires_at + grace` (setting `attempt.answer_grace_seconds`, default 10) with `409 { code: "attempt_expired" }`.
  - Recurring **`attempt_autosubmit`** job: worker currently only runs enqueued jobs (`jobs.EnqueueJob`, `maxAttempts=30`, 1-min backoff) — add a self-rescheduling sweeper (every 60 s) that submits expired in-progress attempts (`auto_submitted=true`).
  - Only attempts that carry `expires_at` are affected — existing untimed tests and old in-flight attempts behave as before.
  - AC: attempt killed mid-test is auto-submitted within ~90 s of deadline; score computed from saved answers; idempotent (double-run safe).
  - **Status:** ✅ Done
  - **Business overview:** Timed tests now have a server-enforced deadline. The attempt carries `expires_at` and the start response carries `server_now` (so the app can correct for a wrong phone clock). Late answers are refused (409 `attempt_expired`, 10 s grace) and the attempt is scored from what was saved. A worker sweeper submits abandoned timed attempts every 60 s, so killing the app can't leave a test open forever.
  - **How to test:** `TestServerEnforcedDeadlineAndAutoSubmit`, `TestSweeperSubmitsAbandonedTimedAttempts`. Manual: start a 1-minute test, wait, try to answer → 409; result shows `auto_submitted: true`.
  - **Notes / bugs / deviations:** Only attempts that have `expires_at` are affected, so old in-flight attempts and untimed tests behave as before. Resuming an already-expired attempt returns 409 `attempt_expired` with the attempt id (the app should show the result).

- [x] **BE-0.6 · Go test harness** — `M` · deps: BE-0.2
  - Repo has only `role_test.go` and `subscription_service_test.go`. Add: ephemeral Postgres for tests (docker-compose or testcontainers), fixtures/factories (course→subject→chapter→test→questions→users), CI job.
  - AC: `go test ./...` runs green in CI against a real Postgres; factory helpers used by all later tasks.
  - **Status:** ✅ Done
  - **Business overview:** There is now a real-database test harness: tests run against Postgres, with factories (course → subject → chapter → tests/questions → users per role) and full HTTP-level route tests. Tests skip themselves if `TEST_DATABASE_URL` is not set.
  - **How to test:** `docker run -d -p 55432:5432 -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=codon_test postgres:16-alpine` then `TEST_DATABASE_URL=postgres://test:test@127.0.0.1:55432/codon_test?sslmode=disable go test ./...`
  - **Notes / bugs / deviations:** No CI config exists in the repo, so nothing was wired into CI — add `go test ./...` with a Postgres service to your pipeline.

- [~] **BE-0.7 · Swagger/contract pipeline** — `S` · deps: none
  - `docs/docs.go`, `swagger.json/yaml` are generated; make regeneration a CI check so the FE can trust the spec.
  - AC: CI fails if annotations and generated docs diverge.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Swagger docs (`docs/`) were regenerated from the new annotations and now include the media, teacher-question, CSV, app-config and attempt endpoints.
  - **How to test:** Open `/swagger/index.html`. Regenerate with `go run github.com/swaggo/swag/cmd/swag@v1.16.6 init -g cmd/api/main.go -o docs --parseInternal --parseDependency`.
  - **Notes / bugs / deviations:** No CI check that fails when docs are stale (no CI in repo). I regenerate the docs again at the end of the backend work.

- [x] **BE-0.8 · Typed settings helper + `GET /app-config`** — `M` · deps: BE-0.2 · unblocks: FE-0.4
  - Wrap `PlatformSetting` (key/value, already used for `kyc_required`) with typed getters + 30 s cache; generalise the admin write path beyond `PATCH /admin/settings/kyc-required`.
  - `GET /app-config` (any authed user) returns: feature flags (`custom_test.enabled`, `custom_test.tutor_mode`, `custom_test.status_filters`, `bookmarks.enabled`, `reports.enabled`, `ratings.enabled`, `rich_content.math`), limits (`media.max_bytes`, allowed mimes), report reasons list, rating rules, bookmark collection labels.
  - AC: flags default **off** when a key is missing; response cacheable (`ETag`).
  - **Status:** ✅ Done
  - **Business overview:** Every tunable now lives in platform settings with a typed, cached reader and a registry of defaults (feature flags default OFF). `GET /app-config` gives the app its flags, limits, report reasons, rating rules and bookmark-collection labels, with an ETag. Admins change settings via `GET/PATCH /admin/settings/custom-test`; every change is validated and written to an audit log.
  - **How to test:** `TestAppConfigFlagsDefaultOffAndEtag`. Manual: PATCH `{values:{"custom_test.enabled":"true"}}` as admin, then GET /app-config as a student → flag is true within the request.
  - **Notes / bugs / deviations:** Settings cache is 30 s per process (invalidated immediately on the process that writes), so other replicas can lag by up to 30 s.

- [x] **BE-0.9 · Cursor pagination helper** — `S` · deps: none
  - AC: shared `Paginate(query, limit, cursor)` (keyset on `(created_at,id)` or caller-provided sort); max limit 100; tests.
  - **Status:** ✅ Done
  - **Business overview:** A shared cursor-pagination helper (stable under new inserts) is used by every new list endpoint; page size defaults to 25 and is capped at 100.
  - **How to test:** `GET /teacher/questions?limit=3` then follow `next_cursor` (`TestTeacherBrowseFiltersCompletenessAndBulkUpdate`).

### M1 — Media, rich content, question metadata, teacher authoring backend

- [x] **BE-1.1 · `media_assets` + `media_refs` models & migration** — `S` · deps: BE-0.2 · unblocks: FE-1.11
  - Schema per §1.2. AC: migrations up/down; indexes on `(owner_id, created_at)`, `(sha256)`.
  - **Status:** ✅ Done
  - **Business overview:** Uploaded images are tracked as `media_assets` (owner, purpose, size, dimensions, content hash, alt text, status) and `media_refs` records which content uses which image.
  - **How to test:** `go test ./internal/router -run Media`.

- [x] **BE-1.2 · `POST /media/presign`** — `M` · deps: BE-1.1, BE-0.8 · unblocks: FE-1.11, FE-2.6
  - Today `Presign` only allows purposes `kyc_document`, `video`, `csv`, `profile_photo` (A23). Add a **purpose registry** with per-purpose role, mime allowlist and size cap: `question_image`, `explanation_image`, `brain_hack_image`, `wellness_image`, `flashcard_image`, `note_image`, `import_bundle` (zip). Leave the existing `/uploads/presign` untouched for video/CSV/KYC.
  - Request `{ purpose, file_name, content_type, bytes, sha256? }`; response `{ media_id, upload_url, headers, expires_in }`; creates a `pending` row; key `media/<purpose>/<user>/<uuid>.<ext>` (lower-cased).
  - Limits from settings: jpeg/png/webp only, ≤ 5 MB (default), **SVG rejected**. Sign `Content-Length` + `Content-Type` in the PUT — **verify R2 honours signed headers**; if not, rely on BE-1.3 to delete violators.
  - Rate limit: e.g. 200 presigns/user/hour; per-teacher storage quota (setting).
  - AC: wrong role/purpose/mime/size → 400 with `code`; stub path when `storage.Client == nil` mirrors existing behaviour.
  - **Status:** ✅ Done
  - **Business overview:** Teachers/admins can request an upload slot for question, explanation, Brain Hack, flashcard (and admin-only wellness/home) images. The server enforces role per purpose, JPEG/PNG/WebP only (SVG refused), max size (5 MB default), per-hour rate limit and a per-user storage quota — all editable settings. The signed upload URL only accepts exactly the declared size.
  - **How to test:** `TestMediaPresignRulesAndRoles`. Swagger: POST /media/presign as a student with `question_image` → 403 `purpose_forbidden`.
  - **Notes / bugs / deviations:** The existing `/uploads/presign` (video/CSV/KYC/profile) is unchanged. Not verified against real Cloudflare R2: whether R2 honours the signed Content-Length must be checked on staging; the server-side check in 'complete' catches oversize files either way.

- [x] **BE-1.3 · `POST /media/:id/complete`** — `M` · deps: BE-1.2 · unblocks: FE-1.11
  - HEAD the object; enforce real size; **sniff** magic bytes (don't trust `Content-Type`); `image.DecodeConfig` to read width/height *before* full decode (decompression-bomb guard: reject > 4096 px longest side or > ~24 MP); compute sha256 by streaming.
  - Dedupe: same `(owner_id, sha256)` already `ready` → return the existing asset and delete the new object.
  - Enqueue `media_process`; response `{ media }` with `status: processing|ready`.
  - AC: spoofed `Content-Type`, oversized, 8000×8000, corrupt file, and SVG-renamed-to-png each rejected with a distinct `code` and the object deleted.
  - **Status:** ✅ Done
  - **Business overview:** After uploading, `POST /media/{id}/complete` verifies the file itself: real size, real image type by magic bytes (a text file renamed .png is rejected and deleted), dimension cap (4096 px) and corrupt-file detection. A byte-identical re-upload by the same person returns the existing asset instead of a duplicate.
  - **How to test:** `TestMediaRejectsBadUploadsAndDeletesTheObject`, `TestMediaDuplicateUploadReturnsExistingAsset`.

- [x] **BE-1.4 · `media_process` job — variants, EXIF strip** — `M` · deps: BE-1.3
  - Apply EXIF orientation, **strip EXIF/GPS** (phone photos), generate display (≤ 1600 px) and thumbnail (≤ 400 px) variants, store `display_key`/`thumb_key`, set `ready`.
  - Variant format is the backend owner's call: pure-Go JPEG/PNG (no cgo; keep PNG when alpha) vs. WebP via libvips/cgo (smaller, needs Dockerfile change). The contract only promises RN-decodable image bytes at `url`.
  - AC: 4032×3024 JPEG → ≤ 1600 px display in < 2 s; EXIF absent in outputs; failed processing → `rejected` with reason; job retried per existing worker semantics.
  - **Status:** ✅ Done
  - **Business overview:** Every accepted image gets a display version (max 1600 px) and a thumbnail (max 400 px). Phone-photo rotation (EXIF orientation) is applied and all metadata including GPS location is stripped by re-encoding. Transparent diagrams stay PNG; photos become JPEG; small images are never enlarged.
  - **How to test:** `TestMediaCompleteBuildsVariantsAndStripsMetadata`, `TestMediaAppliesExifOrientation`.
  - **Notes / bugs / deviations:** Deviation: processing runs inline inside 'complete' (fast enough for ≤5 MB) rather than as a queued job; a `media_process` job handler exists for re-processing. Pure-Go JPEG/PNG output (no cgo/WebP encoding) — no Dockerfile change needed.

- [x] **BE-1.5 · Media resolver service** — `M` · deps: BE-1.4 · unblocks: FE-1.7, FE-1.8
  - `ResolveMedia(ctx, ids []uuid, ttl) map[uuid]MediaView` — one batched query + local presigning (like `resolveContentURL`, but batched); `ExtractMediaRefs(fields ...string) []uuid`.
  - AC: 90-question payload with 200 images resolves in a single DB query and < 50 ms signing; TTL parameterised.
  - **Status:** ✅ Done
  - **Business overview:** Any response that contains rich text now carries one `media` map (id → signed URL, thumbnail URL, width, height, alt) built with a single database query per response; URLs live at least as long as the test (duration + 30 min, minimum 2 h).
  - **How to test:** GET /tests/{id}/questions during an attempt with an image question (`TestStudentQuestionPayloadHidesAnswersAndResolvesMedia`).

- [x] **BE-1.6 · Reference tracking + save-time validation** — `M` · deps: BE-1.5, BE-1.9
  - On create/update of any rich-text owner: parse `media:` refs from all fields; require each media to exist, be `ready`, be owned by the author (or author has manage-all / is admin) and have a compatible `purpose`; replace the `media_refs` set in the same transaction.
  - AC: unknown/not-ready/foreign id → `422 { code: "invalid_media_ref", details: [{field, id}] }`; ref set updated on edit/delete; max images per question and per field enforced (settings, default 6 / 2).
  - **Status:** ✅ Done
  - **Business overview:** When a teacher saves content that references an image, the server checks the content is valid and every referenced image exists, is ready, belongs to that teacher (or the teacher can manage all content) and is the right kind. Bad references return 422 `invalid_media_ref` naming the field and image. The set of images used by each question is tracked.
  - **How to test:** `TestQuestionAuthoringWithImagesAndMetadata` (foreign and unknown media refused; refs recorded).

- [x] **BE-1.7 · Media library endpoints** — `S` · deps: BE-1.5 · unblocks: FE-1.12, FE-2.6
  - `GET /teacher/media` (mine, cursor, `?unreferenced=true`), `PATCH /teacher/media/:id` (alt text), `DELETE` (409 `media_in_use` if referenced).
  - **Status:** ✅ Done
  - **Business overview:** Teachers have a media library: list their images (optionally only unused ones), set alt text, and delete an image only if nothing uses it (409 `media_in_use` otherwise).
  - **How to test:** `TestMediaLibraryDeleteBlockedWhileReferenced`.

- [x] **BE-1.8 · Orphan media GC job** — `S` · deps: BE-1.6
  - `pending` > 24 h and never completed, or unreferenced `ready` > 7 d → delete objects + rows. AC: dry-run mode + metrics.
  - **Status:** ✅ Done
  - **Business overview:** A worker job every 6 hours removes uploads that were never completed (>24 h) and images nothing references (>7 days), including their stored files. A dry-run mode reports what would go.
  - **How to test:** `TestContentHashBackfillAndMediaGC`.

- [x] **BE-1.9 · `internal/richtext` package + `content_format`** — `L` · deps: BE-0.2 · unblocks: FE-1.2, FE-1.3, FE-2.4
  - Implements the **rich-text v1** grammar (spec D12): paragraphs, bold/italic, sub/sup, lists, line breaks, `$…$` / `$$…$$` math markers, images `![alt](media:<uuid>)`. **No raw HTML, no links, no other URL schemes.**
  - Provides: `Validate(text) []Issue`, `ExtractMediaRefs`, `PlainText(text)` (search/notifications/stats), `Normalize(text)` (for content hash).
  - `questions.content_format` column: existing rows = `plain` (never re-parsed); create/update writes `rich_v1`.
  - Length caps (settings; defaults: stem 4000, option 1000, explanation 6000 chars).
  - **Shared golden vectors:** repo-level `contracts/rich-text-v1/grammar.md` + `vectors.json` (`input → normalized AST/plain text/refs/issues`) consumed by **both** Go tests and FE Jest tests, so the two parsers can't drift.
  - AC: 100 % of vectors pass; fuzz test (no panics on arbitrary input); `<script>`/`javascript:`/`data:` never survive validation.
  - **Status:** ✅ Done
  - **Business overview:** There is one shared 'rich text v1' format for question stems/options/explanations: bold/italic, subscript/superscript (H~2~O, x^2^), lists, inline and block math markers, and images `![alt](media:<id>)`. It is a closed subset — no HTML or links — validated on every save (length caps, image counts). Existing questions are marked `plain` and are never reinterpreted, so a stray `$` or `*` in old text is safe. The grammar and 33 golden test vectors live in `contracts/rich-text-v1` and will be reused by the app's parser.
  - **How to test:** `go test ./internal/richtext` (vectors + a 20 000-input fuzz that must never panic).
  - **Notes / bugs / deviations:** Deviation: the max stem/option/explanation lengths are enforced by settings (defaults 4000/1000/6000).

- [x] **BE-1.10 · Question metadata migration (spec D.1 / CM-Q1..Q6)** — `M` · deps: BE-0.2 · unblocks: FE-2.4, FE-2.5
  - Columns per §1.2. Backfill: `subject_id`/`chapter_id` from parent test where non-null; `source_type` from parent `module_type`; `custom_eligible = true`; `content_hash` (BE-1.12). `difficulty` stays NULL for legacy rows (that's what the quick-tag queue fixes).
  - Indexes: `(chapter_id, difficulty, custom_eligible, flag_status)`, `(subject_id)`, GIN on tags via join table, `(content_hash)`.
  - AC: migration idempotent; row counts before/after match; `EXPLAIN` on the builder's candidate query uses the composite index.
  - **Status:** ✅ Done
  - **Business overview:** Questions now carry their own metadata: subject, chapter, topic, difficulty, NCERT class/page, source (Q Bank/Practice/Test Series/previous-year) + year, custom-test eligibility, content hash, version, language and a moderation flag. Existing questions inherit subject/chapter/source from their parent test; difficulty stays empty until tagged.
  - **How to test:** `TestBackfillTestQuestionsAndMetadata` (db package). Swagger: POST /teacher/tests/{id}/questions with `difficulty`, `ncert_page`, `source_year`.

- [x] **BE-1.11 · Topics + tags** — `M` · deps: BE-1.10 · unblocks: FE-2.5
  - `topics` (per chapter) with admin CRUD; `tags` with normalised slug (`lower`, trim, collapse spaces, strip `#`) and `alias_of` so `#NEET`/`#neet` collapse; `GET /tags?q=` autocomplete (top 20, prefix + trigram).
  - AC: creating a tag that matches an existing slug returns the existing tag; admin merge re-points `question_tags`.
  - **Status:** ✅ Done
  - **Business overview:** Topics (finer than chapters) and tags exist. Tags are normalised (`#NEET  Bio` = `neet-bio`), searchable by prefix (`GET /tags?q=`), and admins can rename, merge (the merged tag becomes an alias so future input lands on the canonical tag) or delete unused tags.
  - **How to test:** `TestTagsAndTopicsTaxonomy`.

- [x] **BE-1.12 · Content hash + duplicate detection** — `M` · deps: BE-1.9, BE-1.10 · unblocks: FE-2.7
  - `content_hash = sha256(Normalize(stem) + "\x1f" + Normalize(A..D) + attached-media sha256s)`. Same image uploaded twice hashes equal via `media_assets.sha256`.
  - `POST /teacher/questions/check-duplicate` and `warnings: [{ code: "possible_duplicate", question_id, similarity }]` on create/update/import. **Warn only** — no unique constraint (near-duplicates across courses are legitimate). Generation dedupes by hash regardless (BE-3.5).
  - AC: identical text differing only in whitespace/case/markdown → same hash; different option order → different hash.
  - **Status:** ✅ Done
  - **Business overview:** Duplicate questions are detected by a content hash that ignores case, spacing and markup (and treats the same image uploaded twice as one). Saving, importing or calling `POST /teacher/questions/check-duplicate` returns warnings listing matching questions; nothing is blocked. Legacy questions get their hashes computed automatically at API start.
  - **How to test:** `TestQuestionAuthoringWithImagesAndMetadata` (duplicate warning), `TestContentHashBackfillAndMediaGC`.

- [x] **BE-1.13 · Teacher question CRUD + list** — `L` · deps: BE-1.6, BE-1.10, BE-1.11, BE-1.12 · unblocks: FE-2.3, FE-2.4
  - Extend `AddQuestion`/`UpdateQuestion` request/response with rich fields, metadata, `tags: []`, `warnings`, `media` map. Keep the existing edit rule (only when parent test is `draft`/`rejected`); published edits go through corrections (BE-2.5).
  - New `GET /teacher/questions`: cursor-paged; filters `course_id, subject_id, chapter_id, difficulty, tag_id, test_id, eligible, flag_status, reported=true, missing=difficulty|chapter|tags|ncert|alt_text, q=` (ILIKE on `PlainText`; `pg_trgm` index P1); scope = own unless `can_manage_all_content`/admin (reuse `canManageAllTests`).
  - Each row: question (rich fields), `media` map (thumbnails only for list), parent test summary, report count.
  - AC: 10 k-question teacher lists in < 300 ms; ownership enforced (tests for cross-teacher access); `total_questions` kept consistent (currently maintained by `UpdateColumn` expressions).
  - **Status:** ✅ Done
  - **Business overview:** Teachers get a question-bank workspace: `GET /teacher/questions` lists all their questions across tests with search, filters (course, subject, chapter, difficulty, tag, test, eligible, flag status, reported, missing metadata) and cursor paging; create/update accept the rich text, images, metadata and tags. Live (published) questions can't have their content edited directly (409 `question_locked` — corrections flow, BE-2.5) but their metadata can, with an audit entry.
  - **How to test:** `TestTeacherBrowseFiltersCompletenessAndBulkUpdate`, `TestPublishGateAndLiveQuestionRules`.
  - **Notes / bugs / deviations:** Text search uses ILIKE on the raw stored text (no pg_trgm index yet) — fine for thousands of questions, add a trigram index if the bank grows large. Response of create/update stays a flat question (plus `warnings` and `media`) so older app builds keep working.

- [x] **BE-1.14 · Bulk update** — `M` · deps: BE-1.13 · unblocks: FE-2.11
  - `POST /teacher/questions:bulk-update { ids (≤200), patch: { chapter_id, subject_id, difficulty, tags_add[], tags_remove[], custom_eligible, move_to_test_id } }`, all-or-nothing transaction, per-id ownership check, response lists per-id outcome.
  - Metadata-only patches are allowed on published questions (they don't change what students see) and are audited; content changes are not.
  - AC: mixed-ownership request rejected entirely; audit rows written.
  - **Status:** ✅ Done
  - **Business overview:** Bulk edit: up to 200 questions can get a new chapter/subject, difficulty, tags added/removed, eligibility toggled, or be moved into another draft test — all-or-nothing. If any id isn't yours nothing changes (403 `not_owner`).
  - **How to test:** `TestTeacherBrowseFiltersCompletenessAndBulkUpdate`.
  - **Notes / bugs / deviations:** Route is `POST /teacher/questions/bulk-update` (a colon in a gin route path is treated as a parameter, so `questions:bulk-update` was not usable).

- [x] **BE-1.15 · Completeness endpoint** — `S` · deps: BE-1.13 · unblocks: FE-2.10
  - `GET /teacher/questions/completeness?course_id=` → counts of missing `difficulty|chapter|topic|tags|ncert|alt_text` grouped by chapter. AC: matches `missing=` list counts exactly.
  - **Status:** ✅ Done
  - **Business overview:** `GET /teacher/questions/completeness` shows, per chapter, how many questions are missing difficulty, topic, tags, NCERT page or image alt text — the numbers match the `missing=` list filter exactly. This drives the quick-tag backfill of the existing pool.
  - **How to test:** `TestTeacherBrowseFiltersCompletenessAndBulkUpdate`.

- [x] **BE-1.16 · Publish gate (D16)** — `S` · deps: BE-1.10 · unblocks: FE-2.12
  - `SubmitForReview` for `qbank`/`practice`: every question needs `chapter_id` + `difficulty` (chapter inherited from the test at create time if null); ≥ 1 question; all attached media `ready`. Test Series exempt.
  - AC: `422 { code: "incomplete_questions", details: { missing: [{question_id, fields[]}] } }`.
  - **Status:** ✅ Done
  - **Business overview:** Submitting a Q Bank or Practice test for review now requires every question to have a chapter and a difficulty (and all its images ready). Otherwise 422 `incomplete_questions` lists exactly which question is missing which field. Test Series are exempt.
  - **How to test:** `TestPublishGateAndLiveQuestionRules`.

- [x] **BE-1.17 · CSV import v2 — schema + `validate` mode** — `L` · deps: BE-1.10, BE-1.11, BE-1.12 · unblocks: FE-2.9
  - Today's `CSVImportService.ProcessCSVReader` requires `question_text, option_a–d, correct_option`, treats `explanation` as optional, inserts row-by-row, and reports a single `error_message` per row (A25). Extend with: `subject, chapter, topic, difficulty, ncert_class, ncert_page, tags` (pipe-separated), `source_type, source_year, custom_eligible, question_id` (update mode), and image columns `question_image, option_a_image … option_d_image, explanation_image` (+ optional `*_alt`).
  - `mode=validate` performs the full parse + validation (columns, enums, chapter resolution by id **or** name, duplicate check, image presence) and stores results **without inserting**; `mode=commit` (or `POST …/commit`) applies only if the file hash is unchanged.
  - `template_version=1` (current columns) keeps working untouched.
  - Row errors get `code` + `field` (`MISSING_COLUMN`, `BAD_ENUM`, `UNKNOWN_CHAPTER`, `MISSING_IMAGE`, `IMAGE_TOO_LARGE`, `DUPLICATE_IN_FILE`, `POSSIBLE_DUPLICATE`, …).
  - Cap rows per import (setting, default 2000); commit in chunks inside transactions so a failure doesn't leave half a file.
  - AC: 2 000-row validate < 30 s; commit is idempotent (replay does not double-insert); v1 template regression test.
  - **Status:** ✅ Done
  - **Business overview:** CSV import v2: new optional columns for subject/chapter/topic (by name or id), difficulty, NCERT class/page, tags (`a|b`), source type/year, eligibility and image columns. A **validate** run parses everything and reports row-level problems without inserting anything; **commit** applies it. Legacy v1 files keep working and stay plain text. Errors carry a code and field (MISSING_FIELD, BAD_ENUM, UNKNOWN_CHAPTER, MISSING_IMAGE, DUPLICATE_IN_FILE, …) and warnings (possible duplicates) are reported separately.
  - **How to test:** `TestCSVv1LegacyImportStaysPlainText`, `TestCSVv2ZipPreflightThenCommit`, `TestCSVCommitRefusesChangedFile`.
  - **Notes / bugs / deviations:** BUG FIXED: the old importer let any teacher import into any test id, and into published tests. It now requires ownership and a draft/rejected test, and file keys must be under the caller's own upload folder. Commits run row-by-row (a bad row is skipped and reported), not as one transaction.

- [x] **BE-1.18 · CSV import — ZIP bundle with images** — `L` · deps: BE-1.17, BE-1.4
  - Upload purpose `import_bundle` (application/zip, ≤ 100 MB default). Bundle = `questions.csv` + `images/<filename>`. Worker streams the zip (**zip-slip protection, entry-count and total-uncompressed-size caps, compression-ratio check** for zip bombs), runs each image through the BE-1.3/1.4 validation+processing path, creates `media_assets` (owner = importing teacher), maps `filename → media_id`, and rewrites cells into `![alt](media:id)` (stem/explanation: appended on a new line after the text; options: text and/or image).
  - Also supports a plain CSV whose image columns reference **already-uploaded** library media by filename.
  - AC: missing file → row error `MISSING_IMAGE:<name>`; unreferenced images listed as warnings; malicious zip (`../`, bomb) rejected; whole flow works in `validate` mode without creating permanent assets (temp assets GC'd).
  - **Status:** ✅ Done
  - **Business overview:** A ZIP bundle (questions.csv + images) can be uploaded. The server unzips it safely (no path tricks, file-count/size/compression-ratio limits), validates each image like a normal upload, and turns `question_image`/`option_a_image`/… file names into images inside the questions. Images not found in the ZIP are looked up in the teacher's media library by file name; missing ones are listed by name.
  - **How to test:** `TestCSVv2ZipPreflightThenCommit`, `TestCSVRejectsMaliciousZipAndForeignFiles`.
  - **Notes / bugs / deviations:** Validate mode stores nothing (no temporary assets are created at all).

- [x] **BE-1.19 · CSV import — update / metadata-backfill mode** — `M` · deps: BE-1.17
  - `mode=update`: match by `question_id` (or `content_hash` as fallback), update **metadata only** by default (`difficulty, chapter, topic, tags, ncert, source, custom_eligible`); content changes require an explicit `allow_content_update` and only on draft/rejected tests.
  - AC: 500-row backfill updates without touching text; unmatched rows reported.
  - **Status:** ✅ Done
  - **Business overview:** Update mode backfills metadata on existing questions from a CSV, matched by `question_id` (or by content). Text is never changed unless explicitly allowed and the test is still a draft.
  - **How to test:** `TestCSVUpdateModeBackfillsMetadataOnly`.

- [x] **BE-1.20 · `GET /teacher/csv-template?version=2`** — `S` · deps: BE-1.17 · unblocks: FE-2.9
  - Returns columns, required flag, allowed values, an example row and short descriptions so the FE stops hard-coding `COLUMNS` (currently in `csv-upload.tsx`).
  - **Status:** ✅ Done
  - **Business overview:** `GET /teacher/csv-template?version=2` returns the columns, whether required, allowed values and an example row, so the app no longer hard-codes the column list.
  - **How to test:** `TestCSVRejectsMaliciousZipAndForeignFiles` (template assertion).

- [x] **BE-1.21 · Adopt the media resolver in every student/teacher/admin question payload** — `M` · deps: BE-1.5, BE-1.9 · unblocks: FE-1.7, FE-1.8, FE-1.9
  - `GetQuestions`, `GetReview`, `TeacherGetTest`, `AdminGetTest` (and later bookmarks/custom endpoints) include `content_format` + the `media` map. For `plain` questions the map is simply empty.
  - AC: existing authored tests' JSON is a strict superset of today's; snapshot tests.
  - **Status:** ✅ Done
  - **Business overview:** Every payload that shows question content (student questions during an attempt, review, teacher/admin test detail, single question responses) now includes `content_format` and the `media` map. For legacy plain questions the map is empty and the text is untouched.
  - **How to test:** `TestStudentQuestionPayloadHidesAnswersAndResolvesMedia` (also asserts correct answers/explanations never appear before submit).

### M2 — Bookmarks, Reports, Corrections, Ratings

- [x] **BE-2.1 · Polymorphic item registry** — `M` · deps: BE-0.2 · unblocks: BE-2.2, 2.4, 2.6
  - `internal/items`: `Resolve(item_type, id) → {exists, visible_to(user), owner_id, course_id, home_test_id?}` for `question`, `test`, `content`, (later `flashcard_deck`, `brain_hack`). Bookmarks, reports and ratings all authorise through it — one copy of the logic.
  - AC: table-driven tests per item type; unknown type → 400.
  - **Status:** ✅ Done
  - **Business overview:** One shared lookup (`internal/items`) decides whether a question/test/content item exists, who authored it, and whether a student has actually been shown it. Bookmarks, reports and ratings all use it, so the rules are identical everywhere.
  - **How to test:** Exercised by all bookmark/report/rating tests (`social_test.go`).

- [x] **BE-2.2 · Bookmarks** — `L` · deps: BE-2.1, BE-1.21 · unblocks: FE-3.1, FE-3.2, FE-3.3
  - Tables per §1.2; migration seeds 3 system collections (**⚑ placeholder keys `revise_later`, `doubts`, `important` — replace once D19 is confirmed; labels come from data**).
  - `PUT /me/bookmarks` (idempotent upsert; moves between collections), `DELETE`, `GET /me/bookmarks` (filters `collection_id, item_type, subject_id, chapter_id, q`, cursor), `GET /me/bookmarks/ids?item_type=question` → `{ [collection_id]: [item_id] }` (compact, for the FE's in-memory set).
  - **Anti-scrape rule:** a student can bookmark a question only if they have been *exposed* to it (an `attempt_answers` row exists in any of their attempts). `GET /me/bookmarks` returns `correct_option`/`explanation` **only** for questions from a *submitted* attempt (or revealed in tutor mode); otherwise stem + options only.
  - AC: non-exposed question → `403 not_exposed`; duplicate PUT is a no-op; deleting a collection (admin) reassigns bookmarks to a default.
  - **Status:** ✅ Done
  - **Business overview:** Students can bookmark questions (and content) into one of three admin-labelled collections. `PUT /me/bookmarks` is idempotent and can move a bookmark between collections; `GET /me/bookmarks` lists them (filters: collection, type, subject, chapter, text; cursor paging); `GET /me/bookmarks/ids` gives the compact id sets the app keeps in memory. Security rules: a student can only bookmark a question they were actually shown (403 `not_exposed`), and the answer key/explanation appear in the bookmark list only after they submitted that attempt or revealed it in tutor mode. The attempt review now marks `bookmarked` per question and supports `filter=bookmarked`.
  - **How to test:** `TestBookmarksFlow`. In Swagger: bookmark a question id you never attempted → 403; answer it in an attempt, bookmark it, GET /me/bookmarks (no `correct_option`), submit, GET again (key present).
  - **Notes / bugs / deviations:** Collection names are placeholders (`revise_later`, `doubts`, `important`) pending your confirmation (decision D19); they are editable data (BE-2.3).

- [x] **BE-2.3 · Admin bookmark-collection config** — `S` · deps: BE-2.2 · unblocks: FE-3.9
  - `GET/PATCH /admin/bookmark-collections` (label, order, active). AC: audit row.
  - **Status:** ✅ Done
  - **Business overview:** Admins can list, rename, reorder and deactivate the system bookmark collections. Deactivating one moves its bookmarks to the first remaining active collection; the last active one can't be deactivated. Changes are audit-logged.
  - **How to test:** `TestBookmarksFlow` (admin part). `PATCH /admin/bookmark-collections/{id}` `{label, is_active}`.

- [x] **BE-2.4 · Reports** — `L` · deps: BE-2.1 · unblocks: FE-3.4, FE-3.5, FE-2.14, FE-3.8
  - `POST /reports { item_type, item_id, reason, note?, context, attempt_id? }` with reasons `wrong_answer | typo_unclear | duplicate | outdated | image_issue | other` (D21), note ≤ 300 chars, rejected without exposure (same rule as bookmarks), one **open** report per `(reporter, item)`, rate limit (e.g. 30/day).
  - Routing: author inbox `GET /teacher/reports`, `POST /teacher/reports/:id/resolve { status, note }`; admin `GET /admin/reports` (status/reason/course filters), `resolve|dismiss|reassign`; reporter `GET /me/reports`.
  - **Auto-hold:** when distinct reporters with reasons in `reports.auto_hold_reasons` (default `wrong_answer,image_issue`) ≥ `reports.auto_hold_threshold` (default 3) → `questions.flag_status = under_review` (excluded from *custom generation* immediately via BE-3.5; existing tests unaffected); cleared on resolve.
  - Reasons list is delivered via `/app-config` so a new reason needs no app release.
  - AC: concurrency-safe threshold (two simultaneous reports don't skip it); reporter sees resolution state.
  - **Status:** ✅ Done
  - **Business overview:** Students can report a question (wrong answer, typo/unclear, duplicate, outdated, image missing/unreadable, other) with an optional ≤300-char note. Reporting the same question twice returns the existing report (no spam); reporters can only report what they've seen; there is a daily limit (30 default). The author gets an in-app notification; teachers see an inbox (`/teacher/reports`), admins a queue with filters, assign-to-teacher, dismiss and resolve. **Auto-hold:** when 3 different students report a question as wrong-answer/image-problem (configurable) it is flagged `under_review` and stops being picked for custom tests (existing tests are unaffected); resolving reports below the threshold lifts the hold. The reporter is notified with the outcome and can see it in `GET /me/reports`.
  - **How to test:** `TestReportsAutoHoldAndResolution`, `TestReportRateLimit`.
  - **Notes / bugs / deviations:** The threshold check locks the question row so two simultaneous reports can't both miss it. Notifications are stored in-app rows now; push delivery arrives with BE-5.6.

- [x] **BE-2.5 · Corrections for published questions (D18, A26)** — `XL` · deps: BE-1.13, BE-2.4 · unblocks: FE-2.13, FE-3.8
  - `POST /teacher/questions/:id/corrections { proposed (content/metadata patch), reason, rescore }` → `question_revisions` row `pending`. Auto-approved when actor is admin or `can_manage_all_content`; otherwise `GET /admin/corrections` + `approve|reject`.
  - Apply (transactional): snapshot before-state; update fields + media refs; `version++`; recompute `content_hash`; invalidate builder-config cache.
  - `rescore=true` and `correct_option` changed → enqueue **`rescore_question`** job: for every *submitted* attempt containing the question (via `test_questions`), recompute `is_correct`, `marks_awarded`, attempt `score/correct/wrong/unattempted`, `student_question_state`, `question_stats`. Idempotent, chunked, audited.
  - AC: correcting a key with rescore fixes historic scores exactly once; without rescore, historic results unchanged; reporter of the linked report is notified state (`fixed`).
  - **Status:** ✅ Done
  - **Business overview:** Live (published) questions can finally be corrected. A teacher proposes a correction (new text/options/answer/explanation, mandatory reason, optional 're-score past attempts'). Admins and platform-wide teachers are applied immediately; others go to an admin queue where it can be approved/rejected (the teacher is notified). Applying: bumps the question version, recomputes its content hash, validates images against the author, closes open reports as 'fixed' (reporters notified) and lifts any hold. If the answer key changed and re-score was requested, a background job recalculates every submitted attempt containing that question (scores, correct/wrong counts, the student's per-question state) — safe to run repeatedly. Without re-score, historical results never change.
  - **How to test:** `TestCorrectionsApplyRescoreAndResolveReports`: student answered B (+4); key corrected to C with re-score → the attempt becomes −1 after the job runs.
  - **Notes / bugs / deviations:** Drafts can't use corrections (409 `question_editable`); only one pending correction per question.

- [x] **BE-2.6 · Ratings** — `L` · deps: BE-2.1 · unblocks: FE-3.6, FE-3.7
  - `PUT /ratings { item_type, item_id, value, tags? }` / `DELETE`; per-type validation registry (**⚑ D20:** `test|content|flashcard_deck|note` → 1–5; `question` → −1/+1); **no free text**.
  - Eligibility: test → has a *submitted* attempt; content → watch progress ≥ 60 % or completed (`UserWatchHistory`); question → exposure. Errors `403 not_eligible`.
  - Aggregates kept in the same transaction (or a trigger); list/detail payloads of tests and content gain `rating_avg, rating_count, my_rating`; `ListTests` and `GetChapterContent` gain `sort=rating`.
  - AC: rating twice updates rather than inserts; average matches a from-scratch recompute test.
  - **Status:** ✅ Done
  - **Business overview:** Ratings: stars 1–5 for tests, videos/documents, Brain Hacks and flashcard decks; thumbs (−1/+1) for a question's explanation. Only after the student actually did the thing (submitted the test, watched ≥60 s or completed the video — documents are always eligible — or saw the question), otherwise 403 `not_eligible`. Rating again updates. No free text (tags come from a fixed list). Tests and content now show `rating_avg`, `rating_count` and the caller's `my_rating`; tests list supports `sort=rating`, chapter content lists support `sort=rating` and return `my_ratings`.
  - **How to test:** `TestRatingsEligibilityAndAggregates`.
  - **Notes / bugs / deviations:** Aggregates are recomputed from scratch on every rating change (cannot drift). Stars-vs-thumbs is my proposal (decision D20 awaiting your confirmation).

- [x] **BE-2.7 · Cleanup hooks** — `S` · deps: BE-2.2, 2.4, 2.6
  - Deleting/archiving an item removes or archives its bookmarks/ratings/reports. Note `DeleteTest` currently hard-deletes attempts and questions in one transaction — extend it (and never reuse it for generated tests).
  - **Status:** ✅ Done
  - **Business overview:** Deleting a question or a (draft) test now also removes its bookmarks, reports, ratings, notes, stats and tags so nothing dangles; `items.Cleanup` is the shared helper.
  - **How to test:** Covered by the existing draft-test delete path + `DeleteQuestionCascade`.
  - **Notes / bugs / deviations:** The old `DeleteTest` hard-deletes attempts — deliberately NOT used for generated tests (they are archived instead, BE-3.9).

### M3 — Custom Test MVP (generation + runtime)

- [x] **BE-3.1 · Decouple questions from tests — `test_questions` (D1-B)** — `XL` · deps: BE-0.2, BE-0.6, BE-1.21 · unblocks: everything below
  - Create `test_questions`; backfill from `questions.test_id` (`position = order_index`). **Dual-write** on `AddQuestion`, CSV import, `DeleteQuestion`, `DeleteTest`. Then switch reads behind a flag: `GetQuestions`, `ScoringService.SubmitAttempt` (loads questions via join), `GetReview`, `TeacherGetTest`, `AdminGetTest`, `total_questions` maintenance, progress SQL.
  - A parity job compares join vs. legacy counts nightly until the flag is permanent.
  - AC: with the flag on, **every existing endpoint's response is byte-identical** for authored tests (golden-file tests recorded before the change); rollback = flip the flag.
  - **Status:** ✅ Done
  - **Business overview:** A question no longer belongs to just one test: tests list their questions through a membership table (`test_questions`, with position), so a generated custom test can reuse existing questions without copying them. The migration backfills every existing question; every write path (add, import, delete, move, delete-test) keeps it in sync, and every read (student questions, scoring, review, teacher/admin detail) goes through it. A setting `test_questions.read_via_join` flips reads back to the legacy link instantly if anything looks wrong, and `CheckTestQuestionParity` reports any drift.
  - **How to test:** `TestReadSwitchAndParity`; every existing-module router test (attempts, publish gate, CSV) runs on the new read path.
  - **Notes / bugs / deviations:** I did not record golden files of the OLD responses before changing them (no access to production data); instead the old behaviours are covered by the router tests. Test membership for questions is by home test only (D1-B).

- [x] **BE-3.2 · `tests` columns + visibility rules** — `M` · deps: BE-3.1
  - `origin`, `owner_user_id`, `visibility`, `blueprint`, `blueprint_schema_version`, `expires_at`, `archived_at`; `module_type='custom'` valid.
  - **Every existing list/aggregate must exclude `origin='generated'`:** `TestHandler.ListTests`, `GetTest`, curriculum `test_count`, teacher/admin lists, moderation counts, `admin.go` dashboard counts, progress queries as appropriate (A4).
  - Owner check on `GetTest`, `GetQuestions`, `POST /tests/:id/attempts` when `visibility='private'`.
  - AC: a generated test never appears in any other user's response (test with two users); public endpoints unchanged.
  - **Status:** ✅ Done
  - **Business overview:** Tests now have an `origin` (authored / generated), owner, visibility (public / private), stored blueprint, mode, expiry and archive time; `module_type: custom` is valid. Generated tests are private to their owner and never appear in any shared list: student test list, curriculum test counts, teacher and admin lists, admin dashboard counts. Other students get 404 on it, on its questions and on starting an attempt.
  - **How to test:** `TestGenerationCreatesAPrivateFrozenTest` (checks /tests, /tests?module_type=custom, /teacher/tests, other user's GET/attempt).
  - **Notes / bugs / deviations:** BUG FIXED: a `marks_per_wrong` of 0 was silently stored as -1 (GORM default) — both for generated 'no negative marking' tests and for teachers creating tests with 0 negative marks via the API. CreateTest now writes the real marks back.

- [x] **BE-3.3 · `student_question_state`** — `L` · deps: BE-3.1
  - Upsert inside `SubmitAttempt`'s transaction for every question in the attempt (authored + generated); backfill migration from historic `attempt_answers` (chunked, resumable).
  - AC: totals reconcile with a from-scratch aggregate over `attempt_answers`; 100 k-row backfill completes without long locks.
  - **Status:** ✅ Done
  - **Business overview:** The server remembers, per student and question, how many times they saw/answered/got it right, the last answered result (correct/incorrect) and when they last answered it. This powers 'only questions I got wrong', 'only unattempted', 'skip what I did recently', weak-area detection and the review screen. It is updated inside the submit transaction and backfilled from history by the migration.
  - **How to test:** `TestAnswerLifecycleAndScoring` (state after submit), `TestStatusFiltersUseStudentHistoryAndBookmarks`.
  - **Notes / bugs / deviations:** Design choice: a skipped question counts as 'seen' but not 'answered', so it still counts as unattempted (matches how students think of 'unused').

- [x] **BE-3.4 · Blueprint schema v1 + validator (`internal/blueprint`)** — `M` · deps: BE-0.8
  - Per §1.5; bounds from settings (`custom_test.max_questions`, allowed durations, marking presets); auto-title; forward-migration hook.
  - AC: JSON-schema doc published in `be/docs`; golden valid/invalid fixtures shared with FE (`contracts/blueprint-v1/`).
  - **Status:** ✅ Done
  - **Business overview:** The blueprint (what the student asked for) is a versioned, validated JSON document: filters, count, difficulty mix, subject weights, order, strategy, fallback, mode, timing, marking preset, seed. Unknown top-level fields are ignored (forward compatible), unknown filter keys and newer schema versions are rejected, and all limits come from admin settings. 20 golden vectors in `contracts/blueprint-v1` are shared with the app.
  - **How to test:** `go test ./internal/blueprint`.

- [x] **BE-3.5 · Selection engine (`internal/generation`)** — `L` · deps: BE-3.1, BE-3.3, BE-3.4, BE-1.12, BE-2.2
  - Strategy interface `Select(ctx, Request) (Selection, error)`; ship `random`. Candidate set = questions where: home/joined test is `published` **and** `origin='authored'`; `source_type ∈ eligible_sources` (setting; **default `qbank,practice,pyq`, not `test_series`** — D2); `custom_eligible`; `flag_status='active'`; course matches; entitlement filter (BE-3.6); blueprint filters (status filters via `student_question_state` / `bookmarks`).
  - **Dedupe by `content_hash`** (one per hash). Difficulty mix + subject weighting with a **recorded fallback policy** (`fail | borrow_adjacent | fewer`) — the response lists every relaxation applied (CM-G4); never silent.
  - Determinism: seeded PRNG; **do not use `ORDER BY random()`** on the full pool — fetch candidate ids (capped, e.g. 50 k) then sample in Go.
  - AC: property tests (count respected, no duplicates, seed reproducible); p95 < 500 ms on a 100 k-question pool (BE-3.18).
  - **Status:** ✅ Done
  - **Business overview:** The selection engine picks questions server-side. Pool = questions from published, non-generated tests of the course, with an allowed source (default Q Bank, Practice, previous-year — NOT Test Series), marked custom-eligible, not held for review, matching the student's filters (subject/chapter/topic, difficulty, tags in/out, NCERT page range, status = unattempted/incorrect/correct/bookmarked, skip-recent). Duplicates (same content hash) appear once. Difficulty mix and subject weights (even/proportional/custom) are honoured with largest-remainder rounding; when a bucket is short the gap is borrowed AND reported as a relaxation — never silent. Strategies: random, unseen_first, weak_first, spaced. A seed makes a selection reproducible.
  - **How to test:** `TestSeedIsDeterministicAndMixIsHonoured`, `TestShortBucketsAreBorrowedAndReportedNeverSilent`, `TestSubjectWeightingAndDedupe`, `TestStatusFiltersUseStudentHistoryAndBookmarks`.
  - **Notes / bugs / deviations:** Performance: the first version fetched the whole pool and was ~3.4 s p95 on 100 k questions; ranking + sampling now happens in SQL (per subject/difficulty bucket, seeded hash) so only a few hundred rows return. `spaced` ranks by due date but nothing schedules reviews yet (BE-4.16).

- [x] **BE-3.6 · Entitlement for mixed pools (D5)** — `M` · deps: BE-3.5
  - Paid subscribers: any eligible question in their subscribed course(s). Free: only questions whose home test has `requires_subscription=false`; `custom_test.free_max_questions` (default 10) and `custom_test.free_daily_generations` (default 3, counted per **IST** calendar day). Admin bypass as in `SubscriptionService.CheckAccess`; honour `kyc_required`.
  - AC: free user never receives a paid question (test); over-quota → `403 { code: "quota_exceeded", details: { limit, resets_at } }`; subscription expiring mid-attempt doesn't kill the in-progress attempt but blocks new generation.
  - **Status:** ✅ Done
  - **Business overview:** Access rules for mixed pools: admins and paying subscribers (with approved KYC when the platform requires it) draw from the whole course; everyone else is on the free tier — only questions from free-flagged tests, at most 10 questions per test (admin setting) and 3 custom tests per day (IST calendar day). Over the limit → 403 `quota_exceeded` with `resets_at`; a request for more than the free max is clamped and reported (`free_tier_clamp`). A subscription that lapses mid-attempt doesn't kill the attempt.
  - **How to test:** `TestFreeTierClampQuotaAndPaidPool`.

- [x] **BE-3.7 · `POST /custom-tests/count` (dry run)** — `M` · deps: BE-3.5 · unblocks: FE-4.6
  - Same pipeline, nothing persisted. Returns `{ available, feasible_count, by_subject[], by_difficulty[], bottleneck: { filter, reason, counts }, suggestions: [{ code, label, patch }] }` — `suggestions` are ready-to-apply blueprint patches ("use 4", "include medium", "include attempted") so the FE stays dumb.
  - Rate limit (e.g. 60/min/user).
  - AC: p95 < 300 ms; suggestions verified to actually increase `available`.
  - **Status:** ✅ Done
  - **Business overview:** `POST /custom-tests/count` is the builder's live 'N questions match' call: same pool query, nothing saved. It returns matches by subject and difficulty, the requested vs feasible count, the free-tier clamp, the tightest filter ('Hard is the tightest filter: 3 match, 15 without it') and ready-to-apply suggestions ('Use 3', 'Include all difficulty levels') — each verified to actually increase the match count. Rate-limited (60/min/user).
  - **How to test:** `TestPoolTooSmallExplainsAndSuggests`. On a 100 000-question pool: 288 ms unloaded (`LOAD_TEST=1`).

- [x] **BE-3.8 · `POST /custom-tests` (generate)** — `L` · deps: BE-3.2, BE-3.5, BE-3.6 · unblocks: FE-4.8
  - Validates blueprint, runs the engine, creates `Test(origin=generated, module_type=custom, visibility=private, status=published, owner=user)` + `test_questions` rows; snapshots `marks_per_correct/wrong`, `duration_minutes`, `mode`, `blueprint`; returns `{ test, relaxations[] }`.
  - `Idempotency-Key` via `custom_test_requests`; caps: active generated tests per user (default 50), `expires_at` = +30 d if never started.
  - Errors: `pool_too_small` (with the same `suggestions`), `quota_exceeded`, `invalid_blueprint`, `not_entitled`.
  - AC: generated tests work through the **unchanged** `POST /tests/:id/attempts` → questions → answers → submit path; retry with same key returns the same test.
  - **Status:** ✅ Done
  - **Business overview:** `POST /custom-tests` generates the test: validates the blueprint, applies entitlement/quotas, selects, and creates a private test (module `custom`) with its questions frozen in order, plus marks, duration, mode and the blueprint (with the seed). The response lists any relaxations. An `Idempotency-Key` header makes a retried request return the same test (200 instead of 201). Errors: `invalid_blueprint` (field-level issues), `pool_too_small` (available count, bottleneck, suggestions), `quota_exceeded`, `rate_limited`, `too_many_tests`. The generated test runs through the unchanged attempt endpoints.
  - **How to test:** `TestGenerationCreatesAPrivateFrozenTest`, `TestIdempotencyRegenerateListRenameAndArchive`.

- [x] **BE-3.9 · Generated-test list/get/rename/archive** — `M` · deps: BE-3.8 · unblocks: FE-4.11
  - `GET /custom-tests` (mine; state derived: `not_started | in_progress | completed`; last score; blueprint summary), `GET /custom-tests/:id`, `PATCH` (title), `DELETE` (**soft** — set `archived_at`; attempts and stats preserved).
  - AC: other users get 404 (not 403) to avoid leaking existence.
  - **Status:** ✅ Done
  - **Business overview:** My custom tests: list (with derived state not_started/in_progress/completed, attempt count, last attempt and a one-line summary, filters + paging), detail (blueprint + attempts), rename, and delete = archive (hidden, but attempts and analytics are kept; an open attempt is submitted first). Non-owners get 404, not 403.
  - **How to test:** `TestIdempotencyRegenerateListRenameAndArchive`.

- [x] **BE-3.10 · `GET /custom-tests/builder-config`** — `L` · deps: BE-3.4, BE-3.6, BE-1.10, BE-1.11 · unblocks: FE-4.3, FE-4.4
  - Returns everything the generic builder renders (spec CM-E2/E3), scoped to `course_id` and to *this user's entitlement*: subject → chapter → topic tree with **eligible question counts**, difficulty levels (+counts), supported status filters, allowed sources, top tags, limits (min/max count, durations), modes enabled, marking presets, system presets (BE-3.11), feature flags, `schema_version`.
  - Cache per `(course, entitlement_tier)` for ~5 min; invalidate on question publish/correction.
  - AC: adding a filter server-side needs no FE release if it uses an existing widget type; response < 200 ms warm.
  - **Status:** ✅ Done
  - **Business overview:** `GET /custom-tests/builder-config?course_id=` gives the app everything the builder needs so new filters don't need an app release: subject → chapter → topic tree with eligible-question counts (for this student's entitlement), difficulty counts, status filters and whether they're enabled, allowed sources, popular tags, limits, modes (tutor only if enabled), marking presets, orders/strategies, system presets, remaining free quota and flags.
  - **How to test:** `TestBuilderConfigTemplatesAndAdminPresets`.
  - **Notes / bugs / deviations:** Cached 60 s per (course, entitlement tier) instead of 5 min; preset changes invalidate immediately, question publication/correction relies on the 60 s TTL.

- [x] **BE-3.11 · System presets** — `S` · deps: BE-3.4 · unblocks: FE-4.7, FE-5.12
  - `custom_test_presets` + admin CRUD; delivered inside `builder-config`. Seed: "Daily 20", "Chapter sprint", "PYQ only", "NEET 45 min" (names are data).
  - **Status:** ✅ Done
  - **Business overview:** System presets are data: 'Daily 20', 'Weak areas', 'Chapter sprint', 'PYQ only' (all courses) and 'NEET 45 min' (NEET course) are seeded; admins can list, create, edit, deactivate, delete them (validated like a student's blueprint; audit-logged) and they show up in builder-config immediately.
  - **How to test:** `TestBuilderConfigTemplatesAndAdminPresets` (also generates/counts with every seeded preset).

- [x] **BE-3.12 · Runtime payload updates** — `M` · deps: BE-3.1, BE-1.21, BE-0.5
  - Attempt stores `mode` + `config_snapshot`; `GET /tests/:id/questions` returns via join with `position`, `content_format`, `media` map (TTL per §1.3); `attempt_no` numbering.
  - AC: authored tests unchanged; generated tests return only their questions.
  - **Status:** ✅ Done
  - **Business overview:** Attempts now store the mode (exam/tutor), a config snapshot (marks, duration, question count), the attempt number and a server deadline; the questions payload comes through the membership table with `position`, `content_format` and the media map (URLs valid for the whole test).
  - **How to test:** `TestGenerationCreatesAPrivateFrozenTest`, `TestStartAttemptContract`.

- [x] **BE-3.13 · Scoring on join + result breakdown** — `L` · deps: BE-3.3, BE-3.12
  - `ScoringService.SubmitAttempt` loads questions via `test_questions`; updates `student_question_state`, `daily_activity` (streak). `GET /attempts/:id/result` adds `breakdown: { subjects[], chapters[], difficulty[] }` (accuracy = correct ÷ attempted, plus attempted/total — D9) computed from **question-level** metadata.
  - AC: identical scores to today for authored tests; breakdown sums reconcile with totals.
  - **Status:** ✅ Done
  - **Business overview:** Scoring reads questions through membership, updates the student's question state and daily streak, and `GET /attempts/{id}/result` returns a breakdown by subject, chapter and difficulty from question-level metadata (accuracy = correct ÷ attempted, plus totals and marks). Submitting a custom test counts toward the streak (previously only video heartbeats did).
  - **How to test:** `TestAnswerLifecycleAndScoring`, `TestGenerationCreatesAPrivateFrozenTest`.

- [x] **BE-3.14 · Review v2** — `M` · deps: BE-3.13, BE-2.2
  - `GET /attempts/:id/review?filter=all|correct|wrong|unattempted|marked|bookmarked&cursor=`; ordered by `position`; each item: rich fields + `media`, `question_meta` (subject/chapter/difficulty/ncert), `bookmarked`, `reported_by_me`, `my_rating`. Only for submitted attempts.
  - **Status:** ✅ Done
  - **Business overview:** Review v2: ordered by question position, filterable (all/correct/wrong/unattempted/marked/bookmarked), cursor-paginated when `limit` is given, and each item carries subject/chapter/difficulty/NCERT, bookmarked, reported-by-me, my rating, marked-for-review, time spent, confidence and (when ≥30 students attempted it) the cohort '% got this right'.
  - **How to test:** `TestAnswerLifecycleAndScoring`, `TestBookmarksFlow`, `TestRatingsEligibilityAndAggregates`.

- [x] **BE-3.15 · Progress analytics fix (A9)** — `M` · deps: BE-3.13 · unblocks: FE-4.21
  - `GetProgressBreakdown` currently joins via `tests.subject_id`; move to question-level subject. **Remove the hard-coded Physics/Chemistry/Botany/Zoology fallback** (return `[]`) — it leaks a NEET assumption and fake data (CM-E11).
  - AC: cross-subject custom tests contribute to each subject's accuracy.
  - **Status:** ✅ Done
  - **Business overview:** Progress analytics now use each question's own subject (so cross-subject custom tests count toward every subject they touch), divide by answered questions only, can be segmented with `?module=custom|qbank|…`, and the trend is the LAST 10 scores oldest→newest. When there is no data the endpoint returns empty lists instead of a fake Physics/Chemistry/Botany/Zoology and ten zeros.
  - **How to test:** `TestProgressBreakdownUsesQuestionSubjectsAndNeverFabricates`.
  - **Notes / bugs / deviations:** BUGS FIXED: (1) the trend returned the FIRST 10 attempts ever, not the latest; (2) accuracy was divided by all answer rows including unattempted ones, understating it; (3) fabricated placeholder subjects/zeros. NOTE FOR THE APP: empty `subjects`/`trend` arrays are now possible — screens must show an empty state.

- [x] **BE-3.16 · Retake vs. regenerate (D4)** — `S` · deps: BE-3.8
  - `POST /custom-tests/:id/regenerate` (same blueprint, new seed → new test); retake = new attempt on same test (works today since only *in-progress* attempts are unique); `attempt_no` increments.
  - **Status:** ✅ Done
  - **Business overview:** 'Retake' = start another attempt on the same generated test (numbered `attempt_no` 1, 2, …); 'New set' = `POST /custom-tests/{id}/regenerate` runs the stored blueprint again with a fresh seed and returns a new test.
  - **How to test:** `TestIdempotencyRegenerateListRenameAndArchive`.

- [~] **BE-3.17 · Observability** — `M` · deps: BE-3.8
  - Metrics/logs: generation latency, empty-pool rate, relaxation rate, quota rejections, autosubmit count, media processing time/failures, report auto-holds.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Generation latency, relaxation and empty-pool counters are collected in-process (slow generations are logged) and exposed with DB-derived 24-hour figures — generated tests, auto-submitted attempts, rejected uploads, questions held under review, open reports — at `GET /admin/custom-test/metrics`.
  - **How to test:** `TestBuilderConfigTemplatesAndAdminPresets` (metrics shape). Manual: GET /admin/custom-test/metrics as admin.
  - **Notes / bugs / deviations:** Counters are per process (reset on restart, not aggregated across replicas) and there is no Prometheus exporter — wire the endpoint or logs into your monitoring.

- [~] **BE-3.18 · Load & correctness test** — `M` · deps: BE-3.8
  - Synthetic pool 100 k questions; 1 000 concurrent generations; assert p95 targets, no duplicates, no paid leakage to free users.
  - **Status:** ⚠️ Partly done
  - **Business overview:** An opt-in load test seeds 100 000 questions and runs 100 generations at 20 concurrent. Result on a laptop-class Docker Postgres with no tuning: unloaded generation **190 ms**, count **288 ms** (both within budget). Under 20-way concurrency p50 1.3 s / p95 2.2 s because every request scans the same pool on one DB.
  - **How to test:** `LOAD_TEST=1 go test ./internal/router -run GenerationLoad -v`.
  - **Notes / bugs / deviations:** Honest gap: the 500 ms p95 target holds unloaded, not at 20 concurrent generations on this hardware. If exam-time bursts are expected, add a read replica or a precomputed per-course eligible-question table. The test asserts the unloaded budget only.

### M4 — "Marrow-class"

- [x] **BE-4.1 · Tutor-mode reveal** — `M` · deps: BE-3.12 · unblocks: FE-4.16
  - `POST /attempts/:id/answers/:qid/reveal` → `{ correct_option, explanation (+media), is_correct, marks }`; only when `attempt.mode='tutor'` and an answer exists; sets `revealed_at`; subsequent upserts for that question → 409 `answer_locked`. In `exam` mode → 403.
  - **Status:** ✅ Done
  - **Business overview:** Tutor mode: `POST /attempts/{id}/answers/{qid}/reveal` shows the correct option and explanation (with images) for ONE question after the student has chosen an answer, then locks that answer. Exam-mode attempts can never reveal (403 `not_tutor_mode`); revealing before answering is refused (409 `answer_required`); a locked answer can't be changed (409 `answer_locked`). Tutor mode is only offered when the `custom_test.tutor_mode` flag is on.
  - **How to test:** `TestTutorRevealRules`.

- [x] **BE-4.2 · Mark-for-review, confidence, time, batch sync** — `M` · deps: BE-0.4 · unblocks: FE-4.14, FE-4.15
  - Persist `marked_for_review`, `confidence`, `time_spent_seconds`; `PUT /attempts/:id/answers` batch (array with client `answered_at`, last-write-wins, idempotent) for offline recovery.
  - **Status:** ✅ Done
  - **Business overview:** Per-answer extras are stored: mark for review, confidence (sure/unsure/guess), time spent. `PUT /attempts/{id}/answers` batch-syncs up to 200 answers for offline recovery — an older client timestamp never overwrites a newer server answer, and one bad item never fails the batch.
  - **How to test:** `TestBatchSyncLastWriteWins`, `TestAnswerLifecycleAndScoring`.

- [x] **BE-4.3 · "Practise my mistakes"** — `S` · deps: BE-3.8 · unblocks: FE-4.18
  - `POST /custom-tests/from-attempt/:attempt_id { include: wrong|unattempted|both, mode, timing }` → generation with fixed question ids (still applies entitlement + eligibility).
  - **Status:** ✅ Done
  - **Business overview:** 'Practise my mistakes': `POST /custom-tests/from-attempt/{attempt_id}` makes a new custom test from the wrong and/or unattempted questions of a submitted attempt (options: wrong / unattempted / both). Held or ineligible questions are skipped; entitlement still applies.
  - **How to test:** `TestStatusFiltersUseStudentHistoryAndBookmarks`.

- [x] **BE-4.4 · Analytics endpoints** — `L` · deps: BE-3.3, BE-3.13 · unblocks: FE-5.4
  - `/me/analytics/mastery` (per chapter/topic: attempted, accuracy, last practised, bucket), `/coverage` (seen/total), `/weak-areas` (thresholds from settings, recency-weighted, min N), `/trend?module=`. Add a materialised rollup if the joins get slow.
  - **Status:** ✅ Done
  - **Business overview:** Learning analytics for the student: **mastery** per chapter (questions answered, accuracy, last practised, bucket weak/improving/strong/not_enough_data), **coverage** (distinct questions seen ÷ eligible, per subject), **weak areas** (weakest first, each with a one-tap blueprint), **trend** (score % of the last N attempts, optionally per module). Thresholds and minimum sample size are admin settings.
  - **How to test:** `TestWeakFirstAndUnseenFirstStrategiesAndAnalytics`. Swagger: GET /me/analytics/mastery|coverage|weak-areas|trend.

- [x] **BE-4.5 · Strategies: `weak_first`, `unseen_first`** — `M` · deps: BE-3.5, BE-4.4 · (`spaced` → BE-4.16)
  - **Status:** ✅ Done
  - **Business overview:** Selection strategies `unseen_first` (never-answered questions first) and `weak_first` (chapters where the student's accuracy is lowest first) work alongside `random` and `spaced`, ranked in SQL.
  - **How to test:** `TestWeakFirstAndUnseenFirstStrategiesAndAnalytics`.

- [x] **BE-4.6 · `GET /me/recommendations`** — `M` · deps: BE-4.4 · unblocks: FE-5.5
  - Rule-based: weakest topic with ≥ N answers → suggested blueprint patch.
  - **Status:** ✅ Done
  - **Business overview:** `GET /me/recommendations` returns up to 3 rule-based suggestions with a blueprint the app can pre-fill: strengthen the weakest chapter, revise what's due, or (for new students) start with fresh questions.
  - **How to test:** `TestWeakFirstAndUnseenFirstStrategiesAndAnalytics`, `TestSpacedRepetitionSchedulesAndRanksDueFirst`.

- [x] **BE-4.7 · Question stats rollup** — `L` · deps: BE-3.13 · unblocks: FE-2.18, FE-5.10
  - Incremental on submit + nightly reconcile; `question_stats` (attempts, correct, avg time, report count, empirical difficulty); `GET /teacher/questions/:id/stats`; outlier flags (< 20 % / > 95 % correct with n ≥ 50).
  - **Status:** ✅ Done
  - **Business overview:** Cohort statistics per question (attempts, correct, average time, open reports, empirical difficulty from real accuracy) are updated on every submit, rebuilt from raw data after corrections, and empirical difficulty is refreshed nightly (≥50 answers). Teachers see them at `GET /teacher/questions/{id}/stats` — hidden until enough students answered — with outlier flags `low_accuracy` (<20% with ≥50 answers, likely a wrong key) and `too_easy` (>95%).
  - **How to test:** `TestQuestionStatsCohortAndTeacherView`.

- [x] **BE-4.8 · Cohort "% got this right" on review items** — `S` · deps: BE-4.7
  - Only when `attempts ≥ 30`; never per-person data (CM-S6).
  - **Status:** ✅ Done
  - **Business overview:** Review items show 'x% of students got this right' only when at least 30 students (setting) answered the question, and never any per-person data.
  - **How to test:** `TestQuestionStatsCohortAndTeacherView`.

- [x] **BE-4.9 · Pool health** — `M` · deps: BE-1.10 · unblocks: FE-5.13, FE-2.15
  - `GET /admin/pool-health` (eligible counts by course/subject/chapter/difficulty, metadata completeness, reported/under-review, low-inventory alerts with a configurable floor) and teacher-scoped `GET /teacher/inventory`.
  - **Status:** ✅ Done
  - **Business overview:** Pool health for admins (`GET /admin/pool-health`): per chapter, eligible questions with easy/medium/hard split, questions missing topic/tags/NCERT page/difficulty, questions under review, open reports and a low-inventory alert below a configurable floor (30). Teachers get `GET /teacher/inventory`: the chapters that most need questions, fewest first, with how many are theirs.
  - **How to test:** `TestPoolHealthInventoryAndNotes`.

- [x] **BE-4.10 · Admin settings API + audit log** — `M` · deps: BE-0.8 · unblocks: FE-5.11
  - Typed `GET/PATCH /admin/settings/custom-test`; every admin mutation (settings, presets, collections, tags, corrections) writes `admin_audit_log`.
  - **Status:** ✅ Done
  - **Business overview:** Admins change the tunables (flags, limits, sources, free-tier caps, report thresholds…) via `GET/PATCH /admin/settings/custom-test`; values are validated by type and every change is written to `admin_audit_log` with before/after.
  - **How to test:** `TestAppConfigFlagsDefaultOffAndEtag`.

- [x] **BE-4.11 · Tags & topics admin** — `M` · deps: BE-1.11 · unblocks: FE-5.14 — merge/alias/delete with re-pointing.
  - **Status:** ✅ Done
  - **Business overview:** Admin tag and topic management: rename, merge (source becomes an alias so future input resolves to the target), delete unused; topics per chapter.
  - **How to test:** `TestTagsAndTopicsTaxonomy`.

- [x] **BE-4.12 · Personal templates** — `S` · deps: BE-3.4 · unblocks: FE-5.3
  - `custom_test_templates` CRUD (cap ≈ 30/user).
  - **Status:** ✅ Done
  - **Business overview:** Students can save a blueprint as a template (max 30), rename/replace it, delete it and run it later; templates are validated like a generation request and are private.
  - **How to test:** `TestBuilderConfigTemplatesAndAdminPresets`.

- [x] **BE-4.13 · Retention & deletion** — `M` · deps: BE-3.9
  - GC never-started generated tests past `expires_at`; account-deletion hooks for bookmarks/notes/templates/generated tests; retention settings.
  - **Status:** ✅ Done
  - **Business overview:** Daily housekeeping (worker): expired custom tests that were never started are archived; read notifications older than 90 days are deleted. For account erasure, `POST /admin/users/{id}/purge-personal-data` deletes a user's study data (bookmarks, notes, ratings, reports, templates, generated tests and their attempts, question state, flashcard state, video notes, push tokens, notifications) while keeping the account, payments and authored content; it is audit-logged.
  - **How to test:** `TestRetentionAndPersonalDataPurge`.
  - **Notes / bugs / deviations:** The app has no self-service 'delete my account' flow, so the purge is an admin action only.

- [x] **BE-4.14 · Personal question notes (CM-T12, P2)** — `M` · deps: BE-2.1 — `question_notes(user, question, body rich_v1, media)`; exposure rule as bookmarks.
  - **Status:** ✅ Done
  - **Business overview:** Students can keep a private note on any question they've seen (`PUT/GET/DELETE /me/question-notes`, ≤4000 characters); notes show up in the review screen (`my_note`).
  - **How to test:** `TestPoolHealthInventoryAndNotes`.
  - **Notes / bugs / deviations:** Images in notes are rejected for now (400 `images_not_supported`).

- [x] **BE-4.15 · Multi-device attempt lock (CM-S9)** — `M` · deps: BE-0.4 · unblocks: FE-4.17
  - Track `active_session_id` on the attempt; writes from another session → `409 { code: "attempt_active_elsewhere" }` unless `takeover=true`.
  - **Status:** ✅ Done
  - **Business overview:** An attempt is bound to the login session that started it. Opening it on a second device returns `active_elsewhere: true`; writes and submit from that device get 409 `attempt_active_elsewhere` until `POST /attempts/{id}/takeover` moves it. The timeout sweeper ignores the lock.
  - **How to test:** `TestMultiDeviceLockAndTakeover`.
  - **Notes / bugs / deviations:** Requests without a session (tests, workers) are never locked out.

- [x] **BE-4.16 · Spaced repetition scheduling (P2)** — `L` · deps: BE-3.3
  - `srs_due_at/interval` on `student_question_state`; `spaced` strategy + "Due for revision" preset. **Design once, shared with Flashcards** (BE-5.3).
  - **Status:** ✅ Done
  - **Business overview:** Spaced repetition: after every submit each answered question gets a review date — a correct answer doubles the interval (1, 2, 4 … capped at 60 days), a wrong answer resets it to 1 day. The `spaced` strategy puts questions that are due first, and a 'Revision due' preset was added. The same scheduling idea is reused by Flashcards.
  - **How to test:** `TestSpacedRepetitionSchedulesAndRanksDueFirst`.

### M5 — Follow-on epics from `notes.md` (each is its own mini-project; listed for dependency visibility)

- [x] **BE-5.1 · Brain Hacks real backend (A27, D.2)** — `L` · deps: BE-1.9, BE-1.5, BE-2.1 · unblocks: FE-6.4
  - `brain_hacks` model (title, category `focus|memory|exam_day` → data not enum, body `rich_v1`, cover media, `status` workflow identical to `ContentItem` incl. admin approval, author). Teacher CRUD, admin approvals (add to Approvals hub queue), student list/detail. **Fix the dead `content_type='brain_hack'` count in `admin.go`.** Polymorphic bookmark/report/rating registration.
  - **Status:** ✅ Done
  - **Business overview:** Brain Hacks now exist on the server (they were a frontend mock with no backend). Teachers create/edit hacks with rich text + images and an optional cover image, submit them for review, admins approve/reject (author is notified), the author publishes. Students list published hacks by category (categories are data, with Focus/Memory/Exam Day as defaults), sort by rating, and open one with its images and their own rating. Ratings, bookmarks and reports work on hacks through the shared item registry. The admin dashboard previously counted a `content_type = 'brain_hack'` that could never exist; it now counts the real table and includes pending hacks in pending reviews.
  - **How to test:** `TestBrainHacksWorkflowWithImages`. Swagger: /teacher/brain-hacks, /admin/brain-hacks, /brain-hacks.
  - **Notes / bugs / deviations:** A question-image can't be used as a Brain Hack cover (purpose check).

- [x] **BE-5.2 · Wellness rich body + media** — `M` · deps: BE-1.9 · unblocks: FE-6.5
  - Migrate `wellness_content.media_url` to media ids; `body_text` → rich with `content_format`.
  - **Status:** ✅ Done
  - **Business overview:** Wellness articles can have a rich body (bold, sub/superscript, math, images) and a cover image; existing items stay plain. The missing `GET /wellness/content/{id}` (the app's own API type says 'requires BE implementation') now exists. List and detail return a resolved `media` map.
  - **How to test:** `TestWellnessRichBodyAndDetail`.

- [~] **BE-5.3 · Flashcards v1** — `XL` · deps: BE-1.9, BE-2.2, BE-4.16 · unblocks: FE-6.3
  - Decks/cards (rich + media), authoring reuse, study sessions, SRS state, polymorphic bookmarks/ratings/reports. Own mini-plan.
  - **Status:** ⚠️ Partly done
  - **Business overview:** Flashcards v1: teachers/admins author decks (course/subject/chapter, subscription flag) and cards with rich text + images on both sides, reorder them, submit for review; admins approve; students browse decks (with locked/new/due/learned progress), browse cards, study a spaced-repetition queue (due cards first, then new), grade cards again/hard/good/easy (10 min / ×1.2 / 1 d then ×2 / 3 d then ×3, cap 180 d), and run 'quick questions' sessions across decks. Studying counts toward the streak; decks/cards work with bookmarks, ratings and the report/notification machinery.
  - **How to test:** `TestFlashcardsAuthoringStudySRSAndGating`.
  - **Notes / bugs / deviations:** Reduced scope vs the 'XL' estimate: no per-card reports UI endpoint beyond the shared report service, no import for cards, no deck sharing. Live decks can't be edited (no corrections flow for cards yet).

- [x] **BE-5.4 · Explore composite API** — `L` · deps: BE-3.11, BE-5.3 · unblocks: FE-6.2
  - **Status:** ✅ Done
  - **Business overview:** `GET /explore?course_id=` returns one composite discovery response: in-progress attempts to continue, rule-based recommendations, the chapters with the most eligible questions, custom-test presets (when the module is enabled), flashcard decks (newest + top-rated) and Brain Hacks. Empty sections are empty arrays so the app hides them.
  - **How to test:** `TestFlashcardsAuthoringStudySRSAndGating` (explore assertions).

- [x] **BE-5.5 · Video notes** — `L` · deps: BE-1.9 · unblocks: FE-6.6
  - `video_notes(user, content_item, timestamp_seconds, body rich_v1)`. **Re-verify the video pipeline first** — `video-player.tsx` now uses `expo-video`; notes.md's blocker is stale (A31).
  - **Status:** ✅ Done
  - **Business overview:** Video notes: students can attach timestamped notes (markdown text, ≤4000 chars, max 500 per item) to a video/document, list them in time order, edit and delete them; premium content requires the same access as watching it. Notes are private.
  - **How to test:** `TestVideoNotes`.
  - **Notes / bugs / deviations:** I did not re-verify the video playback pipeline (video-player.tsx uses expo-video now); the notes API is independent of it. Images in notes are not supported.

- [x] **BE-5.6 · Push notifications v1** — `L` · deps: BE-0.8 · unblocks: FE-6.7
  - `POST /me/push-tokens`, preferences, Expo push sender job; triggers: report resolved, streak nudge, scheduled practice.
  - **Status:** ✅ Done
  - **Business overview:** Push notifications v1: devices register Expo push tokens (a token belongs to one account; moving accounts moves it), users set preferences (push on/off, streak nudges, report updates), and an in-app notification inbox (list, unread count, mark read). A worker dispatches new notifications to registered devices every 30 s, honouring preferences, pruning dead tokens, at most once each; report resolutions, correction decisions, brain-hack/deck approvals are notified. A streak nudge ('keep your 3-day streak') is created in the IST evening for students who practised the last two days but not today.
  - **How to test:** `TestPushTokensPreferencesDispatchAndStreakNudge` (with a fake sender).
  - **Notes / bugs / deviations:** Not exercised against the real Expo push service (no credentials/network use in tests). Scheduled-practice reminders (CM-L10) are left to local notifications in the app.

- [x] **BE-5.7 · Home "Updates" content** — `M` · unblocks: FE-6.1
  - Admin-managed items replacing the hard-coded `UPDATES` array in `(student)/(home)/index.tsx`.
  - **Status:** ✅ Done
  - **Business overview:** The Home 'Updates' carousel now has an admin-managed source: admins create/edit/reorder/schedule (start/end) items with optional image and an in-app CTA route (arbitrary URLs are rejected), students get `GET /home/updates` with only currently-active items. Empty = the app hides the carousel — no placeholder copy.
  - **How to test:** `TestHomeUpdatesAndShareBlueprint`.

- [x] **BE-5.8 · Share a blueprint (P3)** — `M` · deps: BE-3.4 — short code → blueprint (never questions).
  - **Status:** ✅ Done
  - **Business overview:** Sharing a custom test: `POST /custom-tests/share` returns an 8-character code (30 days) and a deep link; `GET /custom-tests/shared/{code}` returns the blueprint (never the questions) for the recipient's builder, re-validated against current limits. Personal state (status filters, bookmark collections, recent-exclusion, seed, title) is stripped before sharing.
  - **How to test:** `TestHomeUpdatesAndShareBlueprint`.

> **Anti-piracy (notes C.3)** needs **no backend work** — role is already in the JWT/`/me`; it is FE-only (`expo-screen-capture`), best-effort.

---

## 3. Cross-cutting checklists

### 3.1 Security
- [ ] Media: mime sniffing, SVG banned, dimension/decompression-bomb guard, EXIF stripped, presign rate limits, per-teacher quota, ownership on every media id used in content.
- [ ] Rich text: closed grammar; no HTML/links/URL schemes; length caps; validated on every write path (editor, CSV, ZIP, corrections).
- [ ] ZIP import: zip-slip, entry count, uncompressed size, ratio.
- [ ] Answer non-disclosure: no key/explanation before submit/reveal on **any** endpoint (runtime, bookmarks, reports, notes, review).
- [ ] Exposure rule (bookmark/report/rate/note) so the pool cannot be enumerated by UUID guessing.
- [ ] Attempt writes scoped to the attempt's question set (BE-0.4); generation/count rate-limited; free-tier daily caps.
- [ ] Private generated tests 404 for non-owners.
- [ ] Presigned GET TTL ≥ test duration + buffer; no public bucket, no listing endpoint.

### 3.2 Performance & indexes
- [ ] Composite index for the candidate query (`chapter_id, difficulty, custom_eligible, flag_status`); `(content_hash)`; `test_questions(question_id)`; `student_question_state(user_id, last_result)`; `bookmarks(user_id, collection_id)`; `content_reports(status, item_id)`; `media_assets(sha256)`.
- [ ] Batched media resolution (no N+1).
- [ ] `builder-config` cached; `count` debounced client-side and rate-limited server-side.
- [ ] Load test targets: generation p95 < 500 ms; count p95 < 300 ms; question payload (90 Q + 200 images) < 400 ms server time.

### 3.3 Jobs (worker)
| Job | Task | Schedule |
|---|---|---|
| `media_process` | 1.4 | on complete |
| `csv_import` (v2: validate/commit/update, zip) | 1.17–1.19 | on demand |
| `attempt_autosubmit` | 0.5 | every 60 s |
| `orphan_media_gc` | 1.8 | daily |
| `rescore_question` | 2.5 | on correction |
| `question_stats_rollup` | 4.7 | incremental + nightly |
| `generated_test_gc` | 4.13 | daily |
| `push_dispatch` | 5.6 | on event |

### 3.4 Backfill / migration order (do not reorder)
1. Baseline migrations (0.2) → 2. `media_*` (1.1) → 3. question metadata columns (1.10) → 4. `content_hash` backfill → 5. `test_questions` + dual-write (3.1) → 6. read switch behind flag → 7. `student_question_state` backfill (3.3) → 8. `tests` origin columns (3.2). Every step reversible; run on a prod copy first.

---

## 4. `PlatformSetting` keys introduced

| Key | Default | Task |
|---|---|---|
| `custom_test.enabled` / `.tutor_mode` / `.status_filters` | `false` | 0.8 |
| `custom_test.max_questions` | 90 | 3.4 |
| `custom_test.allowed_durations` | 5–180 min | 3.4 |
| `custom_test.eligible_sources` | `qbank,practice,pyq` | 3.5 |
| `custom_test.free_max_questions` | 10 | 3.6 |
| `custom_test.free_daily_generations` | 3 | 3.6 |
| `custom_test.max_active_generated` | 50 | 3.8 |
| `attempt.answer_grace_seconds` | 10 | 0.5 |
| `media.max_bytes` | 5 242 880 | 1.2 |
| `media.max_dimension` | 4096 | 1.3 |
| `media.max_images_per_question` / `_per_field` | 6 / 2 | 1.6 |
| `media.teacher_quota_bytes` | 2 GB | 1.2 |
| `import.max_rows` / `import.max_bundle_bytes` | 2000 / 100 MB | 1.17, 1.18 |
| `richtext.max_stem_chars` / `_option` / `_explanation` | 4000 / 1000 / 6000 | 1.9 |
| `reports.auto_hold_threshold` / `.auto_hold_reasons` | 3 / `wrong_answer,image_issue` | 2.4 |
| `analytics.weak_accuracy_threshold` / `.min_answers` | 0.5 / 10 | 4.4 |
| `pool.low_inventory_floor` | 30 | 4.9 |

---

## 5. Rough effort by milestone (single backend dev, relative)

Computed from the task sizes above (S=1d, M=2.5d, L=5d, XL=10d); **re-estimate before planning**.

| Milestone | Tasks | Dev-days | ≈ Weeks (5-day) |
|---|---:|---:|---:|
| M0 Foundations | 9 | 16.5 | 3.3 |
| M1 Media, rich content, metadata, authoring backend | 21 | 53.5 | 10.7 |
| M2 Bookmarks, reports, corrections, ratings | 7 | 29.5 | 5.9 |
| M3 Custom Test MVP | 18 | 62 | 12.4 |
| M4 Marrow-class | 16 | 43 | 8.6 |
| M5 Follow-on epics | 8 | 37.5 | 7.5 |
| **Total** | **79** | **242–242** | **48.4–48.4** |

**Reading these numbers honestly**
- They are **sums of dev-days, not a calendar**: BE and FE work in parallel, so elapsed time is governed by the critical paths in §6, not by adding the columns.
- **Custom Test MVP + images + teacher authoring = M0 + M1 + M3 ≈ 132 dev-days (~26 weeks) of backend** for one developer. M2 (bookmarks/reports/ratings) and M4 are in scope because you asked for them, but they are not on the MVP critical path.
- BE-5.3 (Flashcards) is sized `XL` as a placeholder — it needs its own plan and is almost certainly larger.
- Excludes QA/rework, review cycles, and infrastructure/ops time (R2 verification, Docker changes, staging migrations).

---

## 6. Dependency graph (what unblocks what)

```
BE-0.1 ─┐
BE-0.2 ─┼─► BE-1.1 ─► 1.2 ─► 1.3 ─► 1.4 ─► 1.5 ─► 1.21 ─► (FE-1.7, 1.8, 1.9)
BE-0.6 ─┘                              └────► 1.6 ◄── 1.9 (richtext)
BE-0.4 ─► 0.5 (timer) ─► FE-4.14
BE-1.10 ─► 1.11, 1.12 ─► 1.13 ─► 1.14, 1.15, 1.16 ─► (FE-2.x authoring)
BE-1.17 ─► 1.18, 1.19, 1.20 ─► FE-2.9
BE-2.1 ─► 2.2 (bookmarks) · 2.4 (reports) ─► 2.5 (corrections) · 2.6 (ratings)
BE-3.1 (test_questions) ─► 3.2 ─► 3.3 ─► 3.5 ─► 3.6 ─► 3.7, 3.8 ─► 3.9, 3.10 ─► FE-4.x
BE-3.12, 3.13, 3.14 ─► FE-4.18, 4.19
BE-4.x ─► FE-5.x     BE-5.x ─► FE-6.x
```

**Critical path for the Custom Test MVP:** 0.2 → 1.10 → 3.1 → 3.3 → 3.5 → 3.8 → 3.10, with 0.4/0.5 in parallel. **Critical path for images:** 0.2 → 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.21 (and 1.9 in parallel).

---

## 7. Questions for the backend owner

1. Is the deployed API ahead of this repo (BE-0.1)? Which branch is deployed?
2. Are you comfortable adopting `golang-migrate` now (BE-0.2)? If not, what is the plan for the backfills in §3.4?
3. Image variants: pure-Go JPEG/PNG or WebP via libvips (BE-1.4)? Any Dockerfile constraints?
4. Does Cloudflare R2 honour signed `Content-Length` on presigned PUTs (BE-1.2)?
5. Preferred approach for recurring jobs (BE-0.5): self-rescheduling `BackgroundJob`, or a ticker in `cmd/worker`?
6. Test DB in CI — testcontainers or a compose service (BE-0.6)?
7. `test_questions` read-switch flag (BE-3.1): env var, or `PlatformSetting`?


---

## Addendum — backend changes made while building the frontend

| Change | Why | Test |
|---|---|---|
| `GET /tests/{id}` now returns `active_attempt {id, started_at, expires_at, answered, total}` when the caller has an in-progress attempt | The pre-start screen could not honestly offer "Resume" or show progress | `TestGetTestReportsActiveAttemptForResume` |
| `GET /admin/corrections` and `GET /teacher/corrections` return a `media` map (current *and* proposed text) | Reviewers could not see images in a correction (would render as "unavailable") | existing correction tests still pass |
| `gofmt` applied to `internal/handlers/*.go`; Swagger regenerated | consistency | `go build`, `go vet`, full `go test ./...` green |

Full suite at the end of the session: `go vet ./...` clean; `go test ./...` all packages ok (router integration suite ≈ 20 s against real Postgres).
