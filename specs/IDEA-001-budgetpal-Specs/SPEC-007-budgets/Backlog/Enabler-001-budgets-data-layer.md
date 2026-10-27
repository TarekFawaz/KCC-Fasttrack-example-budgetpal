# Enabler-001: Budgets table, repository and status rule

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-007-budgets]] | P1 | S | Ready | backend-node | None | Story-001 |

## Outcome Statement
Enable budget storage and progress calculation by adding the `budgets` table, a user-scoped repository and a pure status function, so that the API stories build on tested data access.

## Acceptance Criteria
- [ ] AC-1 - Given migration `0070`, when the runner starts, then table `budgets` exists with `user_id`, `category_id`, `month` (`YYYY-MM`), `amount_minor` (INTEGER > 0), foreign keys, and a unique index on user + category + month.
- [ ] AC-2 - Given a budget exists, when the repository upserts the same user, category and month, then the amount is replaced and no second row exists.
- [ ] AC-3 - Given two users, when user B calls any repository function with A's budget id or category, then nothing is returned or changed (every function takes `userId`).
- [ ] AC-4 - Given transactions in a month, when progress is queried, then `spent_minor` per budgeted category is a SQL sum scoped to the user and the month, and transactions of other months, categories or users are excluded.
- [ ] AC-5 - Given budget and spent in minor units, when the status function runs, then it returns `ok` below 80%, `warning` from 80% to 100% inclusive, and `over` above 100%, using integer arithmetic.

## INVEST
I PASS · N PASS · V PASS (unblocks both APIs) · E PASS · S PASS · T PASS

## Impacted Files
- `api/migrations/0070-budgets.sql` - create `budgets` table and unique index
- `api/src/modules/budgets/budgets.repository.ts` - upsert, find, delete, list-with-spent (user-scoped SQL)
- `api/src/modules/budgets/budgets.status.ts` - pure status function
- `api/src/modules/budgets/budgets.repository.test.ts` - repository and status tests

## Test Hints
- unit: status boundaries 79.99%, 80%, 100%, 100.01% (AC-5)
- integration: in-memory SQLite with migrations, two users (AC-2, AC-3, AC-4); migration shape (AC-1)
