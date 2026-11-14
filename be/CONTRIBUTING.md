# Backend contribution checklist

Layers: **handler** (bind → one service call → respond via `httpx`) → **service** (rules, transactions, `*CodedError`) → DB.

**Handlers**
- [ ] No `tx`, no raw SQL, no business rules in handlers. Errors go through `httpx.Fail` / `respondErr` (`{error, code, details}`); never return `err.Error()` of an internal error.
- [ ] Every list endpoint is paginated (`paged(...)` / `pagination`).

**Services / SQL**
- [ ] Every DB call uses `.WithContext(ctx)` and its `.Error` is checked.
- [ ] Multi-row writes are in one transaction. State changes are `UPDATE … WHERE id=? AND status IN (allowed)` and check `RowsAffected`.
- [ ] `First()` on a non-unique filter has an explicit `Order(…)`.
- [ ] SQL values are bound (`?`). Never concatenate non-constant text into SQL.
- [ ] Days/streaks/quotas use `clock.AppDay` / `clock.StartOfAppDay` — never `Truncate(24h)`.
- [ ] Ordering is deterministic (seeded, with an `id` tie-breaker).
- [ ] Background work: `jobs.EnqueueJob(tx, …)` in the same transaction; handlers are idempotent.

**Schema**
- [ ] Schema change ⇒ new numbered file in `internal/db/migrations` (production never runs AutoMigrate). `TestFreshDatabaseFromMigrationsMatchesModels` must stay green.
- [ ] Owned children get `ON DELETE CASCADE` FKs; polymorphic references are cleaned by `items.Cleanup`.
- [ ] Rules that matter are DB constraints (unique / partial unique / CHECK), not just handler checks.
- [ ] No `default:` GORM tag on a bool/number whose zero value is meaningful — set the value explicitly.

**Cross-cutting**
- [ ] Paid-content access: `SubscriptionService.Allow` / `AccessFor` — never re-implement subscription/KYC checks.
- [ ] Authoring ownership: `authz.Scope` / `authz.OwnsUploadKey`.
- [ ] New reviewable entity: add a `services.Reviewable`. New rateable/bookmarkable type: add to `items`.
- [ ] New tunable: `settings.Defaults`; read via `settings.*` only.
- [ ] `make swagger` after changing annotations; `make test` before pushing.
