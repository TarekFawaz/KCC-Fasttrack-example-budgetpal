---
id: SPEC-004
title: Accounts
status: Ready
depends_on: [SPEC-002]
---

# SPEC-004: Accounts

| Priority | Category | Status | Wave | Depends on | Blocks | Index |
|--|--|--|--|--|--|--|
| P1 | Feature | Ready | 3 | [[../SPEC-002-auth/SPEC-002-auth\|SPEC-002]] | [[../SPEC-005-transactions/SPEC-005-transactions\|SPEC-005]] | [[../IDEA-001-budgetpal-Specs]] |

## Delivery Brief
- **Who:** A signed-in BudgetPal user who tracks money across several places (current account, savings, credit card, cash).
- **Gets:** An Accounts page to add, list, rename, retype, re-balance and delete accounts, each with a name, a type and an opening balance in minor units.
- **Value:** Transactions (SPEC-005) need an account to belong to; the opening balance is the starting point of every account balance.
- **Measured by:** A user creates, edits and deletes an account on the page; a second user never sees or changes it; a duplicate name or an invalid field is rejected with a field-level error and writes nothing.
- **Out of scope:** Computed balances and transaction counts (SPEC-005), transfers between accounts, archiving, multi-currency (one `CURRENCY` per install, D-13), delete-with-reassign.

## Decisions taken here (defaults, no open question)
- Types: `checking`, `savings`, `credit_card`, `cash`, `other` (zod enum, stored as `TEXT` with a `CHECK`).
- Names: trimmed, 1-60 chars, unique per user case-insensitively (unique index on `user_id, name COLLATE NOCASE`); duplicate returns 409.
- Opening balance: integer minor units, may be negative (credit card), absolute value at most 10^12; default 0.
- In-use delete rule: delete is blocked with 409 while any transaction references the account. SPEC-005 declares `transactions.account_id` with `ON DELETE RESTRICT`; the repository maps the SQLite foreign-key error to 409, so no import of the transactions module is needed (GR-006) and the rule holds before and after SPEC-005 exists.
- Migration: `api/migrations/0040-create-accounts.sql` (range 0040-0049, GR-014).

## Acceptance Criteria
- [ ] AC-1 - A signed-in user can create an account with name, type and opening balance and sees it in the list, ordered by name.
- [ ] AC-2 - A user can edit an account's name, type and opening balance; changes persist after reload.
- [ ] AC-3 - A user can delete an account that no transaction uses; it disappears from the list.
- [ ] AC-4 - Deleting an account referenced by a transaction returns 409 problem+json, the account stays, and the page shows an inline explanation.
- [ ] AC-5 - A second account name equal to an existing one (ignoring case and surrounding spaces) for the same user returns 409; the same name for another user is allowed.
- [ ] AC-6 - Invalid input (empty or over-long name, unknown type, non-integer or out-of-range balance, unknown field) returns 400 with field-level errors and writes nothing.
- [ ] AC-7 - Every route requires a session (401 without one); user B gets 404 on user A's account for read, update and delete and sees none of A's accounts in the list.
- [ ] AC-8 - Money is stored and sent as integer minor units; the page shows it through `Intl` in the install currency and never uses floats for the stored value.
- [ ] AC-9 - The Accounts page appears in the navigation without editing a shared file, has an empty state, labelled inputs, inline errors and no serious or critical axe violation.
- [ ] AC-10 - The routes appear in the OpenAPI document served at `/docs/json` and responses match it.

## Backlog
| Key | Type | Title | Status | Depends on | Wave | Files | File |
|--|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | Accounts table, repository and schemas | Ready | None | 1 | 4 | [[Backlog/Enabler-001-accounts-data-layer]] |
| Story-001 | Story | Create and list accounts (API) | Ready | Enabler-001 | 2 | 4 | [[Backlog/Story-001-create-and-list-accounts-api]] |
| Story-002 | Story | Edit and delete accounts with in-use rule (API) | Ready | Story-001 | 3 | 3 | [[Backlog/Story-002-edit-and-delete-accounts-api]] |
| Story-003 | Story | Accounts page: list and add | Ready | Story-001 | 3 | 5 | [[Backlog/Story-003-accounts-page-list-and-add]] |
| Story-004 | Story | Accounts page: edit and delete | Ready | Story-002, Story-003 | 4 | 3 | [[Backlog/Story-004-accounts-page-edit-and-delete]] |

## Architecture references
- Decisions: D-01 (modules), D-03/D-04 (zod, OpenAPI), D-05 (SQLite, migrations), D-08 (isolation), D-10/D-11 (validation, problem+json), D-13 (money), D-19/D-20 (React, a11y), D-23 (tests); guardrails GR-002, GR-003, GR-004, GR-006, GR-007, GR-014
- Containers: API, SQLite database, Web
- Architecture Document: [[../../../architecture/architecture]]

## Risks
- Delete rule depends on SPEC-005's `ON DELETE RESTRICT` - AC-4 is proven here with a test-only table carrying that foreign key; SPEC-005 must keep the clause and add its own check.
- SPEC-002 helpers (`requireUser`, validation helper, session test helper) are assumed in `api/src/kernel/` - if names differ, the planner adjusts imports, not the design.
- Nav auto-registration (SPEC-001 `feature.ts` convention) must exist - Story-003 stops and reports if it is missing.
- Account type list is an assumption (Assumptions log); changing it later is a new migration.
