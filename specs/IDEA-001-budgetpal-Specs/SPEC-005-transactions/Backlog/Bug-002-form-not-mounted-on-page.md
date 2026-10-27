# Bug-002: Add, edit and delete UI is never rendered on the Transactions page

| Type | Parent | Source | Severity | Status | Story / AC | Regression test | Evidence |
|--|--|--|--|--|--|--|--|
| Bug | [[../SPEC-005-transactions]] | verifier | major | verified | Story-005 / AC-1 | T-035 | [[../../../../TestResults/IDEA-001/SPEC-005/Story-005-AC-1-Bug-002]] |

## Reproduce
1. In `src/IDEA-001-budgetpal/web/src`, search for imports of `TransactionForm` and `DeleteTransaction` outside test files: `grep -rn "TransactionForm\|DeleteTransaction" --include=*.tsx --include=*.ts . | grep -v test`.
2. Only `TransactionForm.tsx` itself matches. `TransactionsPage.tsx` (the component `feature.ts` registers for `/transactions`) renders filters, table and pager only: no add form, no Edit or Delete control per row.

## Expected / Actual
- Expected: spec AC-9 and Story-005 AC-1, AC-3..AC-6: from the Transactions page a user adds, edits and deletes a transaction, with inline errors and a prerequisite message.
- Actual: `TransactionForm` and `DeleteTransaction` are exported but mounted nowhere, so no user can add, edit or delete a transaction through the UI. T-035..T-041 pass only because they render the components in isolation. The page's empty state tells the user to "choose Add transaction", a control that does not exist.
- Plan note: the plan says Story-005 must not edit the wave-5 file `TransactionsPage.tsx` (Risk Flags), and Story-005's Impacted Files omit it, so the planner has to widen Story-005's allowance (or add a mount point) before the implementer can fix this. Add a test that renders `TransactionsPage` and adds, edits and deletes a row through it.

## Impacted Files
- `src/IDEA-001-budgetpal/web/src/features/transactions/TransactionsPage.tsx` (mount form, Edit and Delete per row)
- `src/IDEA-001-budgetpal/web/src/features/transactions/TransactionsPage.test.tsx` or `TransactionForm.test.tsx` (page-level regression test)
