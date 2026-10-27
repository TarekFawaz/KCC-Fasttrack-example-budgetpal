# Story-001: Dashboard and budgets restyled

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-010-shadcn-ui]] | P1 | M | Ready | frontend-react, testing-unit | Enabler-002 | Story-004 |

## Statement
As a signed-in user, I want the dashboard and the budgets page to look like a modern app, so that spending and limits are easy to read at a glance.

## Acceptance Criteria
- [ ] AC-1 - Given the dashboard, then the month or range control is a shadcn Tabs or Select, the charts sit in Cards, and the Recharts charts stay with colours taken from the theme tokens and their data-table alternative kept.
- [ ] AC-2 - Given the existing dashboard behaviour (spending by category, month-over-month trend, empty and error states, `Intl` currency display), then it is unchanged and its tests keep their queries and intent.
- [ ] AC-3 - Given the budgets page, then budgets are Cards or rows with a shadcn Progress (accessible name and value kept), a Badge for `ok`, `warning` and `over` with icon plus text, shadcn Input and Button for the amount form, and the same inline validation errors.
- [ ] AC-4 - Given the status rule from SPEC-007 (`ok` below 80%, `warning` up to and including 100%, `over` above), then colours, icons and text show it with no colour-only cue.
- [ ] AC-5 - Given each page, then it has no serious or critical axe violation in light and dark (token classes toggled in the test), is keyboard reachable with a visible focus ring, and its layout uses no fixed width over 360 px.
- [ ] AC-6 - Given the two features, then `dashboard.module.css`, `BudgetsPage.module.css` and `BudgetProgress.module.css` are deleted and no hard-coded colour remains; the budgets contrast test now reads the theme tokens.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS (a mechanical restyle; the planner may split per page if SZ-4 trips) · T PASS

## Impacted Files
- `web/src/features/dashboard/DashboardPage.tsx` - Cards, range control, layout
- `web/src/features/dashboard/{SpendingByCategory,TrendChart}.tsx` - Card wrappers, token colours, table alternative
- `web/src/features/dashboard/dashboard.module.css` - deleted
- `web/src/features/budgets/{BudgetsPage,BudgetForm,BudgetProgress}.tsx` - Card, Input, Button, Progress, Badge
- `web/src/features/budgets/{BudgetsPage,BudgetProgress}.module.css` - deleted

## Test Hints
- unit (Testing Library, mocked API): existing flows pass unchanged (AC-2); Tabs or Select changes the range (AC-1); progress `aria-valuenow` and badge text per status at 79%, 80%, 100%, 101% (AC-3, AC-4)
- unit: axe in light and dark (AC-5); source scan for hard-coded colours and for the deleted CSS files (AC-6)
- Tests beside the code (in scope, not counted in Files) are updated, not deleted: `DashboardPage`, `SpendingByCategory`, `TrendChart`, `BudgetForm`, `BudgetsPage` and `BudgetsPage.set` (T-0xx IDs keep their intent).
