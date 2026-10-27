# Enabler-004: SQLite layer, migration runner, startup and shutdown

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-001-walking-skeleton]] | P0 | M | Ready | backend-nodejs | Enabler-002 | Story-001 |

## Outcome Statement
Enable every later spec to ship its tables by adding the SQLite connection, a forward-only numbered migration runner with checksums, the `api` entry point and graceful shutdown, so that each spec adds one SQL file in its reserved range.

## Acceptance Criteria
- [ ] AC-1 - Given a path, when the db opens, then WAL mode and foreign keys are on and the parent folder is created if missing.
- [ ] AC-2 - Given an empty database and `api/migrations/0001-init.sql`, when the runner runs, then it applies files in numeric order, each in one transaction, creates the table `app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`, and records name and SHA-256 in `_migrations`.
- [ ] AC-3 - Given an up-to-date database, when the runner runs again, then nothing is applied; if an applied file's checksum changed, startup fails naming the file; a file outside the numbering pattern is rejected.
- [ ] AC-4 - Given valid config, when `server.ts` starts, then it migrates, then listens on `PORT`; a failed migration exits non-zero before listening.
- [ ] AC-5 - Given a running server, when SIGTERM or SIGINT arrives, then it stops accepting requests, closes the db handle and exits 0.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS (4 files) · T PASS

## Impacted Files
- `api/src/kernel/db.ts` - `openDb(path)`, pragmas, close
- `api/src/kernel/migrate.ts` - `runMigrations(db, dir)`, checksum check
- `api/migrations/0001-init.sql` - creates `app_meta` (range 0001-0009 reserved for SPEC-001)
- `api/src/server.ts` - load config, open db, migrate, build app, listen, shutdown handlers

## Test Hints
- unit: runner on temp db: apply, rerun, changed checksum, bad file name (AC-2, AC-3); pragmas read back (AC-1)
- integration: spawn `server.ts` with a temp db, `GET /health` later; send SIGTERM and assert exit code 0 (AC-5); bad SQL file exits non-zero (AC-4)
- tests in `api/test/` (not counted in Files)
