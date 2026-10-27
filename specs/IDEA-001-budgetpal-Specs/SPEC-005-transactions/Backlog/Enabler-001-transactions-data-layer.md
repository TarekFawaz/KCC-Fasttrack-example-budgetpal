# Enabler-001: Transactions table, schemas and repository

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-005-transactions]] | P1 | S | Ready | backend-nodejs | None | Story-001, Story-002, Story-003 |

## Outcome Statement
Enable every transaction route to share one migration, one set of zod schemas and one user-scoped repository, so that the stories stay thin and isolation is enforced in one place.

## Acceptance Criteria
- [ ] AC-1 - Given a fresh database, when migrations run, then `transactions` exists (`id`, `user_id`, `account_id`, `category_id`, `occurred_on` TEXT, `amount_minor` INTEGER, `description`, `created_at`, `updated_at`) with foreign keys `ON DELETE RESTRICT` and an index on `(user_id, occurred_on)`.
- [ ] AC-2 - Given the migration file, then it is `0050-transactions.sql`, forward-only, with no REAL/FLOAT/DECIMAL column.
- [ ] AC-3 - Given the zod schemas, then bodies are `.strict()`, amount is a positive safe integer (max 999999999999), date is a real `YYYY-MM-DD`, description is 1-200 chars, month is `YYYY-MM`.
- [ ] AC-4 - Given repository functions, then each takes `userId` first and every statement filters by `user_id`; reading another user's id returns nothing.
- [ ] AC-5 - Given an account or category id, when `ownsAccount` / `ownsCategory` run, then they are true only for rows of that user.

## INVEST
I PASS · N PASS · V PASS (unblocks all stories) · E PASS · S PASS · T PASS

## Impacted Files
- `api/migrations/0050-transactions.sql` - new table and index
- `api/src/modules/transactions/transactions.schemas.ts` - zod schemas and types
- `api/src/modules/transactions/transactions.repository.ts` - user-scoped SQL
- `api/src/modules/transactions/transactions.repository.test.ts` - repository tests

## Test Hints
- unit: schema accepts/rejects dates, amounts, months (AC-3)
- integration: migrate on empty db, inspect columns and FKs (AC-1, AC-2); two users, cross-read returns none (AC-4, AC-5)
