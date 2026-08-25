# Codon — Production Deployment Guide

> Complete guide to move the Codon mobile app (Expo React Native) and Go backend from local development to production for real users.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [All Services You Need](#2-all-services-you-need)
3. [Phase 1 — Third-Party Service Setup](#3-phase-1--third-party-service-setup)
4. [Phase 2 — Backend Infrastructure](#4-phase-2--backend-infrastructure)
5. [Phase 3 — Domain, SSL & Reverse Proxy](#5-phase-3--domain-ssl--reverse-proxy)
6. [Phase 4 — Production Environment Variables](#6-phase-4--production-environment-variables)
7. [Phase 5 — Database Hardening](#7-phase-5--database-hardening)
8. [Phase 6 — Mobile App Build & Submission](#8-phase-6--mobile-app-build--submission)
9. [Phase 7 — CI/CD Pipeline](#9-phase-7--cicd-pipeline)
10. [Phase 8 — Monitoring & Observability](#10-phase-8--monitoring--observability)
11. [Pre-Launch Checklist](#11-pre-launch-checklist)
12. [Cost Estimate](#12-cost-estimate)

---

## 1. Architecture Overview

```mermaid
graph LR
    subgraph "User Devices"
        A["📱 Expo App<br/>(Android / iOS)"]
    end

    subgraph "Cloud Infrastructure"
        B["🔀 Reverse Proxy<br/>(Caddy / Nginx)"]
        C["🖥️ API Server<br/>(Go + Gin)"]
        D["⚙️ Background Worker<br/>(Go)"]
        E["🐘 PostgreSQL 16"]
        F["🔴 Redis 7"]
        G["📦 Object Storage<br/>(Cloudflare R2 / S3)"]
    end

    subgraph "Third-Party Services"
        H["📲 2Factor.in<br/>(OTP SMS)"]
        I["💳 Razorpay<br/>(Payments)"]
        J["🏗️ Expo EAS<br/>(Build Service)"]
        K["📊 Play Store /<br/>App Store"]
    end

    A -->|HTTPS| B
    B --> C
    C --> E
    C --> F
    C --> G
    C --> H
    C --> I
    D --> E
    D --> G
    J --> K
```

### What Runs Where

| Component | Description | Container/Process |
|---|---|---|
| **API Server** | Go binary (`/bin/api`) — serves all REST endpoints | Docker container or systemd service |
| **Background Worker** | Go binary (`/bin/worker`) — CSV import, video transcoding jobs | Separate Docker container or systemd service |
| **PostgreSQL 16** | Primary data store | Managed DB or Docker |
| **Redis 7** | OTP rate-limiting, session caching | Managed Redis or Docker |
| **Cloudflare R2** | Object storage for videos, CSVs, KYC docs, profile photos | Cloudflare managed |
| **Caddy** | Reverse proxy + automatic HTTPS via Let's Encrypt | Docker or host |

---

## 2. All Services You Need

### Self-Hosted / Infrastructure (You Deploy)

| Service | Purpose | Where It Lives |
|---|---|---|
| **Go API Server** | Core backend — auth, CRUD, admin, payments | Your server |
| **Go Worker** | Background jobs (CSV parsing, video transcode) | Your server |
| **PostgreSQL 16** | All app data | Managed DB or self-hosted |
| **Redis 7** | OTP rate-limiting | Managed or self-hosted |
| **Caddy / Nginx** | Reverse proxy, TLS termination | Your server |

### Third-Party Services (Accounts Required)

| Service | Purpose | Estimated Cost |
|---|---|---|
| **[2Factor.in](https://2factor.in/)** | SMS OTP delivery to Indian phone numbers | ~₹0.18/SMS (prepaid credits) |
| **[Razorpay](https://razorpay.com/)** | Payment gateway (UPI, cards, netbanking) | 2% per transaction |
| **[Cloudflare R2](https://www.cloudflare.com/r2/)** | S3-compatible object storage for files | Free up to 10GB/mo storage, ₹0/egress |
| **[Expo EAS](https://expo.dev/eas)** | Cloud builds for Android APK/AAB & iOS IPA | Free tier: 30 builds/mo |
| **[Google Play Console](https://play.google.com/console)** | Publish to Play Store | One-time $25 |
| **[Apple Developer Program](https://developer.apple.com/)** | Publish to App Store | $99/year |
| **Domain registrar** | `codon.app` or similar | ~$12/year |

---

## 3. Phase 1 — Third-Party Service Setup

### 3.1 — 2Factor.in (OTP Provider)

1. Sign up at [2factor.in](https://2factor.in/)
2. Complete KYC verification (required for production SMS)
3. Purchase SMS credits (start with ₹500 = ~2,700 OTPs)
4. Get your **API Key** from the Dashboard
5. Create an OTP template:
   - Template: `Your Codon verification code is {otp}. Valid for 10 minutes.`
   - Submit for DLT approval (takes 1-3 business days)

> [!IMPORTANT]
> OTP delivery will **not work** until your DLT template is approved. Start this process first as it has the longest lead time.

```bash
# Test your API key
curl "https://2factor.in/API/V1/YOUR_API_KEY/SMS/9876543210/1234"
```

### 3.2 — Razorpay (Payments)

1. Sign up at [razorpay.com](https://razorpay.com/) → **Standard** account
2. Complete business KYC:
   - PAN, GST (if applicable), bank account details
   - Business proof (registration certificate / Udyam)
3. Wait for account activation (1-3 business days)
4. Once activated, go to **Settings → API Keys**:
   - Generate a **Live** key pair → save `key_id` and `key_secret`
5. Set up **Webhooks**:
   - URL: `https://api.codon.app/api/v1/payments/webhook`
   - Events: `payment.captured`, `payment.failed`, `order.paid`
   - Copy the **Webhook Secret**

> [!WARNING]
> Never use Test mode keys in production. The Razorpay dashboard clearly labels Test vs Live modes.

### 3.3 — Cloudflare R2 (Object Storage)

1. Sign up for [Cloudflare](https://dash.cloudflare.com/) (free tier)
2. Go to **R2 Object Storage** → Create bucket: `codon-prod`
3. Go to **R2 → Manage R2 API Tokens** → Create API token:
   - Permissions: **Object Read & Write**
   - Specify bucket: `codon-prod`
   - Copy the **Access Key ID** and **Secret Access Key**
4. Note your **R2 endpoint URL**: `https://<account_id>.r2.cloudflarestorage.com`

**Why R2 over S3:**
- **Zero egress fees** — videos served to users cost $0 in bandwidth
- S3-compatible API — your existing `aws-sdk-go-v2` code works unchanged
- 10 GB free storage + 10 million free reads/month

### 3.4 — Domain & DNS

1. Purchase a domain (e.g., `codon.app` or `codonapp.in`)
2. Point DNS to Cloudflare (free plan) for CDN + DDoS protection
3. Create DNS records:
   - `A api.codon.app → <your_server_ip>`
   - `CNAME www.codon.app → codon.app` (if you need a landing page later)

---

## 4. Phase 2 — Backend Infrastructure

### Option A — Railway (Recommended for Initial Launch)

> [!TIP]
> **Best for:** Small teams, initial users (<1000), fastest path to production.
> Railway handles Docker builds, SSL, custom domains, and managed Postgres/Redis out of the box.

**Steps:**
```bash
# 1. Install Railway CLI
npm install -g @railway/cli
railway login

# 2. Create a new project
railway init

# 3. Add services from the Railway dashboard:
#    - PostgreSQL (managed)   → gives you DATABASE_URL automatically
#    - Redis (managed)        → gives you REDIS_URL automatically

# 4. Deploy the API
cd be
railway up --service api

# 5. Deploy the Worker (same Dockerfile, different CMD)
railway up --service worker
```

In Railway dashboard:
- Set all env vars (see Phase 4)
- Add custom domain: `api.codon.app`
- Railway auto-provisions SSL

**Estimated cost:** $5-20/month (usage-based, no minimum)

---

### Option B — Single VPS (Most Cost-Effective)

> [!TIP]
> **Best for:** Maximum control, cost-conscious, comfortable with Linux.

**Recommended VPS:** Hetzner CX22 (2 vCPU, 4 GB RAM, 40 GB SSD) — **€4.35/month (~₹400/month)**

```bash
# 1. SSH into your server
ssh root@your-server-ip

# 2. Install Docker
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y

# 3. Clone your repo
git clone https://github.com/your-org/codon.git /opt/codon
cd /opt/codon/be

# 4. Create production .env (see Phase 4)
cp .env.example docker/.env
nano docker/.env  # Fill in all production values

# 5. Update docker-compose.yml for production
#    (see production docker-compose below)

# 6. Build and start
docker compose -f docker/docker-compose.yml up -d --build

# 7. Verify
curl http://localhost:8080/api/v1/health
```

**Production `docker-compose.yml`:**

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: codon
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"  # Only localhost, NOT public
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "127.0.0.1:6379:6379"  # Only localhost
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    command: /bin/api
    ports:
      - "127.0.0.1:8080:8080"  # Behind reverse proxy
    env_file:
      - .env
    environment:
      ENV: production
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/codon?sslmode=disable
      REDIS_URL: redis://default:${REDIS_PASSWORD}@redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  worker:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    command: /bin/worker
    env_file:
      - .env
    environment:
      ENV: production
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/codon?sslmode=disable
      REDIS_URL: redis://default:${REDIS_PASSWORD}@redis:6379
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - api
    restart: unless-stopped

volumes:
  postgres_data:
  caddy_data:
  caddy_config:
```

---

## 5. Phase 3 — Domain, SSL & Reverse Proxy

### Caddy (Auto-HTTPS, zero config)

Create `be/docker/Caddyfile`:

```
api.codon.app {
    reverse_proxy api:8080

    # Security headers
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }

    # Razorpay webhook needs raw body — don't buffer
    @webhook path /api/v1/payments/webhook
    handle @webhook {
        reverse_proxy api:8080
    }

    log {
        output file /var/log/caddy/access.log
        format json
    }
}
```

Caddy automatically:
- Provisions a Let's Encrypt TLS certificate
- Redirects HTTP → HTTPS
- Renews certificates before they expire

---

## 6. Phase 4 — Production Environment Variables

Create `docker/.env` with all production values:

```bash
# ─── Server ───────────────────────────────────────────────────────────────────
PORT=8080
ENV=production

# ─── PostgreSQL ───────────────────────────────────────────────────────────────
POSTGRES_USER=codon_prod
POSTGRES_PASSWORD=<generate: openssl rand -hex 24>

# ─── Redis ────────────────────────────────────────────────────────────────────
REDIS_PASSWORD=<generate: openssl rand -hex 24>

# ─── JWT ──────────────────────────────────────────────────────────────────────
JWT_SECRET=<generate: openssl rand -hex 32>
JWT_EXPIRY_DAYS=90

# ─── 2Factor.in OTP ──────────────────────────────────────────────────────────
TWO_FACTOR_API_KEY=<your-2factor-api-key>

# ─── Razorpay (LIVE keys) ────────────────────────────────────────────────────
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxx
RAZORPAY_KEY_SECRET=<your-live-secret>
RAZORPAY_WEBHOOK_SECRET=<your-webhook-secret>

# ─── Cloudflare R2 ───────────────────────────────────────────────────────────
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=codon-prod
S3_ACCESS_KEY_ID=<r2-access-key>
S3_SECRET_ACCESS_KEY=<r2-secret-key>

# ─── Worker ───────────────────────────────────────────────────────────────────
WORKER_POLL_SECONDS=5

# ─── Rate Limiting ────────────────────────────────────────────────────────────
OTP_RATE_LIMIT_PER_HOUR=5
```

> [!CAUTION]
> **Never commit `.env` files to git.** Add `docker/.env` to `.gitignore`. Use a secrets manager (e.g., `doppler`, `infisical`, or Railway's built-in secrets) for team environments.

**Generate all secrets at once:**
```bash
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
echo "REDIS_PASSWORD=$(openssl rand -hex 24)"
```

---

## 7. Phase 5 — Database Hardening

### 7.1 — Automated Backups

```bash
# Create a backup script: /opt/codon/backup.sh
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/codon"
mkdir -p $BACKUP_DIR

docker exec codon-postgres-1 pg_dump -U codon_prod codon | gzip > "$BACKUP_DIR/codon_$TIMESTAMP.sql.gz"

# Keep only last 14 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +14 -delete

# Optional: upload to R2
# aws s3 cp "$BACKUP_DIR/codon_$TIMESTAMP.sql.gz" s3://codon-backups/ --endpoint-url https://<id>.r2.cloudflarestorage.com
```

```bash
# Cron job: daily at 3 AM
chmod +x /opt/codon/backup.sh
crontab -e
# Add: 0 3 * * * /opt/codon/backup.sh >> /var/log/codon-backup.log 2>&1
```

### 7.2 — Connection Pooling

For production with >50 concurrent users, add PgBouncer:

```yaml
# Add to docker-compose.yml
pgbouncer:
  image: edoburu/pgbouncer:latest
  environment:
    DATABASE_URL: postgres://codon_prod:<password>@postgres:5432/codon
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 200
    DEFAULT_POOL_SIZE: 20
  ports:
    - "127.0.0.1:6432:6432"
  depends_on:
    postgres:
      condition: service_healthy
```

Then point your API's `DATABASE_URL` to PgBouncer on port `6432`.

---

## 8. Phase 6 — Mobile App Build & Submission

### 8.1 — Update Frontend for Production

Update `fe/src/api/client.ts` — the production URL:

```typescript
export const API_BASE = __DEV__
  ? `http://${DEV_HOST}:8080/api/v1`
  : 'https://api.codon.app/api/v1';   // ← Update this to your actual domain
```

Update `fe/app.json` for store submission:

```json
{
  "expo": {
    "name": "Codon",
    "slug": "codon",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "codon",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.yourcompany.codon",
      "buildNumber": "1",
      "infoPlist": {
        "NSCameraUsageDescription": "Codon needs camera access for KYC document scanning"
      }
    },
    "android": {
      "package": "com.yourcompany.codon",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#1A1A2E"
      },
      "permissions": ["CAMERA"]
    },
    "plugins": [
      "expo-router",
      "expo-font",
      "expo-web-browser",
      "expo-secure-store",
      ["expo-camera", { "cameraPermission": "Allow Codon to use your camera for KYC verification" }]
    ]
  }
}
```

### 8.2 — EAS Build Setup

```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Log into your Expo account
eas login

# 3. Initialize EAS in the project
cd fe
eas init

# 4. Create eas.json
```

Create `fe/eas.json`:

```json
{
  "cli": {
    "version": ">= 15.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "autoIncrement": "buildNumber"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "production"
      },
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

### 8.3 — Build & Submit to Stores

```bash
# ── Android ──────────────────────────────────────────────────────────────────

# Build production AAB
eas build --platform android --profile production

# Submit to Google Play (requires service account JSON)
eas submit --platform android --profile production

# ── iOS ──────────────────────────────────────────────────────────────────────

# Build production IPA (requires Apple Developer account)
eas build --platform ios --profile production

# Submit to App Store Connect
eas submit --platform ios --profile production
```

### 8.4 — Google Play Store Setup

1. Go to [Google Play Console](https://play.google.com/console) → Create app
2. Fill in store listing:
   - App name: **Codon**
   - Short description, full description
   - Screenshots (phone + tablet if applicable)
   - Feature graphic (1024×500)
   - App icon (512×512)
3. Complete the **Data Safety** questionnaire:
   - Phone number: Collected for authentication
   - Payment info: Collected via Razorpay
   - Device identifiers: Collected for session management
4. Set **Content rating** → IARC questionnaire
5. Set **Target audience**: 16+ (educational app)
6. Upload the AAB from EAS build
7. **Internal Testing** first → then **Production** roll-out

### 8.5 — Apple App Store Setup

1. Go to [App Store Connect](https://appstoreconnect.apple.com/) → Create new app
2. Fill in app information:
   - Name: **Codon**
   - Primary language: English (India)
   - Bundle ID: `com.yourcompany.codon`
3. Upload screenshots for required device sizes
4. Fill in **App Privacy**:
   - Phone Number (Authentication)
   - Payment Info (Purchases)
5. Upload IPA from EAS build
6. Submit for **App Review** (typically 24-48 hours)

> [!NOTE]
> Apple requires a **Privacy Policy URL** and **Terms of Service URL** before submission. Host these on your website or a simple static page.

---

## 9. Phase 7 — CI/CD Pipeline

### GitHub Actions (Recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths: ['be/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: |
          cd be
          docker build -f docker/Dockerfile -t codon-api:${{ github.sha }} .

      - name: Push to registry
        run: |
          echo "${{ secrets.REGISTRY_PASSWORD }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          docker tag codon-api:${{ github.sha }} ghcr.io/${{ github.repository }}/codon-api:latest
          docker push ghcr.io/${{ github.repository }}/codon-api:latest

      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_IP }}
          username: deploy
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/codon/be
            docker compose pull
            docker compose up -d --force-recreate api worker
            docker image prune -f
```

---

## 10. Phase 8 — Monitoring & Observability

### 10.1 — Uptime Monitoring (Free)

- **[UptimeRobot](https://uptimerobot.com/)** (free tier: 50 monitors)
  - Monitor: `https://api.codon.app/api/v1/health`
  - Check interval: 5 minutes
  - Alert via: Email + Telegram

### 10.2 — Application Logging

Add structured logging to your Go API. For a lightweight setup:

```bash
# View logs
docker compose logs -f api worker

# Persist logs with Docker's json-file driver (default)
# Logs are at /var/lib/docker/containers/<id>/<id>-json.log
```

For a more robust setup later, consider **Grafana Cloud** free tier (50GB logs/month).

### 10.3 — Error Tracking (Optional but Recommended)

- **[Sentry](https://sentry.io/)** free tier: 5,000 errors/month
- Add Sentry Go SDK to the backend
- Add `sentry-expo` to the frontend

### 10.4 — Add a Health Endpoint

Ensure the backend has a health check route (add if missing):

```go
// In main.go, before the auth middleware
r.GET("/api/v1/health", func(c *gin.Context) {
    c.JSON(200, gin.H{"status": "ok", "version": "1.0.0"})
})
```

---

## 11. Pre-Launch Checklist

### Backend Readiness

- [ ] `ENV=production` is set
- [ ] `JWT_SECRET` is a strong random 64-char hex string
- [ ] PostgreSQL password is strong and unique
- [ ] Redis password is set
- [ ] 2Factor.in API key is set and DLT template is approved
- [ ] Razorpay **Live** keys are set (not Test keys)
- [ ] Razorpay webhook URL is configured and secret is set
- [ ] Cloudflare R2 bucket created and credentials are set
- [ ] Worker container is running and processing jobs
- [ ] Database backups are automated (cron)
- [ ] All ports (5432, 6379) are **not** exposed to the public internet
- [ ] Only port 80/443 is publicly accessible (via Caddy)
- [ ] CORS is configured if needed (currently not set — Gin default)
- [ ] OTP rate limit is appropriate for production (5/hour)

### Frontend Readiness

- [ ] `API_BASE` production URL is correct in `client.ts`
- [ ] `app.json` has correct `bundleIdentifier` (iOS) and `package` (Android)
- [ ] App icons and splash screens are production-quality
- [ ] `eas.json` is configured with correct store credentials
- [ ] Privacy Policy URL is live
- [ ] Terms of Service URL is live

### Store Readiness

- [ ] Google Play Console account created ($25 one-time)
- [ ] Apple Developer account created ($99/year)
- [ ] Store listings complete (screenshots, descriptions, graphics)
- [ ] Content rating questionnaire completed
- [ ] Data safety/privacy forms completed
- [ ] Internal testing builds verified on real devices

### Security

- [ ] No hardcoded secrets in the codebase
- [ ] `.env` files are in `.gitignore`
- [ ] HTTPS enforced for all API traffic
- [ ] Presigned URLs have reasonable expiry (15 minutes)
- [ ] Admin routes are properly gated with `RoleAdmin` middleware
- [ ] SSH access uses key-based auth (no passwords)

---

## 12. Cost Estimate

### Monthly costs for initial launch (~100-500 users)

| Service | Provider | Monthly Cost |
|---|---|---|
| **VPS** (2 vCPU, 4GB RAM) | Hetzner CX22 | **~₹400** |
| **Object Storage** | Cloudflare R2 (free tier) | **₹0** |
| **OTP SMS** | 2Factor.in (~500 OTPs/mo) | **~₹90** |
| **Payments** | Razorpay (2% per txn) | **Variable** |
| **Domain** | Any registrar | **~₹80** |
| **Monitoring** | UptimeRobot (free) | **₹0** |
| **EAS Builds** | Expo (free tier) | **₹0** |
| **SSL** | Let's Encrypt (via Caddy) | **₹0** |
| | | |
| **Total (excl. payment fees)** | | **~₹570/month** |

### When to upgrade

| Trigger | Action |
|---|---|
| >1,000 users or DB >5GB | Upgrade VPS to 4 vCPU / 8GB RAM (~₹800/mo) |
| >50 concurrent DB connections | Add PgBouncer |
| >100 GB video storage | Still free on R2; consider CDN for playback |
| Need zero-downtime deploys | Move to Railway or a 2-node setup |
| >10,000 users | Consider managed PostgreSQL (Supabase / Neon) |

---

> [!IMPORTANT]
> **Recommended launch order:**
> 1. Set up 2Factor.in + Razorpay accounts **first** (KYC approval takes days)
> 2. Provision server + deploy backend
> 3. Test full flow on internal APK
> 4. Submit to Play Store (faster review) → then App Store
> 5. Announce launch once both stores approve
