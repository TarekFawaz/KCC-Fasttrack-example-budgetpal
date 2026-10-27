---
title: "SPEC-005 Story-005 AC-1 Bug-002"
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

# Bug-002: Add, edit and delete UI is never rendered on the Transactions page

- **Spec:** SPEC-005
- **Backlog item:** Story-005 (also spec AC-9)
- **Acceptance criterion:** AC-1 - given the page, when I submit the add form, the transaction is created and the list refreshes (AC-3..AC-6 depend on the same mount)
- **Severity:** major

## Steps to reproduce
1. `grep -rn "TransactionForm\|DeleteTransaction" --include=*.ts --include=*.tsx src/IDEA-001-budgetpal/web/src | grep -v test`.
2. Open `web/src/features/transactions/TransactionsPage.tsx`: filters, table, pager; no form, no Edit or Delete buttons.

## Expected
The page lets the user add, edit and delete transactions.

## Actual
`TransactionForm` and `DeleteTransaction` are exported by `TransactionForm.tsx` and imported by no non-test file. The user cannot add, edit or delete from the UI; T-035..T-041 exercise the components in isolation and pass. The empty-state text refers to an "Add transaction" control that is not on the page.

## Evidence
- grep output above (only the defining file matches); `TransactionsPage.tsx` has no import of `TransactionForm`.

## Related
- Backlog item: [[../../../specs/IDEA-001-budgetpal-Specs/SPEC-005-transactions/Backlog/Bug-002-form-not-mounted-on-page]]
- Test run summary: [[test-run-summary]]
