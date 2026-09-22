# ─── Build stage ──────────────────────────────────────────────────────────────
FROM golang:1.26-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build both binaries
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/worker ./cmd/worker

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache ca-certificates ffmpeg tzdata

WORKDIR /app
COPY --from=builder /bin/api /bin/api
COPY --from=builder /bin/worker /bin/worker

# Here removing the CMD as it is different for worker and API - Add them diretly in the railway
# For Worker /bin/worker
# For Api /bin/api