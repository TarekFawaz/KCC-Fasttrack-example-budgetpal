---
title: "SPEC-008 Test Run Summary"
tags:
  - testing
  - test-run
created: 2026-10-27
updated: 2026-10-27
version: 1.0.0
status: active
commit: 280e854a4e27925d4ba250a3882f14b6929ed6f4
verifier-pass: 1 (full)
---

# SPEC-008 Test Run Summary

Verified at HEAD `280e854` from `src/IDEA-001-budgetpal`. api dashboard tests: 4 files, 23 passed, exit 0. web dashboard tests: 4 files, 29 passed, exit 0. `pnpm build` exit 0, `pnpm lint` exit 0, `quality-gate -Spec SPEC-008` exit 0 (full root suite, coverage 100%). No bug filed; no open bug.

Deferred by human decision H-001 and the PREFLIGHT limit (docker-registry unreachable): compose up, container image build/scan, smoke checks, and SAST (semgrep). They are accepted-deferred, never PASS. No SPEC-008 AC or Test ID depends on them (no compose, Dockerfile or new service in the diff). The quality-gate printed PASS for QG-SAST (docker run semgrep); this verifier does not count that as evidence, per H-001.

## Epic acceptance criteria
| AC | Status | Evidence |
|--|--|--|
| AC-1 | PASS | T-006, T-007, T-008 (expense only, sorted desc, integer minor units, currency) |
| AC-2 | PASS | T-014, T-015, T-016, T-017 (zero-fill, oldest first, default 6, max 24) |
| AC-3 | PASS | T-003, T-011, T-019 (401, 400 problem+json); SQL in `*.repository.ts` with `user_id` filter |
| AC-4 | PASS | T-010, T-018 |
| AC-5 | PASS | T-024, T-025, T-030, T-031, T-032 |
| AC-6 | PASS | T-026, T-033 |
| AC-7 | PASS (jsdom axe; light/dark visual review DEFERRED, no browser/Docker) | T-028, T-029, T-031, T-035 |
| AC-8 | PASS | diff has no compose, Dockerfile, env or new service; T-013, T-021 (no amounts in logs) |

## Backlog item acceptance criteria
| Item | ACs | Status | Bug file |
|--|--|--|--|
| Enabler-001 | AC-1..AC-4 | PASS | - |
| Story-001 | AC-1..AC-5 | PASS | - |
| Story-002 | AC-1..AC-5 | PASS | - |
| Story-003 | AC-1..AC-6 | PASS | - |
| Story-004 | AC-1..AC-5 | PASS | - |

## Atomic test cases
| Test ID | Item / AC | Result | Evidence |
|--|--|--|--|
| T-001 | Enabler-001 AC-1 | PASS | `api` vitest, junit-api.xml |
| T-002 | Enabler-001 AC-2 | PASS | `api` vitest, junit-api.xml |
| T-003 | Enabler-001 AC-3 | PASS | `api` vitest, junit-api.xml |
| T-004 | Enabler-001 AC-3 | PASS | `api` vitest, junit-api.xml |
| T-005 | Enabler-001 AC-4 | PASS | `api` vitest, junit-api.xml |
| T-006 | Story-001 AC-1 | PASS | `api` vitest, junit-api.xml |
| T-007 | Story-001 AC-1 | PASS | `api` vitest, junit-api.xml |
| T-008 | Story-001 AC-2 | PASS | `api` vitest, junit-api.xml |
| T-009 | Story-001 AC-3 | PASS | `api` vitest, junit-api.xml |
| T-010 | Story-001 AC-4 | PASS | `api` vitest, junit-api.xml |
| T-011 | Story-001 AC-5 | PASS | `api` vitest, junit-api.xml |
| T-012 | Story-001 AC-1 (perf) | PASS | `api` vitest, junit-api.xml |
| T-013 | Story-001 AC-1 (log) | PASS | `api` vitest, junit-api.xml |
| T-014 | Story-002 AC-1 | PASS | `api` vitest, junit-api.xml |
| T-015 | Story-002 AC-2 | PASS | `api` vitest, junit-api.xml |
| T-016 | Story-002 AC-3 | PASS | `api` vitest, junit-api.xml |
| T-017 | Story-002 AC-1 | PASS | `api` vitest, junit-api.xml |
| T-018 | Story-002 AC-4 | PASS | `api` vitest, junit-api.xml |
| T-019 | Story-002 AC-5 | PASS | `api` vitest, junit-api.xml |
| T-020 | Story-002 AC-1 (perf) | PASS | `api` vitest, junit-api.xml |
| T-021 | Story-002 AC-1 (log) | PASS | `api` vitest, junit-api.xml |
| T-022 | Story-003 AC-1 | PASS | `web` vitest, junit-web.xml |
| T-023 | Story-003 AC-2 | PASS | `web` vitest, junit-web.xml |
| T-024 | Story-003 AC-2 | PASS | `web` vitest, junit-web.xml |
| T-025 | Story-003 AC-3 | PASS | `web` vitest, junit-web.xml |
| T-026 | Story-003 AC-4 | PASS | `web` vitest, junit-web.xml |
| T-027 | Story-003 AC-5 | PASS | `web` vitest, junit-web.xml |
| T-028 | Story-003 AC-6 | PASS | `web` vitest, junit-web.xml |
| T-029 | Story-003 AC-6 | PASS | `web` vitest, junit-web.xml |
| T-030 | Story-004 AC-1 | PASS | `web` vitest, junit-web.xml |
| T-031 | Story-004 AC-2 | PASS | `web` vitest, junit-web.xml |
| T-032 | Story-004 AC-3 | PASS | `web` vitest, junit-web.xml |
| T-033 | Story-004 AC-4 | PASS | `web` vitest, junit-web.xml |
| T-034 | Story-004 AC-5 | PASS | `web` vitest, junit-web.xml |
| T-035 | Story-004 AC-5 | PASS | `web` vitest, junit-web.xml |
