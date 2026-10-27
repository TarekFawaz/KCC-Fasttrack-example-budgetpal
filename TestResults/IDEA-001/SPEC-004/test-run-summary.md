---
title: "SPEC-004 Test Run Summary"
tags:
  - testing
  - test-run
created: 2026-10-27
updated: 2026-10-27
version: 1.0.0
status: active
commit: 644d19812e28fa5273d78587dd718bd3eacc9067
verifier-pass: 1 (full)
copyright: "KCC framework (c) 2026 Tarek Fawaz"
homepage: "https://tikasway.dev/kcc"
license: "Licensed under the terms in LICENSE"
---

# SPEC-004 Test Run Summary

Verified at HEAD `644d198`. Run from `src/IDEA-001-budgetpal`: `tsc --noEmit` api and web (exit 0), `eslint .` (exit 0), `pnpm test` (exit 0; api 149 passed, 1 skipped [SPEC-001 T-023 SIGTERM, win32]; web 104 passed), `vitest run accounts` api (46 passed) and web (61 passed). Each SPEC-004 Test ID appears in a test name and every matching test passed. Docker is unreachable (PREFLIGHT limit): no `docker build` or `compose up` was attempted; no SPEC-004 AC or Test ID needs one (the spec does not touch compose or Dockerfiles), so nothing is DEFERRED for it. `quality-gate` failed QG-STATIC on one test-file literal: [[Story-003-AC-6-Bug-001]].

**Scoped re-verification at HEAD `31260e4`** (only `AccountsPage.test.tsx` changed since `644d198`): `vitest run src/features/accounts` web exit 0 (61 passed, T-023 included), web `tsc --noEmit` exit 0, `eslint src/features/accounts` exit 0, `quality-gate -Spec SPEC-004` exit 0, `check-traceability` exit 0. Bug-001 verified. All other rows below are carried over from the first pass and were not re-run.

## Epic acceptance criteria
| AC | Status | Evidence |
|--|--|--|
| AC-1 | PASS | T-006, T-020, T-021 (201, list ordered by name, page row) |
| AC-2 | PASS | T-013, T-024 |
| AC-3 | PASS | T-014, T-026 |
| AC-4 | PASS | T-015, T-027 (409 problem+json, row stays, inline in-use message) |
| AC-5 | PASS | T-003, T-007, T-013 (case/space-insensitive 409; other user allowed) |
| AC-6 | PASS | T-005, T-008, T-013 (400 with field errors, table unchanged) |
| AC-7 | PASS | T-009, T-016, T-017 (401; 404 cross-user on get/update/delete; empty list for B) |
| AC-8 | PASS | T-001, T-005, T-020, T-021 (integer column, string math, `Intl`) |
| AC-9 | PASS | T-018, T-019, T-022, T-023, T-028 (jsdom axe; browser check not run) |
| AC-10 | PASS | T-010, T-017 (`/docs/json` paths and responses) |

## Backlog item acceptance criteria
| Backlog item | AC | Status | Bug file |
|--|--|--|--|
| Enabler-001 | AC-1 | PASS | - |
| Enabler-001 | AC-2 | PASS | - |
| Enabler-001 | AC-3 | PASS | - |
| Enabler-001 | AC-4 | PASS | - |
| Enabler-001 | AC-5 | PASS | - |
| Story-001 | AC-1..AC-5 | PASS | - |
| Story-002 | AC-1..AC-6 | PASS | - |
| Story-003 | AC-1..AC-5 | PASS | - |
| Story-003 | AC-6 | PASS (axe, labels, one column); QG-STATIC literal fixed in `31260e4`, Bug-001 verified | [[Story-003-AC-6-Bug-001]] |
| Story-004 | AC-1..AC-5 | PASS | - |

## Atomic test cases
| Test ID | Item | AC | Level | Result | File |
|--|--|--|--|--|--|
| T-001 | Enabler-001 | AC-1 | unit | PASS | api/src/modules/accounts/accounts.repository.test.ts |
| T-002 | Enabler-001 | AC-2 | unit | PASS | api/src/modules/accounts/accounts.repository.test.ts |
| T-003 | Enabler-001 | AC-3 | unit | PASS | api/src/modules/accounts/accounts.repository.test.ts |
| T-004 | Enabler-001 | AC-4 | unit | PASS | api/src/modules/accounts/accounts.repository.test.ts |
| T-005 | Enabler-001 | AC-5 | unit | PASS | api/src/modules/accounts/accounts.repository.test.ts |
| T-006 | Story-001 | AC-1 | integration | PASS | api/src/modules/accounts/accounts.routes.test.ts |
| T-007 | Story-001 | AC-2 | integration | PASS | api/src/modules/accounts/accounts.routes.test.ts |
| T-008 | Story-001 | AC-3 | integration | PASS | api/src/modules/accounts/accounts.routes.test.ts |
| T-009 | Story-001 | AC-4 | integration | PASS | api/src/modules/accounts/accounts.routes.test.ts |
| T-010 | Story-001 | AC-5 | integration | PASS | api/src/modules/accounts/accounts.routes.test.ts |
| T-011 | Story-001 | AC-2 | unit | PASS | api/src/modules/accounts/accounts.routes.test.ts |
| T-012 | Story-002 | AC-1 | integration | PASS | api/src/modules/accounts/accounts.isolation.test.ts |
| T-013 | Story-002 | AC-2 | integration | PASS | api/src/modules/accounts/accounts.isolation.test.ts |
| T-014 | Story-002 | AC-3 | integration | PASS | api/src/modules/accounts/accounts.isolation.test.ts |
| T-015 | Story-002 | AC-4 | integration | PASS | api/src/modules/accounts/accounts.isolation.test.ts |
| T-016 | Story-002 | AC-5 | integration | PASS | api/src/modules/accounts/accounts.isolation.test.ts |
| T-017 | Story-002 | AC-6 | integration | PASS | api/src/modules/accounts/accounts.isolation.test.ts |
| T-018 | Story-003 | AC-1 | unit | PASS | web/src/features/accounts/AccountsPage.test.tsx |
| T-019 | Story-003 | AC-2 | unit | PASS | web/src/features/accounts/AccountsPage.test.tsx |
| T-020 | Story-003 | AC-3 | unit | PASS | web/src/features/accounts/AccountsPage.test.tsx, money.test.ts |
| T-021 | Story-003 | AC-4 | unit | PASS | web/src/features/accounts/money.test.ts, AccountForm.test.tsx, AccountsPage.test.tsx |
| T-022 | Story-003 | AC-5 | unit | PASS | web/src/features/accounts/AccountsPage.test.tsx, AccountForm.test.tsx |
| T-023 | Story-003 | AC-6 | unit | PASS | web/src/features/accounts/AccountsPage.test.tsx |
| T-024 | Story-004 | AC-1 | unit | PASS | web/src/features/accounts/AccountsPage.test.tsx, AccountForm.test.tsx |
| T-025 | Story-004 | AC-2 | unit | PASS | web/src/features/accounts/AccountsPage.test.tsx, AccountForm.test.tsx |
| T-026 | Story-004 | AC-3 | unit | PASS | web/src/features/accounts/AccountsPage.test.tsx |
| T-027 | Story-004 | AC-4 | unit | PASS | web/src/features/accounts/AccountsPage.test.tsx |
| T-028 | Story-004 | AC-5 | unit | PASS | web/src/features/accounts/AccountsPage.test.tsx |
| T-029 | Enabler-001 | AC-1 | unit | PASS | api/src/modules/accounts/accounts.repository.test.ts |

## Related
- Bug: [[Story-003-AC-6-Bug-001]]
- Quality gate: [[quality-gate]]
