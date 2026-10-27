# Story-001: Spending by category endpoint

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-008-dashboard]] | P2 | S | Ready | backend-nodejs | Enabler-001 | Story-003 |

## Statement
As a budget owner, I want my spending for a month grouped by expense category, so that I can see where my money went.

## Acceptance Criteria
- [ ] AC-1 - Given I have expense transactions in 2026-03, when I call `GET /api/dashboard/spending?month=2026-03`, then I get `month`, `currency`, `totalMinor` and `categories[]` with `categoryId`, `name`, `amountMinor`, sorted by amount descending, and the category amounts add up to `totalMinor`.
- [ ] AC-2 - Given I have income-kind categories or transactions in other months, when I call the endpoint, then they are not counted.
- [ ] AC-3 - Given I have no expense transactions in the month, when I call the endpoint, then I get 200 with `totalMinor: 0` and an empty `categories` array.
- [ ] AC-4 - Given user A has transactions and user B has none, when B calls the endpoint, then B sees `totalMinor: 0` and none of A's category names.
- [ ] AC-5 - Given no session cookie, when the endpoint is called, then 401; given `month=bad`, then 400 problem+json.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/modules/dashboard/spending.repository.ts` - `spendingByCategory(userId, range)` SQL `GROUP BY` over transactions joined to categories of kind `expense`
- `api/src/modules/dashboard/spending.service.ts` - assemble totals and currency from config
- `api/src/modules/dashboard/spending.routes.ts` - `GET /spending` with `requireUser`

## Test Hints
- unit: service totals equal the sum of rows, ordering (AC-1)
- integration: seeded transactions across months and kinds (AC-1, AC-2, AC-3); two-user isolation (AC-4); 401 and 400 cases (AC-5)
