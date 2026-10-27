# Story-003: List and filter transactions (API)

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-005-transactions]] | P1 | S | Ready | backend-nodejs | Story-001 | Story-004 |

## Statement
As a budget owner, I want a paginated list of my transactions filtered by month, account and category, so that I can find what I spent.

## Acceptance Criteria
- [ ] AC-1 - Given my transactions, when I `GET /transactions`, then 200 returns `{items, total, limit, offset}` sorted by date then id descending, default limit 50.
- [ ] AC-2 - Given `month=2026-03`, `accountId` or `categoryId`, when listing, then only matching rows return and the filters combine (AND); `total` counts the filtered set.
- [ ] AC-3 - Given `limit` above 200, a negative `offset`, a malformed month or an unknown query key, then 400 with field errors.
- [ ] AC-4 - Given user B has transactions, when user A lists (also with B's account id as filter), then none of B's rows appear.
- [ ] AC-5 - Given 10,000 rows, when listing a month, then the query is served by the `(user_id, occurred_on)` index and p95 stays under 200 ms.
- [ ] AC-6 - Given no match, then `items` is `[]` and `total` is 0.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/modules/transactions/transactions.routes.ts` - GET list route and query schema
- `api/src/modules/transactions/transactions.service.ts` - list with filters and paging
- `api/src/modules/transactions/transactions.routes.test.ts` - list tests

## Test Hints
- integration: seed rows, assert order and paging (AC-1, AC-6); combined filters (AC-2)
- integration: invalid queries (AC-3); two-user list (AC-4); seeded 10k timing and `EXPLAIN QUERY PLAN` (AC-5)
