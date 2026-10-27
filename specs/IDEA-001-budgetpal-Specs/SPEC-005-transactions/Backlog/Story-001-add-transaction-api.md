# Story-001: Add a transaction (API)

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-005-transactions]] | P1 | S | Done | backend-nodejs | Enabler-001 | Story-002, Story-003 |

## Statement
As a budget owner, I want to record a transaction against one of my accounts and categories, so that my spending and income are tracked.

## Acceptance Criteria
- [ ] AC-1 - Given a signed-in user with an account and a category, when they `POST /transactions` with valid fields, then the response is 201 with the stored row and it is in the database.
- [ ] AC-2 - Given no session, when `POST /transactions` is called, then the response is 401.
- [ ] AC-3 - Given an account or category id owned by another user or unknown, when posting, then 400 problem+json names the field and nothing is written.
- [ ] AC-4 - Given a bad date, amount 0, a negative or fractional amount, a long description or an unknown field, when posting, then 400 with field errors and nothing is written.
- [ ] AC-5 - Given a successful add, then the log line has no description or amount.
- [ ] AC-6 - Given the app starts, then the module router is auto-registered and the route appears in the OpenAPI document at `/docs`.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/modules/transactions/index.ts` - router export for auto-registration
- `api/src/modules/transactions/transactions.routes.ts` - POST route, schemas, OpenAPI
- `api/src/modules/transactions/transactions.service.ts` - ownership checks, create
- `api/src/modules/transactions/transactions.routes.test.ts` - route tests

## Test Hints
- integration: Fastify `inject` happy path (AC-1), 401 (AC-2), foreign ids (AC-3), invalid bodies (AC-4)
- integration: capture log output (AC-5); GET `/docs/json` contains the path (AC-6)
