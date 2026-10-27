# Story-004: Browse transactions page

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-005-transactions]] | P1 | M | Ready | frontend-react | Story-003 | Story-005 |

## Statement
As a budget owner, I want a Transactions page with month, account and category filters and paging, so that I can review my money movements.

## Acceptance Criteria
- [ ] AC-1 - Given the app is registered, when I open the nav, then a Transactions entry leads to `/transactions` (auto-registered through `feature.ts`).
- [ ] AC-2 - Given transactions, when the page loads, then a table shows date, description, account, category and amount formatted with `Intl` from minor units, expenses and income distinguished by text or icon, not colour alone.
- [ ] AC-3 - Given the filters, when I pick a month, account or category, then the list reloads with those filters; the account and category selects are labelled and fed from the existing list endpoints.
- [ ] AC-4 - Given more than one page, when I use Previous and Next, then the page moves by the limit and shows the range and total.
- [ ] AC-5 - Given no rows, then an empty state explains how to add the first one; while loading and on error a status message is shown.
- [ ] AC-6 - Given the page, then axe finds no serious or critical violation, it is keyboard operable, and at 360 px it is a single column.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS (five files, one page) · T PASS

## Impacted Files
- `web/src/features/transactions/feature.ts` - route and nav entry
- `web/src/features/transactions/TransactionsPage.tsx` - page, filters, table, pager
- `web/src/features/transactions/api.ts` - query hooks and types
- `web/src/features/transactions/TransactionsPage.module.css` - styles with tokens
- `web/src/features/transactions/TransactionsPage.test.tsx` - component and axe tests

## Test Hints
- unit: money and date formatting (AC-2)
- integration: Testing Library with mocked fetch: render, filter change, pager (AC-2..AC-5); axe (AC-6); registry lists the nav entry (AC-1)
