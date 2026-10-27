# Story-001: Create and list accounts (API)

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-004-accounts]] | P1 | S | Ready | backend-nodejs, testing-integration | Enabler-001 | Story-002, Story-003 |

## Statement
As a signed-in user, I want to create accounts and list mine, so that I can later attach transactions to them.

## Acceptance Criteria
- [ ] AC-1 - Given a session, when `POST /api/accounts` has a valid name, type and opening balance, then the response is 201 with the account and it appears in `GET /api/accounts`, ordered by name.
- [ ] AC-2 - Given an existing name for the same user in any case, when `POST` repeats it, then the response is 409 problem+json and no row is added.
- [ ] AC-3 - Given invalid input (empty name, unknown type, `12.5` balance, unknown field), when `POST` is sent, then the response is 400 with field-level errors and nothing is written.
- [ ] AC-4 - Given no session, when either route is called, then the response is 401; given users A and B, then `GET` for B never contains A's accounts.
- [ ] AC-5 - Given the module folder, when the API starts, then the router is auto-registered and both routes appear in `/docs/json` with request and response schemas.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/modules/accounts/accounts.service.ts` - create and list use cases, maps repository errors
- `api/src/modules/accounts/accounts.routes.ts` - `POST /api/accounts`, `GET /api/accounts` behind `requireUser`
- `api/src/modules/accounts/index.ts` - exports the router for auto-registration
- `api/src/modules/accounts/accounts.routes.test.ts` - Fastify `inject` tests

## Test Hints
- integration: sign up two users with the SPEC-002 test helper, cover AC-1 to AC-4 with `inject`.
- integration (AC-5): fetch `/docs/json`, assert both paths and 201/400/401/409 responses.
- unit: service maps `DuplicateName` to 409.
