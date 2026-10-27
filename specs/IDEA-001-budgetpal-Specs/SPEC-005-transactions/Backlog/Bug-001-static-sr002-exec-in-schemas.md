# Bug-001: QG-STATIC SR-002 hit in the transactions schemas

| Type | Parent | Source | Severity | Status | Story / AC | Regression test | Evidence |
|--|--|--|--|--|--|--|--|
| Bug | [[../SPEC-005-transactions]] | verifier | major | fixed | Enabler-001 / AC-3 | T-003 | [[../../../../TestResults/IDEA-001/SPEC-005/Enabler-001-AC-3-Bug-001]] |

## Reproduce
1. Run `.KCC/tools/quality-gate -Spec SPEC-005`.
2. QG-STATIC reports `api/src/modules/transactions/transactions.schemas.ts:10` (SR-002); exit 1.

## Expected / Actual
- Expected: QG-STATIC passes; `.exec(` / `.prepare(` appear only in `*.repository.ts`, `api/src/kernel/db/` or tests (SR-002, GR-002/GR-003).
- Actual: `isRealDate` calls `/^(\d{4})-(\d{2})-(\d{2})$/.exec(value)`, a regex `exec`, which SR-002 matches by pattern. Rewrite without the `.exec(` token (for example `value.match(regex)` or `regex.test` plus slicing) and keep T-003 green. Do not edit `static-rules.tsv`.

## Impacted Files
- `src/IDEA-001-budgetpal/api/src/modules/transactions/transactions.schemas.ts`
