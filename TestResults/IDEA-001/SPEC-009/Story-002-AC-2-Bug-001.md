---
title: "SPEC-009 Story-002 AC-2 Bug-001"
tags:
  - testing
  - bug
  - severity/major
created: 2026-10-28
updated: 2026-10-28
version: 1.0.0
status: verified
---

# Bug-001: Login does not reliably return to the remembered target

- **Spec:** SPEC-009
- **Backlog item:** Story-002 (spec AC-2)
- **Acceptance criterion:** AC-2 - a visitor sent to `/login` from `/budgets?month=2026-10` lands there after login
- **Severity:** major
- **Bug item:** [[../../../specs/IDEA-001-budgetpal-Specs/SPEC-009-signin-first/Backlog/Bug-001-login-target-race-fails-suite]]

## Steps to reproduce
1. `pnpm --filter @budgetpal/web test:coverage` in `src/IDEA-001-budgetpal` (3 runs, 3 failures, exit 1).
2. `pnpm --filter @budgetpal/web test` (4 runs: 1 failure, 3 passes of 331).

## Expected
After login the location is `/budgets?month=2026-10` and "Budgets page" shows.

## Actual
`Unable to find role="heading" and name "Budgets page"`; the DOM shows the dashboard and `where` = `/` (auth.test.tsx:317). The signed-in redirect of `/login` to `/` in `AuthGate` and the page's own `navigate(target)` race.

## Evidence
`quality-gate` QG-COV exit 1 (log: `quality-gate-artifacts/log-4.txt`). The same file alone: 42 passed, three runs, with and without coverage.

## Re-verification at 11f5420
Fixed by one owner of the post-sign-in move (`AuthGate` redirect to `safeTarget(location.state)`; the pages no longer navigate). Verifier-run: `test:coverage` x3 exit 0 (337/337, 98.43% lines); 3 concurrent `test` runs 337/337; `build` exit 0; `quality-gate` (SAST left out, H-001) exit 0. Status: verified.
