---
id: SPEC-005
title: Transactions
status: Ready
depends_on: [SPEC-003, SPEC-004]
---

# SPEC-005: Transactions

| Priority | Category | Status | Wave | Depends on | Blocks | Index |
|--|--|--|--|--|--|--|
| P1 | Feature | Ready | 4 | [[../SPEC-003-categories/SPEC-003-categories\|SPEC-003]], [[../SPEC-004-accounts/SPEC-004-accounts\|SPEC-004]] | SPEC-006, SPEC-007, SPEC-008 | [[../IDEA-001-budgetpal-Specs]] |

## Delivery Brief
- **Who:** A signed-in budget owner recording their day-to-day money movements.
- **Gets:** Add, edit and delete transactions (date, amount, description, account, category) and list them filtered by month, account and category, with pagination.
- **Value:** The transactions table and API that CSV import, budgets and the dashboard build on.
- **Measured by:** A user records a transaction and finds it in the filtered list; user B never sees or changes user A's rows (two-user test); list of 10,000 rows answers under 200 ms p95.
- **Out of scope:** CSV import and its dedupe key (SPEC-006), budgets (SPEC-007), charts and aggregates (SPEC-008), transfers between accounts, account balances, bulk edit, CSV export, free-text search.

## Acceptance Criteria
- [ ] AC-1 - A signed-in user can add a transaction (date `YYYY-MM-DD`, amount in integer minor units > 0, description 1-200 chars, own account, own category) and gets 201 with the stored row.
- [ ] AC-2 - Direction comes from the category kind (expense or income); the amount is always stored as a positive integer; no floats and no `REAL` column anywhere (GR-007).
- [ ] AC-3 - A user can edit and delete their own transaction; editing re-checks account and category ownership.
- [ ] AC-4 - The list returns `{items, total, limit, offset}` sorted by date then id descending, with optional `month=YYYY-MM`, `accountId` and `categoryId` filters that combine, and offset/limit paging (default 50, max 200, D-12).
- [ ] AC-5 - Every route requires a session (401 otherwise) and is scoped by `user_id`: user B gets 404 on user A's transaction and sees none of A's rows in lists (QG-ISOLATION).
- [ ] AC-6 - An account or category id that does not exist or belongs to another user is rejected with 400 and a field error; nothing is written.
- [ ] AC-7 - Invalid or unknown fields (bad date, zero, negative or non-integer amount, empty or long description, bad month) return 400 problem+json with field errors; the table is unchanged (QG-VALIDATION).
- [ ] AC-8 - Deleting an account or category that has transactions stays blocked by SPEC-003/004's rule; the foreign keys here use `ON DELETE RESTRICT`.
- [ ] AC-9 - The Transactions page is reached from the nav, lists with filters and pager, adds, edits and deletes with inline validation errors and an empty state; it passes axe with no serious or critical violation (QG-A11Y).
- [ ] AC-10 - Logs for these routes never contain descriptions or amounts (GR-008). QG-PROD items 1, 3-6: n/a, owned by SPEC-001 and unchanged by this module.

## Backlog
| Key | Type | Title | Status | Depends on | Wave | Files | File |
|--|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | Transactions table, schemas and repository | Ready | None | 1 | 4 | [[Backlog/Enabler-001-transactions-data-layer]] |
| Story-001 | Story | Add a transaction (API) | Ready | Enabler-001 | 2 | 4 | [[Backlog/Story-001-add-transaction-api]] |
| Story-002 | Story | Edit and delete a transaction (API) | Ready | Story-001 | 3 | 3 | [[Backlog/Story-002-edit-delete-transaction-api]] |
| Story-003 | Story | List and filter transactions (API) | Ready | Story-001 | 4 | 3 | [[Backlog/Story-003-list-filter-transactions-api]] |
| Story-004 | Story | Browse transactions page | Ready | Story-003 | 5 | 5 | [[Backlog/Story-004-transactions-list-page]] |
| Story-005 | Story | Add, edit and delete from the page | Ready | Story-002, Story-004 | 6 | 4 | [[Backlog/Story-005-transaction-form-ui]] |

## Architecture references
- Decisions: D-01, D-03, D-04, D-08, D-10, D-11, D-12, D-13, D-16, D-19, D-20, D-23
- Containers: API, Web, SQLite database
- Architecture Document: [[../../../architecture/architecture]]

## Risks
- Table and column names of `categories` and `accounts` (SPEC-003/004) are read for ownership checks; GR-006 forbids importing their modules - the repository queries `id` and `user_id` of those tables in its own SQL and the planner confirms names against the merged migrations 0030/0040.
- The web account and category pickers call the SPEC-003/004 list endpoints through the kernel API client, not their feature code (GR-006).
- Positive amounts with direction from category kind: SPEC-006 must map signed CSV amounts onto a category kind - recorded here so it plans for it.
- SPEC-006 adds its dedupe column and unique index in its own migration (0060 range), so this migration stays unaware of import.
