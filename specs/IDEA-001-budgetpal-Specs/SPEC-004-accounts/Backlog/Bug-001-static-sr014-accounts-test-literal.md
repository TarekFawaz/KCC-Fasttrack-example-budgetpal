# Bug-001: QG-STATIC SR-014 hit in the accounts page test

| Type | Parent | Source | Severity | Status | Story / AC | Regression test | Evidence |
|--|--|--|--|--|--|--|--|
| Bug | [[../SPEC-004-accounts]] | verifier | major | verified | Story-003 / AC-6 | T-023 | [[../../../../TestResults/IDEA-001/SPEC-004/Story-003-AC-6-Bug-001]] |

## Reproduce
1. Run `.KCC/tools/quality-gate -Spec SPEC-004`.
2. QG-STATIC reports `web/src/features/accounts/AccountsPage.test.tsx:182` (SR-014); exit 1.

## Expected / Actual
- Expected: QG-STATIC passes; no `web/src/**/*.ts(x)` file contains the literal `dangerouslySetInnerHTML` (SR-014 has no test-file exemption).
- Actual: the T-023 source-rules test writes the literal inside the regex that forbids it. Same defect as SPEC-001 Bug-001: build the pattern from parts (see `web/src/kernel/source-rules.test.ts`, `rawHtmlProp`), so T-023 keeps its meaning. Do not edit `static-rules.tsv`.

## Impacted Files
- `src/IDEA-001-budgetpal/web/src/features/accounts/AccountsPage.test.tsx`
