---
title: "SPEC-001 Test Run Summary"
tags:
  - testing
  - test-run
created: 2026-10-27
updated: 2026-10-27
version: 1.0.0
status: active
copyright: "KCC framework (c) 2026 Tarek Fawaz"
homepage: "https://tikasway.dev/kcc"
license: "Licensed under the terms in LICENSE"
---

# SPEC-001 Test Run Summary

Full pass 1 at `9b4a3df`; scoped re-verification (RE-VERIFICATION MODE) at `a3bbb35` re-ran only Bug-001, Bug-002, T-011, T-015, T-025, T-026, T-030 plus `pnpm -r build`, `pnpm lint`, `pnpm test:coverage` (all exit 0; root 10 passed + 3 skipped, api 33 passed + 1 skipped, web 26 passed; coverage 100% statements). All other rows are carried over from the full pass and were not re-run.
`pnpm install --frozen-lockfile` (0), `pnpm -r build` (0), `pnpm lint` (0), `pnpm test:coverage` (0; root 10 passed + 3 skipped, api 32 passed + 1 skipped, web 25 passed; coverage 100% statements).
DEFERRED = the check needs the Docker registry/daemon (PREFLIGHT known limit; `docker build` and `compose up` were not attempted) or a POSIX signal (win32). Never a pass.

## Backlog item acceptance criteria

| Backlog item | AC | Status | Bug file |
|--|--|--|--|
| Enabler-001 | AC-1 | PASS | - |
| Enabler-001 | AC-2 | PASS | - |
| Enabler-001 | AC-3 | PASS | - |
| Enabler-002 | AC-1 | PASS | - |
| Enabler-002 | AC-2 | PASS | - |
| Enabler-002 | AC-3 | PASS | - |
| Enabler-002 | AC-4 | PASS | - |
| Enabler-002 | AC-5 | PASS | - |
| Enabler-002 | AC-6 | PASS | - |
| Enabler-003 | AC-1 | PASS | - |
| Enabler-003 | AC-2 | PASS | - |
| Enabler-003 | AC-3 | PASS (Bug-001 verified) | [[Enabler-003-AC-3-Bug-001]] |
| Enabler-003 | AC-4 | PASS | - |
| Enabler-004 | AC-1 | PASS | - |
| Enabler-004 | AC-2 | PASS | - |
| Enabler-004 | AC-3 | PASS | - |
| Enabler-004 | AC-4 | PASS | - |
| Enabler-004 | AC-5 | PASS in-process (T-022); the real-signal test T-023 is DEFERRED | - |
| Story-001 | AC-1 | PASS (Bug-002 verified) | [[Story-001-AC-1-Bug-002]] |
| Story-001 | AC-2 | PASS | - |
| Story-001 | AC-3 | PASS | - |
| Story-001 | AC-4 | PASS | - |
| Story-001 | AC-5 | PASS | - |
| Enabler-005 | AC-1 | DEFERRED (needs `docker compose up --build`) | - |
| Enabler-005 | AC-2 | PASS | - |
| Enabler-005 | AC-3 | PASS | - |
| Enabler-005 | AC-4 | DEFERRED for the live proxy (T-034); the nginx.conf read is PASS | - |
| Enabler-005 | AC-5 | DEFERRED (needs a running volume, T-035) | - |
| Enabler-005 | AC-6 | PASS | - |

## Spec acceptance criteria

| AC | Status | Note |
|--|--|--|
| AC-1 | DEFERRED | compose up needs the registry |
| AC-2 | PASS | T-025, T-026, T-030 |
| AC-3 | PASS | T-003, T-004, T-005, T-006 |
| AC-4 | PASS | T-007 |
| AC-5 | PASS | T-017, T-018, T-019, T-020, T-021 |
| AC-6 | PASS | T-008, T-012, T-013, T-029 |
| AC-7 | PASS | T-009, T-026 |
| AC-8 | DEFERRED | T-022 passes in-process; a real SIGTERM (T-023, `docker stop`) was not run |
| AC-9 | PASS | T-010, T-011 on the api; the web headers are read from nginx.conf only (T-034 DEFERRED) |
| AC-10 | DEFERRED | static compose and Dockerfile checks pass (T-032, T-033, T-037); volume persistence T-035 DEFERRED |
| AC-11 | PASS | T-014, T-027, T-028 (jsdom axe; 360 px and dark contrast read from the CSS only, no browser run) |
| AC-12 | PASS | T-036 |

## Atomic test cases

| Test ID | Status | Evidence |
|--|--|--|
| T-001 | PASS | `test/workspace.test.ts` |
| T-002 | PASS | `test/workspace.test.ts` |
| T-003 | PASS | `test/workspace.test.ts` |
| T-004 | PASS | `test/workspace.test.ts` |
| T-005 | PASS | `api/test/config.test.ts` |
| T-006 | PASS | `api/test/config.test.ts` |
| T-007 | PASS | `api/test/app.test.ts` |
| T-008 | PASS | `api/test/app.test.ts` |
| T-009 | PASS | `api/test/app.test.ts` |
| T-010 | PASS | `api/test/app.test.ts` |
| T-011 | PASS | `api/test/app.test.ts` |
| T-012 | PASS | `web/src/kernel/registry.test.ts` |
| T-013 | PASS | `web/src/kernel/Shell.test.tsx` |
| T-014 | PASS | `web/src/kernel/Shell.test.tsx` |
| T-015 | PASS (re-verified at a3bbb35; Bug-001 verified) | `web/src/kernel/source-rules.test.ts` |
| T-016 | PASS | `web/src/kernel/build.test.ts` |
| T-017 | PASS | `api/test/db.test.ts` |
| T-018 | PASS | `api/test/db.test.ts` |
| T-019 | PASS | `api/test/db.test.ts` |
| T-020 | PASS | `api/test/server.test.ts` |
| T-021 | PASS | `api/test/server.test.ts` |
| T-022 | PASS | `api/test/server.test.ts` |
| T-023 | DEFERRED: skipped on win32, `child.kill` does not run SIGTERM handlers | `api/test/server.test.ts` |
| T-024 | PASS | `web/src/features/home/useHealth.test.tsx` |
| T-025 | PASS | `api/test/health.test.ts` |
| T-026 | PASS | `api/test/health.test.ts` |
| T-027 | PASS | `web/src/features/home/HomePage.test.tsx` |
| T-028 | PASS | `web/src/features/home/HomePage.test.tsx` |
| T-029 | PASS | `web/src/features/home/HomePage.test.tsx` |
| T-030 | PASS (re-verified at a3bbb35; Bug-002 verified) | `api/test/health.test.ts` |
| T-031 | DEFERRED: docker-registry unreachable | `test/packaging.test.ts` |
| T-032 | PASS (parsed YAML and `docker compose config`) | `test/packaging.test.ts` |
| T-033 | PASS | `test/packaging.test.ts` |
| T-034 | DEFERRED: docker-registry unreachable | `test/packaging.test.ts` |
| T-035 | DEFERRED: docker-registry unreachable | `test/packaging.test.ts` |
| T-036 | PASS | `test/packaging.test.ts` |
| T-037 | PASS | `test/packaging.test.ts` |

## Related
- Verdict: [[../../../specs/IDEA-001-budgetpal-Specs/SPEC-001-walking-skeleton/review]]
- Spec: [[../../../specs/IDEA-001-budgetpal-Specs/SPEC-001-walking-skeleton/SPEC-001-walking-skeleton]]
