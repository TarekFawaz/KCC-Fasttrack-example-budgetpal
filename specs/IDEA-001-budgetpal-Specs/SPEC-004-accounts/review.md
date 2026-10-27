---
spec-id: SPEC-004
title: "SPEC-004 Review"
tags:
  - spec
  - review
  - status/approved
  - lifecycle/review
created: 2026-10-27
updated: 2026-10-27
status: approved
verdict: APPROVED
commit: 31260e443c41550a976df679549405d69be6d9f8
version: 1.0.0
---

# SPEC-004 Verification Report

**Scoped re-verification (pass 2 of 2), fast track, depthlevel 2, at HEAD `31260e4`** on `spec/SPEC-004`; previous review: CHANGES_NEEDED at `644d198`. Re-verified: [[Backlog/Bug-001-static-sr014-accounts-test-literal]] (status `fixed` -> `verified`) and T-023 / Story-003 AC-6 (the only file changed since `644d198` is `web/src/features/accounts/AccountsPage.test.tsx`), plus `quality-gate` and `check-traceability` whole. **Every other row below was carried over unchanged from the first review and not re-run**; carried-over rows are not this pass's evidence. Known environment limit (PREFLIGHT): docker-registry unreachable; no `docker build` or `compose up` was attempted; no SPEC-004 AC or Test ID needs one, so nothing is DEFERRED for it.

## Epic Acceptance Criteria
| # | Criterion | Status | Evidence |
|--|--|--|--|
| AC-1 | Create account, listed by name | PASS | T-006, T-020, T-021; `accounts.routes.ts` POST/GET; `AccountsPage.tsx` |
| AC-2 | Edit name, type, balance | PASS | T-013, T-024 |
| AC-3 | Delete unused account | PASS | T-014, T-026 |
| AC-4 | In-use delete is 409, row stays, inline message | PASS | T-015, T-027; repository maps FK error to `InUse` (RESTRICT test table) |
| AC-5 | Duplicate name (case/space) 409, other user allowed | PASS | T-003, T-007, T-013; unique `(user_id, name COLLATE NOCASE)` |
| AC-6 | Invalid input 400 with field errors, nothing written | PASS | T-005, T-008, T-013 |
| AC-7 | 401 without session; cross-user 404; list isolated | PASS | T-009, T-016, T-017; every route has `onRequest: requireUser` |
| AC-8 | Integer minor units; `Intl` display; no floats | PASS | T-001, T-005, T-020, T-021; no `parseFloat`/`toFixed` in feature code |
| AC-9 | Nav via `feature.ts`, empty state, labels, inline errors, axe | PASS (jsdom) | T-018, T-019, T-022, T-023, T-028; a real-browser check was not run |
| AC-10 | Routes in `/docs/json`, responses match | PASS | T-010, T-017; `api/openapi.json` carries the five routes |

## Backlog Item Verification

### Stories
| Item | Dialect | Complexity | AC | Status | Evidence |
|--|--|--|--|--|--|
| Story-001 | backend-nodejs, testing-integration | high | AC-1..AC-5 | PASS | T-006..T-011 |
| Story-002 | backend-nodejs, testing-integration | high | AC-1..AC-6 | PASS | T-012..T-017 |
| Story-003 | frontend-react, testing-unit | medium | AC-1..AC-5 | PASS | T-018..T-022 |
| Story-003 | frontend-react, testing-unit | medium | AC-6 | PASS (re-verified at `31260e4`: T-023 passes with the pattern built from parts; QG-STATIC passes) | T-023; [[Backlog/Bug-001-static-sr014-accounts-test-literal]] verified |
| Story-004 | frontend-react, testing-unit | medium | AC-1..AC-5 | PASS | T-024..T-028 |

### Enablers
| Item | Dialect | Complexity | AC | Status | Evidence |
|--|--|--|--|--|--|
| Enabler-001 | backend-nodejs, testing-unit | high | AC-1..AC-5 | PASS | T-001..T-005, T-029; `0040-create-accounts.sql` |

## Atomic Test Case Verification
All 29 Test IDs (T-001..T-029) appear in a test name and PASS. File per ID and result: [[../../../TestResults/IDEA-001/SPEC-004/test-run-summary]]. API files: `api/src/modules/accounts/accounts.{repository,routes,isolation}.test.ts`; web files: `web/src/features/accounts/{money,AccountForm,AccountsPage}.test.*`.

## Traceability
`check-traceability -Spec SPEC-004` exit 0 after `test-run-summary.md` was written (every AC maps to a Test ID that passes).

## Scope Check
Diff `main..HEAD` touches only `src/IDEA-001-budgetpal/`. Layout departs from the plan's Impacted Files wording (`api/`, `web/` live under `src/IDEA-001-budgetpal/`), consistent with SPEC-001/002. Beyond the plan's file list: `api/openapi.json` (regenerated), `README.md`, `api/test/auth-storage.test.ts` (stale migration-list fix), `test/live-stack.ts` and `test/live-stack.test.ts` (defer live-stack tests when Docker cannot create a network). All are small, under the workspace, and explained in commit `02eb14a`. No scope creep outside the workspace.

## Build Status
`tsc --noEmit` api and web exit 0; `eslint .` exit 0; `pnpm run build` through the gate exit 0.

## Test Status
`pnpm test` exit 0: api 149 passed, 1 skipped (SPEC-001 SIGTERM, win32); web 104 passed. Coverage 100% against the 80% floor. No performance or security suite was scoped by the plan. Two-user isolation and validation are covered as integration tests.

## Quality Gate Check
Re-run at `31260e4`: `quality-gate -Spec SPEC-004` exit 0. PASS: QG-SCOPE, STACK, LOCK, BUILD, LINT, TEST, COV (100% vs 80%), SECRETS, DEPS, SAST (semgrep via docker ran, no findings), STATIC (18 rules over 98 files, no hit; the first pass's SR-014 hit is gone). Not covered by the plan (architecture excludes): sbom, image scan. QG-PROD (trimmed): 1 `/health` still 200 (SPEC-001 T-025 passes with the router registered); 2 no log call in the accounts module; 3 no config change, currency from `VITE_CURRENCY` with a `USD` default (documented in README); 4 repository takes the kernel db handle; 5 migration 0040 is forward-only; 6 no packaging change. QG-PROD pass.

## Architecture Gate Check
GR-002 (requireUser on all five routes, `userId` first, `WHERE user_id = ?`), GR-003 (SQL only in the repository and the migration; T-029), GR-004 (zod `.strict()` body, params, response on every route), GR-006 (no cross-module imports), GR-007 (INTEGER column, string money math), GR-013 (feature code clean), GR-014 (0040, in range), GR-016 (problem+json) hold (carried over; the only change since is a test file, and QG-STATIC now passes).

## Architecture Documentation Check
Fast track: `architecture/architecture.md` and `quality-gates.md` (and `static-rules.tsv`) exist; no spec `arch.md` is expected. No `.mmd` file and no `architecture/diagrams/` found. Architecture documentation OK.

## API Conformance Check
`api/openapi.json` is checked in and lists the five account routes with request and 2xx/4xx schemas; `/docs/json` asserted by T-010 and T-017; routes and verbs match. Observation (not a Bug): the OpenAPI summary of `GET /api/accounts/:id` reads "Read one of thened account" (`accounts.routes.ts:81`, `openapi.json:376`); a cosmetic typo for the next touch of the file. API conformance OK.

## Architecture Conformance Check (QG-ARCH-CONFORMANCE)
Declared stack (Fastify 5, zod, better-sqlite3, React 18, Vite, TanStack Query, vitest) matches the manifests and imports; no new dependency, no second validator, ORM or UI kit. Architecture conformance OK.

## Architecture Docs Quality Check (QG-ARCH-DOCS)
Fast track: no critic loop. `architecture.md` and `quality-gates.md` are substantive; no deprecated layout. OK.

## Dialect Review
backend-nodejs: layered routes, service, repository; parameterised SQL; typed errors; no raw error text leaks. frontend-react: labelled inputs, focus on first error, native dialog with Escape and Cancel, CSS variables. testing-unit / testing-integration: tests exercise real behaviour (temp DB, `inject`, two users, Testing Library with mocked fetch, axe). Security review of the diff (validation at the boundary, authz, injection, secrets): no findings. The first pass's one finding (SR-014 literal in a test, Bug-001) is fixed and verified.

## Project Structure and Docs
Code under `src/IDEA-001-budgetpal/`; `README.md` updated for the accounts feature and `VITE_CURRENCY`. A browser check against the compose stack is DEFERRED (docker-registry unreachable); jsdom axe stands in for AC-9 and is not counted as browser evidence.

## Bugs
| Bug | Severity | Status | Story / AC |
|--|--|--|--|
| [[Backlog/Bug-001-static-sr014-accounts-test-literal]] | major | verified | Story-003 / AC-6 |

## Evidence
Commands this scoped pass ran, at `31260e4`:

| Command (run by verifier) | Exit code | Notes |
|--|--|--|
| `git diff 644d198..HEAD -- src` | 0 | one file: `AccountsPage.test.tsx` |
| `npx vitest run src/features/accounts` (web) | 0 | 3 files, 61 passed, T-023 included |
| `npx tsc -p tsconfig.json --noEmit` (web) | 0 | |
| `npx eslint src/features/accounts` (web) | 0 | |
| `quality-gate.ps1 -Spec SPEC-004` | 0 | all gates pass incl. QG-STATIC and QG-PROD |
| `check-traceability.ps1 -Spec SPEC-004` | 0 | |
| `check-run-conformance.ps1 -Scope bugs` | 0 | Bug-001 verified |

First-pass commands (api `pnpm test` 149 passed 1 skipped, web 104 passed, api tsc and eslint exit 0) are carried over, not re-run, and are not evidence here.

## Test Results
- Summary: [[../../../TestResults/IDEA-001/SPEC-004/test-run-summary]]
- Bug files: [[../../../TestResults/IDEA-001/SPEC-004/Story-003-AC-6-Bug-001]]
- Gate report: [[../../../TestResults/IDEA-001/SPEC-004/quality-gate]]
- Screenshots: none taken.

## Verdict
**APPROVED**: traceability exit 0, `quality-gate` exit 0 (QG-PROD and QG-ARCH-DOCS pass), no open blocker or major Bug (Bug-001 verified), every AC and Test ID PASS. Suggest marking SPEC-004 Done in `specs/specs.md` and the idea-specs index. Observations carried over, not Bugs: a browser check of AC-9 is DEFERRED (docker-registry unreachable; jsdom axe only), and the cosmetic OpenAPI summary typo for `GET /api/accounts/:id`. Confidence: 96%.

## Related
- Epic spec: [[SPEC-004-accounts]]
- Test results layout: [[../../../.KCC/kernel/protocols/test-results-layout]]
- Plan: [[plan]]
- Roadmap: [[../ROADMAP]]
- Idea-specs index: [[../IDEA-001-budgetpal-Specs]]
- All specs: [[../../specs|All specs MOC]]
