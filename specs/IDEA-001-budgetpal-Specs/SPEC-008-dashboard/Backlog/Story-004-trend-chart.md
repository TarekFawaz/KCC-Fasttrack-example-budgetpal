# Story-004: Trend chart on the dashboard

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-008-dashboard]] | P2 | S | Ready | frontend-react | Story-002, Story-003 | None |

## Statement
As a budget owner, I want a chart of my total spending for the last months, so that I can see whether my spending is rising or falling.

## Acceptance Criteria
- [ ] AC-1 - Given trend data, when the dashboard loads, then a Recharts bar or line chart shows one point per month, oldest first, ending at the selected month.
- [ ] AC-2 - Given the same data, when the page renders, then a table with month and formatted amount is available as an alternative to the chart.
- [ ] AC-3 - Given I choose 3, 6 or 12 months in a labelled selector, when I change it, then the chart and table reload with that count (default 6).
- [ ] AC-4 - Given all points are zero, when the page loads, then the trend section shows the empty state instead of a flat chart.
- [ ] AC-5 - Given loading or error, then the trend section shows its own loading state or error with retry without blanking the category section; axe-core reports no violations.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `web/src/features/dashboard/TrendChart.tsx` - Recharts chart, table and range selector
- `web/src/features/dashboard/api.ts` - add the hook for `/api/dashboard/trend`
- `web/src/features/dashboard/DashboardPage.tsx` - mount the trend section below the categories

## Test Hints
- integration: Testing Library with mocked API for data, all-zero, loading and error (AC-1, AC-2, AC-4, AC-5); selector changes the request `months` (AC-3); axe-core (AC-5)
