# Codon Backend — Implementation Plan (Go)

## Context

`Product-context.md` is the authoritative product spec for Codon (NEET UG / 9th / 10th exam-prep app). The frontend is React Native (Expo); this plan covers the backend only, written in Go. The goal of this document is to turn Product-context.md's flows and functional requirements into a concrete, buildable backend: full database schema, full REST API, backend component structure, and a phased build order.

This plan is grounded **only** in:
1. `Product-context.md` (sections 1–3.8), and
2. The architecture/product decisions confirmed directly in conversation with the product owner (listed below).

It does not pull in scope from any other document in the repo (community/reels, notifications, parent dashboards, mentor roles, etc. are all intentionally excluded — none of that is in Product-context.md).

## Confirmed Decisions (do not re-litigate — these drive every choice below)

| Area | Decision |
|---|---|
| Auth | Phone number + OTP only, no passwords/email. `phoneNumber` is the user's unique identity. OTP via **2Factor.in**. |
| Roles | Student (default on first signup), Teacher, Admin. Role is admin-assigned. |
| Courses | Exactly 3, fixed: **NEET UG**, **9th standard**, **10th standard**. |
| Access model | Subscription-gating is set **per test / per content item** (not per course) via a `requires_subscription` flag, so individual NEET UG items can be marked free and, if ever needed, a 9th/10th item could be marked premium. Default intent unchanged: 9th/10th items are created with `requires_subscription=false`, NEET UG items with `requires_subscription=true`. No auto-trial — freely-flagged content is the starter access. |
| Subscription plans | Modular — created/edited by admin from the dashboard (not hardcoded), with duration + price. |
| Content modules | Q Bank, Test Series, and Practice are **one unified `Test` entity** distinguished by a `module_type` field. Learn & Video Classes are a separate `ContentItem` entity. Both require **admin approval before a teacher can publish**. |
| Scoring | Configurable per test (`marks_per_correct` / `marks_per_wrong`) — not hardcoded NEET +4/-1. |
| KYC | Feature-flagged. Admin toggles `kyc_required` platform-wide. When ON: student submits an ID document + number, admin manually approves/rejects. When OFF: no KYC step at all. |
| Payments | Razorpay. No voluntary refunds — only failed/duplicate transactions get refunded. |
| Sessions | Two-device limit enforced (3rd login evicts oldest session). No inactivity auto-logout — sessions are long-lived (90 days) until manual logout or device eviction. **JWT access token**, carrying `user_id`/`role`/`device_id`/`jti` claims, stored by the FE in persistent secure storage (e.g. Expo SecureStore) — **plus a server-side `sessions` registry keyed by `jti`**. The JWT signature is verified statelessly on every request; the `sessions` row (looked up by `jti`) is what lets the server revoke/evict a session before its natural expiry, which a pure stateless JWT can't do on its own. |
| Out of scope | Push notifications, community/reels, parent role, mentor/doctor role — none of this is in Product-context.md. |
| Database | PostgreSQL |
| DB access | GORM |
| Web framework | Gin |
| Hosting | Single VPS/VM, Docker Compose |
| File/video storage | S3-compatible object storage (S3 or R2), presigned URLs; self-managed ffmpeg → HLS transcoding for video |
| OTP provider | 2Factor.in, behind a swappable interface |

---

## 1. Database Schema (PostgreSQL)

All primary keys are UUIDs (`gen_random_uuid()`) to avoid enumeration on externally-reachable IDs (payment/webhook-adjacent tables especially). All monetary values are stored as **integer paise** (smallest currency unit), matching how Razorpay's own API works — avoids floating-point rounding issues.

### users
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| phone_number | text, unique, not null | identity/login key |
| name | text, nullable | set via profile edit |
| role | enum(`student`,`teacher`,`admin`), not null, default `student` | admin-assigned |
| profile_photo_key | text, nullable | S3 object key |
| selected_course_id | uuid FK → courses.id, nullable | |
| can_manage_all_content | boolean, not null, default false | the "wider permissions" flag from Product-context.md §1.5, teacher-only in practice |
| kyc_status | enum(`not_required`,`pending`,`approved`,`rejected`), not null, default `not_required` | |
| created_at, updated_at | timestamptz | |
| last_login_at | timestamptz, nullable | |

Index: unique(phone_number).

### otp_requests
Ephemeral table for the OTP send/verify handshake.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| phone_number | text, not null | |
| otp_code_hash | text, not null | never store plaintext OTP |
| expires_at | timestamptz, not null | e.g. now()+5min |
| attempts | int, not null, default 0 | verify-attempt counter, lock after N |
| consumed_at | timestamptz, nullable | |
| created_at | timestamptz | |

Index: (phone_number, expires_at) for lookup + cleanup job.

### sessions
Backs the JWT+registry hybrid auth and the two-device limit. The JWT itself is never stored — only its `jti` (a generated UUID, embedded as a claim when the JWT is issued).
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | also used as the JWT's `jti` claim |
| user_id | uuid FK → users.id | |
| device_id | text, not null | client-generated stable device identifier |
| device_info | text, nullable | e.g. "iPhone 14, iOS 17" for admin visibility |
| created_at | timestamptz | |
| last_used_at | timestamptz | |
| expires_at | timestamptz, not null | created_at + 90 days; also encoded as the JWT's `exp` claim |
| revoked_at | timestamptz, nullable | |

Index: user_id, expires_at.
Auth check per request: verify the JWT signature + `exp` locally (no DB hit), then look up `sessions` by `id = jwt.jti` and reject if `revoked_at is not null` or the row is missing/expired.
Two-device rule: on new-device login, count active (`revoked_at is null and expires_at > now()`) sessions for the user; if ≥2, revoke the one with the oldest `last_used_at` before creating the new one.

### courses
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | "NEET UG" / "9th Standard" / "10th Standard" |
| slug | text, unique | `neet-ug`, `9th-standard`, `10th-standard` |
| description | text, nullable | |
| is_active | boolean, not null, default true | |
| created_at, updated_at | timestamptz | |

Seeded via migration with exactly the 3 rows above — no course-creation API, since Product-context.md fixes the set ("For now it will be 9th, 10th, Neet UG"). Subscription-gating is **not** set here — see `requires_subscription` on `tests` and `content_items` below, so individual tests/lectures can be flagged free or premium independent of course.

### subscription_plans
Admin-managed per Product-context.md §3.2.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | e.g. "3 Months", "1 Year" — admin-defined |
| course_id | uuid FK → courses.id | in practice always NEET UG, but schema isn't hardcoded to it |
| duration_days | int, not null | |
| price_paise | bigint, not null | |
| currency | text, not null, default `INR` | |
| benefits | text[], nullable | bullet list for plan-card display |
| is_active | boolean, not null, default true | soft-deactivate instead of delete |
| created_by | uuid FK → users.id | admin who created it |
| created_at, updated_at | timestamptz | |

### subscriptions
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users.id | |
| plan_id | uuid FK → subscription_plans.id | |
| course_id | uuid FK → courses.id | denormalized from plan at purchase time (stable even if the plan changes later) |
| status | enum(`pending_payment`,`active`,`expired`,`cancelled`), not null | |
| start_date, end_date | date, nullable until activated | |
| auto_renew | boolean, not null, default false | field reserved; **no auto-charge/mandate flow is implemented in this build** — Razorpay is used for one-time checkout only, matching the "no voluntary refunds, simple policy" decision. Renewal = user manually re-purchases. |
| created_at, updated_at | timestamptz | |

Index: (user_id, status, end_date) — used constantly for access checks.
"Active" = `status = 'active' AND end_date >= current_date`.

### payment_records
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users.id | |
| subscription_id | uuid FK → subscriptions.id, nullable | linked once the pending subscription is created |
| razorpay_order_id | text, unique, not null | |
| razorpay_payment_id | text, nullable | set on capture |
| razorpay_signature | text, nullable | stored for audit |
| amount_paise | bigint, not null | |
| currency | text, not null | |
| status | enum(`created`,`captured`,`failed`,`refunded`), not null | |
| failure_reason | text, nullable | |
| refunded_at | timestamptz, nullable | |
| refund_reason | text, nullable | only ever "failed_or_duplicate_transaction" per policy |
| created_at, updated_at | timestamptz | |

### tests
Unified Q Bank / Test Series / Practice entity.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| title | text, not null | |
| course_id | uuid FK → courses.id | |
| module_type | enum(`qbank`,`test_series`,`practice`), not null | |
| requires_subscription | boolean, not null, default true if course=NEET UG else false | set per test at creation, overridable by teacher/admin — lets individual NEET UG tests be marked free or a specific 9th/10th test be marked premium |
| topic | text, nullable | for filtering |
| created_by | uuid FK → users.id | teacher or admin |
| total_questions | int, not null, default 0 | denormalized, kept in sync when questions added |
| duration_minutes | int, nullable | null = untimed |
| marks_per_correct | numeric(5,2), not null, default 4 | |
| marks_per_wrong | numeric(5,2), not null, default -1 | |
| status | enum(`draft`,`pending_review`,`approved`,`rejected`,`published`), not null, default `draft` | see workflow below |
| reviewed_by | uuid FK → users.id, nullable | |
| reviewed_at | timestamptz, nullable | |
| rejection_reason | text, nullable | |
| created_at, updated_at | timestamptz | |

### questions
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| test_id | uuid FK → tests.id | |
| question_text | text, not null | |
| option_a, option_b, option_c, option_d | text, not null | fixed 4-option MCQ, matches NEET format |
| correct_option | enum(`A`,`B`,`C`,`D`), not null | |
| explanation | text, nullable | shown in post-test review |
| order_index | int, not null | display order within the test |
| created_at, updated_at | timestamptz | |

### student_attempts
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users.id | |
| test_id | uuid FK → tests.id | |
| status | enum(`in_progress`,`submitted`), not null | |
| started_at | timestamptz, not null | |
| submitted_at | timestamptz, nullable | |
| time_taken_seconds | int, nullable | |
| score | numeric(6,2), nullable | set on submit |
| total_marks | numeric(6,2), nullable | |
| correct_count, wrong_count, unattempted_count | int, nullable | |
| created_at | timestamptz | |

### attempt_answers
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| attempt_id | uuid FK → student_attempts.id | |
| question_id | uuid FK → questions.id | |
| selected_option | enum(`A`,`B`,`C`,`D`), nullable | null = unattempted |
| is_correct | boolean, nullable | computed on submit |
| marks_awarded | numeric(5,2), nullable | computed on submit |
| answered_at | timestamptz, nullable | |

Index: unique(attempt_id, question_id) — one answer row per question per attempt, upserted as the student progresses (supports resume).

### content_items
Learn / Video Classes entity.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| title | text, not null | |
| course_id | uuid FK → courses.id | |
| content_type | enum(`video`,`document`), not null | |
| requires_subscription | boolean, not null, default true if course=NEET UG else false | same per-item override as `tests.requires_subscription` |
| topic | text, nullable | |
| uploaded_by | uuid FK → users.id | |
| file_key | text, not null | original upload's S3 key |
| video_status | enum(`queued`,`transcoding`,`ready`,`failed`), nullable | only set when content_type=video |
| hls_playlist_url | text, nullable | set once transcoding job completes |
| status | enum(`draft`,`pending_review`,`approved`,`rejected`,`published`), not null, default `draft` | same workflow as tests |
| reviewed_by, reviewed_at, rejection_reason | as above | |
| created_at, updated_at | timestamptz | |

### csv_import_batches
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| teacher_id | uuid FK → users.id | |
| test_id | uuid FK → tests.id | which draft test the questions are appended to |
| file_key | text, not null | original CSV, kept for audit |
| total_rows, success_rows, error_rows | int | |
| status | enum(`processing`,`completed`,`completed_with_errors`,`failed`), not null | |
| created_at, completed_at | timestamptz | |

### csv_import_row_errors
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| batch_id | uuid FK → csv_import_batches.id | |
| row_number | int | |
| error_message | text | |
| raw_row_data | jsonb | original row, for the teacher to fix and re-upload |

**Proposed CSV template** (no schema exists in any doc — this is the concrete column list a teacher's spreadsheet must have):
`question_text, option_a, option_b, option_c, option_d, correct_option, explanation` (correct_option = A/B/C/D). One header row + one row per question. Rows failing validation (missing required field, correct_option not in A–D) are skipped and logged to `csv_import_row_errors`; the rest of the batch still imports.

### kyc_records
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users.id | |
| id_type | enum(`aadhaar`,`pan`), not null | |
| id_number | text, not null | |
| document_file_key | text, not null | S3 key of uploaded ID image |
| status | enum(`pending`,`approved`,`rejected`), not null, default `pending` | |
| reviewed_by | uuid FK → users.id, nullable | |
| reviewed_at | timestamptz, nullable | |
| rejection_reason | text, nullable | |
| submitted_at | timestamptz, not null | |
| created_at, updated_at | timestamptz | |

### wellness_content
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| title | text, not null | |
| category | enum(`guidance`,`motivation`,`reflection_prompt`), not null | covers "supportive content, reflection prompts, and wellness guidance" (Product-context.md §3.8) |
| body_text | text, not null | |
| media_url | text, nullable | |
| is_active | boolean, not null, default true | |
| created_by | uuid FK → users.id | admin |
| created_at, updated_at | timestamptz | |

*(Daily check-in and reflection-response capture are explicitly skipped for v1 — reflection prompts are served as read-only content via `wellness_content` with `category=reflection_prompt`, with no student-submitted response stored.)*

### platform_settings
Key-value table for admin-controlled feature flags.
| Column | Type | Notes |
|---|---|---|
| key | text, PK | e.g. `kyc_required` |
| value | text | e.g. `"true"` / `"false"` |
| updated_at | timestamptz | |
| updated_by | uuid FK → users.id, nullable | |

Seeded with `kyc_required = false`.

### Content Approval State Machine (tests & content_items)
```
draft --(teacher: submit-for-review)--> pending_review
pending_review --(admin: approve)--> approved
pending_review --(admin: reject + reason)--> rejected
approved --(teacher: publish)--> published
rejected --(teacher: edit + resubmit)--> pending_review
```
Only `published` items are visible to students. This directly implements Product-context.md §2.4 steps 2–5 ("uploads... which should be further approved by an admin" → "publishes content for students").

---

## 2. REST API Specification

Base path: `/api/v1`. Auth via `Authorization: Bearer <jwt>` unless marked Public. Role column: who may call it.

### Auth
| Method & Path | Role | Body | Notes |
|---|---|---|---|
| POST /auth/otp/send | Public | `{phone_number}` | Rate-limited (e.g. 3/hour/phone) via Redis counter. Sends OTP through 2Factor.in. |
| POST /auth/otp/verify | Public | `{phone_number, otp_code, device_id, device_info?}` | Creates the user if `phone_number` is new (role=student). Applies two-device eviction, creates a `sessions` row. Returns `{access_token, user}` — `access_token` is the JWT for the FE to persist. |
| POST /auth/logout | Any | — | Revokes the current session. |
| GET /auth/sessions | Any | — | Lists caller's active sessions/devices. |
| DELETE /auth/sessions/:id | Any | — | Revoke a specific session (remote logout of another device). |

### Profile
| Method & Path | Role | Body | Notes |
|---|---|---|---|
| GET /me | Any | — | Profile + subscription summary + kyc_status. |
| PATCH /me | Any | `{name?, profile_photo_key?, selected_course_id?}` | |
| GET /me/progress | Student | — | Attempted-test count, avg score, attempt history (Product-context.md §3.2). |
| GET /me/attempts | Student | — | Full attempt history list. |

### Courses
| Method & Path | Role | Body | Notes |
|---|---|---|---|
| GET /courses | Any | — | Fixed 3 courses. |
| GET /courses/:id | Any | — | |

### Subscription Plans
| Method & Path | Role | Body | Notes |
|---|---|---|---|
| GET /subscription-plans | Any | — | Active plans only. |
| POST /admin/subscription-plans | Admin | `{name, course_id, duration_days, price_paise, currency, benefits[]}` | |
| PATCH /admin/subscription-plans/:id | Admin | partial | |
| DELETE /admin/subscription-plans/:id | Admin | — | Soft-delete via `is_active=false`. |

### Subscriptions & Payments
| Method & Path | Role | Body | Notes |
|---|---|---|---|
| GET /me/subscription | Student | — | Current active subscription + expiry, or none. |
| POST /subscriptions/checkout | Student | `{plan_id}` | Creates Razorpay order + `pending_payment` subscription + `created` payment_record. Returns `{razorpay_order_id, amount_paise, currency, key_id}`. |
| POST /subscriptions/verify-payment | Student | `{razorpay_order_id, razorpay_payment_id, razorpay_signature}` | Client-side fallback confirmation if the webhook hasn't landed yet; verifies signature before activating. |
| POST /webhooks/razorpay | Public (Razorpay-signed) | Razorpay payload | Idempotent handler for `payment.captured` / `payment.failed`. Activates subscription on capture. |
| GET /admin/payments | Admin | query: status, user_id | |
| GET /admin/payments/:id | Admin | — | |

Access rule enforced on any test/content item where `requires_subscription = true`: the student must have an **active** subscription for that item's `course_id` **and**, if `kyc_required` is on, `user.kyc_status == approved`.

### KYC
| Method & Path | Role | Body | Notes |
|---|---|---|---|
| GET /platform-settings/kyc-required | Any | — | Whether KYC is currently enforced (also embedded in `GET /me`). |
| POST /me/kyc | Student | `{id_type, id_number, document_file_key}` | Sets status=pending. |
| GET /me/kyc | Student | — | Own KYC record/status. |
| GET /admin/kyc?status=pending | Admin | — | Review queue. |
| POST /admin/kyc/:id/approve | Admin | — | |
| POST /admin/kyc/:id/reject | Admin | `{reason}` | |
| PATCH /admin/settings/kyc-required | Admin | `{enabled: bool}` | Toggles the feature flag. |

### File Uploads
| Method & Path | Role | Body | Notes |
|---|---|---|---|
| POST /uploads/presign | Any authenticated | `{file_name, content_type, purpose}` | `purpose` ∈ `kyc_document, video, csv, profile_photo`; determines bucket path + allowed content-types. Returns `{upload_url, file_key}` for a direct PUT to S3 from the app. |

### Tests (Q Bank / Test Series / Practice)
| Method & Path | Role | Body | Notes |
|---|---|---|---|
| GET /tests?course_id=&module_type=&topic= | Student | — | Published only; items with `requires_subscription=true` are gated per the access rule above. |
| GET /tests/:id | Student | — | Metadata only (no answers). |
| POST /tests/:id/attempts | Student | — | Starts (or resumes, if an `in_progress` one exists) an attempt. |
| GET /tests/:id/questions | Student | — | Question text + options only. Requires an active attempt. |
| PUT /attempts/:id/answers/:question_id | Student (own attempt) | `{selected_option}` | Upsert — supports save-as-you-go / resume. |
| POST /attempts/:id/submit | Student (own attempt) | — | Finalizes; computes score server-side from `marks_per_correct`/`marks_per_wrong`. |
| GET /attempts/:id/result | Student (own attempt) | — | Score summary. |
| GET /attempts/:id/review | Student (own attempt) | — | Per-question: selected vs. correct option + explanation. |

### Teacher Content Management
| Method & Path | Role | Body | Notes |
|---|---|---|---|
| POST /teacher/tests | Teacher | `{title, course_id, module_type, topic?, duration_minutes?, marks_per_correct?, marks_per_wrong?}` | Creates draft. |
| PATCH /teacher/tests/:id | Teacher (owner, or `can_manage_all_content`) | partial | Only while `draft`/`rejected`. |
| POST /teacher/tests/:id/questions | Teacher (owner) | `{question_text, option_a..d, correct_option, explanation?}` | |
| POST /teacher/tests/:id/csv-import | Teacher (owner) | `{file_key}` | Creates a `csv_import_batches` row, processed async by worker. |
| GET /teacher/csv-imports/:id | Teacher | — | Batch status + row errors. |
| POST /teacher/tests/:id/submit-for-review | Teacher (owner) | — | draft → pending_review. |
| POST /teacher/tests/:id/publish | Teacher (owner) | — | approved → published. |
| GET /teacher/tests | Teacher | — | Own tests (all, if `can_manage_all_content`). |
| POST /teacher/content | Teacher | `{title, course_id, content_type, topic?, file_key}` | Creates draft `content_items`; queues transcode job if video. |
| PATCH /teacher/content/:id | Teacher (owner) | partial | |
| POST /teacher/content/:id/submit-for-review | Teacher (owner) | — | |
| POST /teacher/content/:id/publish | Teacher (owner) | — | |
| GET /teacher/content | Teacher | — | |

### Admin Content Moderation & User Management
| Method & Path | Role | Body | Notes |
|---|---|---|---|
| GET /admin/tests?status=pending_review | Admin | — | |
| POST /admin/tests/:id/approve | Admin | — | |
| POST /admin/tests/:id/reject | Admin | `{reason}` | |
| GET /admin/content?status=pending_review | Admin | — | |
| POST /admin/content/:id/approve | Admin | — | |
| POST /admin/content/:id/reject | Admin | `{reason}` | |
| GET /admin/users?role=&search= | Admin | — | |
| GET /admin/users/:id | Admin | — | |
| PATCH /admin/users/:id/role | Admin | `{role}` | Product-context.md §3.1: role is admin-managed. |
| PATCH /admin/users/:id/teacher-permissions | Admin | `{can_manage_all_content}` | The "wider permissions" grant from §1.5. |
| GET /admin/dashboard/summary | Admin | — | Counts: users, active subscriptions, pending KYC, pending content reviews — supports §2.5 step 4 ("monitors student progress and content quality"). |

### Wellness (MMM)
| Method & Path | Role | Body | Notes |
|---|---|---|---|
| GET /wellness/content?category= | Student | — | guidance / motivation. |
| GET /wellness/reflection-prompts | Student | — | Read-only content (`category=reflection_prompt`); no response is captured/stored in v1. |
| POST /admin/wellness-content | Admin | `{title, category, body_text, media_url?}` | |
| PATCH /admin/wellness-content/:id | Admin | partial | |
| DELETE /admin/wellness-content/:id | Admin | — | |

---

## 3. Go Backend Component Architecture

```
codon-backend/
  cmd/
    api/main.go          # HTTP server entrypoint
    worker/main.go        # background job worker entrypoint (video transcode, CSV import)
  internal/
    config/                # env-based config loading
    models/                 # GORM structs, one file per entity group
    db/                     # GORM init, migration runner wiring
    middleware/
      auth.go                # JWT verify + sessions-row lookup by jti -> attach user to context
      role.go                # RequireRole(...roles)
      subscription_gate.go   # checks the requested test/content_item's requires_subscription flag,
                              # active subscription for its course, and kyc_status if required
    handlers/                # Gin handlers, grouped by resource (auth, profile, courses, plans,
                              # subscriptions, payments, kyc, tests, attempts, content, csvimport,
                              # wellness, admin)
    services/                # business logic: otp_service, session_service, subscription_service,
                              # payment_service (Razorpay), scoring_service, kyc_service,
                              # content_review_service, csv_import_service, transcode_service
    repository/               # thin GORM query layer, one per entity
    razorpay/                  # Razorpay API client: order creation, signature verification
    otp/                       # OTPProvider interface + TwoFactorProvider implementation
    storage/                   # S3 client: presigned PUT/GET URL generation
    jobs/                      # background_jobs table model + enqueue helpers
  migrations/                # plain SQL migrations (golang-migrate)
  docker/
    Dockerfile
    docker-compose.yml       # api, worker, postgres, redis
```

**Why golang-migrate over GORM AutoMigrate:** explicit, reviewable SQL migration files are safer for a schema with this many enums/constraints and a payments table — AutoMigrate can't express check-constraints or safely handle enum changes.

**Why a DB-backed job queue instead of a message broker:** single-VPS scale doesn't justify running RabbitMQ/NSQ. A `background_jobs` table (`id, type, payload jsonb, status, attempts, run_after, last_error, created_at`) polled by a worker goroutine every few seconds handles video transcoding and CSV import processing with far less operational overhead, and is trivial to inspect/retry via SQL.

**Why Redis:** used for two things only — OTP send rate-limiting (per-phone cooldown counter) and caching the (rarely-changing) courses/active-plans lists. Not used for session revocation — that's the `sessions` table in Postgres (looked up by JWT `jti`), since it needs to be durable, not just fast.

**Middleware chain for a protected endpoint:** `AuthMiddleware` (resolves JWT + `sessions` row → user) → `RoleMiddleware` (if role-restricted) → `SubscriptionGateMiddleware` (on test/content routes, checks the specific item's `requires_subscription` flag) → handler.

---

## 4. Phased Build Sequence

1. **Scaffolding** — Go module, Gin skeleton, Docker Compose (api+worker+postgres+redis), config loading, `GET /healthz`, migration tooling wired up. *Done when:* `docker compose up` serves the health check.
2. **Auth + Users + Sessions** — OTP send/verify (2Factor.in behind an interface; a console-logging stub provider for local dev), JWT issuance + `sessions` row creation, two-device eviction, `AuthMiddleware`, `/me` endpoints. *Done when:* a curl-driven OTP login returns a JWT access token, and a 3rd-device login evicts the oldest session.
3. **Courses + Subscription Plans + Role management** — seed the 3 courses, admin plan CRUD, `GET /courses`, `GET /subscription-plans`, admin role-assignment endpoint. *Done when:* an admin can create a plan and a student can list it.
4. **Razorpay subscriptions + payments** — checkout order creation, webhook handler with signature verification, `verify-payment` fallback, subscription activation, `/me/subscription`. *Done when:* a Razorpay test-mode payment activates a subscription end-to-end via the webhook.
5. **Tests (Q Bank/Test Series/Practice) + attempts** — teacher create/edit test+questions, admin approve/reject, teacher publish, student list/start/answer/submit/review, `SubscriptionGateMiddleware` applied. *Done when:* a teacher-created NEET UG test, once approved and published, is only fetchable by a subscribed student, and scoring respects the test's configured marks.
6. **Content items (Learn/Video Classes) + CSV import + worker** — presigned upload, transcode job (ffmpeg → HLS) via the worker, CSV parsing job with per-row error reporting, same approval/publish workflow as tests. *Done when:* a teacher-uploaded CSV appends questions to a draft test with a visible error report for bad rows, and an uploaded video becomes playable (HLS) after async processing.
7. **KYC** — feature-flag toggle, submission, admin review queue, tie-in with `SubscriptionGateMiddleware`. *Done when:* toggling `kyc_required` on blocks NEET UG access for a subscribed-but-unverified student until an admin approves their KYC.
8. **Mental well-being (MMM)** — wellness content admin CRUD; guidance, motivation, and reflection-prompt content served read-only to students (no check-in or response capture in v1). *Done when:* an admin can publish new wellness content in any of the three categories and it appears immediately via `GET /wellness/content` / `GET /wellness/reflection-prompts`.
9. **Admin dashboard + hardening** — summary-counts endpoint, payment listing/filtering, input validation pass, OTP rate-limiting, index review under load. *Done when:* the admin summary endpoint returns accurate live counts and OTP send is rate-limited per phone number.

---

## 5. Verification

- Each phase above has an explicit "done when" — verify by driving the actual HTTP API with curl/Postman against the Docker Compose stack (Postgres + Redis + api + worker), not just unit tests.
- For payments specifically: use Razorpay's test mode + their webhook test tool to fire real `payment.captured`/`payment.failed` events at the local webhook endpoint (e.g. via an ngrok tunnel) before considering Phase 4 done.
- For the two-device limit and content-approval state machine: write integration tests that exercise the full state transitions (these are easy to get subtly wrong and hard to catch by manual testing alone).
