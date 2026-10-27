# Story-002: Monthly progress endpoint

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-007-budgets]] | P1 | S | Ready | backend-node | Story-001 | Story-003 |

## Statement
As a BudgetPal user, I want one call that returns my budgets for a month with spent, percent and status, so that I can see how I am doing.

## Acceptance Criteria
- [ ] AC-1 - Given budgets and transactions, when the user calls `GET /api/budgets?month=YYYY-MM`, then each item has category id and name, `budgetMinor`, `spentMinor`, `percent` and `status`.
- [ ] AC-2 - Given spending of 79%, 80%, 100% and 101% of a budget, when progress is read, then the statuses are `ok`, `warning`, `warning` and `over`.
- [ ] AC-3 - Given an expense category with no budget, when progress is read, then it is listed under `unbudgeted` with its spent figure so the page can offer to add a budget.
- [ ] AC-4 - Given a month without budgets, when progress is read, then `items` is empty and the response is 200.
- [ ] AC-5 - Given an invalid or missing `month`, when progress is read, then the response is 400 problem+json.
- [ ] AC-6 - Given user A's budgets and spending, when user B reads progress, then B sees none of A's items or amounts.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/modules/budgets/budgets.progress.routes.ts` - GET route with `requireUser`
- `api/src/modules/budgets/budgets.progress.service.ts` - assemble items, percent, status, unbudgeted list
- `api/src/modules/budgets/budgets.progress.test.ts` - progress and isolation tests
- `api/src/modules/budgets/index.ts` - add the progress route to the module router (created by Story-001)

## Test Hints
- integration (inject, seeded transactions): shape (AC-1); boundary amounts (AC-2); unbudgeted (AC-3); empty month (AC-4); bad month (AC-5); two-user (AC-6)
