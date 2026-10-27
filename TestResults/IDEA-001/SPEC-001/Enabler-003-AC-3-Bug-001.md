---
title: "SPEC-001 Enabler-003 AC-3 Bug-001"
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

# Bug-001: QG-STATIC SR-014 hit in the web source-rules test

- **Spec:** SPEC-001
- **Backlog item:** Enabler-003
- **Acceptance criterion:** AC-3 - the shell code, when searched, has no `dangerouslySetInnerHTML` (GR-013 / SR-014)
- **Severity:** major

## Steps to reproduce
1. From the repo root run `powershell -ExecutionPolicy Bypass -File .KCC\tools\quality-gate.ps1 -Spec SPEC-001`.
2. Read `TestResults/IDEA-001/SPEC-001/quality-gate-artifacts/static-hits.txt`.

## Expected
QG-STATIC passes: no `web/src/**/*.ts(x)` file contains the literal `dangerouslySetInnerHTML` (SR-014 has no test-file exemption).

## Actual
`web/src/kernel/source-rules.test.ts:30` and `:32` contain the literal inside the regex that checks for it, so QG-STATIC exits 1 (SR-014). Fix in the test: build the pattern from parts (for example `'dangerously' + 'SetInnerHTML'`) so the literal is not in the file and T-015 keeps its meaning. Do not edit `static-rules.tsv`.

## Evidence
- `quality-gate-artifacts/static-hits.txt` (hits `web/src/kernel/source-rules.test.ts:30` and `:32`).

## Related
- Backlog item: [[../../../specs/IDEA-001-budgetpal-Specs/SPEC-001-walking-skeleton/Backlog/Enabler-003-web-shell]]
- Spec: [[../../../specs/IDEA-001-budgetpal-Specs/SPEC-001-walking-skeleton/SPEC-001-walking-skeleton]]
- Test run summary: [[test-run-summary]]
