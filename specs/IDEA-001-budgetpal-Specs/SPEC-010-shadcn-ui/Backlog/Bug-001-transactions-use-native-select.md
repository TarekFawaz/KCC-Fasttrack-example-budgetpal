# Bug-001: Transactions filters and form use native `<select>`, not the kit Select

| Type | Parent | Source | Severity | Status | Story / AC | Regression test | Evidence |
|--|--|--|--|--|--|--|--|
| Bug | [[../SPEC-010-shadcn-ui]] | verifier | major | verified | Story-003 / AC-1, AC-2 (spec AC-6) | T-029, T-030 | [[../../../../TestResults/IDEA-001/SPEC-010/Story-003-AC-1-Bug-001]] |

## Reproduce
1. `grep -rn "<select" src/IDEA-001-budgetpal/web/src/features --include=*.tsx` lists native selects in `TransactionsPage.tsx` (lines 164, 180: account and category filters) and `TransactionForm.tsx` (277, 298: account and category in the add/edit form).
2. `grep -rn "components/ui/select" src/IDEA-001-budgetpal/web/src` matches only `components/ui/kit.test.tsx`; no page imports the kit Select.

## Expected / Actual
- Expected: spec AC-6 "transactions use Table, Dialog, AlertDialog, Select and Badge"; Story-003 AC-1 "Select filters"; AC-2 "Label, Input and Select" in the Dialog form.
- Actual: native `<select>` dressed with `SELECT_CLASSES` ("Native selects keep their role, label and keyboard behaviour", `TransactionForm.tsx:34`). `TransactionsPage.test.tsx` T-034 asserts "labelled native controls". No ruling, ADR or plan note accepts the substitution; the `@radix-ui/react-select` dependency and `select.tsx` are shipped but unused by any page.

## Fix
Either use the kit Select (Radix) for the transactions filters and form with the same labels and tests (queries by role `combobox`/name), or get a human ruling that native selects satisfy "Select" and amend the spec ACs.

## Impacted Files
- `src/IDEA-001-budgetpal/web/src/features/transactions/TransactionsPage.tsx`, `TransactionForm.tsx`, `TransactionsPage.test.tsx`, `TransactionForm.test.tsx`
