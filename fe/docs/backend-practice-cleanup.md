# Backend cleanup: fold Practice into Q Bank

Status: **proposal, nothing changed in `be/`.** Found on 2026-11-14 by reading the backend. The student app already shows Practice sets under Q Bank (see `screen-inventory.md`).

Practice is identical to Q Bank in `be/`:
- The publish gate only treats Test Series differently (`question_service.go` `CheckPublishGate`). Q Bank and Practice follow the same rules.
- `module_type` is plain text in the database, with no constraint (`0000_baseline.sql`), so values are checked only in Go.
- `GET /tests` takes a single `module_type`, has no paging, and orders by newest or rating. Merging Q Bank and Practice on the client is safe.

Where "practice" appears (for a later cleanup, if you approve backend work):
1. `models/assessment.go` and `models/enums.go`: the `ModulePractice` constant.
2. `validate/validate.go` `ModuleTypes`, `handlers/tests.go` create validation and swagger enums, `services/progress_service.go` and `handlers/analytics.go` module filters.
3. A separate field, question `source_type` (qbank, practice, test_series, pyq, other): used by `sourceTypeFor`, CSV import (`csv_import_service.go`), `custom_tests.go` labels and the setting `custom_test.eligible_sources` (default `qbank,practice,pyq`). This describes where a question came from, not the test type. Fold it only if you want one source too.
4. Tests: `testutil.go` and `db/migrate_test.go`.

Suggested order, if you go ahead:
1. Migration: `UPDATE tests SET module_type='qbank' WHERE module_type='practice'` (and questions' `source_type` if folding it).
2. Keep accepting `practice` on read for old app builds, mapped to `qbank`, for a release or two.
3. Then remove the constant, validation entries and swagger enums.
4. Teacher create-test drops the option in the same release.

## Decisions needed
- Fold question `source_type` "practice" into "qbank" too, or keep it?
- How long to keep accepting `practice` from old app builds?
- Approve backend changes (the frontend-only scope needs an explicit OK).
