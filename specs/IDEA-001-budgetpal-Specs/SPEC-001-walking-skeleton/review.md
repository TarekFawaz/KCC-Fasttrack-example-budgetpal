---
spec-id: SPEC-001
title: "SPEC-001 Review"
tags:
  - spec
  - review
  - status/waiver-needed
  - lifecycle/review
created: 2026-10-27
updated: 2026-10-27
status: waiver-needed
verdict: WAIVER_NEEDED
commit: a3bbb35397902062403816f75fbd1dddb0a0fbc1
version: 1.0.0
---

# SPEC-001 Verification Report

Scoped re-verification (full pass 1 was at `9b4a3df`), fast track, depthlevel 2. Re-run here: Bug-001, Bug-002, the Test IDs whose files changed in `9b4a3df..a3bbb35` (T-011, T-015, T-025, T-026, T-030), plus build, lint, tests, `quality-gate`, `check-traceability`. **Every other row below is carried over unchanged from the full pass and was not re-run**; carried-over rows are not evidence of this pass. Known environment limit (PREFLIGHT): docker-registry unreachable, so no `docker build` or `compose up`; every AC and Test ID needing them stays DEFERRED, never PASS.

## Epic Acceptance Criteria
| # | Criterion | Status | Evidence |
|--|--|--|--|
| AC-1 | compose up, both healthy, home shows API health | DEFERRED | needs compose up (T-031); code path covered by T-025, T-027 (carried over) |
| AC-2 | `/health` 200 `{ok,ok}`, 503 problem+json | PASS | re-run: T-025, T-026, T-030 (200 `application/json` and 503 `application/problem+json` documented; live 503 matches) |
| AC-3 | zod env config, names never values, `.env.example` names only | PASS | carried over: T-003..T-006; gitleaks clean (re-seen in quality-gate) |
| AC-4 | single-line JSON logs with request id, no secrets | PASS | carried over: T-007 |
| AC-5 | migration runner, checksums, idempotent, refuses changed file | PASS | carried over: T-017..T-021 |
| AC-6 | module and feature auto-registration | PASS | carried over: T-008, T-012, T-013, T-029 |
| AC-7 | unknown route and error as problem+json | PASS | carried over: T-009, T-026 |
| AC-8 | SIGTERM closes db, exit 0 | DEFERRED | T-022 PASS in-process; T-023 skipped on win32, container stop not run |
| AC-9 | `/docs`, OpenAPI 3.1, security headers | PASS | T-010, T-011 (T-011 re-run, incl. new wrapper test); web headers read from `web/nginx.conf` only (T-034 DEFERRED) |
| AC-10 | non-root, pinned, loopback, healthchecks, volume survives | DEFERRED | static parts PASS (T-032, T-033, T-037, carried over); T-035 DEFERRED |
| AC-11 | axe clean, icon plus text, 360 px | PASS | carried over: T-014, T-027, T-028 (jsdom axe; CSS read only, no browser run) |
| AC-12 | README run, env table, backup and restore, redeploy | PASS | carried over: T-036; restore command not executed (needs Docker) |

## Backlog Item Verification

### Stories
| Item | Dialect | Complexity | AC | Status | Evidence |
|--|--|--|--|--|--|
| Story-001 | frontend-react | low | AC-1 | PASS | re-run T-030: 200 and 503 both documented; [[Backlog/Bug-002-health-503-not-in-openapi]] verified |
| Story-001 | frontend-react | low | AC-2 | PASS | carried over: T-026 (re-run, still passes) |
| Story-001 | frontend-react | low | AC-3 | PASS | carried over: T-024, T-027 |
| Story-001 | frontend-react | low | AC-4 | PASS | carried over: T-028 |
| Story-001 | frontend-react | low | AC-5 | PASS | carried over: T-029 |

### Enablers
| Item | Dialect | Complexity | AC | Status | Evidence |
|--|--|--|--|--|--|
| Enabler-001 | devops-cloud | low | AC-1..3 | PASS | carried over: T-001..T-004 |
| Enabler-002 | backend-nodejs | high | AC-1..6 | PASS | carried over: T-005..T-011; T-011 re-run (the `app.ts` wrapper change is in this item's file) |
| Enabler-003 | frontend-react | medium | AC-1, AC-2, AC-4 | PASS | carried over: T-012..T-014, T-016 |
| Enabler-003 | frontend-react | medium | AC-3 | PASS | re-run T-015 (3 tests, incl. a non-vacuity check on the pattern); QG-STATIC no longer reports SR-014; [[Backlog/Bug-001-static-sr014-test-literal]] verified |
| Enabler-004 | backend-nodejs | medium | AC-1..4 | PASS | carried over: T-017..T-021 |
| Enabler-004 | backend-nodejs | medium | AC-5 | PASS in-process | T-022; T-023 DEFERRED (win32) |
| Enabler-005 | devops-cloud | medium | AC-2, AC-3, AC-6 | PASS | carried over: T-032, T-033, T-036, T-037 |
| Enabler-005 | devops-cloud | medium | AC-1, AC-4 live, AC-5 | DEFERRED | T-031, T-034, T-035 need Docker |

## Atomic Test Case Verification
37 Test IDs, each found by ID in a test file. Per-ID result: [[../../../TestResults/IDEA-001/SPEC-001/test-run-summary]].

| Result | Test IDs |
|--|--|
| PASS (33) | T-001..T-022, T-024..T-030, T-032, T-033, T-036, T-037 (T-011, T-015, T-025, T-026, T-030 re-run at `a3bbb35`; the rest carried over) |
| FAIL (0) | none |
| DEFERRED (4) | T-023 (win32), T-031, T-034, T-035 (docker-registry unreachable) |

## Traceability
`check-traceability -Spec SPEC-001` exit 3: 0 errors (TRC-004 cleared for T-015 and T-030); TRC-006 warnings on T-023, T-031, T-034, T-035 (DEFERRED, not a pass). Every AC maps to a Test ID that exists in a test file.

## Scope Check
`git diff 9b4a3df..HEAD`: 8 files, all under `src/IDEA-001-budgetpal/` or `Backlog/Bug-*.md`. They match the two Bugs' Impacted Files plus `api/src/app.ts` and `api/test/app.test.ts`, which the Option A ruling added to Bug-002. No scope creep. Earlier full-pass scope result (56 files vs `5554f9b`) carried over.

## Build Status
`pnpm -r build` exit 0 (tsc, vite build); `pnpm lint` exit 0 (re-run at `a3bbb35`).

## Test Status
`pnpm test:coverage` exit 0 (re-run): root 10 passed, 3 skipped (Docker); api 33 passed, 1 skipped (T-023); web 26 passed. Coverage 100% statements. Regression tests by name: T-011 (wrapper, mixed/content-only/hidden routes), T-015 (3 tests), T-030 (2 tests) pass.

## Quality Gate Check
`quality-gate -Spec SPEC-001` exit 1 (re-run). QG-SCOPE, STACK, LOCK, BUILD, LINT, TEST, COV (100%), SECRETS, DEPS pass. Not passing:
- QG-STATIC FAIL: the SR-014 hits are gone (Bug-001 verified). The one remaining hit is SR-018 at `api/Dockerfile:18` (`FROM toolchain AS build`), a false positive: the pattern matches a build-stage reference as an untagged `FROM`; every external base is pinned and the last stage has `USER node` (GR-017 met). Not a code defect; needs a rule fix in `architecture/static-rules.tsv` or a human waiver.
- QG-SAST DEFERRED: `semgrep` is missing; install is human-gated (`toolchain-preflight -Tools semgrep`).
- QG-PROD (carried over): 1 (health) partly DEFERRED, 2 PASS, 3 PASS, 4 DEFERRED (real SIGTERM), 5 PASS, 6 PASS.
- QG-SMOKE DEFERRED (registry).

## Architecture Gate Check
Carried over from the full pass, not re-run: GR-001, GR-003, GR-005, GR-006, GR-011, GR-014, GR-015, GR-016, GR-017 (SR-018 false positive above), GR-018 PASS. GR-013 / SR-014 is now clean (rescanned inside `quality-gate`). The new `app.ts` wrapper adds no SQL, CORS or dependency.

## Architecture Documentation Check
Carried over: fast track, `architecture/architecture.md` has C1, C2, `## Decisions`, `## Toolchain`; `quality-gates.md` and `static-rules.tsv` present; no `.mmd`, no `architecture/diagrams/`; no spec `arch.md` (not a finding). OK.

## API Conformance Check
Re-run: `/health` lists 200 `application/json` and 503 `application/problem+json`; `api/openapi.json` equals the served `/docs/json` and the live 503 returns that media type (T-030). Swagger UI at `/docs` (T-011). Bug-002 closed.

## Architecture Conformance Check (QG-ARCH-CONFORMANCE)
Carried over: manifests match `## Decisions` and `## Toolchain`. The diff touches no manifest or lockfile. OK.

## Architecture Docs Quality Check (QG-ARCH-DOCS)
Carried over: fast track, no critic loop; `architecture.md` is a full document, no deprecated layout. OK.

## Dialect Review
Re-run scope: `app.ts` wrapper (backend-nodejs): bare zod responses pass through the provider unchanged, `hide` honoured, content form converted per media type; tested for mixed, content-only and hidden routes: OK. `source-rules.test.ts` (testing-unit): pattern built from parts, with a positive check that it still detects the raw-HTML prop and both storages, so the rule is not vacuous: OK. Other dialect findings carried over.
Observations (no Bug, carried over): (1) the README restore path copies a file into a stopped container with `docker compose cp`; ownership by root may block the `node` user, untested; (2) `/api/docs` through the nginx proxy was not checked. Follow-up for a human with Docker access.

## Project Structure and Docs
Carried over: code under `src/IDEA-001-budgetpal/` only; `README.md` there has prerequisites, `cp .env.example .env`, run, env table, backup and restore, redeploy. `.env` git-ignored.

## Bugs
| Bug | Severity | Status | Story / AC |
|--|--|--|--|
| [[Backlog/Bug-001-static-sr014-test-literal]] | major | verified | Enabler-003 / AC-3 |
| [[Backlog/Bug-002-health-503-not-in-openapi]] | minor | verified | Story-001 / AC-1 |

## Waivers
| Item | Why it is not a code fix | What a human does |
|--|--|--|
| QG-STATIC SR-018 at `api/Dockerfile:18` (`FROM toolchain AS build`) | Rule false positive: the regex matches a build-stage reference as an untagged `FROM`; GR-017 is met. | Architect fixes the SR-018 pattern in `architecture/static-rules.tsv`, or a human waives the hit. |
| QG-SAST (`semgrep` missing) | Missing tool; install is human-gated. | Run `toolchain-preflight -Tools semgrep` and approve the install, or defer. |
| AC-1, AC-8, AC-10; T-023, T-031, T-034, T-035; QG-SMOKE; QG-PROD 1 and 4 | Docker registry unreachable (PREFLIGHT limit) and a POSIX signal test on win32. DEFERRED, not a pass. | Run on a host with Docker and a POSIX shell, or waive explicitly. |

## Evidence
Commands the verifier ran in this pass, at `a3bbb35` (the full-pass commands of `9b4a3df` are not repeated here as evidence):

| Command (run by verifier) | Exit code | Notes |
|--|--|--|
| `pnpm install --frozen-lockfile` (in `src/IDEA-001-budgetpal`) | 0 | lockfile up to date |
| `pnpm -r build` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test:coverage` | 0 | root 10 + 3 skipped, api 33 + 1 skipped, web 26; 100% statements |
| `vitest run test/health.test.ts test/app.test.ts --reporter=verbose` (api) | 0 | T-011, T-025, T-026, T-030 pass by name |
| `vitest run src/kernel/source-rules.test.ts --reporter=verbose` (web) | 0 | T-015 passes (3 tests) |
| `.KCC/tools/quality-gate.ps1 -Spec SPEC-001` | 1 | STATIC fails on SR-018 only; SAST deferred |
| `.KCC/tools/check-traceability.ps1 -Spec SPEC-001` | 3 | 0 errors, TRC-006 x4 (deferred) |
| `.KCC/tools/check-run-conformance.ps1 -Scope bugs` | 0 | |
| `.KCC/tools/check-run-conformance.ps1 -Scope review` | 0 | |
| `git diff 9b4a3df..HEAD --stat`, `git log` | 0 | scope check |
| `docker build` / `compose up --build` | not run | known environment limit |

Follow-up check (state 17, same HEAD `a3bbb35`, no code change since the pass above): `semgrep` is still not installed (`which semgrep` finds nothing), so QG-SAST stays DEFERRED; the install is human-gated and was not done. The re-run of `quality-gate -Spec SPEC-001` was blocked by the permission classifier in this session and did not run, so the `quality-gate` exit 1 above is the last result at this HEAD, not a new one. Re-ran: `check-traceability -Spec SPEC-001` exit 3 (0 errors, TRC-006 x4 deferred) and `check-run-conformance -Scope bugs` exit 0.

## Test Results
- Summary: [[../../../TestResults/IDEA-001/SPEC-001/test-run-summary]]
- Bug files: [[../../../TestResults/IDEA-001/SPEC-001/Enabler-003-AC-3-Bug-001]], [[../../../TestResults/IDEA-001/SPEC-001/Story-001-AC-1-Bug-002]] (both verified)
- Screenshots: `TestResults/IDEA-001/SPEC-001/screenshots/` (none taken; no browser run)

## Verdict
**WAIVER_NEEDED**

Both Bugs are verified and closed, no blocker/major bug is open, and `check-traceability` has 0 errors. What keeps the gate red is outside the code (see Waivers): the SR-018 false positive, the missing `semgrep`, and the Docker-dependent ACs and Test IDs. Not APPROVED: `quality-gate` is exit 1 and the deferred items are not a pass. Confidence: 90%.

## Related
- Epic spec: [[SPEC-001-walking-skeleton]]
- Test results layout: [[../../../.KCC/kernel/protocols/test-results-layout]]
- Plan: [[plan]]
- Roadmap: [[../ROADMAP]]
- Idea-specs index: [[../IDEA-001-budgetpal-Specs]]
- All specs: [[../../specs|All specs MOC]]
