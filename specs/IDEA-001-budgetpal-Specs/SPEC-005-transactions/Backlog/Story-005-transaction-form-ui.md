# Story-005: Add, edit and delete from the page

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-005-transactions]] | P1 | M | Ready | frontend-react | Story-002, Story-004 | None |

## Statement
As a budget owner, I want to add, edit and delete transactions from the Transactions page, so that I can keep my records current without leaving it.

## Acceptance Criteria
- [ ] AC-1 - Given the page, when I submit the add form with date, amount, description, account and category, then the transaction is created, the list refreshes and the form resets.
- [ ] AC-2 - Given the amount field, when I type `12.50`, then it is sent as 1250 minor units using string parsing, never `parseFloat` or `toFixed`; invalid text shows an inline error.
- [ ] AC-3 - Given a server 400 with field errors, then each error shows next to its labelled input and the form keeps the entered values.
- [ ] AC-4 - Given a row, when I choose Edit, change a field and save, then the row updates in the list.
- [ ] AC-5 - Given a row, when I choose Delete and confirm, then the row is removed; cancelling changes nothing; the confirm is keyboard operable and returns focus.
- [ ] AC-6 - Given no accounts or no categories exist, then the form explains what to create first instead of failing.
- [ ] AC-7 - Given the form, then axe finds no serious or critical violation and every control has a visible label and focus style.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `web/src/features/transactions/TransactionForm.tsx` - add and edit form with inline errors
- `web/src/features/transactions/money.ts` - parse and format minor units without floats
- `web/src/features/transactions/api.ts` - create, update, delete mutations
- `web/src/features/transactions/TransactionForm.test.tsx` - form, delete and axe tests

## Test Hints
- unit: `money.ts` parses `12.50`, `12`, `0.05`, rejects `1.234` and `abc` (AC-2)
- integration: mocked fetch for create, 400 field errors, edit, delete confirm (AC-1, AC-3..AC-5); empty prerequisites (AC-6); axe (AC-7)
