# Enabler-001: Dashboard module scaffold, schemas and index migration

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-008-dashboard]] | P2 | S | Ready | backend-nodejs | None | Story-001, Story-002 |

## Outcome Statement
Enable the two dashboard endpoints by creating the auto-registered `dashboard` API module, its zod query and response schemas, and an index on transactions, so that the stories add only handlers and SQL.

## Acceptance Criteria
- [ ] AC-1 - Given the api starts, when modules are auto-registered, then `api/src/modules/dashboard/index.ts` mounts under `/api/dashboard` with no edit to any shared router file.
- [ ] AC-2 - Given migration `0080` runs on a database that already has the transactions table, when it completes, then an index on `(user_id, date)` exists and re-running the runner does nothing.
- [ ] AC-3 - Given the schemas, when `month=2026-13`, `months=0`, `months=25` or `end=abc` is parsed, then validation fails; `month=2026-02` parses and yields the half-open range `2026-02-01` to `2026-03-01`.
- [ ] AC-4 - Given the routes are registered, when the OpenAPI document is generated, then it lists both dashboard paths with their schemas (D-04).

## INVEST
I PASS · N PASS · V PASS (unblocks both endpoints) · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/modules/dashboard/index.ts` - module entry exporting the router for auto-registration; registers the two route plugins
- `api/src/modules/dashboard/schemas.ts` - zod query, response and month-range helpers
- `api/src/modules/dashboard/spending.routes.ts` - empty route plugin, filled by Story-001
- `api/src/modules/dashboard/trend.routes.ts` - empty route plugin, filled by Story-002
- `api/migrations/0080-dashboard-transactions-index.sql` - index on `transactions(user_id, date)`

## Test Hints
- unit: month parsing, range boundaries (December to January rollover, leap February), bad values rejected (AC-3)
- integration: boot the app, assert the module is registered and the index exists in `sqlite_master`, runner idempotent (AC-1, AC-2); OpenAPI lists both paths (AC-4)
