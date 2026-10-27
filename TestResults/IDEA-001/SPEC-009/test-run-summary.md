---
title: "SPEC-009 Test Run Summary"
tags:
  - testing
  - test-run
created: 2026-10-28
updated: 2026-10-28
version: 1.0.0
status: active
---

# SPEC-009 Test Run Summary

Full verification pass 1 at `b41a607c7ef0248f97b1a42ffae268fbbaaa9b5f` (fast track, depthlevel 2). Verifier-run: `pnpm --filter @budgetpal/web test` (4 runs: 331/331 three times, 330/331 once), `test:coverage` (3 runs, each 330/331, exit 1), a JUnit run (`junit-web.xml`, 331 passed), `build` (exit 0), `check-traceability` and `quality-gate`.
DEFERRED = the Docker registry/daemon (PREFLIGHT limit) or SAST (H-001). No AC or Test ID of this spec needs either (web-only). Never a pass.
Re-verification at `11f5420` (scoped pass): Bug-001 fixed and verified; no failing AC or Test ID. Rows not listed in the re-verified scope are carried over from the first pass at `b41a607`, not re-run individually (the full suite, 337/337, ran green three times).

## Backlog item acceptance criteria

| Backlog item | AC | Status | Bug file |
|--|--|--|--|
| Enabler-001 | AC-1..AC-5 | PASS | - |
| Enabler-002 | AC-1..AC-6 | PASS | - |
| Story-001 | AC-1..AC-8 | PASS | - |
| Story-002 | AC-1 | PASS | - |
| Story-002 | AC-2 | PASS | - (Bug-001 verified) |
| Story-002 | AC-3..AC-7 | PASS | - |
| Story-003 | AC-1..AC-7 | PASS | - |
| Story-004 | AC-1..AC-6 | PASS | - |

## Spec acceptance criteria

| AC | Status | Note |
|--|--|--|
| AC-1 | PASS | T-006, T-013, T-014 |
| AC-2 | PASS | T-015, T-022, T-023 (re-verified at 11f5420; Bug-001 verified) |
| AC-3 | PASS | T-016 |
| AC-4 | PASS | T-009, T-010, T-018 |
| AC-5 | PASS | T-001, T-002, T-017, T-021 |
| AC-6 | PASS | T-007, T-024, T-025 |
| AC-7 | PASS | T-035, T-037 |
| AC-8 | PASS | T-028..T-030, T-033 (jsdom axe; no browser visual review run) |
| AC-9 | PASS | T-019 |
| AC-10 | PASS | T-020, T-026, T-027 |
| AC-11 | PASS | `test:coverage` exit 0 x3, 337 tests, 98.43% lines >= 80% |

## Atomic test cases

| Test ID | Status | Evidence |
|--|--|--|
| T-001 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/registry.test.ts` |
| T-002 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/registry.test.ts` |
| T-003 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/registry.test.ts` |
| T-004 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/registry.test.ts` |
| T-005 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/registry.test.ts` |
| T-006 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/session.test.ts` |
| T-007 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/session.test.ts` |
| T-008 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/session.test.ts` |
| T-009 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/session.test.ts` |
| T-010 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/session.test.ts` |
| T-011 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/session.test.ts` |
| T-012 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/session.test.ts (mockSession cases)` |
| T-013 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/AuthGate.test.tsx` |
| T-014 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/AuthGate.test.tsx` |
| T-015 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/AuthGate.test.tsx` |
| T-016 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/AuthGate.test.tsx` |
| T-017 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/AuthGate.test.tsx` |
| T-018 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/AuthGate.test.tsx` |
| T-019 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/AuthGate.test.tsx` |
| T-020 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/AuthGate.test.tsx` |
| T-021 | PASS | `src/IDEA-001-budgetpal/web/src/features/auth/auth.test.tsx` |
| T-022 | PASS | `src/IDEA-001-budgetpal/web/src/features/auth/auth.test.tsx` (re-verified at 11f5420) |
| T-023 | PASS | `src/IDEA-001-budgetpal/web/src/features/auth/auth.test.tsx` |
| T-024 | PASS | `src/IDEA-001-budgetpal/web/src/features/auth/auth.test.tsx` |
| T-025 | PASS | `src/IDEA-001-budgetpal/web/src/features/auth/auth.test.tsx` |
| T-026 | PASS | `src/IDEA-001-budgetpal/web/src/features/auth/auth.test.tsx` |
| T-027 | PASS | `src/IDEA-001-budgetpal/web/src/features/auth/auth.test.tsx` |
| T-028 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/HealthDot.test.tsx` |
| T-029 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/HealthDot.test.tsx` |
| T-030 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/HealthDot.test.tsx` |
| T-031 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/useHealth.test.tsx` |
| T-032 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/HealthDot.test.tsx` |
| T-033 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/HealthDot.test.tsx` |
| T-034 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/HealthDot.test.tsx` |
| T-035 | PASS | `src/IDEA-001-budgetpal/web/src/features/dashboard/DashboardPage.test.tsx` |
| T-036 | PASS | `src/IDEA-001-budgetpal/web/src/features/dashboard/DashboardPage.test.tsx` |
| T-037 | PASS | `src/IDEA-001-budgetpal/web/src/features/dashboard/DashboardPage.test.tsx` |
| T-038 | PASS | `src/IDEA-001-budgetpal/web/src/features/dashboard/DashboardPage.test.tsx` |
| T-039 | PASS | `src/IDEA-001-budgetpal/web/src/kernel/HealthDot.test.tsx` |
| T-040 | PASS | `src/IDEA-001-budgetpal/web/src/features/dashboard/DashboardPage.test.tsx` |
