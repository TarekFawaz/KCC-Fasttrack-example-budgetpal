# Story-002: Month-over-month trend endpoint

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-008-dashboard]] | P2 | S | Ready | backend-nodejs | Enabler-001 | Story-004 |

## Statement
As a budget owner, I want my total monthly spending for the last N months, so that I can see whether I spend more or less over time.

## Acceptance Criteria
- [ ] AC-1 - Given expenses in several months, when I call `GET /api/dashboard/trend?months=6&end=2026-03`, then I get `currency` and `points[]` of exactly 6 entries `{month, totalMinor}` from 2025-10 to 2026-03, oldest first.
- [ ] AC-2 - Given a month in the window has no expenses, when I call the endpoint, then that month appears with `totalMinor: 0`.
- [ ] AC-3 - Given no `months` or `end`, when I call the endpoint, then it returns 6 points ending in the current month.
- [ ] AC-4 - Given user B has no transactions, when B calls the endpoint, then every point is 0 and A's figures never appear.
- [ ] AC-5 - Given no session, then 401; given `months=25` or `end=2026-99`, then 400 problem+json; income categories are excluded.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/modules/dashboard/trend.repository.ts` - `monthlyTotals(userId, fromDate, toDate)` SQL grouping by `substr(date,1,7)`
- `api/src/modules/dashboard/trend.service.ts` - build the month window and zero-fill gaps
- `api/src/modules/dashboard/trend.routes.ts` - `GET /trend` with `requireUser`

## Test Hints
- unit: window across a year boundary, zero-fill, default parameters (AC-1, AC-2, AC-3)
- integration: seeded data, two-user isolation (AC-4), 401 and 400 cases, income excluded (AC-5)
