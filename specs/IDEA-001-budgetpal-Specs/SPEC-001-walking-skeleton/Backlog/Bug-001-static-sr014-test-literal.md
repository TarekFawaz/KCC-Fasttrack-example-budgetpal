# Bug-001: QG-STATIC SR-014 hit in the web source-rules test

| Type | Parent | Source | Severity | Status | Story / AC | Regression test | Evidence |
|--|--|--|--|--|--|--|--|
| Bug | [[../SPEC-001-walking-skeleton]] | verifier | major | fixed | Enabler-003 / AC-3 | T-015 | [[../../../../TestResults/IDEA-001/SPEC-001/Enabler-003-AC-3-Bug-001]] |

## Reproduce
1. Run `.KCC/tools/quality-gate -Spec SPEC-001`.
2. QG-STATIC reports `web/src/kernel/source-rules.test.ts:30` and `:32` (SR-014).

## Expected / Actual
- Expected: QG-STATIC passes; no web source file contains the literal `dangerouslySetInnerHTML`.
- Actual: the test that enforces the rule contains the literal in its regex. Build the pattern from parts; T-015 keeps asserting the same thing.

## Impacted Files
- `src/IDEA-001-budgetpal/web/src/kernel/source-rules.test.ts`
