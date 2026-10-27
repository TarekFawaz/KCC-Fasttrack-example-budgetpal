---
title: "SPEC-004 Story-003 AC-6 Bug-001"
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

# Bug-001: QG-STATIC SR-014 hit in the accounts page test

- **Spec:** SPEC-004
- **Backlog item:** Story-003
- **Acceptance criterion:** AC-6 - the page passes axe, has labelled inputs and a one-column layout; the source rules (GR-013 / SR-014) hold for `web/src`
- **Severity:** major

## Steps to reproduce
1. From the repo root run `powershell -ExecutionPolicy Bypass -File .KCC\tools\quality-gate.ps1 -Spec SPEC-004`.
2. Read `TestResults/IDEA-001/SPEC-004/quality-gate-artifacts/static-hits.txt`.

## Expected
QG-STATIC passes: no `web/src/**/*.ts(x)` file contains the literal `dangerouslySetInnerHTML`.

## Actual
`web/src/features/accounts/AccountsPage.test.tsx:182` contains the literal in the regex of the T-023 source-rules test, so QG-STATIC exits 1 (SR-014). Fix in the test: build the pattern from parts, as `web/src/kernel/source-rules.test.ts` does. Do not edit `static-rules.tsv`.

## Evidence
- `quality-gate-artifacts/static-hits.txt` (`web/src/features/accounts/AccountsPage.test.tsx:182 SR-014`).

## Re-verification (scoped pass, HEAD `31260e4`)
Fixed by commit `31260e4`: the pattern is built from parts in `AccountsPage.test.tsx`. `vitest run src/features/accounts` (web) exit 0, 61 passed including T-023; `quality-gate -Spec SPEC-004` exit 0 with QG-STATIC pass (18 rules, 98 files). Status: verified.

## Related
- Backlog item: [[../../../specs/IDEA-001-budgetpal-Specs/SPEC-004-accounts/Backlog/Story-003-accounts-page-list-and-add]]
- Spec: [[../../../specs/IDEA-001-budgetpal-Specs/SPEC-004-accounts/SPEC-004-accounts]]
- Test run summary: [[test-run-summary]]
