---
title: "SPEC-001 Story-001 AC-1 Bug-002"
tags:
  - testing
  - bug
  - severity/minor
created: 2026-10-27
updated: 2026-10-27
version: 1.0.0
status: verified
copyright: "KCC framework (c) 2026 Tarek Fawaz"
homepage: "https://tikasway.dev/kcc"
license: "Licensed under the terms in LICENSE"
---

# Bug-002: OpenAPI document omits the 503 that GET /health returns

- **Spec:** SPEC-001
- **Backlog item:** Story-001
- **Acceptance criterion:** AC-1 - `GET /health` is documented in OpenAPI (AC-2 defines the 503 `application/problem+json`)
- **Severity:** minor

## Steps to reproduce
1. Read `src/IDEA-001-budgetpal/api/openapi.json` or request `/docs/json`: `/health` has a `200` response only.
2. Read `api/src/modules/health/index.ts`: the schema declares `response: { 200: ... }`, while the handler returns 503 problem+json when the query fails.

## Expected
Per `api-standards.md` -> *Verifier conformance check* item 3, status codes in the document match the implementation: `/health` lists 200 and 503 (`application/problem+json`).

## Actual
Only `200` is documented. The 503 is implemented and tested (T-026) but absent from the contract, so T-030 passes against an incomplete document. Fix: add a 503 response schema (problem body) to the route, regenerate with `UPDATE_OPENAPI=1`, and extend T-030 to assert it.

## Evidence
- `api/openapi.json` (one response, `200`); `api/src/modules/health/index.ts` lines 18-35.

## Related
- Backlog item: [[../../../specs/IDEA-001-budgetpal-Specs/SPEC-001-walking-skeleton/Backlog/Story-001-health-on-home]]
- Spec: [[../../../specs/IDEA-001-budgetpal-Specs/SPEC-001-walking-skeleton/SPEC-001-walking-skeleton]]
- Test run summary: [[test-run-summary]]
