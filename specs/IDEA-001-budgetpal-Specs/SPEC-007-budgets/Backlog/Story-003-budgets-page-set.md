# Story-003: Budgets page: pick month, set and remove budgets

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-007-budgets]] | P1 | M | Ready | frontend-react | Story-002 | Story-004 |

## Statement
As a BudgetPal user, I want a budgets page where I pick a month and set or remove a budget per expense category, so that I can plan my spending.

## Acceptance Criteria
- [ ] AC-1 - Given the app shell, when the user is signed in, then a "Budgets" nav entry appears via `feature.ts` auto-registration and opens the page with the current month selected.
- [ ] AC-2 - Given the month picker, when the user changes the month, then the list reloads for that month.
- [ ] AC-3 - Given an expense category, when the user enters an amount and saves, then the budget is stored and the list updates; the amount is shown through `Intl` with the install currency and held as integer minor units.
- [ ] AC-4 - Given an empty, zero, negative or non-numeric amount, when the user saves, then an inline labelled error appears and no request is sent or the API error is shown next to the field.
- [ ] AC-5 - Given an existing budget, when the user removes it, then it disappears from the list after the API confirms.
- [ ] AC-6 - Given no expense categories or no budgets, when the page loads, then an empty state explains what to do next.
- [ ] AC-7 - Given keyboard use only, when the user completes the flow, then all controls are reachable, labelled and have a visible focus.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS (page, form and API hooks only; progress visuals split to Story-004) · T PASS

## Impacted Files
- `web/src/features/budgets/feature.ts` - route and nav entry
- `web/src/features/budgets/BudgetsPage.tsx` - page, month picker, list
- `web/src/features/budgets/BudgetForm.tsx` - amount form with validation
- `web/src/features/budgets/api.ts` - TanStack Query hooks
- `web/src/features/budgets/BudgetsPage.module.css` - styles with CSS-variable tokens

## Test Hints
- unit (Testing Library, mocked API): nav entry (AC-1); month change (AC-2); save and amount to minor units (AC-3); validation (AC-4); remove (AC-5); empty state (AC-6); keyboard and labels (AC-7)
