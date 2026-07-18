# Codon Backend

Go backend for **Codon** — a mobile-first learning platform for NEET UG, 9th, and 10th standard students.

Built with **Gin + GORM + PostgreSQL + Redis**, single-VPS deployable via Docker Compose.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Quick Start (Local Dev)](#quick-start-local-dev)
4. [Running with Docker Compose](#running-with-docker-compose)
5. [Environment Variables](#environment-variables)
6. [API Documentation (Swagger)](#api-documentation-swagger)
7. [Key Design Decisions](#key-design-decisions)
8. [Phased Feature Overview](#phased-feature-overview)
9. [Development Tips](#development-tips)

---

## Prerequisites

| Tool | Version |
|---|---|
| Go | 1.21+ |
| Docker + Docker Compose | v2+ |
| PostgreSQL (local) | 15+ (or use Docker) |
| Redis (local) | 7+ (or use Docker) |

---

## Project Structure

```
be/
├── cmd/
│   ├── api/main.go          # HTTP API server entrypoint
│   └── worker/main.go       # Background job worker entrypoint
├── internal/
│   ├── config/              # Env-based config loading
│   ├── models/              # GORM structs (all entities)
│   ├── db/                  # DB connection, auto-migrate, seed
│   ├── middleware/
│   │   ├── auth.go          # JWT verify + sessions DB lookup
│   │   ├── role.go          # Role-based access control
│   │   └── subscription_gate.go  # requires_subscription + KYC gate
│   ├── handlers/            # Gin handlers grouped by resource
│   │   ├── auth.go          # OTP send/verify, sessions
│   │   ├── profile.go       # /me, progress, subscription
│   │   ├── courses.go       # Courses + subscription plans
│   │   ├── payments.go      # Razorpay checkout + webhook
│   │   ├── kyc.go           # KYC submission and admin review
│   │   ├── uploads.go       # S3 presigned URL generation
│   │   ├── tests.go         # Q Bank / Test Series / Practice
│   │   ├── attempts.go      # Student attempt flow + scoring
│   │   ├── content.go       # Learn / Video Classes
│   │   ├── wellness.go      # Mental well-being content
│   │   └── admin.go         # Admin user + dashboard
│   ├── services/            # Business logic
│   │   ├── otp_service.go
│   │   ├── session_service.go
│   │   ├── subscription_service.go
│   │   ├── scoring_service.go
│   │   ├── csv_import_service.go
│   │   └── transcode_service.go
│   ├── jobs/                # DB-backed background job worker
│   ├── otp/                 # OTPProvider interface + 2Factor.in impl
│   ├── razorpay/            # Razorpay API client + signature verify
│   └── storage/             # S3/R2 presigned PUT/GET URLs
├── docs/                    # Swagger/OpenAPI generated files
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── .env.example
└── go.mod
```

---

## Quick Start (Local Dev)

### 1. Clone and set up environment

```bash
cd be/
cp .env.example .env
# Edit .env with your credentials
```

### 2. Start PostgreSQL and Redis (Docker, easiest)

```bash
docker run -d --name codon-pg \
  -e POSTGRES_DB=codon -e POSTGRES_USER=codon -e POSTGRES_PASSWORD=codon \
  -p 5432:5432 postgres:16-alpine

docker run -d --name codon-redis -p 6379:6379 redis:7-alpine
```

### 3. Run the API server

```bash
go run ./cmd/api
```

The server starts at **http://localhost:8080**. Check it:

```bash
curl http://localhost:8080/healthz
# → {"status":"ok","time":"..."}
```

### 4. Run the background worker (separate terminal)

```bash
go run ./cmd/worker
```

The worker polls the `background_jobs` table every 5 seconds for CSV import and video transcode jobs.

### 5. Test OTP login (console-stub mode)

With no `TWO_FACTOR_API_KEY` set, OTPs are printed to stdout instead of being sent via SMS:

```bash
# Send OTP (look at server console output for the OTP code)
curl -X POST http://localhost:8080/api/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+919876543210"}'

# Verify OTP (use the code logged to console)
curl -X POST http://localhost:8080/api/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+919876543210", "otp_code": "123456", "device_id": "device-abc"}'
```

The response includes `access_token` — a JWT to use as `Authorization: Bearer <token>` on all protected routes.

---

## Running with Docker Compose

```bash
cd docker/

# Copy and configure env vars
cp ../.env.example .env

# Build and start all 4 services (api + worker + postgres + redis)
docker compose up --build

# Stop
docker compose down

# Stop and remove volumes (clears DB)
docker compose down -v
```

Services:
| Service | Port | Notes |
|---|---|---|
| `api` | `8080` | HTTP API + Swagger UI |
| `worker` | — | Background jobs (no HTTP port) |
| `postgres` | `5432` | PostgreSQL 16 |
| `redis` | `6379` | Redis 7 |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `8080` | HTTP server port |
| `ENV` | No | `development` | `development` or `production` |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis URL |
| `JWT_SECRET` | **Yes** | — | HMAC secret for JWT signing (`openssl rand -hex 32`) |
| `JWT_EXPIRY_DAYS` | No | `90` | Session duration in days |
| `TWO_FACTOR_API_KEY` | No | — | 2Factor.in API key. Leave blank for console-stub OTPs |
| `RAZORPAY_KEY_ID` | No | — | Razorpay Key ID |
| `RAZORPAY_KEY_SECRET` | No | — | Razorpay Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | No | — | Razorpay webhook signing secret |
| `S3_ENDPOINT` | No | — | Custom S3 endpoint (e.g. Cloudflare R2). Leave blank for AWS |
| `S3_REGION` | No | `us-east-1` | S3 region |
| `S3_BUCKET` | No | `codon` | S3 bucket name |
| `S3_ACCESS_KEY_ID` | No | — | S3 access key. Leave blank to use stub presign URLs |
| `S3_SECRET_ACCESS_KEY` | No | — | S3 secret key |
| `OTP_RATE_LIMIT_PER_HOUR` | No | `3` | Max OTP sends per phone number per hour |
| `WORKER_POLL_SECONDS` | No | `5` | How often the worker checks for pending jobs |

---

## API Documentation (Swagger)

Once the server is running, open:

```
http://localhost:8080/swagger/index.html
```

This serves the interactive Swagger UI. All endpoints are documented with request/response schemas.

### Regenerating the Swagger spec

If you add new API annotations, regenerate with:

```bash
# Install swag CLI (once)
go install github.com/swaggo/swag/cmd/swag@latest

# Regenerate
swag init -g cmd/api/main.go -o docs/ --parseDependency --parseInternal
```

### Using the API in Postman / Insomnia

Import the generated `docs/swagger.json` directly into Postman or Insomnia for a full pre-built collection.

---

## Key Design Decisions

### Authentication
- **Phone number + OTP only** — no passwords. OTP via 2Factor.in (console-stub in dev).
- **JWT + server-side sessions registry** — JWT is verified statelessly (fast), but a `sessions` table row (looked up by `jti`) allows server-side revocation, which pure stateless JWTs can't support.
- **Two-device limit** — on 3rd login, the oldest session (by `last_used_at`) is automatically evicted.
- **90-day sessions** — no inactivity auto-logout; explicit logout or eviction required.

### Content Approval State Machine
```
draft → pending_review → approved → published
                      ↓
                   rejected → (edit) → pending_review
```
Both `tests` and `content_items` follow this workflow. Only `published` items are visible to students.

### Subscription Gating
- Gating is **per-item** (`requires_subscription` flag), not per-course.
- Default: NEET UG items = `requires_subscription=true`; 9th/10th items = `false`.
- Individual items can override this default.
- If `kyc_required` platform flag is on, subscribed students must also have `kyc_status=approved`.

### Background Jobs
- DB-backed queue (`background_jobs` table) polled every few seconds — no external broker needed.
- Two job types: `csv_import` (bulk question creation from teacher CSV) and `video_transcode` (ffmpeg → HLS).

### Razorpay
- **One-time checkout only** — no mandates or auto-charge.
- Webhook handler is idempotent — safe to re-fire `payment.captured`.
- Client-side `verify-payment` fallback for cases where the webhook hasn't landed yet.

---

## Phased Feature Overview

| Phase | Feature | Status |
|---|---|---|
| 1 | Scaffolding, health check, config | ✅ |
| 2 | Auth + OTP + Sessions (2-device limit) | ✅ |
| 3 | Courses + Subscription Plans + Role management | ✅ |
| 4 | Razorpay subscriptions + payments + webhook | ✅ |
| 5 | Tests + Attempts + Scoring + Approval flow | ✅ |
| 6 | Content items + CSV import + Background worker | ✅ |
| 7 | KYC — submission, admin review, platform flag | ✅ |
| 8 | Mental well-being (Wellness) content | ✅ |
| 9 | Admin dashboard + hardening + rate limiting | ✅ |

---

## Development Tips

### Building binaries

```bash
# API server
go build -o bin/api ./cmd/api

# Worker
go build -o bin/worker ./cmd/worker
```

### Running tests

```bash
go test ./...
```

### Checking for unused imports

```bash
go vet ./...
```

### Inspecting the DB

If running with Docker Compose:

```bash
docker exec -it docker-postgres-1 psql -U codon -d codon
```

Common queries:
```sql
-- Check sessions
SELECT id, user_id, device_id, revoked_at, expires_at FROM sessions ORDER BY created_at DESC;

-- Check background jobs
SELECT id, type, status, attempts, last_error FROM background_jobs ORDER BY created_at DESC;

-- Check pending KYC
SELECT id, user_id, status, submitted_at FROM kyc_records WHERE status = 'pending';
```

### Webhook testing with Razorpay

Use [ngrok](https://ngrok.com/) to expose your local server:

```bash
ngrok http 8080
# Copy the https URL, e.g. https://abc123.ngrok.io

# Set webhook URL in Razorpay dashboard:
# https://abc123.ngrok.io/api/v1/webhooks/razorpay
```

Then use Razorpay's test mode to fire `payment.captured` and `payment.failed` events.
