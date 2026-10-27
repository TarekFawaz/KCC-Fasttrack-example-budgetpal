---
id: SPEC-007
title: Budgets
status: Ready
depends_on: [SPEC-005]
---

# SPEC-007: Budgets

| Priority | Category | Status | Wave | Depends on | Blocks | Index |
|--|--|--|--|--|--|--|
| P1 | Feature | Ready | 5 | [[../SPEC-005-transactions/SPEC-005-transactions\|SPEC-005]] | None | [[../IDEA-001-budgetpal-Specs]] |

## Delivery Brief
- **Who:** A BudgetPal user who wants to stay within a monthly spending limit per category.
- **Gets:** One budget amount per expense category per month, with spent / budget progress, an 80% warning and an over-budget flag on the budgets page.
- **Value:** The user sees at a glance which categories are close to or over their limit, without doing the sums.
- **Measured by:** For a month with a budget and transactions, the page shows spent, budget, percent and the correct status (within budget, warning at >= 80%, over budget above 100%); user B never sees user A's budgets.
- **Out of scope:** Rollover, copying budgets to the next month, income or total-month budgets, notifications, dashboard charts ([[../SPEC-008-dashboard/SPEC-008-dashboard|SPEC-008]]).

## Acceptance Criteria
- [ ] AC-1 - A user can set, change and remove one budget (integer minor units, > 0) for an expense category in a month `YYYY-MM`; setting again for the same category and month replaces the amount.
- [ ] AC-2 - A budget for an income category, an unknown category, another user's category, or an invalid month or amount is rejected with 400 or 404 problem+json and nothing is written.
- [ ] AC-3 - The progress view for a month lists each budgeted category with budget, spent (sum of the user's transactions in that category and month, computed in SQL) and percent.
- [ ] AC-4 - Status is `ok` below 80%, `warning` from 80% up to and including 100%, and `over` above 100%; the boundaries use integer arithmetic.
- [ ] AC-5 - The budgets page shows each status as icon plus text (never colour alone), a progress bar with an accessible name and value, an empty state when no budget exists, and inline validation errors; it has no serious or critical axe violation.
- [ ] AC-6 - User B cannot read, change or delete user A's budgets (404) and sees none of A's budgets or spent figures in lists or progress (QG-ISOLATION).
- [ ] AC-7 - Every route declares zod schemas, is behind `requireUser`, and appears in the OpenAPI document; logs contain no amounts.

## Backlog
| Key | Type | Title | Status | Depends on | Wave | Files | File |
|--|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | Budgets table, repository and status rule | Ready | None | 1 | 4 | [[Backlog/Enabler-001-budgets-data-layer]] |
| Story-001 | Story | Set, change and remove a budget (API) | Ready | Enabler-001 | 2 | 4 | [[Backlog/Story-001-budget-set-api]] |
| Story-002 | Story | Monthly progress endpoint | Ready | Story-001 | 3 | 4 | [[Backlog/Story-002-budget-progress-api]] |
| Story-003 | Story | Budgets page: pick month, set and remove budgets | Ready | Story-002 | 4 | 5 | [[Backlog/Story-003-budgets-page-set]] |
| Story-004 | Story | Progress bars with warning and over-budget flags | Ready | Story-003 | 5 | 3 | [[Backlog/Story-004-budgets-progress-ui]] |

## Architecture references
- Decisions: D-01, D-04, D-05, D-08, D-10, D-11, D-13, D-15, D-19, D-20
- Containers: API, Web, SQLite database (C2 diagram)
- Architecture Document: [[../../../architecture/architecture]]

## Risks
- The budgets module needs transaction sums but GR-006 forbids importing another module - its own repository reads the `transactions` and `categories` tables by SQL; the planner checks column names and the amount sign convention against SPEC-005's migration.
- Percent rounding hides the 80% and 100% edges - status is decided by integer comparison (`spent*100 >= budget*80`, `spent > budget`), percent is display only.
- QG-PROD: n/a for health, config, logs and shutdown (inherited from SPEC-001; this spec adds routes only); rollback is the forward-only migration `0070` left in place and the module folder removed.
- Parallel build with SPEC-006 and SPEC-008 - this spec owns only `api/src/modules/budgets`, `web/src/features/budgets` and migration `0070`.
