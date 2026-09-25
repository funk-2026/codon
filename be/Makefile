# Codon backend — common tasks. Requires Go (see go.mod) and, for tests, a Postgres.
TEST_DATABASE_URL ?= postgres://test:test@127.0.0.1:55432/codon_test?sslmode=disable

.PHONY: build vet test test-load swagger test-db

build:
	go build ./...

vet:
	go vet ./...

# Starts a throwaway Postgres for the integration tests (port 55432).
test-db:
	docker run -d --name codon-test-pg -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=codon_test -p 127.0.0.1:55432:5432 postgres:16-alpine

test:
	TEST_DATABASE_URL="$(TEST_DATABASE_URL)" go test ./...

# 100 000-question generation load test (BE-3.18)
test-load:
	LOAD_TEST=1 TEST_DATABASE_URL="$(TEST_DATABASE_URL)" go test ./internal/router -run GenerationLoad -v

# Regenerate the OpenAPI docs after changing handler annotations
swagger:
	go run github.com/swaggo/swag/cmd/swag@v1.16.6 init -g cmd/api/main.go -o docs --parseInternal --parseDependency
