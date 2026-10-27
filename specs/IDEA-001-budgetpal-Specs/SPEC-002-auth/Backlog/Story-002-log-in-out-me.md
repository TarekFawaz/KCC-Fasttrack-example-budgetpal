# Story-002: Log in, log out and read me

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-002-auth]] | P0 | S | Ready | backend-nodejs, testing-security | Enabler-003, Story-001 | Story-003 |

## Statement
As a returning user, I want to log in, log out and see who I am logged in as, so that only I can reach my data and I can end my session.

## Acceptance Criteria
- [ ] AC-1 - Given correct credentials, when `POST /api/auth/login` is called, then the response is 200 `{id, email}` and a new session cookie is set (`HttpOnly`, `SameSite=Lax`, `Path=/`; `Secure` only with `COOKIE_SECURE`).
- [ ] AC-2 - Given a wrong password or an unknown email, when called, then both return 401 with the identical generic message and no cookie.
- [ ] AC-3 - Given a logged-in user, when `POST /api/auth/logout` is called, then the session row is deleted, the cookie is cleared and the old cookie then gets 401 on `me`.
- [ ] AC-4 - Given a valid session, when `GET /api/auth/me` is called, then it returns that user only; with two users logged in each sees only their own email; without a session it returns 401.
- [ ] AC-5 - Given a session past its idle or absolute timeout, when `me` is called, then the response is 401.
- [ ] AC-6 - Given any login or logout call, then logs hold the event type and request id, no password, cookie or hash.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS (three thin routes on the same store) · T PASS

## Impacted Files
- `api/src/modules/auth/login.ts` - login, logout and `me` routes
- `api/src/modules/auth/index.ts` - mounts the three routes (extends Story-001's file)
- `api/src/modules/auth/login.test.ts` - API tests, including the two-user and expiry cases

## Test Hints
- integration: cookie attributes parsed from `set-cookie` (AC-1); message equality (AC-2); logout then `me` (AC-3); two users via `createLoggedInUser` (AC-4); expiry with injected clock (AC-5); log capture (AC-6)
