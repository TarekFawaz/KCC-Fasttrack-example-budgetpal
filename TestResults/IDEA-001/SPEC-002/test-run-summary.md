---
spec: SPEC-002
commit: 1b770306e1a6c995d59a0bfead1d6fb14afa84f3
verifier-pass: 1 (full)
---

# SPEC-002 Test Run Summary

Verified at HEAD `1b77030`. Run from `src/IDEA-001-budgetpal`: `pnpm -r build` (exit 0), `pnpm lint` (exit 0), `pnpm test:coverage` (exit 0; api 103 passed, 1 skipped [SPEC-001 T-023 SIGTERM, win32]; web 43 passed; root 10 passed, 3 skipped [Docker packaging, SPEC-001]). Per-test results taken from `vitest --reporter=json` for api and web (every SPEC-002 Test ID appears in a test name and every matching test passed). Docker is unreachable (PREFLIGHT limit): no compose or image step was attempted; no SPEC-002 Test ID needs one. No bug files: no failing AC.

## Epic acceptance criteria
| AC | Status | Evidence |
|--|--|--|
| AC-1 | PASS | T-015, T-016, T-019 (201 `{id,email}`, session cookie, duplicate/case-variant 409) |
| AC-2 | PASS | T-001, T-017, T-018 (400 problem+json, field errors, `users` unchanged) |
| AC-3 | PASS | T-006, T-015, T-016, T-020, T-021 (`$argon2id$`, m=19456 t=2 p=1; no password/hash in body or logs) |
| AC-4 | PASS | T-023, T-024 (cookie set; identical generic 401 for wrong password and unknown email, no cookie) |
| AC-5 | PASS | T-008, T-010, T-023 (HttpOnly, SameSite=Lax, Path=/, Secure only with COOKIE_SECURE; only SHA-256 of 32 random bytes stored) |
| AC-6 | PASS | T-025 (row deleted, cookie cleared, old cookie 401) |
| AC-7 | PASS | T-009, T-026, T-027 (me, 401 without session, idle and absolute expiry, env-tunable) |
| AC-8 | PASS | T-011, T-012, T-013, T-026 (deny by default, `request.user.id`, `createLoggedInUser` two-user helper) |
| AC-9 | PASS | T-001..T-004 (zod body/params/query to problem+json, no stack) |
| AC-10 | PASS (jsdom) | T-030..T-035 (inline errors, labels, focus, axe, log-out in shell). Browser check against `docker compose up` is DEFERRED (docker-registry unreachable); not counted as evidence |
| AC-11 | PASS | T-009 (env timeouts), T-014, T-021, T-028 (event type and request id only); health/shutdown owned by SPEC-001 |

## Atomic test cases
| Test ID | Item | AC | Level | Result | File |
|--|--|--|--|--|--|
| T-001 | Enabler-001 | AC-1 | unit | PASS | api/src/kernel/validate.test.ts |
| T-002 | Enabler-001 | AC-2 | unit | PASS | api/src/kernel/validate.test.ts |
| T-003 | Enabler-001 | AC-3 | integration | PASS | api/src/kernel/validate.test.ts |
| T-004 | Enabler-001 | AC-4 | unit | PASS | api/src/kernel/validate.test.ts |
| T-005 | Enabler-002 | AC-1 | integration | PASS | api/test/auth-storage.test.ts |
| T-006 | Enabler-002 | AC-2 | unit | PASS | api/test/auth-storage.test.ts |
| T-007 | Enabler-002 | AC-3 | unit | PASS | api/test/auth-storage.test.ts |
| T-008 | Enabler-002 | AC-4 | unit | PASS | api/test/auth-storage.test.ts |
| T-009 | Enabler-002 | AC-5 | integration | PASS | api/test/auth-storage.test.ts,api/test/config.test.ts |
| T-010 | Enabler-002 | AC-6 | unit | PASS | api/test/auth-storage.test.ts |
| T-011 | Enabler-003 | AC-1 | unit | PASS | api/src/kernel/require-user.test.ts |
| T-012 | Enabler-003 | AC-2 | integration | PASS | api/src/kernel/require-user.test.ts |
| T-013 | Enabler-003 | AC-3 | integration | PASS | api/src/kernel/require-user.test.ts |
| T-014 | Enabler-003 | AC-4 | security | PASS | api/src/kernel/require-user.test.ts |
| T-015 | Story-001 | AC-1 | unit | PASS | api/src/modules/auth/signup.test.ts |
| T-016 | Story-001 | AC-1 | integration | PASS | api/src/modules/auth/signup.test.ts |
| T-017 | Story-001 | AC-2 | unit | PASS | api/src/modules/auth/signup.test.ts |
| T-018 | Story-001 | AC-2 | integration | PASS | api/src/modules/auth/signup.test.ts |
| T-019 | Story-001 | AC-3 | integration | PASS | api/src/modules/auth/signup.test.ts |
| T-020 | Story-001 | AC-4 | unit | PASS | api/src/modules/auth/signup.test.ts |
| T-021 | Story-001 | AC-4 | security | PASS | api/src/modules/auth/signup.test.ts |
| T-022 | Story-001 | AC-5 | integration | PASS | api/src/modules/auth/signup.test.ts |
| T-023 | Story-002 | AC-1 | integration | PASS | api/src/modules/auth/login.test.ts |
| T-024 | Story-002 | AC-2 | security | PASS | api/src/modules/auth/login.test.ts |
| T-025 | Story-002 | AC-3 | integration | PASS | api/src/modules/auth/login.test.ts |
| T-026 | Story-002 | AC-4 | integration | PASS | api/src/modules/auth/login.test.ts |
| T-027 | Story-002 | AC-5 | integration | PASS | api/src/modules/auth/login.test.ts |
| T-028 | Story-002 | AC-6 | security | PASS | api/src/modules/auth/login.test.ts |
| T-029 | Story-002 | AC-1 | integration | PASS | api/src/modules/auth/login.test.ts |
| T-030 | Story-003 | AC-1 | unit | PASS | web/src/features/auth/auth.test.tsx |
| T-031 | Story-003 | AC-2 | unit | PASS | web/src/features/auth/auth.test.tsx |
| T-032 | Story-003 | AC-3 | unit | PASS | web/src/features/auth/auth.test.tsx |
| T-033 | Story-003 | AC-4 | unit | PASS | web/src/features/auth/auth.test.tsx |
| T-034 | Story-003 | AC-5 | unit | PASS | web/src/features/auth/auth.test.tsx |
| T-035 | Story-003 | AC-6 | unit | PASS | web/src/features/auth/auth.test.tsx |

## Re-verification at ed78a5a
Scoped pass. SR-018 fix verified (`QG-STATIC` PASS). api (103 passed) and web (43 passed) suites re-run, exit 0; T-001..T-035 results above carried over. QG-TEST fails only on SPEC-001 live-stack tests T-031/T-034/T-035 (container cannot reach npm registry): environment, DEFERRED, no SPEC-002 Bug. AC-10 browser check remains DEFERRED.

## Re-verification at ae94976
Scoped pass. `ed78a5a..HEAD` touched only `test/live-stack.ts`, `test/live-stack.test.ts`, `test/packaging.test.ts`, `README.md`. QG-TEST now PASS: SPEC-001 live-stack T-031/T-034/T-035 skip with a reason (npm registry unreachable from the build container) and are DEFERRED, not passed. `quality-gate` exit 3 (QG-SAST deferred, `semgrep` missing); `check-traceability` exit 0. T-001..T-035 and AC-1..AC-11 carried over; AC-10 browser check remains DEFERRED. No Bug filed.
