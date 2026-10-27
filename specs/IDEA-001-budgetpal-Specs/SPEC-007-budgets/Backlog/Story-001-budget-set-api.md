# Story-001: Set, change and remove a budget (API)

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-007-budgets]] | P1 | S | Ready | backend-node | Enabler-001 | Story-002, Story-003 |

## Statement
As a BudgetPal user, I want to set, change and remove the budget for an expense category in a month, so that I control my monthly limits.

## Acceptance Criteria
- [ ] AC-1 - Given a signed-in user and an expense category, when they `PUT /api/budgets/{month}/{categoryId}` with `{amountMinor}` > 0, then the budget is saved (201 new, 200 replaced) and returned.
- [ ] AC-2 - Given an income category, an unknown category, or another user's category, when the user sets a budget, then the response is 400 (income) or 404 and nothing is written.
- [ ] AC-3 - Given an invalid month, a zero, negative or non-integer amount, or an unknown body field, when the user sets a budget, then the response is 400 problem+json with field errors and nothing is written.
- [ ] AC-4 - Given an existing budget, when the user calls `DELETE /api/budgets/{month}/{categoryId}`, then it returns 204 and the budget is gone; a second delete returns 404.
- [ ] AC-5 - Given user A's budget, when user B updates or deletes it, then the response is 404 and A's row is unchanged.
- [ ] AC-6 - Given no session, when any budgets route is called, then it returns 401.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/modules/budgets/budgets.schema.ts` - zod schemas and OpenAPI metadata
- `api/src/modules/budgets/budgets.service.ts` - kind and ownership checks, upsert, delete
- `api/src/modules/budgets/budgets.routes.ts` - PUT and DELETE routes with `requireUser`
- `api/src/modules/budgets/index.ts` - module router export for auto-registration

## Test Hints
- integration (Fastify inject): save, replace, delete (AC-1, AC-4); income and foreign category (AC-2); invalid inputs leave the table unchanged (AC-3); two-user test (AC-5); no cookie (AC-6)
