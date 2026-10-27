# Story-003: Transactions and CSV import restyled

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-010-shadcn-ui]] | P1 | M | Ready | frontend-react, testing-unit | Enabler-002 | Story-004 |

## Statement
As a user, I want the transactions list and the CSV import wizard to look modern and stay easy to use on a phone, so that the busiest pages feel clear.

## Acceptance Criteria
- [ ] AC-1 - Given the transactions page, then rows are in a shadcn Table (horizontally scrollable inside its own container at 360 px, not the page), with Select filters, a Badge for the category and kind, and pagination Buttons.
- [ ] AC-2 - Given add and edit, then the form opens in a Dialog (title, description, focus trap, Escape closes, focus returns to the trigger) with Label, Input and Select; validation and API errors stay inline beside the fields.
- [ ] AC-3 - Given delete, then the confirmation is an AlertDialog (`role="alertdialog"`, focus starts on Cancel) and the row disappears only after the API confirms, as before.
- [ ] AC-4 - Given the import page, then it is a stepper (upload, map columns, preview, result) with Cards, a step indicator that exposes the current step to assistive tech, and a preview Table with the per-line errors; focus still moves to the step heading as before.
- [ ] AC-5 - Given the SPEC-005 and SPEC-006 behaviour (filters, paging, minor-unit amounts through `Intl`, duplicate skipping, caps and error reporting by line), then it is unchanged and the existing tests keep their intent.
- [ ] AC-6 - Given both pages, then each has no serious or critical axe violation in light and dark (also with the Dialog and AlertDialog open), is keyboard reachable with a visible focus ring and has no page-level horizontal scroll at 360 px.
- [ ] AC-7 - Given the features, then `TransactionsPage.module.css` and `ImportPage.module.css` are deleted and no hard-coded colour remains; the transactions CSS check is rewritten as "tokens and classes only".

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS (the largest page is `ImportPage.tsx`; the planner may split it out if SZ-4 trips) · T PASS

## Impacted Files
- `web/src/features/transactions/{TransactionsPage,TransactionForm}.tsx` - Table, Dialog, AlertDialog, Select, Badge
- `web/src/features/transactions/TransactionsPage.module.css` - deleted
- `web/src/features/import/ImportPage.tsx` - stepper, Cards, preview Table
- `web/src/features/import/ImportPage.module.css` - deleted

## Test Hints
- unit (Testing Library, mocked API): the existing add, edit, delete, filter and paging flows pass (AC-1, AC-3, AC-5); Dialog focus, Escape and focus return (AC-2)
- unit: import flow through all steps with the same fixtures (AC-4, AC-5); `aria-current="step"` on the active step (AC-4)
- unit: axe with dialogs open in both schemes (AC-6); scans for hard-coded colours and `.module.css` imports (AC-7); 360 px is checked by class assertions here and visually by the verifier
- Tests beside the code (in scope, not counted in Files) are updated, not deleted: `TransactionsPage.test` (CSS read), `TransactionForm.test`, `ImportPage.test` (T-0xx IDs keep their intent).
