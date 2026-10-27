# Story-002: Edit and delete accounts with in-use rule (API)

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-004-accounts]] | P1 | S | Ready | backend-nodejs, testing-integration | Story-001 | Story-004 |

## Statement
As a signed-in user, I want to read, edit and delete one of my accounts, so that I can correct mistakes and remove accounts I no longer use.

## Acceptance Criteria
- [ ] AC-1 - Given my account, when `GET /api/accounts/:id` is called, then the response is 200 with it; given a malformed or unknown id, then 400 or 404.
- [ ] AC-2 - Given my account, when `PUT /api/accounts/:id` has valid fields, then the response is 200 with the new values; a name taken by another of my accounts returns 409; invalid input returns 400 and the row is unchanged.
- [ ] AC-3 - Given an account no transaction references, when `DELETE /api/accounts/:id` is called, then the response is 204 and the account is gone.
- [ ] AC-4 - Given an account referenced by a foreign-key row, when `DELETE` is called, then the response is 409 problem+json naming the rule and the account stays.
- [ ] AC-5 - Given user A's account id, when user B calls get, update or delete, then each returns 404 and A's row is unchanged.
- [ ] AC-6 - Given no session, when any of these routes is called, then the response is 401.

## INVEST
I PASS (needs Story-001 routes) · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/modules/accounts/accounts.service.ts` - get, update, remove use cases
- `api/src/modules/accounts/accounts.routes.ts` - `GET/PUT/DELETE /api/accounts/:id`
- `api/src/modules/accounts/accounts.isolation.test.ts` - edit/delete tests and the two-user isolation test

## Test Hints
- integration (AC-1 to AC-3, AC-6): `inject` against a temp database.
- integration (AC-4): the test creates `t_ref` with `ON DELETE RESTRICT` pointing at `accounts`, inserts a row, then deletes.
- integration (AC-5): QG-ISOLATION two-user test for read, update and delete; list shows none of A's rows.

## Notes
Both stories edit `accounts.service.ts` and `accounts.routes.ts`; they sit in different waves, so they never run together.
