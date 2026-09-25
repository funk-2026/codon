package db

import (
	"embed"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// migrationLockID is the Postgres advisory-lock key that serialises migration
// runners (two API replicas starting at once must not both apply a file).
const migrationLockID = 727_001

// RunMigrations applies every not-yet-applied SQL file in
// internal/db/migrations, in filename order, each inside its own transaction,
// recording them in schema_migrations. Files must be idempotent-safe on a
// database that AutoMigrate already brought up to date (use IF NOT EXISTS,
// ON CONFLICT DO NOTHING, etc.).
func RunMigrations(gdb *gorm.DB) error {
	sqlDB, err := gdb.DB()
	if err != nil {
		return err
	}
	// Advisory locks are per-connection, so pin one connection for the run.
	conn, err := sqlDB.Conn(gdb.Statement.Context)
	if err != nil {
		return err
	}
	defer conn.Close()

	if _, err := conn.ExecContext(gdb.Statement.Context, "SELECT pg_advisory_lock($1)", migrationLockID); err != nil {
		return fmt.Errorf("migration lock: %w", err)
	}
	defer conn.ExecContext(gdb.Statement.Context, "SELECT pg_advisory_unlock($1)", migrationLockID)

	if _, err := conn.ExecContext(gdb.Statement.Context, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
	)`); err != nil {
		return err
	}

	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		var count int
		row := conn.QueryRowContext(gdb.Statement.Context, "SELECT count(*) FROM schema_migrations WHERE version = $1", name)
		if err := row.Scan(&count); err != nil {
			return err
		}
		if count > 0 {
			continue
		}
		body, err := migrationFS.ReadFile("migrations/" + name)
		if err != nil {
			return err
		}
		tx, err := conn.BeginTx(gdb.Statement.Context, nil)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(gdb.Statement.Context, string(body)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("migration %s: %w", name, err)
		}
		if _, err := tx.ExecContext(gdb.Statement.Context, "INSERT INTO schema_migrations(version) VALUES ($1)", name); err != nil {
			_ = tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
		log.Printf("[migrate] applied %s", name)
	}
	return nil
}

// ExpectedMigrations returns the ordered list of embedded migration versions.
func ExpectedMigrations() []string {
	entries, _ := migrationFS.ReadDir("migrations")
	var names []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	return names
}

// WaitForSchema blocks until every embedded migration is recorded as applied
// (i.e. the API process finished migrating) or the timeout elapses. The worker
// uses this instead of running AutoMigrate itself.
func WaitForSchema(gdb *gorm.DB, timeout time.Duration) error {
	want := ExpectedMigrations()
	deadline := time.Now().Add(timeout)
	for {
		var applied []string
		err := gdb.Raw("SELECT version FROM schema_migrations").Scan(&applied).Error
		if err == nil {
			have := make(map[string]bool, len(applied))
			for _, a := range applied {
				have[a] = true
			}
			missing := 0
			for _, w := range want {
				if !have[w] {
					missing++
				}
			}
			if missing == 0 {
				return nil
			}
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("schema not ready after %v (is the API running migrations?)", timeout)
		}
		time.Sleep(3 * time.Second)
	}
}

// MigrationSQL returns the raw SQL of an embedded migration (used by tests to
// re-run a backfill against fixture rows).
func MigrationSQL(name string) string {
	b, _ := migrationFS.ReadFile("migrations/" + name)
	return string(b)
}
