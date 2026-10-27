---
title: "SPEC-005 Enabler-001 AC-3 Bug-001"
tags:
  - testing
  - bug
  - severity/major
created: 2026-10-27
updated: 2026-10-27
version: 1.0.0
status: verified
copyright: "KCC framework (c) 2026 Tarek Fawaz"
homepage: "https://tikasway.dev/kcc"
license: "Licensed under the terms in LICENSE"
---

# Bug-001: QG-STATIC SR-002 hit in the transactions schemas

- **Spec:** SPEC-005
- **Backlog item:** Enabler-001
- **Acceptance criterion:** AC-3 - zod schemas (real `YYYY-MM-DD` date); the source rules (GR-002/GR-003 / SR-002) hold for `api/src`
- **Severity:** major

## Steps to reproduce
1. Run `powershell -ExecutionPolicy Bypass -File .KCC\tools\quality-gate.ps1 -Spec SPEC-005`.
2. Read `quality-gate-artifacts/static-hits.txt`.

## Expected
QG-STATIC passes.

## Actual
`api/src/modules/transactions/transactions.schemas.ts:10 SR-002` (`/^(\d{4})-(\d{2})-(\d{2})$/.exec(value)`); gate exit 1. The pattern is a regex `exec`, not SQL, but SR-002 matches `.exec(` outside repositories and tests and has no further exemption.

## Evidence
- `quality-gate-artifacts/static-hits.txt`; `quality-gate.md`.

## Related
- Backlog item: [[../../../specs/IDEA-001-budgetpal-Specs/SPEC-005-transactions/Backlog/Bug-001-static-sr002-exec-in-schemas]]
- Test run summary: [[test-run-summary]]
