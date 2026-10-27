---
id: SPEC-004-plan
spec: SPEC-004
status: ready
version: 1.0.0
profile: fasttrack
---

# SPEC-004 Implementation Plan

## Dependency Check
- SPEC-002 (auth) is the only dependency. It has no `plan.md` yet; planned against its backlog contracts: `api/src/kernel/validate.ts` (`validate`), `api/src/kernel/problem.ts` (problem+json handler), `api/src/kernel/require-user.ts` (`requireUser`, `request.user`), `api/test/helpers/auth.ts` (`createLoggedInUser`). SPEC-001 supplies `api/src/kernel/db.ts`, `migrate.ts`, the module auto-registry (`api/src/modules/*/index.ts`), OpenAPI and `web/src/kernel/registry.ts` (`feature.ts`).
- IMPLEMENT waits until SPEC-002 is APPROVED. If an imported name differs, the implementer adjusts the import, not the design. A missing nav registry makes Story-003 stop and report.
- No item is blocked. D-22 is `Proposed` but concerns compose only; no item here touches it.

## Architecture Gate Check
- C4 containers: **API**, **SQLite database**, **Web** (`architecture.md` Containers). No standalone C4 component file under fasttrack. Decisions: D-01, D-03, D-04, D-05, D-08, D-10, D-11, D-13, D-19, D-20, D-23 (all `Accepted` or `Accepted (assumed)`, settled). The order data layer, API, page follows D-01 (`routes -> service -> repository`, module-owned folders). Migration 0040 sits in the E4 range (GR-014).
- Stack conformance: TypeScript 5, Fastify 5 + zod + fastify-type-provider-zod, better-sqlite3 12, React 18 + Vite 5, TanStack Query 5, vitest 2, Testing Library, axe-core. Nothing deviates from `architecture.md`.
- Gates: QG-ARCH-CONFORMANCE, QG-TRACE, QG-SCOPE, QG-QUALITY, QG-STATIC, QG-API-CONFORMANCE, QG-ISOLATION, QG-VALIDATION, QG-A11Y, QG-PROD, QG-BUGS
- Budgets: list endpoint is a single indexed query by `user_id` (well inside 200 ms p95); no CSV or aggregates here.

## Backlog Coverage
| Item | Type | Dialect | Complexity | Wave | Plan coverage | Notes |
|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | backend-nodejs, testing-unit | high | 1 | Covered | SQL and user scoping (GR-002/003) |
| Story-001 | Story | backend-nodejs, testing-integration | high | 2 | Covered | authz, untrusted input |
| Story-002 | Story | backend-nodejs, testing-integration | high | 3 | Covered | authz, FK-error mapping |
| Story-003 | Story | frontend-react, testing-unit | medium | 3 | Covered | money string math |
| Story-004 | Story | frontend-react, testing-unit | medium | 4 | Covered | dialog, keyboard, axe |

## Ordered Changes
All paths use the repo layout fixed by `architecture.md` and `static-rules.tsv` (`api/`, `web/`), see Risk Flags.
1. **Enabler-001** - `api/migrations/0040-create-accounts.sql`: `accounts` (`id`, `user_id` FK users, `name`, `type` CHECK five types, `opening_balance_minor INTEGER NOT NULL DEFAULT 0`, `created_at`, `updated_at`), unique index `(user_id, name COLLATE NOCASE)`. Why: AC-1.
2. **Enabler-001** - `api/src/modules/accounts/accounts.schemas.ts`: zod create/update (`.strict()`, trimmed name 1-60, type enum, integer balance `abs <= 10^12`, default 0), id param, response schema; exported `AccountType`. Why: AC-5, epic AC-6/AC-8. Depends on: none.
3. **Enabler-001** - `api/src/modules/accounts/accounts.repository.ts`: `list/findById/create/update/remove(userId, ...)`, parameterised, `WHERE user_id = ?`; `DuplicateName` on UNIQUE, `InUse` on `SQLITE_CONSTRAINT_FOREIGNKEY`. Why: AC-2..AC-4. Depends on: 1, 2.
4. **Story-001** - `accounts.service.ts`: `createAccount`, `listAccounts`; maps `DuplicateName` to a 409 problem. Depends on: 3.
5. **Story-001** - `accounts.routes.ts`: `POST/GET /api/accounts` behind `requireUser`, zod schemas for body/params/response (OpenAPI), 201/400/401/409; `index.ts` exports the router. Why: epic AC-1, AC-5..AC-7, AC-10.
6. **Story-002** - `accounts.service.ts` adds `getAccount`, `updateAccount`, `deleteAccount` (`InUse` -> 409 naming the rule; unknown or foreign id -> 404). Depends on: 4.
7. **Story-002** - `accounts.routes.ts` adds `GET/PUT/DELETE /api/accounts/:id`. Why: epic AC-2..AC-4, AC-7.
8. **Story-003** - `accounts.api.ts` (list and create hooks), `AccountForm.tsx` (add form; `toMinorUnits` by string math, no float, via `money.ts`), `AccountsPage.tsx` (list, empty state, `Intl.NumberFormat` with the install currency), `accounts.module.css`, `feature.ts` (route `/accounts`, label "Accounts"). Why: epic AC-1, AC-8, AC-9.
9. **Story-004** - `accounts.api.ts` adds update/delete hooks; `AccountForm.tsx` edit mode (prefilled via `fromMinorUnits`); `AccountsPage.tsx` row actions, accessible confirm dialog (native `<dialog>` or `@radix-ui` only if needed, D-19), in-use message on 409. Why: epic AC-2..AC-4, AC-9.

## Waves
| Wave | Items | Files | File-disjoint | Notes |
|--|--|--|--|--|
| 1 | Enabler-001 | 4 | yes (single item) | migration, schemas, repository, repo test |
| 2 | Story-001 | 4 | yes (single item) | needs the repository |
| 3 | Story-002, Story-003 | 3 + 5 | yes: `api/src/modules/accounts/*` vs `web/src/features/accounts/*` | API edit/delete runs beside the web list/add page |
| 4 | Story-004 | 3 | yes (single item) | re-edits the web files of the previous wave so it follows them |

## Dialects Loaded
- `backend-nodejs` - Fastify module, repository, migration (Enabler-001, Story-001, Story-002)
- `frontend-react` - page, form, hooks, CSS tokens, a11y (Story-003, Story-004)
- `testing-unit` - mandatory (repository, schemas, money helpers, Testing Library)
- `testing-integration` - mandatory (Fastify `inject`, `/docs/json`)
- `testing-performance`, `testing-security` - not scoped by any item; isolation and validation are covered as integration tests (QG-ISOLATION, QG-VALIDATION)

## New Files
- `api/migrations/0040-create-accounts.sql`
- `api/src/modules/accounts/{accounts.schemas,accounts.repository,accounts.service,accounts.routes,index}.ts`
- `api/src/modules/accounts/{accounts.repository.test,accounts.routes.test,accounts.isolation.test}.ts`
- `web/src/features/accounts/{feature.ts,AccountsPage.tsx,AccountForm.tsx,accounts.api.ts,accounts.module.css,money.ts}`
- `web/src/features/accounts/{money.test.ts,AccountsPage.test.tsx,AccountForm.test.tsx}`
- No new dependency and no manifest or lockfile edit: every package used is already declared by SPEC-001/SPEC-002 (D-03, D-05, D-19, D-23).

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
| better-sqlite3 | ^12 |
| react | ^18 |
| vite | ^5 |
| @tanstack/react-query | ^5 |
| vitest | ^2 |
| @testing-library/react | ^16 |
| axe-core | ^4 |

## Wave file allowances
| Item | Paths (backticked, `/**` allowed) |
|--|--|
| Story-003 | `web/src/features/accounts/money.ts`, `web/src/features/accounts/money.test.ts`, `web/src/features/accounts/AccountsPage.test.tsx`, `web/src/features/accounts/AccountForm.test.tsx` |
| Story-004 | `web/src/features/accounts/AccountsPage.test.tsx`, `web/src/features/accounts/AccountForm.test.tsx`, `web/src/features/accounts/money.ts`, `web/src/features/accounts/money.test.ts` |

## Risk Flags
- **Path prefix.** The template prefix `src/IDEA-001-budgetpal/` is not used: `architecture.md` (D-01), `static-rules.tsv` (regexes anchored at `^api/src/` and `^web/src/`) and every backlog item fix `api/` and `web/` at the repo root. Following the prefix would make QG-STATIC match nothing. Architecture wins; the implementer must not move files.
- Delete rule rests on SPEC-005 declaring `transactions.account_id ... ON DELETE RESTRICT`. Here it is proven with a test-only table `t_ref` created in the tests (never in a migration). SPEC-005 must keep the clause.
- `PRAGMA foreign_keys = ON` must hold in the test database or `InUse` never fires (T-004 asserts it).
- Story-001 and Story-002 both edit `accounts.service.ts` and `accounts.routes.ts`; they are in different waves. Story-003 and Story-004 likewise share the web files.
- Imported SPEC-002 helper names are assumed (see Dependency Check).
- Account type list is an assumption; changing it later needs a new migration in the 0040-0049 range.
- Standards followed over plan convenience: `api-standards.md` wants the contract checked, so `/docs/json` is asserted in T-010 and the OpenAPI document is generated from the zod schemas (D-04), not hand-written.

## Atomic test cases

| Test ID | Item | AC | Level | Description |
|--|--|--|--|--|
| T-001 | Enabler-001 | AC-1 | unit | Migrate a temp DB; `table_info` has the columns, CHECK rejects an unknown type, the unique NOCASE index exists, no REAL/FLOAT/DECIMAL column |
| T-002 | Enabler-001 | AC-2 | unit | Two users: each repository function takes `userId` first; user B's `list/findById/update/remove` never see or change A's row |
| T-003 | Enabler-001 | AC-3 | unit | `Savings` then ` savings ` (create and update) throws `DuplicateName`; user B may use the name |
| T-004 | Enabler-001 | AC-4 | unit | Test-only `t_ref` with `ON DELETE RESTRICT`: `remove` throws `InUse` and the row stays |
| T-005 | Enabler-001 | AC-5 | unit | Schema accepts valid input and default 0, rejects empty, 61 chars, `1.5`, `10^12+1`, unknown key; trims the name |
| T-006 | Story-001 | AC-1 | integration | `POST` valid body returns 201; `GET` lists it, ordered by name |
| T-007 | Story-001 | AC-2 | integration | `POST` same name in other case returns 409 problem+json; row count unchanged |
| T-008 | Story-001 | AC-3 | integration | Empty name, unknown type, `12.5`, extra field each return 400 with field errors; table unchanged |
| T-009 | Story-001 | AC-4 | integration | No session returns 401 on both routes; user B's `GET` contains none of A's accounts |
| T-010 | Story-001 | AC-5 | integration | Router auto-registered; `/docs/json` has both paths with request schema and 201/400/401/409 responses |
| T-011 | Story-001 | AC-2 | unit | Service maps `DuplicateName` to a 409 problem |
| T-012 | Story-002 | AC-1 | integration | `GET /:id` returns 200 for own account; malformed id 400, unknown id 404 |
| T-013 | Story-002 | AC-2 | integration | `PUT` valid returns 200 with new values; name used by another own account 409; invalid input 400 and row unchanged |
| T-014 | Story-002 | AC-3 | integration | `DELETE` unreferenced account returns 204 and it is gone |
| T-015 | Story-002 | AC-4 | integration | With a `t_ref` row (RESTRICT), `DELETE` returns 409 problem+json naming the rule; account stays |
| T-016 | Story-002 | AC-5 | integration | QG-ISOLATION: user B gets 404 on A's get, update and delete; A's row unchanged; B's list is empty |
| T-017 | Story-002 | AC-6 | integration | No session returns 401 on `GET/PUT/DELETE /:id` |
| T-018 | Story-003 | AC-1 | unit | `feature.ts` exports `{id, path, label: "Accounts", order, component}`; the registry lists it; no shared file edited |
| T-019 | Story-003 | AC-2 | unit | Mocked empty list shows the empty state explaining how to add an account |
| T-020 | Story-003 | AC-3 | unit | Rows show name, type and `Intl`-formatted balance in the install currency |
| T-021 | Story-003 | AC-4 | unit | `toMinorUnits('1234.50')===123450`, `'-20'`, `'0.1'`, rejects `'1.234'`; submit POSTs integer minor units, row appears, form resets |
| T-022 | Story-003 | AC-5 | unit | Mocked 409 and 400 field errors show inline next to the labelled input; focus moves to the first error |
| T-023 | Story-003 | AC-6 | unit | `axe-core` on empty and populated page: no serious or critical violation; inputs labelled |
| T-024 | Story-004 | AC-1 | unit | Edit prefills the decimal balance; save sends a PUT with minor units and the row updates |
| T-025 | Story-004 | AC-2 | unit | Mocked 400/409 on save shows inline errors; the row is unchanged |
| T-026 | Story-004 | AC-3 | unit | Delete opens an accessible dialog; confirm with mocked 204 removes the row |
| T-027 | Story-004 | AC-4 | unit | Mocked 409 on DELETE: dialog closes, row stays, message says the account is in use |
| T-028 | Story-004 | AC-5 | unit | Keyboard-only tab order reaches Edit/Delete; accessible names include the account name; axe clean |
| T-029 | Enabler-001 | AC-1 | unit | Static check: the migration file name is `0040-create-accounts.sql` and no accounts SQL appears outside `*.repository.ts` and the migration (GR-003, GR-014) |

## Standards coverage

| Standard | Verifier check | Covered by |
|--|--|--|
| api-standards (OpenAPI 3.1, problem+json, validation) | routes in `/docs/json`, responses match, 4xx are problem+json | T-010, T-007, T-008, T-015, check:QG-TEST |
| standards-catalog: Security - authorization and data isolation | two-user test, 404 on cross-user | T-002, T-009, T-016 |
| standards-catalog: Security - input validation | strict zod, parameterised SQL | T-005, T-008, T-013 |
| standards-catalog: Data - money (ISO 4217, integer minor units) | integer storage, `Intl` display | T-001, T-005, T-020, T-021 |
| standards-catalog: Data - migrations | forward-only, numbered, in range | T-001, T-029 |
| standards-catalog: Accessibility - WCAG 2.2 AA | axe, labels, keyboard | T-023, T-028 |
| standards-catalog: Testing | vitest, `inject`, Testing Library | T-001..T-028 |

## Gates coverage

| Gate | Covered by |
|--|--|
| QG-ARCH-CONFORMANCE | verifier:compare the Decisions table with manifests and imports |
| QG-TRACE | check:QG-TEST, verifier:check-traceability maps every AC to a Test ID |
| QG-SCOPE | verifier:quality-gate scopes from this table |
| QG-QUALITY | check:QG-BUILD, check:QG-LINT, check:QG-TEST, check:QG-COV, check:QG-LOCK, check:QG-SECRETS, check:QG-DEPS, check:QG-SAST |
| QG-STATIC | check:QG-STATIC, T-029 |
| QG-API-CONFORMANCE | T-010, T-006..T-009 |
| QG-ISOLATION | T-002, T-009, T-016 |
| QG-VALIDATION | T-005, T-008, T-013 |
| QG-A11Y | T-023, T-028 |
| QG-PROD-1 | verifier:health still returns 200 with the accounts router registered |
| QG-PROD-2 | verifier:no log call in the accounts module carries amounts or names |
| QG-PROD-3 | verifier:no config or env change and no hard-coded currency in the page |
| QG-PROD-4 | verifier:repository uses the shared kernel db handle and opens no new one |
| QG-PROD-5 | verifier:migration 0040 is forward-only |
| QG-PROD-6 | verifier:no packaging change so the README redeploy text is untouched |
| QG-BUGS | verifier:check-run-conformance bugs scope exits 0 |
| GR-001 | n/a: this spec does not touch compose |
| GR-002 | static-rules:SR-002, T-002, T-009, T-016, verifier:every route has requireUser |
| GR-003 | static-rules:SR-002 SR-003, T-029 |
| GR-004 | T-005, T-008, T-013, verifier:every route declares a schema |
| GR-005 | static-rules:SR-004 SR-005 |
| GR-006 | static-rules:SR-006 SR-007 |
| GR-007 | static-rules:SR-008 SR-009, T-001, T-021 |
| GR-008 | static-rules:SR-010 |
| GR-009 | n/a: no CSV import here |
| GR-010 | n/a: no password or session code here |
| GR-011 | n/a: headers belong to the walking skeleton and these routes add none |
| GR-012 | verifier:compare the Decisions table with manifests and imports for a second validator or ORM or UI kit |
| GR-013 | static-rules:SR-014 SR-015 |
| GR-014 | verifier:migration 0040 is in the 0040-0049 range, T-029 |
| GR-015 | static-rules:SR-016 |
| GR-016 | static-rules:SR-017, T-015 |
| GR-017 | n/a: no Dockerfile change |
| GR-018 | verifier:no CSRF or rate limit or audit or SBOM dependency or table appears |

## Routing

Written by `kcc route` from each item's Complexity, its files, its domain and CR-7 risk. `kcc-run` and the orchestrator read it;
do not edit it by hand (rerun `kcc route`).

| Item | Wave | Tier | Model | Effort | Why |
|--|--|--|--|--|--|
| Enabler-001 | 1 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; complexity high: effort high |
| Story-001 | 2 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (authz): effort high |
| Story-002 | 3 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (authz): effort high |
| Story-003 | 3 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (token): effort high |
| Story-004 | 4 | balanced | claude-sonnet-5-5 | medium | agent default: balanced / medium |

## Verification Steps
1. `pnpm install --frozen-lockfile` then `pnpm -r typecheck`, `pnpm -r lint`.
2. `pnpm --filter api test -- accounts` (T-001..T-017, T-029) and `pnpm --filter web test -- accounts` (T-018..T-028).
3. `quality-gate -Spec SPEC-004` must be green, including QG-STATIC and the coverage floor.
4. `check-traceability -Spec SPEC-004` exits 0 (every AC has a passing Test ID).
5. Manual: start the API, open `/docs`, confirm the five account routes; open the Accounts page with two users.
6. Per wave: `check-wave-scope -Spec SPEC-004 -Wave N`.

## Scope
Large (19 files: 4 + 4 + 3 + 5 + 3, with shared files counted once about 17, plus 6 allowed test and helper files), split into four file-disjoint waves.

## Confidence
Confidence: 95%

Residual doubt: SPEC-002 has no plan and its helper names are assumed, and the repo-root `api/` and `web/` layout departs from the template prefix. Both are in Risk Flags; neither changes the design.

## Related
- Epic spec: [[SPEC-004-accounts]]
- Idea-specs index: [[../IDEA-001-budgetpal-Specs]]
- Roadmap: [[../ROADMAP]]
- Architecture: [[../../../architecture/architecture]], [[../../../architecture/quality-gates]]
