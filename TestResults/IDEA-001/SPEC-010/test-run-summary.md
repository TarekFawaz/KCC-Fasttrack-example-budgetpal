---
title: "SPEC-010 Test Run Summary"
tags:
  - testing
  - test-run
created: 2026-10-28
updated: 2026-10-28
version: 1.0.0
status: active
---

# SPEC-010 Test Run Summary

Full pass 1 at `4c9f17c` found Bug-001; scoped re-verification at `4ec21d5` (fast track, depthlevel 2) verified the fix. Latest verifier-run: `install --frozen-lockfile`, `build`, `lint` (exit 0), `test:coverage` (445/445, 96.48% lines), JUnit run (`junit-web.xml`, 445 cases), `check-traceability` (exit 0), `quality-gate` (exit 0), `check-run-conformance -Scope bugs` (exit 0). Earlier pass-1 list follows. Verifier-run: `pnpm install --frozen-lockfile`, `build`, `lint`, `test:coverage` (434/434, 96.47% lines), a JUnit run (`junit-web.xml`, 434 passed), `check-traceability` (exit 0), `quality-gate` (exit 0).
DEFERRED (accepted, never PASS): compose/container/smoke steps (Docker registry unreachable, H-001) and SAST (H-001). The `quality-gate` log shows QG-SAST PASS through a `docker run semgrep`; per H-001 that is not counted as a pass here. The visual pass at 360 px (plan Verification step 6) was not run: no browser is available to this verifier; axe runs under jsdom cover both schemes.
Note: Test IDs T-004, T-023, T-026, T-031 are not named `SPEC-010 T-0nn` in any test; the traceability tool matches them through older specs' tests that reuse the same IDs. Their behaviour is covered by the existing transactions, accounts and build suites (see review.md).

## Spec acceptance criteria

| AC | Status | Note |
|--|--|--|
| AC-1 | PASS | T-001..T-005; build, lint, tests exit 0; Dockerfile COPY line 14 |
| AC-2 | PASS | T-007, T-008 (theme.test.ts) |
| AC-3 | PASS | T-010..T-012; no raw-HTML prop, storage or cookie in `src` (grep) |
| AC-4 | PASS | T-036..T-040 |
| AC-5 | PASS | T-036, T-041 |
| AC-6 | PASS | transactions filters and form now use the kit Select (Bug-001 verified): [[Story-003-AC-1-Bug-001]] |
| AC-7 | PASS | page suites pass with role-and-name queries |
| AC-8 | PASS (jsdom axe) | T-018, T-027, T-034, T-043; 360 px browser pass not run |
| AC-9 | PASS | 434 tests, coverage 96.47% lines (floor 80%) |
| AC-10 | PASS | no `*.module.css`/`shell.css`; no hex/rgb/hsl in non-test source |

## Backlog item acceptance criteria

| Backlog item | AC | Status | Bug file |
|--|--|--|--|
| Enabler-001 | AC-1..AC-4 | PASS (Docker run DEFERRED, text tests T-005/T-013 pass) | - |
| Enabler-002 | AC-1..AC-6 | PASS | - |
| Story-001 | AC-1..AC-6 | PASS | - |
| Story-002 | AC-1..AC-7 | PASS | - |
| Story-003 | AC-1 | PASS (Select filters, Bug-001 verified) | [[Story-003-AC-1-Bug-001]] |
| Story-003 | AC-2 | PASS (Select in the Dialog form, Bug-001 verified) | [[Story-003-AC-1-Bug-001]] |
| Story-003 | AC-3..AC-7 | PASS | - |
| Story-004 | AC-1..AC-8 | PASS | - |

## Test IDs
T-001..T-043: all PASS (JUnit 445/445, 0 failures; T-029, T-030 now named `SPEC-010 T-0nn`). Evidence per ID in `review.md`.
