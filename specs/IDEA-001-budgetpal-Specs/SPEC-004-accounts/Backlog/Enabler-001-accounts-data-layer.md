# Enabler-001: Accounts table, repository and schemas

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-004-accounts]] | P1 | S | Ready | backend-nodejs, testing-unit | None | Story-001 |

## Outcome Statement
Enable the accounts module by adding the `accounts` table, a user-scoped repository and the shared zod schemas, so that the API stories build on one tested data layer.

## Acceptance Criteria
- [ ] AC-1 - Given a fresh database, when migrations run, then `accounts` exists with `id`, `user_id` (foreign key to users), `name`, `type` (CHECK in the five types), `opening_balance_minor INTEGER`, `created_at`, `updated_at`, and a unique index on `user_id, name COLLATE NOCASE`; no REAL/FLOAT/DECIMAL column.
- [ ] AC-2 - Given the repository, when any function is called, then it takes `userId` first and every query is parameterised and filtered by `user_id`.
- [ ] AC-3 - Given a name already used by the same user (any case), when `create` or `update` runs, then it throws a typed `DuplicateName` error; another user may use that name.
- [ ] AC-4 - Given a foreign-key constraint error on delete, when `remove` runs, then it throws a typed `InUse` error and the row stays.
- [ ] AC-5 - Given the schemas, when parsed, then name is trimmed 1-60 chars, type is the enum, balance is an integer with absolute value at most 10^12, default 0, and unknown fields are rejected (`.strict()`).

## INVEST
I PASS · N PASS · V PASS (unblocks every story) · E PASS · S PASS · T PASS

## Impacted Files
- `api/migrations/0040-create-accounts.sql` - table and unique index
- `api/src/modules/accounts/accounts.repository.ts` - list, findById, create, update, remove, all scoped by `userId`
- `api/src/modules/accounts/accounts.schemas.ts` - zod create/update/params schemas and response type
- `api/src/modules/accounts/accounts.repository.test.ts` - repository tests on a temp database

## Test Hints
- unit (AC-1): migrate a temp DB, read `pragma table_info` and index list.
- unit (AC-2, AC-3): two users, same name allowed across users, `Savings` vs ` savings ` rejected for one user.
- unit (AC-4): create a test-only table `t_ref(account_id REFERENCES accounts(id) ON DELETE RESTRICT)`, insert a row, `remove` throws `InUse`.
- unit (AC-5): schema accepts valid input, rejects empty, 61 chars, `1.5`, `10^12 + 1`, extra key.
