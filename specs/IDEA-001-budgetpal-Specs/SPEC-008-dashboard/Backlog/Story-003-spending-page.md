# Story-003: Dashboard page with spending by category

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-008-dashboard]] | P2 | M | Ready | frontend-react | Story-001 | Story-004 |

## Statement
As a budget owner, I want a dashboard page that shows my spending by category for a month as a chart and a table, so that I can read my spending at a glance and exactly.

## Acceptance Criteria
- [ ] AC-1 - Given I am signed in, when the app loads, then a "Dashboard" nav entry appears via `feature.ts` auto-registration and opens `/dashboard` with the current month selected.
- [ ] AC-2 - Given spending data, when the page loads, then I see a Recharts pie chart and a table with category, formatted amount (using the response `currency`) and percentage share, with a total row.
- [ ] AC-3 - Given I change the month in the month picker, when the selection changes, then the chart and table reload for that month.
- [ ] AC-4 - Given no expenses in the month, when the page loads, then I see an empty-state message with a link to the transactions page and no chart is rendered.
- [ ] AC-5 - Given the request is loading or fails, then I see a loading state or an error message with a retry button.
- [ ] AC-6 - Given the page is rendered, when axe-core runs, then there are no violations, the month picker is labelled, each chart slice is also in the table, and no meaning relies on colour alone.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS (M estimate; page, hook and chart only) · T PASS

## Impacted Files
- `web/src/features/dashboard/feature.ts` - route and nav entry
- `web/src/features/dashboard/DashboardPage.tsx` - page, month picker, states
- `web/src/features/dashboard/SpendingByCategory.tsx` - Recharts pie plus accessible table
- `web/src/features/dashboard/api.ts` - TanStack Query hook for `/api/dashboard/spending`
- `web/src/features/dashboard/dashboard.module.css` - styles with CSS-variable tokens

## Test Hints
- unit: share percentage and formatting helpers (AC-2)
- integration: Testing Library with mocked API for data, empty, loading, error and month change (AC-2 to AC-5); axe-core check (AC-6); nav registration (AC-1)
