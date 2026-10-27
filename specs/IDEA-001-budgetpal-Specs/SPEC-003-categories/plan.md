---
status: ready
version: 1.0.0
spec: SPEC-003
---

# SPEC-003 Implementation Plan

## Dependency Check
- SPEC-002 (auth) is the only dependency; it has no `plan.md` and no code is merged in this lane yet. Planned against its declared contracts: `api/src/kernel/require-user.ts` (`requireUser`, `request.user`), `validate.ts` (`validate({body, params, query})`), `problem.ts` (problem+json builder and error handler), and SPEC-001's `db.ts`, `migrate.ts`, `web/src/kernel/registry.ts`. No STOP: planning needs no approved review; IMPLEMENT waits until SPEC-002 is APPROVED and merged.
- Downstream: SPEC-005 and SPEC-007 must declare `category_id ... REFERENCES categories(id) ON DELETE RESTRICT` (spec Risks).

## Architecture Gate Check
- Stack: Node 22 + Fastify 5 + zod 3 + better-sqlite3 12 (API), React 18 + Vite 5 + TanStack Query 5 + CSS modules (web), vitest 2 + Testing Library 16 + axe-core 4. Matches D-02, D-03, D-05, D-10, D-19, D-20, D-23; no new package is introduced, so no manifest or lockfile changes.
- Containers (C2): API (`api/src/modules/categories/`: routes -> service -> repository, D-01), Web (`web/src/features/categories/`), SQLite database (migration `0030`, range reserved for E3, GR-014).
- Decisions applied: D-05 (migration 0030, FK `RESTRICT`), D-08 (`requireUser`, `userId` on every repository function, cross-user 404), D-10 (zod `.strict()`), D-11 (problem+json), D-04 (routes in OpenAPI at `/docs`), D-20 (accessibility), D-23 (tests, two-user test). All used Decisions are `Accepted` / `Accepted (assumed)`. D-22 is `Proposed` but affects only compose; no item here touches it.
- QG-SMOKE and QG-AUTH / QG-IMPORT do not apply (no compose, Dockerfile, config, auth or CSV change).
- Gates: QG-ARCH-CONFORMANCE, QG-TRACE, QG-SCOPE, QG-QUALITY, QG-STATIC, QG-API-CONFORMANCE, QG-ISOLATION, QG-VALIDATION, QG-A11Y, QG-PROD, QG-BUGS

## Backlog Coverage
| Item | Type | Dialect | Complexity | Wave | Plan coverage | Notes |
|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | backend-nodejs, testing-unit | high | 1 | Covered | SQL construction and `user_id` scoping (security-sensitive) |
| Story-001 | Story | backend-nodejs, testing-integration | high | 2 | Covered | authorization, input validation |
| Story-002 | Story | backend-nodejs, testing-integration | high | 3 | Covered | authorization, cross-user 404, delete rules |
| Story-003 | Story | frontend-react, testing-unit | medium | 3 | Covered | list, create, inline errors, axe |
| Story-004 | Story | frontend-react, testing-unit | medium | 4 | Covered | edit/delete states, focus management |

## Ordered Changes
1. **Enabler-001** - `api/migrations/0030-categories.sql`: `categories (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('expense','income')), created_at TEXT NOT NULL)` and `UNIQUE INDEX (user_id, name COLLATE NOCASE)`. Keep the words real/float/numeric/decimal out of the file, comments included (SR-008). Why: AC-1, AC-2. Depends on: SPEC-001 migration runner.
2. **Enabler-001** - `api/src/modules/categories/categories.schema.ts`: `.strict()` zod `createCategory`, `updateCategory` (at least one field), `categoryParams` (integer id), `category`; name trimmed, 1-60. Why: AC-5.
3. **Enabler-001** - `api/src/modules/categories/categories.repository.ts`: `list/findById/create/update/remove(userId, ...)`, parameterised SQL only; unique-constraint error -> `DuplicateNameError`, FK-constraint error -> `CategoryInUseError`; `update`/`remove` return nothing/false for another user's id. Why: AC-2, AC-3, AC-4. Depends on: 1.
4. **Enabler-001** - `categories.repository.test.ts` plus `categories.schema.test.ts` (new): in-memory DB with the real migrations; the RESTRICT test creates a temporary referencing table. Depends on: 1-3.
5. **Story-001** - `categories.service.ts` (`create`, `list`; maps `DuplicateNameError` to a 409 problem). Why: AC-1, AC-2. Depends on: 3.
6. **Story-001** - `categories.routes.ts` (`POST`, `GET` with `requireUser` and zod schemas) and `index.ts` (exports router for auto-registration under `/api/categories`). Why: AC-1..AC-5. Depends on: 5.
7. **Story-001** - `categories.routes.test.ts` and `categories.service.test.ts` (new). Depends on: 5, 6.
8. **Story-002** - `categories.service.ts` (`update`, `remove`: duplicate -> 409, in use -> 409 with "in use" detail, not found/other user -> 404); `categories.routes.ts` (`PATCH`, `DELETE /:id`, params and body schemas). Why: AC-1..AC-6. Depends on: 5, 6.
9. **Story-002** - extend `categories.routes.test.ts` and `categories.service.test.ts` (two-user test, temporary referencing table for the in-use case). Depends on: 8.
10. **Story-003** - `web/src/features/categories/categories.api.ts` (list/create query hooks through the kernel API client), `CategoriesPage.tsx`, `CategoriesPage.module.css`, `feature.ts` (route and nav entry). Why: AC-1..AC-5. Depends on: 6.
11. **Story-003** - `CategoriesPage.test.tsx` (mocked API, axe). Depends on: 10.
12. **Story-004** - `categories.api.ts` (update/delete mutations that refresh the list), `CategoryRow.tsx` (view/edit/delete-confirm states, focus handling), `CategoriesPage.tsx` renders `CategoryRow`, `CategoriesPage.module.css` row and message styles, `CategoryRow.test.tsx`. Why: AC-1..AC-5. Depends on: 8, 10.

## Waves
| Wave | Items | Files | File-disjoint | Notes |
|--|--|--|--|--|
| 1 | Enabler-001 | migration, schema, repository, 2 test files (api) | yes (single item) | data layer |
| 2 | Story-001 | service, routes, index, 2 test files (api) | yes (single item) | needs Enabler-001 |
| 3 | Story-002, Story-003 | api module files; web feature files | yes: api tree vs web tree | the api item extends files of the previous wave; the web item needs only the API contract |
| 4 | Story-004 | `CategoryRow*`, `categories.api.ts`, `CategoriesPage.*` (web) | yes (single item) | extends web files of wave 3, so it follows it |

## Dialects Loaded
- `backend-nodejs` - Enabler-001, Story-001, Story-002
- `frontend-react` - Story-003, Story-004
- `testing-unit` - mandatory
- `testing-integration` - mandatory
- `testing-performance`, `testing-security` - not loaded (no item scopes them; isolation is covered by the two-user tests)

## New Files
All paths follow the architecture's workspace layout (D-01), as the backlog's Impacted Files do.
- `api/migrations/0030-categories.sql`
- `api/src/modules/categories/`: `categories.schema.ts`, `categories.repository.ts`, `categories.service.ts`, `categories.routes.ts`, `index.ts`, and tests `categories.schema.test.ts`, `categories.repository.test.ts`, `categories.service.test.ts`, `categories.routes.test.ts`
- `web/src/features/categories/`: `feature.ts`, `categories.api.ts`, `CategoriesPage.tsx`, `CategoriesPage.module.css`, `CategoriesPage.test.tsx`, `CategoryRow.tsx`, `CategoryRow.test.tsx`

## Toolchain
| Tool | Version |
|--|--|
| node | >=22 <25 |
| pnpm | >=9 |
| typescript | ^5 |
| fastify | ^5 |
| fastify-type-provider-zod | ^4 |
| zod | ^3 |
| @asteasolutions/zod-to-openapi | ^7 |
| @fastify/swagger | ^9 |
| @fastify/swagger-ui | ^6 |
| better-sqlite3 | ^12 |
| react | ^18 |
| react-dom | ^18 |
| vite | ^5 |
| react-router | ^6 |
| @tanstack/react-query | ^5 |
| vitest | ^2 |
| @testing-library/react | ^16 |
| axe-core | ^4 |

## Wave file allowances
| Item | Paths (backticked, `/**` allowed) |
|--|--|
| Enabler-001 | `api/src/modules/categories/categories.schema.test.ts` |
| Story-001 | `api/src/modules/categories/categories.service.test.ts` |
| Story-002 | `api/src/modules/categories/categories.service.test.ts` |

## Risk Flags
- **Path layout:** the planner template says `src/IDEA-001-budgetpal/...`, but D-01 fixes a pnpm workspace with `api/` and `web/`, and every backlog item lists those paths. The plan follows the architecture and the backlog; no `src/IDEA-...` tree is created.
- **Dependency not merged:** SPEC-002 and SPEC-001 kernel names (`requireUser`, `validate`, `problem`, the web API client and its error type) are read from their specs, not code. The implementer checks the merged code and adjusts imports only; if a helper is missing, stop and report.
- **Cross-module import ban (SR-006/SR-007):** import shared code only from `api/src/kernel/` and `web/src/kernel/`; a relative `../x` import fails QG-STATIC.
- **SQL rules (SR-002/SR-003/SR-008):** `.prepare`/`.exec` appear only in `categories.repository.ts` and in `.test.ts` files; the service must not touch the database; the migration has no REAL/FLOAT/NUMERIC/DECIMAL, even in comments.
- **In-use rule:** relies on `REFERENCES categories(id) ON DELETE RESTRICT` declared later by SPEC-005 and SPEC-007; here it is proven with a temporary table. The FK-violation code to catch is `SQLITE_CONSTRAINT_FOREIGNKEY`; the unique one is `SQLITE_CONSTRAINT_UNIQUE`. Foreign keys must be on (`openDb` pragma from SPEC-001).
- **Web tests:** Testing Library with `fireEvent` or `user-event` only if SPEC-001 already depends on it (no new package allowed); axe runs via `axe-core` directly.
- **Case-insensitive uniqueness** is ASCII-only (`COLLATE NOCASE`), accepted in the spec.
- Test counts: Story-001 and Story-002 sit at the SZ-4 cap of 8; AC-3 and AC-5 of Story-001 have an integration test only because schema-level unit coverage is T-006.

## Atomic test cases

| Test ID | Item | AC | Level | Description |
|--|--|--|--|--|
| T-001 | Enabler-001 | AC-1 | unit | file is `0030-categories.sql`, contains no REAL/FLOAT columns; in-memory DB shows `categories` columns, `CHECK` on kind and the unique `(user_id, name COLLATE NOCASE)` index |
| T-002 | Enabler-001 | AC-1 | integration | the migration runner applies 0030 on an empty database and a second run is a no-op; deleting a user cascades its categories |
| T-003 | Enabler-001 | AC-2 | unit | user A "Food" then "food" throws `DuplicateNameError`; user B "Food" succeeds |
| T-004 | Enabler-001 | AC-3 | unit | `list(userId)` returns only that user's rows ordered by name; `findById/update/remove` with another user's id return nothing/false |
| T-005 | Enabler-001 | AC-4 | unit | with a temporary table `REFERENCES categories(id) ON DELETE RESTRICT`, `remove` throws `CategoryInUseError` and the row stays |
| T-006 | Enabler-001 | AC-5 | unit | schemas trim the name, reject empty, 61-char, unknown kind and extra fields, accept 60 chars |
| T-007 | Story-001 | AC-1 | integration | `POST /api/categories` returns 201 with id, name, kind; `GET` lists it |
| T-008 | Story-001 | AC-1 | unit | service `create`/`list` pass the caller's `userId` to the repository |
| T-009 | Story-001 | AC-2 | integration | "food" after "Food" returns 409 problem+json and the list is unchanged; another user's "Food" returns 201 |
| T-010 | Story-001 | AC-2 | unit | service maps `DuplicateNameError` to a 409 problem |
| T-011 | Story-001 | AC-3 | integration | empty name, 61 chars, kind `other`, extra field each return 400 problem+json with field errors and write nothing |
| T-012 | Story-001 | AC-4 | integration | `POST` and `GET` without a session return 401 |
| T-013 | Story-001 | AC-4 | integration | two users: `GET` returns only the caller's categories |
| T-014 | Story-001 | AC-5 | integration | the router is auto-registered under `/api/categories`; `/docs/json` contains both paths with body/response schemas |
| T-015 | Story-002 | AC-1 | integration | `PATCH` name and kind returns 200 with updated values; the list shows them |
| T-016 | Story-002 | AC-1 | integration | `/docs/json` contains `PATCH` and `DELETE` on `/api/categories/{id}` with params and body schemas (QG-API-CONFORMANCE) |
| T-017 | Story-002 | AC-2 | integration | renaming to another category's name in different case returns 409 and changes nothing; renaming to its own name returns 200 |
| T-018 | Story-002 | AC-2 | unit | service maps duplicate, in-use and not-found outcomes to 409, 409 ("in use" detail) and 404 |
| T-019 | Story-002 | AC-3 | integration | empty name, bad kind, extra field, empty object and id `abc` each return 400 problem+json with field errors |
| T-020 | Story-002 | AC-4 | integration | `DELETE` of an unused category returns 204 and it no longer lists |
| T-021 | Story-002 | AC-5 | integration | `DELETE` of a category referenced by a `RESTRICT` row returns 409 whose detail says in use; the category remains |
| T-022 | Story-002 | AC-6 | integration | user B `PATCH`/`DELETE` on A's id returns 404 and A's category is unchanged; no session returns 401 |
| T-023 | Story-003 | AC-1 | unit | `feature.ts` exports the route and a "Categories" nav entry; the kernel registry picks it up; no shared file is in the diff |
| T-024 | Story-003 | AC-2 | unit | empty list shows the empty state with instructions for adding the first category |
| T-025 | Story-003 | AC-2 | unit | filled list shows name and kind as text, expense and income labelled |
| T-026 | Story-003 | AC-3 | unit | submitting name and kind adds the row and resets the form |
| T-027 | Story-003 | AC-4 | unit | empty name and a 409 duplicate show inline field errors in an announced region (`role=alert`/`aria-describedby`); the list is unchanged |
| T-028 | Story-003 | AC-5 | unit | axe reports no violations; inputs found by label; tab order reaches form controls |
| T-029 | Story-004 | AC-1 | unit | Edit, change name or kind, Save shows the new values |
| T-030 | Story-004 | AC-1 | unit | Cancel restores the row and sends no request |
| T-031 | Story-004 | AC-2 | unit | empty or duplicate (409) name shows an inline error on the row and the row stays in edit mode |
| T-032 | Story-004 | AC-3 | unit | Delete, confirm removes an unused category's row |
| T-033 | Story-004 | AC-4 | unit | a 409 on delete keeps the row and shows text beside it saying the category is in use |
| T-034 | Story-004 | AC-5 | unit | buttons have accessible names containing the category name; focus moves to the edit field on Edit and back to the row after Save, Cancel and a refused delete |
| T-035 | Story-004 | AC-5 | unit | axe reports no violations in view, edit and error states |

Totals: 35 (unit 21, integration 14).

## Standards coverage

| Standard | Verifier check | Covered by |
|--|--|--|
| api-standards: OpenAPI 3.1 generated from zod, served at `/docs` | routes appear in the document with schemas | T-014, T-016 |
| api-standards: errors as RFC 9457 problem+json | 400/401/404/409 bodies are problem+json | T-009, T-011, T-019, T-021 |
| api-standards: pagination (D-12 deviation) | n/a: a user's categories are returned as one list, no paging in the spec | verifier:list endpoint is unpaged by spec decision |
| standards-catalog: Security - authorization and data isolation | two-user test, cross-user 404 | T-004, T-013, T-022 |
| standards-catalog: Security - input validation | `.strict()` zod, parameterised SQL | T-006, T-011, T-019, check:QG-STATIC |
| standards-catalog: Data - migrations | forward-only numbered file in range | T-001, T-002 |
| standards-catalog: Data - money | no money columns in this spec | T-001 |
| standards-catalog: Accessibility - WCAG 2.2 AA | axe, labels, keyboard, focus | T-028, T-034, T-035 |
| standards-catalog: Testing | vitest, `inject`, Testing Library | check:QG-TEST |

## Gates coverage

| Gate | Covered by |
|--|--|
| QG-ARCH-CONFORMANCE | verifier:compare-decisions-and-toolchain-with-manifests-and-imports |
| QG-TRACE | check:QG-TEST, verifier:check-traceability-spec |
| QG-SCOPE | verifier:quality-gate-scopes-from-this-table |
| QG-QUALITY | check:QG-LOCK, check:QG-BUILD, check:QG-LINT, check:QG-TEST, check:QG-COV, check:QG-SECRETS, check:QG-DEPS, check:QG-SAST |
| QG-STATIC | check:QG-STATIC |
| QG-API-CONFORMANCE | T-014, T-016, T-007, T-015 |
| QG-ISOLATION | T-004, T-013, T-022 |
| QG-VALIDATION | T-006, T-011, T-019 |
| QG-A11Y | T-028, T-034, T-035 |
| QG-BUGS | verifier:check-run-conformance-scope-bugs-exits-0 |
| QG-PROD-1 | check:QG-TEST, verifier:health-test-from-SPEC-001-stays-green |
| QG-PROD-2 | verifier:no-new-log-call-with-personal-data, static-rules:SR-010 |
| QG-PROD-3 | check:QG-SECRETS, static-rules:SR-016 |
| QG-PROD-4 | check:QG-TEST, verifier:shutdown-test-from-SPEC-001-stays-green |
| QG-PROD-5 | T-001, verifier:migration-forward-only-and-README-rollback-text-unchanged |
| QG-PROD-6 | verifier:README-redeploy-text-unchanged |
| GR-001 | static-rules:SR-001 |
| GR-002 | T-004, T-013, T-022, static-rules:SR-002 |
| GR-003 | static-rules:SR-002 SR-003 |
| GR-004 | T-011, T-019, T-014, verifier:every-categories-route-declares-schemas |
| GR-005 | static-rules:SR-004 SR-005 |
| GR-006 | static-rules:SR-006 SR-007 |
| GR-007 | T-001, static-rules:SR-008 SR-009 |
| GR-008 | static-rules:SR-010 |
| GR-009 | n/a: no CSV or upload in this spec |
| GR-010 | n/a: no password or token code in this spec |
| GR-011 | n/a: no header change in this spec |
| GR-012 | verifier:compare-decisions-table-with-manifests-and-imports |
| GR-013 | static-rules:SR-014 SR-015 |
| GR-014 | T-001, T-002, verifier:migration-file-name-in-0030-0039 |
| GR-015 | static-rules:SR-016 |
| GR-016 | static-rules:SR-017, T-011 |
| GR-017 | n/a: no Dockerfile change |
| GR-018 | verifier:no-csrf-ratelimit-lockout-or-audit-dependency-added |

## Routing

Written by `kcc route` from each item's Complexity, its files, its domain and CR-7 risk. `kcc-run` and the orchestrator read it;
do not edit it by hand (rerun `kcc route`).

| Item | Wave | Tier | Model | Effort | Why |
|--|--|--|--|--|--|
| Enabler-001 | 1 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; complexity high: effort high |
| Story-001 | 2 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (authorization): effort high |
| Story-002 | 3 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (authorization): effort high |
| Story-003 | 3 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (token): effort high |
| Story-004 | 4 | balanced | claude-sonnet-5-5 | medium | agent default: balanced / medium |

## Verification Steps
1. `pnpm install --frozen-lockfile` (no manifest change expected; `git diff` shows no `package.json` or lockfile edit).
2. `pnpm -F api test -- categories` and `pnpm -F web test -- categories`: T-001..T-035 pass; the Test ID appears in each test name.
3. `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r build`; then `quality-gate -Spec SPEC-003` green (coverage >= `quality.coverage_min_pct` 80, QG-STATIC, secrets, audit).
4. AC-9 / Story-003 AC-1: `git diff --name-only` for the web side lists only `web/src/features/categories/*`; no shared router or nav file; `api/` side lists only `api/migrations/0030-categories.sql` and `api/src/modules/categories/*`.
5. Manual smoke if the dev server runs: sign up, open Categories, create, rename, delete; open `/docs` and see the four routes.
6. Verifier: per-AC PASS/FAIL for the spec ACs (AC-1..AC-9) against the tests above.

## Scope
Large (17 new files: 10 api, 7 web; no shared file edited).

## Confidence
Confidence: 95%
The categories logic is fully determined. The remaining uncertainty is kernel helper names from SPEC-001/002, which are not merged yet; it is bounded by the Risk Flags rule (adjust imports only, otherwise stop and report).

## Related
- Epic spec: [[SPEC-003-categories]]
- Architecture: [[../../../architecture/architecture]]
- Roadmap / token plan: [[../ROADMAP]]
- Idea-specs index: [[../IDEA-001-budgetpal-Specs]]
