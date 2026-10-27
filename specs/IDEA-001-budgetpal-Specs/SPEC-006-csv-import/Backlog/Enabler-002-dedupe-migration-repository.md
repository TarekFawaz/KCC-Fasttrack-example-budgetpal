# Enabler-002: Dedupe migration and import repository

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-006-csv-import]] | P1 | S | Ready | backend-nodejs, testing-integration | None | Story-002 |

## Outcome Statement
Enable duplicate-safe bulk inserts by adding the dedupe column and unique index and a user-scoped import repository, so that a re-import cannot add a row twice even under a race.

## Acceptance Criteria
- [ ] AC-1 - Given the migration `0060-import-dedupe.sql` (range 0060-0069), when the runner applies it after SPEC-005's, then `transactions.dedupe_key` (TEXT, nullable) exists with a partial unique index on `(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL`; existing rows are untouched.
- [ ] AC-2 - Given a user and an account id, when `accountBelongsToUser(userId, accountId)` runs, then it is true only for the owner's account.
- [ ] AC-3 - Given a batch of rows, when `insertBatch(userId, accountId, rows)` runs in one `better-sqlite3` transaction using `INSERT ... ON CONFLICT DO NOTHING`, then it returns per-row inserted/duplicate results and a failure rolls the whole batch back.
- [ ] AC-4 - Given two users with the same row, when both import it, then both rows are stored (the key is per user).
- [ ] AC-5 - Given the migration, then money columns stay INTEGER and no REAL/FLOAT/DECIMAL type appears (GR-007); all SQL uses placeholders and lives only in `*.repository.ts` (GR-002, GR-003).

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `api/migrations/0060-import-dedupe.sql` - add column and partial unique index (folder per SPEC-001 runner)
- `api/src/modules/import/import.repository.ts` - ownership check, batch insert
- `api/src/modules/import/import.repository.test.ts` - integration tests on a temp SQLite file

## Test Hints
- integration: migrate up on a DB holding SPEC-005 rows (AC-1) · foreign account returns false (AC-2) · duplicate rows in one batch and across batches, forced error rolls back (AC-3) · two-user same row (AC-4) · static rules SR-002, SR-003, SR-008 pass (AC-5)
