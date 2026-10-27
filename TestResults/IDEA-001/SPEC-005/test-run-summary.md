---
title: "SPEC-005 Test Run Summary"
tags:
  - testing
  - test-run
created: 2026-10-27
updated: 2026-10-27
version: 1.0.0
status: active
commit: 85478b98962d1c179d25a5bd7148c15d59fbd026
verifier-pass: 2 (scoped re-verification; rows not named below carried over from pass 1 at 0a250f6)
copyright: "KCC framework (c) 2026 Tarek Fawaz"
homepage: "https://tikasway.dev/kcc"
license: "Licensed under the terms in LICENSE"
---

# SPEC-005 Test Run Summary

**Re-verification (pass 2, scoped) at HEAD `85478b9`:** api `vitest run` exit 0 (259 passed, 1 skipped); web `vitest run` exit 0 (166 passed, 10 new page-level tests for T-035, T-038, T-039, T-040, T-041); `quality-gate` exit 0; `check-traceability` exit 0. [[Enabler-001-AC-3-Bug-001]] and [[Story-005-AC-1-Bug-002]] are `verified`. Every other row below is carried over from pass 1 and not re-run (pass 1 text follows).

Pass 1: verified at HEAD `0a250f6`. From `src/IDEA-001-budgetpal`: api `vitest run` exit 0 (259 passed, 1 skipped = SPEC-001 SIGTERM on win32); web `vitest run` exit 0 (156 passed). Every Test ID T-001..T-041 appears in a test name and its test passed. Docker is unreachable (PREFLIGHT limit): no `docker build` or `compose up` was attempted; no SPEC-005 AC or Test ID needs one (no compose or Dockerfile change), so nothing is DEFERRED for it. Two Bugs filed: [[Enabler-001-AC-3-Bug-001]] (QG-STATIC SR-002) and [[Story-005-AC-1-Bug-002]] (the add/edit/delete UI is mounted nowhere). T-035..T-041 pass against the components in isolation; the Story-005 and epic AC-9 rows below FAIL because the page never renders them.

## Epic acceptance criteria
| AC | Status | Evidence |
|--|--|--|
| AC-1 | PASS | T-007 (201, stored row, integer minor units) |
| AC-2 | PASS | T-002, T-007 (positive INTEGER, CHECK > 0, no REAL; direction from category kind shown on the page) |
| AC-3 | PASS (API) | T-013..T-016; the UI half is covered under AC-9 |
| AC-4 | PASS | T-020, T-021 |
| AC-5 | PASS | T-008, T-015, T-018, T-023 |
| AC-6 | PASS | T-009, T-016 |
| AC-7 | PASS | T-010, T-017, T-022, T-003 |
| AC-8 | PASS | T-006 (RESTRICT FKs; real table) |
| AC-9 | PASS (jsdom; browser check DEFERRED, docker-registry unreachable) | T-028..T-034 (carried over) plus page-level T-035, T-038, T-039, T-040, T-041 in `TransactionsPage.test.tsx` at `85478b9`; [[Story-005-AC-1-Bug-002]] verified |
| AC-10 | PASS | T-011, T-019 (log has event and id only); QG-PROD 1, 3-6 n/a |

## Backlog item acceptance criteria
| Backlog item | AC | Status | Bug file |
|--|--|--|--|
| Enabler-001 | AC-1, AC-2, AC-4, AC-5 | PASS | - |
| Enabler-001 | AC-3 | PASS (T-003 green; no `.exec(` left, QG-STATIC pass) | [[Enabler-001-AC-3-Bug-001]] (verified) |
| Story-001 | AC-1..AC-6 | PASS | - |
| Story-002 | AC-1..AC-6 | PASS | - |
| Story-003 | AC-1..AC-6 | PASS | - |
| Story-004 | AC-1..AC-6 | PASS | - |
| Story-005 | AC-2, AC-7 | PASS (component level: parsing, axe, labels) | - |
| Story-005 | AC-1, AC-3, AC-4, AC-5, AC-6 | PASS (page-level tests in `TransactionsPage.test.tsx`: add posts minor units and the row appears; Edit PATCHes; Delete confirm removes the row; no-account message; axe) | [[Story-005-AC-1-Bug-002]] (verified) |

## Atomic test cases
| Test ID | Item | AC | Level | Result | File |
|--|--|--|--|--|--|
| T-001 | Enabler-001 | AC-1 | integration | PASS | api/src/modules/transactions/transactions.repository.test.ts |
| T-002 | Enabler-001 | AC-2 | integration | PASS | api/src/modules/transactions/transactions.repository.test.ts |
| T-003 | Enabler-001 | AC-3 | unit | PASS | api/src/modules/transactions/transactions.schemas.test.ts |
| T-004 | Enabler-001 | AC-4 | integration | PASS | api/src/modules/transactions/transactions.repository.test.ts |
| T-005 | Enabler-001 | AC-5 | integration | PASS | api/src/modules/transactions/transactions.repository.test.ts |
| T-006 | Enabler-001 | AC-1 | integration | PASS | api/src/modules/transactions/transactions.repository.test.ts |
| T-007 | Story-001 | AC-1 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-008 | Story-001 | AC-2 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-009 | Story-001 | AC-3 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-010 | Story-001 | AC-4 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-011 | Story-001 | AC-5 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-012 | Story-001 | AC-6 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-013 | Story-002 | AC-1 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-014 | Story-002 | AC-2 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-015 | Story-002 | AC-3 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-016 | Story-002 | AC-4 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-017 | Story-002 | AC-5 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-018 | Story-002 | AC-6 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-019 | Story-002 | AC-1 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-020 | Story-003 | AC-1 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-021 | Story-003 | AC-2 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-022 | Story-003 | AC-3 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-023 | Story-003 | AC-4 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-024 | Story-003 | AC-5 | performance | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-025 | Story-003 | AC-5 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-026 | Story-003 | AC-6 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-027 | Story-003 | AC-1 | integration | PASS | api/src/modules/transactions/transactions.routes.test.ts |
| T-028 | Story-004 | AC-1 | integration | PASS | web/src/features/transactions/TransactionsPage.test.tsx |
| T-029 | Story-004 | AC-2 | unit | PASS | web/src/features/transactions/TransactionsPage.test.tsx |
| T-030 | Story-004 | AC-2 | integration | PASS | web/src/features/transactions/TransactionsPage.test.tsx |
| T-031 | Story-004 | AC-3 | integration | PASS | web/src/features/transactions/TransactionsPage.test.tsx |
| T-032 | Story-004 | AC-4 | integration | PASS | web/src/features/transactions/TransactionsPage.test.tsx |
| T-033 | Story-004 | AC-5 | integration | PASS | web/src/features/transactions/TransactionsPage.test.tsx |
| T-034 | Story-004 | AC-6 | integration | PASS | web/src/features/transactions/TransactionsPage.test.tsx |
| T-035 | Story-005 | AC-1 | integration | PASS | web/src/features/transactions/TransactionForm.test.tsx |
| T-036 | Story-005 | AC-2 | unit | PASS | web/src/features/transactions/TransactionForm.test.tsx |
| T-037 | Story-005 | AC-3 | integration | PASS | web/src/features/transactions/TransactionForm.test.tsx |
| T-038 | Story-005 | AC-4 | integration | PASS | web/src/features/transactions/TransactionForm.test.tsx |
| T-039 | Story-005 | AC-5 | integration | PASS | web/src/features/transactions/TransactionForm.test.tsx |
| T-040 | Story-005 | AC-6 | integration | PASS | web/src/features/transactions/TransactionForm.test.tsx |
| T-041 | Story-005 | AC-7 | integration | PASS | web/src/features/transactions/TransactionForm.test.tsx |

## Related
- Bugs: [[Enabler-001-AC-3-Bug-001]], [[Story-005-AC-1-Bug-002]]
- Quality gate: [[quality-gate]]
