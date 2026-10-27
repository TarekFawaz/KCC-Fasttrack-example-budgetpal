---
id: SPEC-002
title: Auth
status: Done
depends_on: [SPEC-001]
---

# SPEC-002: Auth

| Priority | Category | Status | Wave | Depends on | Blocks | Index |
|--|--|--|--|--|--|--|
| P0 | Feature | Done | 2 | [[../SPEC-001-walking-skeleton/SPEC-001-walking-skeleton\|SPEC-001]] | SPEC-003, SPEC-004 | [[../IDEA-001-budgetpal-Specs]] |

## Delivery Brief
- **Who:** a person running BudgetPal on their own machine (several isolated local users are possible).
- **Gets:** sign up with email and password, log in, log out, and read `me`; every later data route can use `requireUser` and one validation helper.
- **Value:** all financial data is per user from the first feature on; later specs add modules without touching auth.
- **Measured by:** the API tests pass (hash prefix `$argon2id$`, cookie attributes, 400 on bad input, 401 without a session, two-user `me` isolation) and the sign-up and login pages work in a browser against `docker compose up`.
- **Out of scope:** CSRF tokens, rate limiting, lockout, audit log, session rotation after login, proxy-aware IP (human waivers); password reset, email, roles, "delete my account" (open question 4: not in v1).

## Acceptance Criteria
- [ ] AC-1 - `POST /api/auth/signup` with a valid email and a password of 15 to 128 characters creates the user, starts a session and returns 201 with `{id, email}`; a duplicate email returns 409.
- [ ] AC-2 - Invalid email, short or common password, or an unknown field returns 400 `application/problem+json` with field-level errors and writes nothing.
- [ ] AC-3 - Passwords are stored only as Argon2id hashes (`$argon2id$` prefix; bcrypt only as documented build fallback); no password or hash appears in a response or a log line.
- [ ] AC-4 - `POST /api/auth/login` sets the session cookie; a wrong password and an unknown email return the same generic 401 message.
- [ ] AC-5 - The session cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` only when env `COOKIE_SECURE` is true; only the SHA-256 hash of the 256-bit session id is stored.
- [ ] AC-6 - `POST /api/auth/logout` deletes the server-side session and clears the cookie; the old cookie then gets 401.
- [ ] AC-7 - `GET /api/auth/me` returns the current user, or 401 without a valid session; an idle (24 h) or absolute (30 d) expired session gets 401 (both env-tunable).
- [ ] AC-8 - `requireUser` guards a route, attaches the user id to the request and is deny-by-default; a test helper creates a logged-in user for later specs' two-user isolation tests.
- [ ] AC-9 - A shared zod validation helper turns body, params and query failures into RFC 9457 problem bodies with no stack trace.
- [ ] AC-10 - The sign-up and login pages show inline field errors, are keyboard reachable with labelled inputs, pass an axe check, and a logged-in user can log out from the app shell.
- [ ] AC-11 - Production readiness: session timeouts and `COOKIE_SECURE` come from env; auth failures log event type and request id only, never credentials; health, graceful shutdown and rollback are n/a here (owned by SPEC-001, forward-only migration 0010).

## Backlog
| Key | Type | Title | Status | Depends on | Wave | Files | File |
|--|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | Validation helper and problem+json errors | Ready | None | 1 | 3 | [[Backlog/Enabler-001-validation-and-errors]] |
| Enabler-002 | Enabler | Users and sessions tables, password hashing, session store | Ready | None | 1 | 5 | [[Backlog/Enabler-002-password-and-session-store]] |
| Enabler-003 | Enabler | requireUser and logged-in test helper | Ready | Enabler-002 | 2 | 3 | [[Backlog/Enabler-003-require-user]] |
| Story-001 | Story | Sign up | Ready | Enabler-001, Enabler-002 | 2 | 4 | [[Backlog/Story-001-sign-up]] |
| Story-002 | Story | Log in, log out and read me | Ready | Enabler-003, Story-001 | 3 | 3 | [[Backlog/Story-002-log-in-out-me]] |
| Story-003 | Story | Sign-up and login pages | Ready | Story-002 | 4 | 5 | [[Backlog/Story-003-auth-pages]] |

## Architecture references
- Decisions: D-03 (zod validation), D-06 (Argon2id), D-07 (sessions), D-08 (requireUser, user scoping), D-09 (open registration), D-10, D-11 (problem+json), D-16, D-17, D-20
- Containers: Web, API, SQLite database
- Architecture Document: [[../../../architecture/architecture]]

## Risks
- Native `argon2` fails to build in Docker - SPEC-001 uses Debian-slim; bcrypt is the documented fallback and needs a Decisions row.
- Module routers register in no fixed order - `requireUser` reads the cookie with `@fastify/cookie`'s `parse`, so it does not depend on plugin order.
- Files shared across items (`modules/auth/index.ts`) - Story-001 creates it in wave 2, Story-002 extends it in wave 3, so no two same-wave items touch it.
- Sign-up enumeration and no throttling - accepted for loopback only (waivers in the Architecture Document); void if GR-001 is broken.
