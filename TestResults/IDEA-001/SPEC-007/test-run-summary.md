---
title: "SPEC-007 Test Run Summary"
tags:
  - testing
  - test-run
created: 2026-10-27
updated: 2026-10-27
version: 1.0.0
status: active
commit: 26ac80c7365e5ee9e88197cacc66bbcad530d10c
verifier-pass: 1 (full)
---

# SPEC-007 Test Run Summary

Verified at HEAD `26ac80c` on `spec/SPEC-007`, from `src/IDEA-001-budgetpal`: api `vitest run budgets` exit 0 (4 files, 36 tests passed); web `vitest run budgets` exit 0 (3 files, 44 tests passed). Every Test ID T-001..T-034 appears in a passing test name. `quality-gate -Spec SPEC-007` exit 0. No Bug filed.

DEFERRED (accepted by human hint H-001, never PASS): compose / container / smoke checks and image scan (docker registry unreachable, PREFLIGHT limit; no SPEC-007 AC or Test ID needs a build, no Dockerfile or compose change); the manual 360 px light and dark visual review (needs a running browser stack; covered in jsdom by T-033, T-034); SAST (semgrep) is accepted-deferred by H-001 even though the gate tool printed PASS, and that PASS is not used as evidence here.

## Epic acceptance criteria
| AC | Status | Evidence |
|--|--|--|
| AC-1 | PASS | T-002, T-006, T-010 (PUT 201 then 200, DELETE 204) |
| AC-2 | PASS | T-007, T-009 (400 income and invalid input, 404 unknown or foreign, table unchanged) |
| AC-3 | PASS | T-004, T-014 (SQL SUM scoped to user, category, month) |
| AC-4 | PASS | T-005, T-015 (79 ok, 80 and 100 warning, 101 over; BigInt) |
| AC-5 | PASS (jsdom; browser check DEFERRED) | T-027, T-029, T-030, T-033, T-025 |
| AC-6 | PASS | T-003, T-011, T-019 |
| AC-7 | PASS | T-008, T-009, T-012, T-013, T-018, T-020, T-021 |

## Backlog item acceptance criteria
| Backlog item | AC | Status | Bug file |
|--|--|--|--|
| Enabler-001 | AC-1..AC-5 | PASS | - |
| Story-001 | AC-1..AC-6 | PASS | - |
| Story-002 | AC-1..AC-6 | PASS | - |
| Story-003 | AC-1..AC-7 | PASS | - |
| Story-004 | AC-1..AC-6 | PASS (AC-5, AC-6 in jsdom; browser check DEFERRED) | - |

## Atomic test cases
| Test ID | Item | AC | Level | Result | File |
|--|--|--|--|--|--|
| T-001 | Enabler-001 | AC-1 | integration | PASS | api/src/modules/budgets/budgets.repository.test.ts |
| T-002 | Enabler-001 | AC-2 | integration | PASS | api/src/modules/budgets/budgets.repository.test.ts |
| T-003 | Enabler-001 | AC-3 | integration | PASS | api/src/modules/budgets/budgets.repository.test.ts |
| T-004 | Enabler-001 | AC-4 | integration | PASS | api/src/modules/budgets/budgets.repository.test.ts |
| T-005 | Enabler-001 | AC-5 | unit | PASS | api/src/modules/budgets/budgets.repository.test.ts (budgetStatus) |
| T-006 | Story-001 | AC-1 | integration | PASS | api/src/modules/budgets/budgets.routes.test.ts |
| T-007 | Story-001 | AC-2 | integration | PASS | api/src/modules/budgets/budgets.routes.test.ts |
| T-008 | Story-001 | AC-3 | unit | PASS | api/src/modules/budgets/budgets.schema.test.ts |
| T-009 | Story-001 | AC-3 | integration | PASS | api/src/modules/budgets/budgets.routes.test.ts |
| T-010 | Story-001 | AC-4 | integration | PASS | api/src/modules/budgets/budgets.routes.test.ts |
| T-011 | Story-001 | AC-5 | integration | PASS | api/src/modules/budgets/budgets.routes.test.ts |
| T-012 | Story-001 | AC-6 | integration | PASS | api/src/modules/budgets/budgets.routes.test.ts |
| T-013 | Story-001 | AC-1 | integration | PASS | api/src/modules/budgets/budgets.routes.test.ts |
| T-014 | Story-002 | AC-1 | integration | PASS | api/src/modules/budgets/budgets.progress.test.ts |
| T-015 | Story-002 | AC-2 | integration | PASS | api/src/modules/budgets/budgets.progress.test.ts |
| T-016 | Story-002 | AC-3 | integration | PASS | api/src/modules/budgets/budgets.progress.test.ts |
| T-017 | Story-002 | AC-4 | integration | PASS | api/src/modules/budgets/budgets.progress.test.ts |
| T-018 | Story-002 | AC-5 | integration | PASS | api/src/modules/budgets/budgets.progress.test.ts |
| T-019 | Story-002 | AC-6 | integration | PASS | api/src/modules/budgets/budgets.progress.test.ts |
| T-020 | Story-002 | AC-1 | integration | PASS | api/src/modules/budgets/budgets.progress.test.ts |
| T-021 | Story-002 | AC-1 | integration | PASS | api/src/modules/budgets/budgets.progress.test.ts |
| T-022 | Story-003 | AC-1 | unit | PASS | web/src/features/budgets/BudgetsPage.set.test.tsx / BudgetsPage.test.tsx |
| T-023 | Story-003 | AC-2 | unit | PASS | web/src/features/budgets/BudgetsPage.set.test.tsx / BudgetsPage.test.tsx |
| T-024 | Story-003 | AC-3 | unit | PASS | web/src/features/budgets/BudgetForm.test.tsx / BudgetsPage.set.test.tsx |
| T-025 | Story-003 | AC-4 | unit | PASS | web/src/features/budgets/BudgetForm.test.tsx / BudgetsPage.set.test.tsx |
| T-026 | Story-003 | AC-5 | unit | PASS | web/src/features/budgets/BudgetForm.test.tsx / BudgetsPage.set.test.tsx |
| T-027 | Story-003 | AC-6 | unit | PASS | web/src/features/budgets/BudgetForm.test.tsx / BudgetsPage.set.test.tsx |
| T-028 | Story-003 | AC-7 | unit | PASS | web/src/features/budgets/BudgetForm.test.tsx / BudgetsPage.set.test.tsx |
| T-029 | Story-004 | AC-1 | unit | PASS | web/src/features/budgets/BudgetsPage.test.tsx |
| T-030 | Story-004 | AC-2 | unit | PASS | web/src/features/budgets/BudgetsPage.test.tsx |
| T-031 | Story-004 | AC-3 | unit | PASS | web/src/features/budgets/BudgetsPage.test.tsx |
| T-032 | Story-004 | AC-4 | unit | PASS | web/src/features/budgets/BudgetsPage.test.tsx |
| T-033 | Story-004 | AC-5 | integration | PASS | web/src/features/budgets/BudgetsPage.test.tsx |
| T-034 | Story-004 | AC-6 | unit | PASS | web/src/features/budgets/BudgetsPage.test.tsx |
