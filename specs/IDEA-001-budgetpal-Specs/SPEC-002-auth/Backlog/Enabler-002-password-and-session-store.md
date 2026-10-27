# Enabler-002: Users and sessions tables, password hashing, session store

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-002-auth]] | P0 | M | Ready | backend-nodejs, testing-unit | None | Enabler-003, Story-001, Story-002 |

## Outcome Statement
Enable sign-up and login by adding the `users` and `sessions` tables, Argon2id password hashing with a common-password check, and a hashed-id session store, so that credentials and sessions are stored the way D-06 and D-07 require.

## Acceptance Criteria
- [ ] AC-1 - Given migration `0010-auth.sql` runs once on an empty database, then `users` (id, email unique case-insensitive, password_hash, created_at) and `sessions` (id_hash primary key, user_id foreign key with cascade, created_at, last_seen_at, expires_at) exist and re-running is a no-op.
- [ ] AC-2 - Given a password, when hashed, then the result starts with `$argon2id$` (m=19 MiB, t=2, p=1 floor) and verifies only against the same password.
- [ ] AC-3 - Given a password under 15 or over 128 characters, or one on the bundled offline common-password list, when checked, then it is rejected; a 15-character non-listed password with spaces or no symbols is accepted (no composition rules).
- [ ] AC-4 - Given a created session, then the cookie value is 256 random bits, only its SHA-256 hash is stored, and lookup by cookie value returns the user.
- [ ] AC-5 - Given a session past the idle timeout (default 24 h, env) or the absolute timeout (default 30 d, env), when looked up, then it is treated as absent and removed; a valid lookup refreshes `last_seen_at`.
- [ ] AC-6 - Given the cookie helpers, then the cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` only when `COOKIE_SECURE` is true.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS (one storage concern; no routes) · T PASS

## Impacted Files
- `api/migrations/0010-auth.sql` - users and sessions tables (reserved range 0010-0019)
- `api/src/modules/auth/password.ts` - hash, verify, policy check
- `api/src/modules/auth/common-passwords.txt` - bundled offline list
- `api/src/modules/auth/sessions.ts` - create, find, delete, cookie name and serialize helpers
- `api/src/modules/auth/repository.ts` - user and session queries (parameterised)

## Test Hints
- unit: hash prefix and verify (AC-2); length and list policy (AC-3); cookie attributes (AC-6)
- integration: migration on temp DB, twice (AC-1); session lifecycle and expiry with an injected clock (AC-4, AC-5)
