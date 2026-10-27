# Story-002: Confirm import and skip duplicates

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-006-csv-import]] | P1 | M | Ready | backend-nodejs, testing-integration | Enabler-001, Enabler-002, Story-001 | None |

## Statement
As a BudgetPal user, I want to confirm the import and be told how many rows were imported, skipped as duplicates and invalid, so that I can trust that my history is complete and not double-counted.

## Acceptance Criteria
- [ ] AC-1 - Given an authenticated user and a valid file, mapping, date format and own account, when they `POST /import/commit`, then valid rows are inserted in one transaction and the response returns `{imported, skipped, invalid, invalidRows[{line, reason}]}`.
- [ ] AC-2 - Given the same file imported twice, when the second commit runs, then `imported` is 0 and `skipped` equals the valid row count; duplicates inside one file also count as skipped.
- [ ] AC-3 - Given invalid rows mixed with valid ones, when committed, then valid rows are inserted, invalid rows are reported by line and never inserted.
- [ ] AC-4 - Given another user's `accountId`, then 404 and nothing is written; given user B importing the same rows as user A, then both users keep their own rows (two-user test).
- [ ] AC-5 - Given a file over the caps or an unauthenticated request, then 400 `problem+json` or 401 and nothing is written.
- [ ] AC-6 - Given a 5000-row file, when committed, then it finishes in under 10 s and imported rows appear in `GET /transactions` filtered by account and month (SPEC-005 API, read by test only).
- [ ] AC-7 - Given the route, then logs hold only counts and request id, never row content; the route is in the OpenAPI document.

## INVEST
I PASS (builds on Story-001's routes file, so it follows it) · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/modules/import/import.routes.ts` - add the commit route (file created by Story-001)
- `api/src/modules/import/import.service.ts` - commit use case: validate, hash, batch insert, counts
- `api/src/modules/import/import.commit.test.ts` - route and isolation tests, 5000-row timing

## Test Hints
- integration: counts for a 10-row file (AC-1) · import twice, in-file duplicate (AC-2) · 2 invalid of 10 (AC-3) · foreign account, two users (AC-4) · oversize, no cookie (AC-5) · 5000 rows timing, rows visible through the transactions list (AC-6) · log capture and OpenAPI (AC-7)
