# Story-003: Accounts page: list and add

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-004-accounts]] | P1 | M | Ready | frontend-react, testing-unit | Story-001 | Story-004 |

## Statement
As a signed-in user, I want an Accounts page that lists my accounts and lets me add one, so that I can set up the places my money lives.

## Acceptance Criteria
- [ ] AC-1 - Given the feature folder, when the app starts, then an "Accounts" entry appears in the navigation and routes to the page through `feature.ts`, with no edit to a shared router or nav file.
- [ ] AC-2 - Given no accounts, when the page loads, then an empty state explains how to add the first account.
- [ ] AC-3 - Given accounts, when the page loads, then each row shows name, type and the opening balance formatted with `Intl` in the install currency.
- [ ] AC-4 - Given the add form, when I enter name, type and a decimal amount (`1234.50`) and submit, then the request sends integer minor units (`123450`), the new row appears and the form resets.
- [ ] AC-5 - Given a duplicate name or invalid input, when I submit, then the API field errors show inline next to the labelled input and focus moves to the first error.
- [ ] AC-6 - Given the page, when axe runs, then there are no serious or critical violations; inputs are labelled, focus is visible and the layout is one column below 768 px.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `web/src/features/accounts/feature.ts` - route and nav entry
- `web/src/features/accounts/AccountsPage.tsx` - list, empty state, composition
- `web/src/features/accounts/AccountForm.tsx` - add form with decimal-to-minor-units conversion (string math, no floats)
- `web/src/features/accounts/accounts.api.ts` - TanStack Query hooks for list and create
- `web/src/features/accounts/accounts.module.css` - styles with CSS-variable tokens

## Test Hints
- unit (AC-4): `toMinorUnits('1234.50') === 123450`, `'-20'`, `'0.1'`, rejects `'1.234'` for a 2-digit currency.
- unit (AC-1 to AC-3, AC-5): Testing Library with a mocked fetch; empty state, rows, field errors.
- unit (AC-6): `axe-core` on the rendered page in both states.
