# Enabler-001: Categories table, schemas and repository

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-003-categories]] | P1 | S | Ready | backend-nodejs, testing-unit | None | Story-001 |

## Outcome Statement
Enable category storage by adding migration 0030, the zod schemas and a user-scoped repository, so that the routes and the page can be built on a tested data layer.

## Acceptance Criteria
- [ ] AC-1 - Given the migration runner, when it starts on an empty database, then table `categories` exists with `id`, `user_id` (FK to users, `ON DELETE CASCADE`), `name`, `kind` (`CHECK` in `expense`, `income`), `created_at`, and a unique index on `(user_id, name COLLATE NOCASE)`; the file is `0030-categories.sql`, forward-only, no REAL/FLOAT columns.
- [ ] AC-2 - Given user A has "Food", when A inserts "food", then the repository signals a duplicate-name error; when user B inserts "Food", it succeeds.
- [ ] AC-3 - Given categories of two users, when `list(userId)` runs, then it returns only that user's rows ordered by name; `findById`, `update` and `remove` take `userId` and return nothing or false for another user's id.
- [ ] AC-4 - Given a row in a test table with `category_id REFERENCES categories(id) ON DELETE RESTRICT`, when `remove` runs on the referenced category, then the repository signals an in-use error and the row stays.
- [ ] AC-5 - The zod schemas (`createCategory`, `updateCategory`, `categoryParams`, `category`) are `.strict()`, trim the name, and bound it to 1-60 chars.

## INVEST
I PASS · N PASS · V PASS (unblocks every other item) · E PASS · S PASS · T PASS

## Impacted Files
- `api/migrations/0030-categories.sql` - new table and unique index (reserved range 0030-0039).
- `api/src/modules/categories/categories.schema.ts` - zod schemas and inferred types.
- `api/src/modules/categories/categories.repository.ts` - parameterised SQL scoped by `userId`; maps SQLite unique and foreign-key errors to typed errors.
- `api/src/modules/categories/categories.repository.test.ts` - repository tests on an in-memory database with the real migrations.

## Test Hints
- unit: schema accepts and rejects (AC-5) · integration: migration applies (AC-1), duplicate per user and across users (AC-2), two-user scoping (AC-3), RESTRICT with a temporary referencing table (AC-4).
