# Enabler-003: requireUser and logged-in test helper

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-002-auth]] | P0 | S | Ready | backend-nodejs, testing-security | Enabler-002 | Story-002, SPEC-003, SPEC-004 |

## Outcome Statement
Enable deny-by-default data routes by adding a `requireUser` preHandler and a test helper that creates logged-in users, so that every later module scopes data by `user_id` and proves isolation with two users.

## Acceptance Criteria
- [ ] AC-1 - Given a route with `requireUser`, when the request has no cookie, an unknown session or an expired one, then the response is 401 problem+json and the handler does not run.
- [ ] AC-2 - Given a valid session cookie, when the route runs, then `request.user.id` holds the user's id; the cookie is read with `@fastify/cookie`'s `parse`, so no plugin registration order matters.
- [ ] AC-3 - Given the test helper `createLoggedInUser(app, email?)`, when called twice, then it returns two distinct users with their own cookies, usable for cross-user 404 tests.
- [ ] AC-4 - Given a 401, then logs hold the event type and request id only, never the cookie.

## INVEST
I PASS · N PASS · V PASS (every data route depends on it) · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/kernel/require-user.ts` - preHandler and `request.user` typing
- `api/test/helpers/auth.ts` - `createLoggedInUser` (inserts a user and session directly through the repository)
- `api/src/kernel/require-user.test.ts` - tests on a throwaway guarded route

## Test Hints
- unit: no cookie, bad cookie, expired session -> 401 (AC-1)
- integration: two helper users see their own ids on a guarded echo route (AC-2, AC-3); captured log output lacks the cookie (AC-4)
