# Story-001: Preview a CSV with column mapping

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-006-csv-import]] | P1 | M | Ready | backend-nodejs, testing-integration | Enabler-001 | Story-002 |

## Statement
As a BudgetPal user, I want to upload a CSV and see how my columns map to transactions before anything is saved, so that I can fix the mapping or the date format instead of importing bad data.

## Acceptance Criteria
- [ ] AC-1 - Given an authenticated user, when they `POST /import/preview` (multipart: `file`, JSON `mapping`, `dateFormat`, `accountId`), then the API returns headers, a suggested mapping, counts of valid and invalid rows, the first 20 valid rows, and invalid rows by line with a reason.
- [ ] AC-2 - Given a file with no `mapping`, when posted, then the response returns headers and a suggested mapping (by header names such as date, amount, description) with no rows validated.
- [ ] AC-3 - Given a preview, then no transaction is inserted and the file is held in memory only, never written to disk.
- [ ] AC-4 - Given an unauthenticated request, then 401; given an `accountId` that is not the caller's, then 404.
- [ ] AC-5 - Given a file over the caps, a bad mapping or a malformed multipart body, then 400 `problem+json` with field errors and no stack trace.
- [ ] AC-6 - Given the route, then it appears in the generated OpenAPI document and logs contain no CSV content, descriptions or amounts.

## INVEST
I PASS (needs only the Enabler-001 pipeline) · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/modules/import/index.ts` - module router entry for the SPEC-001 auto-registry
- `api/src/modules/import/import.routes.ts` - multipart preview route, `requireUser`
- `api/src/modules/import/import.service.ts` - preview use case (uses the repository for the ownership check)
- `api/src/modules/import/import.preview.test.ts` - route tests with Fastify `inject`

## Test Hints
- integration: valid file with mapping (AC-1) · file without mapping (AC-2) · row count in `transactions` unchanged and no file written (AC-3) · no cookie, other user's account (AC-4) · 6 MB file, 5001 rows, missing column (AC-5) · OpenAPI lists the route, captured logs have no row text (AC-6)
