---
id: SPEC-008
title: Dashboard
status: Ready
depends_on: [SPEC-005]
---

# SPEC-008: Dashboard

| Priority | Category | Status | Wave | Depends on | Blocks | Index |
|--|--|--|--|--|--|--|
| P2 | Feature | Ready | 5 | [[../SPEC-005-transactions/SPEC-005-transactions\|SPEC-005]] | None | [[../IDEA-001-budgetpal-Specs]] |

## Delivery Brief
- **Who:** A BudgetPal user (budget owner) who has recorded transactions.
- **Gets:** A dashboard page showing spending by category for a chosen month (pie chart plus table) and a month-over-month spending trend for the last N months, with an empty state when there is no data.
- **Value:** Answers "where does my money go and is it trending up?" without leaving the app.
- **Measured by:** With 10,000 transactions both aggregate endpoints answer in under 200 ms p95; category totals equal the sum of the user's expense transactions for that month; user B never sees user A's figures.
- **Out of scope:** Income or net charts, transfers, budgets (SPEC-007), CSV or image export, drill-down to transactions, custom date ranges beyond a month and "last N months", multi-currency.

## Acceptance Criteria
- [ ] AC-1 - `GET /api/dashboard/spending?month=YYYY-MM` returns, for the signed-in user, total and per-expense-category amounts in integer minor units plus `currency`, sorted by amount descending; income categories are excluded (D-15).
- [ ] AC-2 - `GET /api/dashboard/trend?months=N&end=YYYY-MM` returns one point per month for the last N months (default 6, max 24, end defaults to the current month), oldest first, with zero-filled months.
- [ ] AC-3 - Both aggregates are computed in SQL, are scoped by `user_id`, and an unauthenticated call returns 401; invalid `month`, `months` or `end` returns 400 `application/problem+json`.
- [ ] AC-4 - The two-user isolation test passes: user B's responses contain none of user A's amounts or category names (D-08).
- [ ] AC-5 - The dashboard page lists a spending-by-category chart with an equivalent data table, a month picker (default current month) and a trend chart with its data table.
- [ ] AC-6 - A user with no expense transactions in the selected month (or at all) sees a clear empty state with a link to add a transaction, and no empty chart.
- [ ] AC-7 - The page meets WCAG 2.2 AA: axe reports no violations, charts have a table alternative, colour is never the only carrier of meaning (D-20).
- [ ] AC-8 - Production readiness (QG-PROD): n/a, this spec adds read-only routes to the existing api and web containers and ships no new service; logs follow D-16 (no amounts or descriptions).

## Backlog
| Key | Type | Title | Status | Depends on | Wave | Files | File |
|--|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | Dashboard module scaffold, schemas and index migration | Ready | None | 1 | 5 | [[Backlog/Enabler-001-dashboard-module]] |
| Story-001 | Story | Spending by category endpoint | Ready | Enabler-001 | 2 | 3 | [[Backlog/Story-001-spending-endpoint]] |
| Story-002 | Story | Month-over-month trend endpoint | Ready | Enabler-001 | 2 | 3 | [[Backlog/Story-002-trend-endpoint]] |
| Story-003 | Story | Dashboard page with spending by category | Ready | Story-001 | 3 | 5 | [[Backlog/Story-003-spending-page]] |
| Story-004 | Story | Trend chart on the dashboard | Ready | Story-002, Story-003 | 4 | 3 | [[Backlog/Story-004-trend-chart]] |

## Architecture references
- Decisions: D-01 (modules), D-03/D-04 (zod, OpenAPI), D-08 (user scoping), D-10, D-11, D-13 (money), D-15 (expenses only), D-19/D-20 (Recharts, accessibility), D-23 (tests)
- Containers: API (`api/src/modules/dashboard`), Web (`web/src/features/dashboard`), SQLite database (read only; migration range 0080-0089)
- Architecture Document: [[../../../architecture/architecture]]

## Risks
- Amount sign convention is defined by SPEC-005 - the SQL uses `ABS(amount_minor)` on expense-kind categories; the planner must confirm against the SPEC-005 migration before coding.
- Date filtering on `YYYY-MM-DD` text columns - use half-open `[first day, first day of next month)` ranges so the index on `(user_id, date)` is used.
- Months with no data would leave gaps in the trend - zero-fill in the service so the chart axis is continuous.
- Currency formatting - the API returns `currency` from env `CURRENCY` (D-13), so the web does not read config itself.
