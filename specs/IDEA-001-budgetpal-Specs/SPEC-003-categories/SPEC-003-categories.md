---
id: SPEC-003
title: Categories
status: Ready
depends_on: [SPEC-002]
---

# SPEC-003: Categories

| Priority | Category | Status | Wave | Depends on | Blocks | Index |
|--|--|--|--|--|--|--|
| P1 | Feature | Ready | 3 | [[../SPEC-002-auth/SPEC-002-auth\|SPEC-002]] | [[../SPEC-005-transactions/SPEC-005-transactions\|SPEC-005]] | [[../IDEA-001-budgetpal-Specs]] |

## Delivery Brief
- **Who:** a signed-in BudgetPal user who groups money by purpose.
- **Gets:** a Categories page where they list, create, rename and delete their own expense and income categories.
- **Value:** transactions (SPEC-005) and budgets (SPEC-007) need categories to exist; this is the first reference data.
- **Measured by:** the API tests and the page tests listed in the ACs pass, including the two-user isolation test.
- **Out of scope:** assigning categories to transactions, budgets, reassign-on-delete, category colours or icons, hierarchy, seeded default categories.

## Acceptance Criteria
- [ ] AC-1 - A signed-in user creates a category with a name (1-60 chars, trimmed) and a kind (`expense` or `income`); it is returned with its id and listed (Story-001).
- [ ] AC-2 - Names are unique per user, ignoring case; a duplicate returns 409 problem+json and writes nothing; two users may use the same name (Enabler-001, Story-001).
- [ ] AC-3 - An invalid body (empty or long name, unknown kind, extra field) returns 400 problem+json with field errors on create and on update (Story-001, Story-002).
- [ ] AC-4 - A user renames a category or changes its kind; the change is visible in the list (Story-002).
- [ ] AC-5 - Deleting a category that is referenced by another row (foreign key `ON DELETE RESTRICT`) returns 409 problem+json and keeps the category; deleting an unused one returns 204 (Enabler-001, Story-002).
- [ ] AC-6 - User B reading, updating or deleting user A's category id gets 404 and A's data is unchanged; unauthenticated calls get 401 (Story-001, Story-002).
- [ ] AC-7 - The Categories page lists categories with their kind, shows an empty state, and creates a category with inline field errors (Story-003).
- [ ] AC-8 - The page edits and deletes a category; a refused delete shows the reason in text next to the row; the page has no axe violations and is keyboard operable (Story-004).
- [ ] AC-9 - The API routes carry zod schemas (body, params, query) that appear in the OpenAPI document at `/docs`; the page appears in the nav through `feature.ts` with no shared file edited (Story-001, Story-003).

## Backlog
| Key | Type | Title | Status | Depends on | Wave | Files | File |
|--|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | Categories table, schemas and repository | Ready | None | 1 | 4 | [[Backlog/Enabler-001-categories-data-layer]] |
| Story-001 | Story | Create and list categories (API) | Ready | Enabler-001 | 2 | 4 | [[Backlog/Story-001-create-list-categories-api]] |
| Story-002 | Story | Rename and delete categories (API) | Ready | Story-001 | 3 | 3 | [[Backlog/Story-002-update-delete-categories-api]] |
| Story-003 | Story | Categories page: list and create | Ready | Story-001 | 3 | 5 | [[Backlog/Story-003-categories-page-list-create]] |
| Story-004 | Story | Categories page: edit and delete | Ready | Story-002, Story-003 | 4 | 5 | [[Backlog/Story-004-categories-page-edit-delete]] |

## Architecture references
- Decisions: D-01 (module layout), D-05 (SQLite, migration 0030), D-08 (`requireUser`, `user_id` scoping), D-10 (zod `.strict()`), D-11 (problem+json), D-19/D-20 (React feature, accessibility), D-23 (tests)
- Containers: API, Web, SQLite database
- Architecture Document: [[../../../architecture/architecture]]

## Risks
- The `transactions` and `budgets` tables do not exist yet, so the in-use rule is a foreign-key `RESTRICT` mapped to 409 - SPEC-005 and SPEC-007 must declare `category_id ... REFERENCES categories(id) ON DELETE RESTRICT`; the tests here use a temporary table with that constraint.
- Kernel helper names (`requireUser`, validation helper, API client) come from SPEC-001/002 - the planner reads them from the merged code and adjusts imports; no logic changes.
- Case-insensitive uniqueness uses `COLLATE NOCASE` on ASCII only - accepted for a local tool.
