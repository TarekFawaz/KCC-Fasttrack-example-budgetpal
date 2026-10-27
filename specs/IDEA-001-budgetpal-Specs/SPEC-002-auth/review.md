---
spec-id: SPEC-002
title: "SPEC-002 Review"
tags:
  - spec
  - review
  - status/quality-deferred
  - lifecycle/review
created: 2026-10-27
updated: 2026-10-27
status: quality-deferred
verdict: QUALITY_DEFERRED
commit: ae94976
version: 1.0.0
---

# SPEC-002 Verification Report

Re-verification (scoped pass), fast track, depthlevel 2, at HEAD `ae94976`. Previous review: WAIVER_NEEDED at `ed78a5a`. **Every row not named under `## Re-verification` was carried over from that review and not re-run.** Known environment limit (PREFLIGHT): docker-registry unreachable; the verifier attempted no `docker build` or `compose up`.

## Re-run at the same HEAD
A further pass at the same HEAD `ae94976` (policy note: the deferred quality check is accepted by policy, not a pass). `semgrep` is still not on PATH, and its install is human-gated (never installed silently, even under `--silent`), so QG-SAST stays DEFERRED. `quality-gate --spec SPEC-002` exit 3 again (all other checks PASS), `check-traceability` exit 0. Nothing else changed, so the rows below stand. To close: run `bash .KCC/tools/toolchain-preflight.sh semgrep` (human-approved install), then re-run `quality-gate`.

## Re-verification
Diff `ed78a5a..HEAD` (one commit, `ae94976`): `test/live-stack.ts` (new probe), `test/live-stack.test.ts` (new, 10 tests with an injected runner), `test/packaging.test.ts` (live-stack suite skipped with a printed reason when a build container cannot reach the npm registry) and `README.md` (one paragraph). All under `src/IDEA-001-budgetpal/`. No Bug item exists, so none changed status. No SPEC-002 AC or Test ID file changed.

| Item | Result | Evidence |
|--|--|--|
| QG-TEST | PASS (exit 0) | The 3 SPEC-001 live-stack tests (T-031, T-034, T-035) are now skipped, not failed; `[live-stack] ... deferred (not a pass): the build container cannot reach the npm registry (... UNABLE_TO_VERIFY_LEAF_SIGNATURE)` is printed |
| SPEC-001 T-031, T-034, T-035 | DEFERRED, not a pass | environment: TLS interception at the npm registry from the build container |
| `vitest run test/live-stack.test.ts test/packaging.test.ts` | 17 passed, 3 skipped, exit 0 | the 3 skipped are the live-stack tests above |
| QG-COV | PASS 100% >= 80% | `pnpm run test:coverage` through the gate |
| QG-STATIC | PASS (18 rules, 80 files) | covers the new test files |
| QG-SAST | DEFERRED: `semgrep` missing | unchanged, human-gated install |
| AC-1..AC-11, T-001..T-035 | carried over, files unchanged | |

Observation (not a Bug): the skipped live-stack tests are SPEC-001 tests, so the change is an environment guard that reports a deferral, not a pass. `probeLiveStack` runs one `docker run ... npm view` at test load; it is not a `docker build` or `compose up`.

## Epic Acceptance Criteria
Carried over from the previous review, not re-run.

| # | Criterion | Status | Evidence |
|--|--|--|--|
| AC-1 | signup 201 `{id,email}`, session, duplicate 409 | PASS | T-015, T-016, T-019; `signup.ts`, `0010-auth.sql` (email NOCASE unique) |
| AC-2 | 400 problem+json with field errors, nothing written | PASS | T-001, T-017, T-018; `.strict()` schemas in `schemas.ts` |
| AC-3 | Argon2id only, no password or hash in response or log | PASS | T-006, T-020, T-021 |
| AC-4 | login sets cookie; same generic 401 | PASS | T-023, T-024 |
| AC-5 | cookie attributes; only SHA-256 of 256-bit id stored | PASS | T-008, T-010, T-023 |
| AC-6 | logout deletes session, clears cookie, old cookie 401 | PASS | T-025 |
| AC-7 | me; 401; idle 24 h and absolute 30 d, env-tunable | PASS | T-009, T-026, T-027 |
| AC-8 | `requireUser` deny by default; logged-in test helper | PASS | T-011, T-012, T-013, T-026 |
| AC-9 | shared zod helper, RFC 9457, no stack | PASS | T-001..T-004 |
| AC-10 | pages: inline errors, keyboard, axe, log out in shell | PASS (jsdom) / DEFERRED (browser) | T-030..T-035 pass; the browser check against `docker compose up` was not run and is not counted as evidence |
| AC-11 | production readiness: env timeouts, safe auth logs | PASS | T-009, T-014, T-021, T-028 |

## Backlog Item Verification
Carried over, not re-run.

| Item | Dialect | AC | Status | Evidence |
|--|--|--|--|--|
| Enabler-001 | backend-nodejs | AC-1..AC-4 | PASS | T-001..T-004 |
| Enabler-002 | backend-nodejs | AC-1..AC-6 | PASS | T-005..T-010 |
| Enabler-003 | backend-nodejs | AC-1..AC-4 | PASS | T-011..T-014 |
| Story-001 | backend-nodejs | AC-1..AC-5 | PASS | T-015..T-022 |
| Story-002 | backend-nodejs | AC-1..AC-6 | PASS | T-023..T-029 |
| Story-003 | frontend-react | AC-1..AC-6 | PASS (jsdom) | T-030..T-035; mocked-API tests, no browser run |

## Atomic Test Case Verification
35 Test IDs. Per-ID table: [[../../../TestResults/IDEA-001/SPEC-002/test-run-summary]]. Carried over from the previous review, not re-run (SPEC-002 test files unchanged).

| Result | Test IDs |
|--|--|
| PASS (35) | T-001..T-035 |
| FAIL (0) | none |
| DEFERRED (0) | none (SPEC-001 T-031/T-034/T-035 are not SPEC-002 Test IDs) |

## Traceability
`check-traceability --spec SPEC-002` exit 0, 0 errors, 0 warnings (re-run).

## Scope Check
Since the previous review only `test/live-stack.ts`, `test/live-stack.test.ts`, `test/packaging.test.ts` and `README.md` changed, all under `src/IDEA-001-budgetpal/`, all serving the QG-TEST environment guard. Earlier scope observations carried over; no scope creep.

## Build Status
`quality-gate` QG-BUILD and QG-LINT PASS (re-run, exit 0).

## Test Status
Root workspace through `quality-gate`: `pnpm run test` exit 0 (live-stack T-031/T-034/T-035 skipped, deferred). Changed files: 17 passed, 3 skipped. api and web suites carried over (103 passed + 1 skipped; 43 passed); not re-run.

## Quality Gate Check
`quality-gate --spec SPEC-002` exit 3 (re-run at `ae94976`); scope from the plan's `## Gates coverage` (sbom, image out of scope).

| Check | Result |
|--|--|
| QG-LOCK, BUILD, LINT, TEST | PASS |
| QG-COV | PASS 100% >= 80% |
| QG-SECRETS | PASS (gitleaks) |
| QG-DEPS | PASS (osv-scanner) |
| QG-STATIC | PASS (18 rules, 80 files) |
| QG-SAST | DEFERRED: `semgrep` missing (not a pass) |

## Architecture Gate Check
Carried over: GR-002..GR-006, GR-008, GR-010, GR-014..GR-017 PASS. Others not touched.

## Architecture Documentation Check
Carried over: fast track, `architecture.md` and `quality-gates.md` present; no `.mmd`, no `architecture/diagrams/`; no spec `arch.md` expected.

## API Conformance Check
Carried over: `api/openapi.json` matches the implemented routes; PASS (code and tests, no live server).

## Architecture Conformance Check (QG-ARCH-CONFORMANCE)
Carried over: PASS. No manifest or stack change in the diff.

## Architecture Docs Quality Check (QG-ARCH-DOCS)
Carried over: PASS under fast track.

## Dialect Review
Carried over: backend-nodejs, frontend-react, testing-unit/integration/security checklists satisfied.

## Project Structure and Docs
Carried over: source under `src/IDEA-001-budgetpal/`, README updated (live-stack deferral explained). PASS.

## Bugs
None filed: no failing SPEC-002 AC or Test ID, and no Bug item changed status.

## Waivers
Not a WAIVER_NEEDED verdict (the gate is deferred, not failed). Open human items:

| Item | Why it is not a code fix | What a human does |
|--|--|--|
| QG-SAST deferred | `semgrep` is not installed; install is human-gated | `bash .KCC/tools/toolchain-preflight.sh semgrep`, then re-run `quality-gate` |
| SPEC-001 live-stack T-031/T-034/T-035 deferred | build container cannot reach the npm registry (TLS interception) | Fix container network or CA trust and re-run, or accept the deferral |
| AC-10 browser check | needs a working `docker compose up --build` | Run the manual step once the build works, or waive |

## Evidence
Run by the verifier in this re-verification (earlier evidence rows were carried over and are not repeated):

| Command | Exit |
|--|--|
| `bash .KCC/tools/quality-gate.sh --spec SPEC-002` | 3 (SAST deferred; LOCK, BUILD, LINT, TEST, COV, SECRETS, DEPS, STATIC pass) |
| `bash .KCC/tools/check-traceability.sh --spec SPEC-002` | 0 (0 errors, 0 warnings) |
| `npx vitest run test/live-stack.test.ts test/packaging.test.ts` (root workspace) | 0 (17 passed, 3 skipped) |
| `bash .KCC/tools/check-run-conformance.sh --scope review --spec SPEC-002` | 0 |

## Test Results
[[../../../TestResults/IDEA-001/SPEC-002/test-run-summary]], `quality-gate.md` and `quality-gate-artifacts/` in the same folder.

## Verdict
**QUALITY_DEFERRED**

The previous QG-TEST failure is gone: the SPEC-001 live-stack tests now skip with a printed reason and count as deferred. Traceability is 0 errors, no bug is open, `quality-gate` shows no failing check, and all 35 Test IDs stand (carried over, SPEC-002 files unchanged). Not APPROVED because `quality-gate` exits 3: SAST is deferred (`semgrep` missing, human-gated install). The AC-10 browser check and SPEC-001 T-031/T-034/T-035 stay DEFERRED on the registry limit. Deferred is never a pass. Confidence: 93%.

## Related
- Spec: [[SPEC-002-auth]]
- Plan: [[plan]]
- Test results: [[../../../TestResults/IDEA-001/SPEC-002/test-run-summary]]
