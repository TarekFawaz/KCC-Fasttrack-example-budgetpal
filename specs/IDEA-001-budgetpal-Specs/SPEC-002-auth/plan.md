---
id: SPEC-002-plan
spec: SPEC-002
status: ready
version: 1.0.0
profile: fasttrack
---

# SPEC-002 Implementation Plan

## Dependency Check
- SPEC-001 (walking skeleton) is the only dependency. It has no `plan.md` in this lane and no code in this worktree yet; planned against its declared contracts: `buildApp(config)` with module auto-registration of `api/src/modules/*/index.ts`, `loadConfig()` (`COOKIE_SECURE`), pino logger, `openDb` + `runMigrations` (range 0001-0009), web feature registry `web/src/features/*/feature.ts`, `/docs`. An approved review is not needed to plan; IMPLEMENT waits for SPEC-001 to be APPROVED/merged.
- No blocker. All backlog items passed INVEST, have `AC-N`, Test Hints, dialects and <= 5 Impacted Files.

## Architecture Gate Check
Fast track: no spec `arch.md`; design from the spec's `## Architecture references` and `architecture/architecture.md`. C2 containers: Web, API, SQLite database (no `c4-component` document exists). Decisions confirmed against the plan: D-03 (fastify + zod), D-06 (`argon2@^0.41`, Argon2id m=19 MiB t=2 p=1), D-07 (own session store, `@fastify/cookie@^11`, `node:crypto`), D-08 (`requireUser`, `user_id` scoping), D-09, D-10, D-11 (problem+json), D-16, D-17, D-20 (all Accepted or Accepted (assumed); none blocks). D-22 is `Proposed` (loopback binding): no SPEC-002 item depends on it. No stack deviation.
Ordering: storage and validation first (wave 1), guard and sign-up (wave 2), login/logout/me on the same module file (wave 3, extends `index.ts`), UI last (wave 4).
Gates: QG-ARCH-CONFORMANCE, QG-TRACE, QG-SCOPE, QG-QUALITY, QG-STATIC, QG-API-CONFORMANCE, QG-VALIDATION, QG-AUTH, QG-A11Y, QG-PROD, QG-BUGS (the isolation, smoke and import gates do not apply: isolation is E3-E8 only and the helper here serves it; no compose, Dockerfile or CSV change).

## Backlog Coverage
| Item | Type | Dialect | Complexity | Wave | Plan coverage | Notes |
|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | backend-nodejs | medium | 1 | Covered | `validate()` + problem+json builder; no new package |
| Enabler-002 | Enabler | backend-nodejs | high | 1 | Covered | crypto, secrets, sessions; adds `argon2` and two env names (see allowances) |
| Enabler-003 | Enabler | backend-nodejs | high | 2 | Covered | authorization guard, deny by default |
| Story-001 | Story | backend-nodejs | high | 2 | Covered | untrusted input, credentials, personal data |
| Story-002 | Story | backend-nodejs | high | 3 | Covered | authentication, cookies |
| Story-003 | Story | frontend-react | medium | 4 | Covered | pages, a11y, mocked API tests |

## Ordered Changes
Paths follow the backlog and `architecture.md` (pnpm workspace `api/`, `web/` at the repo root), see Risk Flags.
1. **Enabler-001** `api/src/kernel/problem.ts`: RFC 9457 builder (`type`, `title`, `status`, `detail`, `errors[{field,message}]`) and `registerProblemHandler(app)` (generic 500, no stack, no internal message). Why: AC-9, GR-016.
2. **Enabler-001** `api/src/kernel/validate.ts`: `validate({body,params,query})` preHandler over zod `safeParse`, 400 problem on failure, typed parsed data on `request`. Depends on 1. Why: AC-2, AC-9, GR-004.
3. **Enabler-001** `api/src/kernel/validate.test.ts`.
4. **Enabler-002** `api/migrations/0010-auth.sql`: `users` (email `COLLATE NOCASE` unique), `sessions` (`id_hash` PK, `user_id` FK cascade, `created_at`, `last_seen_at`, `expires_at`); `INTEGER`/`TEXT` only; no `IF NOT EXISTS` tricks, the runner makes it a no-op the second time. Why: AC-1, GR-014.
5. **Enabler-002** `api/src/modules/auth/repository.ts` (all SQL, parameterised, `.prepare` only here) and `api/src/modules/auth/password.ts` + `common-passwords.txt` (hash/verify/policy; argon2id m=19456 KiB t=2 p=1). Why: AC-2, AC-3, GR-003, GR-010.
6. **Enabler-002** `api/src/modules/auth/sessions.ts`: `create/find/delete`, `randomBytes(32)`, SHA-256 hash stored, idle and absolute expiry with injectable clock, cookie name and `serialize` options. Depends on 4, 5. Why: AC-4..AC-6, GR-005, GR-010.
7. **Enabler-002** (allowances) `api/src/kernel/config.ts` + `.env.example` add `SESSION_IDLE_HOURS` (24) and `SESSION_ABSOLUTE_DAYS` (30); `api/package.json` + `pnpm-lock.yaml` add `argon2@^0.41`. Why: AC-11, D-17.
8. **Enabler-003** `api/src/kernel/require-user.ts`: preHandler using `@fastify/cookie` `parse` on the raw header, `sessions.find`, sets `request.user = {id}`, 401 problem otherwise, logs event type and request id only. Depends on 6. `api/test/helpers/auth.ts`: `createLoggedInUser(app, email?)` via repository + sessions. Tests in `require-user.test.ts`.
9. **Story-001** `api/src/modules/auth/schemas.ts` (zod `.strict()` credentials and `{id,email}` response, with OpenAPI metadata), `signup.ts` (route + service, 201/400/409, sets cookie), `index.ts` (module plugin: registers problem handler in its scope, mounts sign-up), `signup.test.ts`. Depends on 2, 5, 6.
10. **Story-002** `api/src/modules/auth/login.ts` (login, logout, me; logout and me behind `requireUser`), `index.ts` mounts them, `login.test.ts`. Depends on 8, 9.
11. **Story-003** `web/src/features/auth/authApi.ts`, `SignUpPage.tsx`, `LoginPage.tsx`, `feature.ts` (routes `/signup`, `/login`, log-out nav entry), `auth.test.tsx`. Depends on 10 (API contract).

## Waves
Authoritative; the spec's `Wave` column was a first cut and is unchanged.

| Wave | Items | Files | File-disjoint | Notes |
|--|--|--|--|--|
| 1 | Enabler-001, Enabler-002 | 3 + 5 (+ allowances) | yes | kernel validate/problem vs auth storage; only Enabler-002 touches `api/package.json`, `config.ts`, `.env.example`, lockfile |
| 2 | Enabler-003, Story-001 | 3 + 4 | yes | `kernel/require-user*`, `test/helpers/auth.ts` vs `modules/auth/{index,signup,schemas}*` |
| 3 | Story-002 | 3 | yes (single item) | extends the module `index.ts` created in wave 2 |
| 4 | Story-003 | 5 | yes (single item) | web only |

## Dialects Loaded
- `backend-nodejs` - Fastify/zod/SQLite items (Enabler-001..003, Story-001, Story-002)
- `frontend-react` - Story-003
- `testing-unit` - mandatory
- `testing-integration` - mandatory
- `testing-security` - scoped by Enabler-003, Story-001, Story-002 (credential and log-leak tests)

## New Files
All listed in each item's Impacted Files; test files sit beside the code. Extra files are in the allowances table.

## Toolchain
| Tool | Version |
|--|--|
| node | >=22 <25 |
| pnpm | >=9 |
| typescript | ^5 |
| fastify | ^5 |
| fastify-type-provider-zod | ^4 |
| zod | ^3 |
| @fastify/cookie | ^11 |
| better-sqlite3 | ^12 |
| argon2 | ^0.41 |
| pino | ^9 |
| react | ^18 |
| react-router | ^6 |
| @tanstack/react-query | ^5 |
| vitest | ^2 |
| @testing-library/react | ^16 |
| axe-core | ^4 |

## Wave file allowances
Paths here are the repo-root workspace paths (`api/`, `web/`), matching the backlog; no file lives under `src/IDEA-001-budgetpal/`.

| Item | Paths (backticked) |
|--|--|
| Enabler-001 | `api/test/**` |
| Enabler-002 | `api/package.json`, `pnpm-lock.yaml`, `api/src/kernel/config.ts`, `api/src/kernel/config.test.ts`, `.env.example`, `api/test/**` |
| Enabler-003 | `api/test/**` |
| Story-001 | `api/test/**` |
| Story-002 | `api/test/**` |
| Story-003 | `web/test/**` |

## Risk Flags
- **Path prefix.** The rule says `src/IDEA-{ID}-{slug}/...`, but the backlog, `architecture.md` (D-24, module paths) and SPEC-001's root `pnpm-workspace.yaml` fix `api/` and `web/` at the repo root. The plan follows them; moving SPEC-002 alone would break SPEC-001's workspace. `check-wave-scope` only watches `src/`, so wave scope is enforced by the verifier from Impacted Files and the allowances table. Raise with the orchestrator if a `src/` prefix is required.
- **Env names (D-17, AC-11).** Timeouts must be env-tunable but `config.ts` (SPEC-001) holds six names. Enabler-002 adds `SESSION_IDLE_HOURS` and `SESSION_ABSOLUTE_DAYS` (additive, optional, defaults 24 and 30) and the empty `.env.example` entries. No Decisions row changes; the verifier should accept the two names under D-07 "env-tunable".
- **Error handler overlap.** SPEC-001 Enabler-002 also builds problem+json errors in `app.ts`. Enabler-001 must reuse the same body shape; `problem.ts` is exported and registered in the auth module scope (`index.ts`, wave 2) so no edit to `app.ts` is needed. If SPEC-001's handler already covers 400/500 identically, `registerProblemHandler` is a no-op wrapper; the shape is pinned by T-001..T-003.
- **kernel to module import.** `require-user.ts` (kernel) imports `modules/auth/sessions`. SR-006 only polices module-to-module imports, so QG-STATIC passes; if a reviewer objects, switch to a decorated `app.findSession` set by the auth plugin (does not change files).
- **Logging and SR-010.** Log calls must carry only `{event, reqId}`; do not put the words password, hash, cookie, sessionId, description or amount on a log line (SR-010 is a line grep). Never read `.stack` (SR-017).
- **SQL location (SR-002).** All SQL only in `repository.ts`; `sessions.ts`, `require-user.ts` and the test helper go through it.
- **Logout** sits behind `requireUser` (deny by default): no session gives 401. Plan choice; not stated in the AC.
- **Native build.** `argon2` may fail to build in the SPEC-001 Debian-slim image; bcrypt is the documented fallback and needs a new Decisions row first (stop and report, do not swap silently).
- **OpenAPI.** D-04 serves a generated document; no checked-in snapshot is planned because one shared file would collide across parallel specs. API-standards "checked-in document" is covered by `/docs/json` tests (T-022, T-029) per D-04; flag if the verifier wants a snapshot.
- Waivers (CSRF, throttling, lockout, rotation, audit, proxy IP) are not implemented; void if GR-001 breaks.

## Atomic test cases

| Test ID | Item | AC | Level | Description |
|--|--|--|--|--|
| T-001 | Enabler-001 | AC-1 | unit | bad, missing and unknown (`.strict()`) body field: 400 `application/problem+json`, `errors[{field,message}]`, handler spy not called |
| T-002 | Enabler-001 | AC-2 | unit | invalid params and invalid query return the same 400 shape |
| T-003 | Enabler-001 | AC-3 | integration | route throwing `Error("secret detail")`: 500 problem body, body lacks the message and any stack |
| T-004 | Enabler-001 | AC-4 | unit | valid request: handler receives parsed, typed data (coerced query number) |
| T-005 | Enabler-002 | AC-1 | integration | `0010-auth.sql` on a temp DB via the runner, twice: tables, unique NOCASE email, FK cascade (delete user removes sessions), second run no-op |
| T-006 | Enabler-002 | AC-2 | unit | hash starts with `$argon2id$` and encodes m=19456 t=2 p=1; verifies same password, rejects another |
| T-007 | Enabler-002 | AC-3 | unit | 14 and 129 chars rejected, listed password rejected, 15-char phrase with spaces and no symbols accepted |
| T-008 | Enabler-002 | AC-4 | unit | cookie value decodes to 32 random bytes; stored `id_hash` equals SHA-256 of it and never the raw value; lookup returns user |
| T-009 | Enabler-002 | AC-5 | integration | injected clock: idle (24 h) and absolute (30 d) expiry give no session and delete the row; valid lookup bumps `last_seen_at`; env values (`SESSION_IDLE_HOURS`, `SESSION_ABSOLUTE_DAYS`) change the limits |
| T-010 | Enabler-002 | AC-6 | unit | serialized cookie has `HttpOnly`, `SameSite=Lax`, `Path=/`; `Secure` only when `COOKIE_SECURE` true |
| T-011 | Enabler-003 | AC-1 | unit | no cookie, unknown session and expired session on a guarded route: 401 problem+json, handler not run |
| T-012 | Enabler-003 | AC-2 | integration | valid cookie: `request.user.id` equals the user id; works with the guard registered before and after the cookie plugin |
| T-013 | Enabler-003 | AC-3 | integration | `createLoggedInUser` twice: two distinct ids and cookies; each sees its own id on the echo route |
| T-014 | Enabler-003 | AC-4 | security | captured log output after a 401 holds event type and request id, not the cookie value |
| T-015 | Story-001 | AC-1 | unit | sign-up service with temp DB stores an `$argon2id$` hash and returns `{id,email}` |
| T-016 | Story-001 | AC-1 | integration | `POST /api/auth/signup` valid: 201 `{id,email}`, `set-cookie` present, hash prefix read from the DB |
| T-017 | Story-001 | AC-2 | unit | schema rejects invalid email, 14-char password, listed password, extra field with field-level errors |
| T-018 | Story-001 | AC-2 | integration | the 400 cases return problem+json with `errors[]` and the `users` table is unchanged |
| T-019 | Story-001 | AC-3 | integration | same email with different case: 409, still one row |
| T-020 | Story-001 | AC-4 | unit | response schema output contains no `password` or hash key |
| T-021 | Story-001 | AC-4 | security | captured logs and body of sign-up contain neither the password nor the hash |
| T-022 | Story-001 | AC-5 | integration | `/docs/json` contains `/auth/signup` with 201, 400 and 409 responses |
| T-023 | Story-002 | AC-1 | integration | login 200 `{id,email}`; `set-cookie` parsed: HttpOnly, SameSite=Lax, Path=/, no Secure by default, Secure with `COOKIE_SECURE`; new session row |
| T-024 | Story-002 | AC-2 | security | wrong password and unknown email: 401, identical body message, no `set-cookie` |
| T-025 | Story-002 | AC-3 | integration | logout deletes the session row, clears the cookie; `me` with the old cookie is 401; logout without a session is 401 |
| T-026 | Story-002 | AC-4 | integration | two users via `createLoggedInUser`: each `me` returns only own email; no cookie gives 401 |
| T-027 | Story-002 | AC-5 | integration | injected clock past idle and past absolute timeout: `me` returns 401 |
| T-028 | Story-002 | AC-6 | security | login and logout logs hold event type and request id; no password, cookie or hash |
| T-029 | Story-002 | AC-1 | integration | `/docs/json` lists login, logout and me with their status codes |
| T-030 | Story-003 | AC-1 | unit | valid sign-up submit (mocked API) calls signup then navigates to `/` |
| T-031 | Story-003 | AC-2 | unit | client invalid input and server 400/409 show inline field errors tied to labelled inputs; focus moves to the first error |
| T-032 | Story-003 | AC-3 | unit | wrong credentials show one generic error; correct ones log in and navigate |
| T-033 | Story-003 | AC-4 | unit | log-out control in the shell calls logout and lands on `/login` |
| T-034 | Story-003 | AC-5 | unit | axe: no serious or critical violation on both pages; tab order reaches every control; styles use CSS variables, no hard-coded colours; no `localStorage` use |
| T-035 | Story-003 | AC-6 | unit | registry picks up `feature.ts`: routes `/signup`, `/login` and the log-out nav entry; no shared file changed |

## Standards coverage

| Standard | Verifier check | Covered by |
|--|--|--|
| api-standards (OpenAPI 3.x, `/docs`, routes match, status codes) | each route and verb documented; schemas and codes match; RFC 9457 errors | T-001..T-003, T-022, T-029, verifier:QG-API-CONFORMANCE against `/docs/json` (D-04) |
| security: password storage | Argon2id params, length 15..128, common list, generic message | T-006, T-007, T-024 |
| security: sessions | HttpOnly, SameSite=Lax, idle and absolute timeout, server-side delete | T-008..T-010, T-023, T-025, T-027 |
| security: authorization and data isolation | deny by default, `user_id` scoping, two-user test | T-011..T-013, T-026 |
| security: input validation | zod strict at every boundary, nothing written on 400 | T-001, T-002, T-017, T-018 |
| security: logging | auth events without secrets | T-014, T-021, T-028 |
| data: migrations | forward-only, one file, range 0010-0019 | T-005, verifier:file is `api/migrations/0010-auth.sql` |
| operations: configuration | env only, `.env.example` names empty | T-009, static-rules:SR-016 |
| accessibility (WCAG 2.2 AA) | axe, labels, keyboard, 360 px | T-031, T-034 |
| supply chain: lockfile, audit | `pnpm-lock.yaml` updated for `argon2`, no high advisory | check:QG-LOCK, check:QG-DEPS |

## Gates coverage

| Gate | Covered by |
|--|--|
| QG-ARCH-CONFORMANCE | verifier:compare Decisions and Toolchain with the manifests and imports |
| QG-TRACE | check:QG-TEST, T-001..T-035 |
| QG-SCOPE | verifier:quality-gate scoped from this Gates coverage table |
| QG-QUALITY | check:QG-LOCK, check:QG-BUILD, check:QG-LINT, check:QG-TEST, check:QG-COV, check:QG-SECRETS, check:QG-DEPS, check:QG-SAST |
| QG-STATIC | check:QG-STATIC |
| QG-API-CONFORMANCE | T-022, T-029, verifier:docs list every auth route and status |
| QG-VALIDATION | T-001, T-002, T-017, T-018 |
| QG-AUTH | T-006, T-007, T-018, T-024, T-025, T-027, T-023 |
| QG-A11Y | T-034, verifier:visual review of focus and dark theme |
| QG-PROD-1 | verifier:health and healthchecks owned by SPEC-001 and not changed here |
| QG-PROD-2 | T-014, T-021, T-028 |
| QG-PROD-3 | check:QG-SECRETS, T-009, static-rules:SR-016 |
| QG-PROD-4 | verifier:graceful shutdown owned by SPEC-001 and not changed here |
| QG-PROD-5 | verifier:migration 0010 is forward-only and rollback is the SQLite file restore in the SPEC-001 README |
| QG-PROD-6 | verifier:redeploy steps stay documented by the SPEC-001 README |
| QG-BUGS | verifier:bugs conformance check exits 0 |
| GR-001 | n/a: no compose or port change in this spec |
| GR-002 | T-011, T-013, T-026, static-rules:SR-002, verifier:logout and me carry requireUser and only signup and login are public |
| GR-003 | static-rules:SR-002 SR-003 |
| GR-004 | T-001, T-002, T-018, verifier:every auth route has a `schema` |
| GR-005 | T-010, T-023, static-rules:SR-004 SR-005 |
| GR-006 | static-rules:SR-006 SR-007 |
| GR-007 | n/a: no money in this spec |
| GR-008 | T-014, T-021, T-028, static-rules:SR-010 |
| GR-009 | n/a: no CSV import in this spec |
| GR-010 | T-006, T-008, static-rules:SR-013 |
| GR-011 | n/a: security headers are owned by SPEC-001 and not changed here |
| GR-012 | verifier:Decisions table matches manifests and imports with no second validator or hashing or session library |
| GR-013 | static-rules:SR-014 SR-015, T-034 |
| GR-014 | T-005, verifier:0010-auth.sql is inside range 0010-0019 and no applied file is edited |
| GR-015 | static-rules:SR-016, check:QG-SECRETS |
| GR-016 | T-003, static-rules:SR-017 |
| GR-017 | n/a: no Dockerfile change in this spec |
| GR-018 | verifier:no rate limiter or lockout or CSRF library or audit table is added |

## Routing
Written by `kcc route` from the Complexity column above; do not fill it by hand.

## Verification Steps
1. `pnpm install --frozen-lockfile` then `pnpm -r build`, `pnpm -r lint`.
2. `pnpm --filter api test` runs T-001..T-029; `pnpm --filter web test` runs T-030..T-035. Every Test ID appears in a test name.
3. `bash .KCC/tools/quality-gate.sh -Spec SPEC-002` (or `.ps1`): QG-LOCK, BUILD, LINT, TEST, COV, SECRETS, DEPS, SAST, STATIC green (exit 3 is a deferral, not a pass).
4. `bash .KCC/tools/check-wave-scope.sh --spec SPEC-002 --wave N` after each wave (watches `src/` only, see Risk Flags); `bash .KCC/tools/check-traceability.sh` for every AC.
5. Manual (Story-003 AC-1, AC-3, AC-4, epic AC-10): after SPEC-001 is merged, `docker compose up --build`, open `http://127.0.0.1:8080/signup`, sign up, log out, log in; confirm 360 px layout and visible focus.
6. `.KCC/tools/check-run-conformance -Scope plan` exits 0.

## Scope
Medium (23 Impacted Files across `api/` and `web/`, plus 6 allowance files).

## Confidence
Confidence: 90%

Below the 95% default threshold because of two open points a human or the orchestrator should settle before IMPLEMENT: the `api/`/`web/` root paths versus the required `src/IDEA-001-budgetpal/` prefix, and the two added env names. Both are recorded in Risk Flags; neither changes the stack.

## Related
- Epic spec: [[SPEC-002-auth]]
- Roadmap / token plan: [[../ROADMAP]]
- Idea-specs index: [[../IDEA-001-budgetpal-Specs]]
- All specs: [[../../specs|All specs MOC]]
