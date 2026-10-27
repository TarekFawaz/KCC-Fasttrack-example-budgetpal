# Story-002: Edit and delete a transaction (API)

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-005-transactions]] | P1 | S | Ready | backend-nodejs | Story-001 | Story-005 |

## Statement
As a budget owner, I want to correct or remove a transaction, so that my records stay accurate.

## Acceptance Criteria
- [ ] AC-1 - Given my transaction, when I `PATCH /transactions/:id` with changed fields, then 200 returns the updated row and `updated_at` changes.
- [ ] AC-2 - Given my transaction, when I `DELETE /transactions/:id`, then 204 and the row is gone.
- [ ] AC-3 - Given another user's transaction id or an unknown id, when I patch or delete, then 404 and the row is unchanged.
- [ ] AC-4 - Given a patch with a foreign or unknown account or category id, then 400 with a field error and the row is unchanged.
- [ ] AC-5 - Given an empty patch, an invalid value or an unknown field, then 400 with field errors and the row is unchanged.
- [ ] AC-6 - Given no session, then both routes return 401.

## INVEST
I PASS (needs only the Story-001 route file) · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/modules/transactions/transactions.routes.ts` - PATCH and DELETE routes
- `api/src/modules/transactions/transactions.service.ts` - update and delete with ownership checks
- `api/src/modules/transactions/transactions.routes.test.ts` - edit/delete tests

## Test Hints
- integration: patch and delete as owner (AC-1, AC-2); two-user test (AC-3)
- integration: foreign ids (AC-4), invalid patches (AC-5), no cookie (AC-6)
