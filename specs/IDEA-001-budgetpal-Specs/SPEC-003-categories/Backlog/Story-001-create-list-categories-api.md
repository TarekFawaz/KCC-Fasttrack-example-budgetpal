# Story-001: Create and list categories (API)

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-003-categories]] | P1 | S | Ready | backend-nodejs, testing-integration | Enabler-001 | Story-002, Story-003 |

## Statement
As a signed-in user, I want to create categories and list mine through the API, so that I can group my money by purpose.

## Acceptance Criteria
- [ ] AC-1 - Given a signed-in user, when `POST /api/categories` sends `{name, kind}`, then the response is 201 with the new category and `GET /api/categories` lists it.
- [ ] AC-2 - Given the user already has "Food", when they post "food", then the response is 409 problem+json and the list is unchanged; when another user posts "Food", it is 201.
- [ ] AC-3 - Given an empty name, a name over 60 chars, kind `other`, or an extra field, when posted, then the response is 400 problem+json with field errors and nothing is written.
- [ ] AC-4 - Given no session, when either route is called, then the response is 401; given two users, `GET` returns only the caller's categories.
- [ ] AC-5 - Given the router, when the API starts, then `api/src/modules/categories/index.ts` is auto-registered under `/api/categories`, both routes declare zod schemas, and they appear in the OpenAPI document.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/modules/categories/categories.service.ts` - create (maps duplicate error to a 409 problem) and list.
- `api/src/modules/categories/categories.routes.ts` - `POST` and `GET` with `requireUser` and zod schemas.
- `api/src/modules/categories/index.ts` - exports the router for auto-registration.
- `api/src/modules/categories/categories.routes.test.ts` - Fastify `inject` tests.

## Test Hints
- integration: create then list (AC-1), duplicate same user vs other user (AC-2), invalid bodies (AC-3), 401 and two-user list isolation (AC-4), `/docs` JSON contains the paths (AC-5).
