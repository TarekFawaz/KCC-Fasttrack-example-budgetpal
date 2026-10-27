# Story-004: Progress bars with warning and over-budget flags

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-007-budgets]] | P1 | S | Ready | frontend-react | Story-003 | None |

## Statement
As a BudgetPal user, I want each budget to show spent against the limit with a clear warning near 80% and a flag when I am over, so that I notice problems early.

## Acceptance Criteria
- [ ] AC-1 - Given a budget with progress, when the page renders, then it shows category, spent, budget and percent, and a progress bar with an accessible name and `aria-valuenow`.
- [ ] AC-2 - Given status `ok`, `warning` and `over`, when rendered, then each shows an icon and text ("Within budget", "Near limit: 80% used or more", "Over budget") as well as green, amber or red colour.
- [ ] AC-3 - Given spending above 100%, when rendered, then the bar is capped at full width and the amount over the budget is stated in text.
- [ ] AC-4 - Given unbudgeted expense categories with spending, when rendered, then they are listed with an "Add budget" action that focuses the amount field.
- [ ] AC-5 - Given the budgets page in light and dark scheme, when axe runs, then there are no serious or critical violations and text contrast is at least 4.5:1.
- [ ] AC-6 - Given a viewport of 360 px, when rendered, then the layout is a single column with no horizontal scroll.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `web/src/features/budgets/BudgetProgress.tsx` - bar, status icon and text
- `web/src/features/budgets/BudgetProgress.module.css` - status tokens, light and dark
- `web/src/features/budgets/BudgetsPage.test.tsx` - progress, status and axe tests

## Test Hints
- unit (Testing Library): values and aria (AC-1); status text and icon per state (AC-2); cap and over text (AC-3); unbudgeted action (AC-4)
- a11y: axe-core on the page in both schemes (AC-5); narrow-viewport layout assertion (AC-6)
