# Story-001: Sign up

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-002-auth]] | P0 | S | Ready | backend-nodejs, testing-security | Enabler-001, Enabler-002 | Story-002 |

## Statement
As a person running BudgetPal, I want to sign up with my email and a password, so that I get my own private space and am logged in straight away.

## Acceptance Criteria
- [ ] AC-1 - Given a valid new email and a 15 to 128 character password, when `POST /api/auth/signup` is called, then the response is 201 `{id, email}`, a session cookie is set and the stored hash starts with `$argon2id$`.
- [ ] AC-2 - Given an invalid email, a short or common password, or an extra field, when called, then the response is 400 problem+json with a field-level error and no row is written.
- [ ] AC-3 - Given an email already registered (case-insensitive), when called, then the response is 409 and no second row exists.
- [ ] AC-4 - Given any sign-up call, then the response body and the log output contain neither the password nor the hash.
- [ ] AC-5 - Given the route, then it is listed in the OpenAPI document at `/docs`.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/modules/auth/index.ts` - module router (auto-registered by SPEC-001); mounts sign-up
- `api/src/modules/auth/signup.ts` - route, schema and service function
- `api/src/modules/auth/schemas.ts` - zod schemas for credentials and user response
- `api/src/modules/auth/signup.test.ts` - API tests

## Test Hints
- integration: 201 and cookie, hash prefix read from the DB (AC-1); 400 cases (AC-2); duplicate with different case (AC-3); captured logs (AC-4); `/docs` JSON contains the path (AC-5)
