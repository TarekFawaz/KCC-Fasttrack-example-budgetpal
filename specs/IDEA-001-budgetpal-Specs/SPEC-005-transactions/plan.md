---
id: SPEC-005-plan
status: ready
version: 1.0.0
---

# SPEC-005 Implementation Plan

## Dependency Check
- SPEC-003 (categories, migration `0030`) and SPEC-004 (accounts, `0040-create-accounts.sql`) are the blockers. Neither has a `plan.md` or merged code in this lane, so this plan assumes their contracts only: tables `categories` and `accounts` with `id` and `user_id` (read in this repository's own SQL, GR-006), `categories.kind` in (`expense`,`income`), and list endpoints for the web pickers. IMPLEMENT waits for both to be APPROVED; the implementer confirms column names against the merged migrations before writing `0050`.
- SPEC-002 / SPEC-001 kernel helpers (`requireUser`, validation helper, problem+json handler, module and feature auto-registration, session test helper, API client) are assumed in `api/src/kernel/` and `web/src/kernel/`. If names differ the implementer adjusts imports, not the design. Missing registry = STOP and report.
- No STOP at planning time.

## Architecture Gate Check
Fast-track: inputs are the spec note's `## Architecture references` and `architecture/architecture.md`. Containers: API (module `transactions`: routes -> service -> repository), Web (feature `transactions`), SQLite database (migration range 0050-0059, E5). Decisions D-01, D-03, D-04, D-08, D-10, D-11, D-12, D-13, D-16, D-19, D-20, D-23 are `Accepted` / `Accepted (assumed)`; D-22 is `Proposed` but touches no item here.
- Gates: QG-ARCH-CONFORMANCE, QG-TRACE, QG-SCOPE, QG-QUALITY, QG-STATIC, QG-API-CONFORMANCE, QG-ISOLATION, QG-VALIDATION, QG-A11Y, QG-PROD, QG-BUGS
- Budgets: list under 200 ms p95 on 10,000 rows (D-12/quality attributes) -> T-024, T-025.
- Stack conformance: TypeScript, Fastify 5, zod 3, better-sqlite3 12, React 18, TanStack Query 5, vitest 2 as declared; no new package is introduced by this spec (scaffold and manifests belong to SPEC-001).

## Backlog Coverage
| Item | Type | Dialect | Complexity | Wave | Plan coverage | Notes |
|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | backend-nodejs | medium | 1 | Covered | migration 0050, zod schemas, user-scoped repository; high-trust isolation code |
| Story-001 | Story | backend-nodejs | high | 2 | Covered | POST; auth, ownership checks, untrusted input, log redaction |
| Story-002 | Story | backend-nodejs | high | 3 | Covered | PATCH/DELETE; ownership re-checks |
| Story-003 | Story | backend-nodejs | medium | 4 | Covered | GET list, filters, paging, index use, perf |
| Story-004 | Story | frontend-react | medium | 5 | Covered | page, filters, pager, a11y |
| Story-005 | Story | frontend-react | medium | 6 | Covered | form, money parsing without floats, delete confirm |

## Ordered Changes
Paths follow the architecture layout (`api/`, `web/`) used by every Impacted Files list and by `static-rules.tsv`; see Risk Flags.
1. **Enabler-001** - `api/migrations/0050-transactions.sql`: `transactions` table (`id`, `user_id`, `account_id`, `category_id`, `occurred_on` TEXT, `amount_minor` INTEGER CHECK > 0, `description`, `created_at`, `updated_at`), FKs `ON DELETE RESTRICT` (user, account, category), index `(user_id, occurred_on)`. No REAL/FLOAT/DECIMAL. Why: AC-1, AC-2, epic AC-2, AC-8.
2. **Enabler-001** - `transactions.schemas.ts`: strict zod create/patch/list-query/param schemas and types (amount safe int 1..999999999999, real calendar date, description 1-200, `month` YYYY-MM, limit 1..200 default 50, offset >= 0). Why: AC-3, epic AC-7. Depends on: none.
3. **Enabler-001** - `transactions.repository.ts`: `insert`, `findById`, `update`, `remove`, `list` (filters + count), `ownsAccount`, `ownsCategory`; every function takes `userId` first and filters by `user_id`; SQL placeholders only. Why: AC-4, AC-5, GR-002/003. Depends on: 1.
4. **Story-001** - `transactions.service.ts` (`create`: ownership checks -> field errors, then insert), `transactions.routes.ts` (POST, zod schemas, OpenAPI, `requireUser`, log without description/amount), `index.ts` (router export). Why: AC-1..AC-6, epic AC-1, AC-6, AC-10. Depends on: 1-3.
5. **Story-002** - add `update` / `remove` to service and PATCH / DELETE to routes (404 for foreign or unknown id, re-check ownership of changed account/category, empty patch -> 400, touch `updated_at`). Depends on: 4.
6. **Story-003** - add `list` to service and `GET /transactions` with query schema (order `occurred_on DESC, id DESC`, `{items,total,limit,offset}`). Depends on: 4.
7. **Story-004** - `feature.ts`, `api.ts` (list hook, types, account/category picker queries through the kernel API client, GR-006), `TransactionsPage.tsx` + `.module.css` (filters, table with `Intl` formatting, text/icon for direction, pager, empty/loading/error states, 360 px single column). Why: AC-1..AC-6, epic AC-9. Depends on: 6.
8. **Story-005** - `money.ts` (string parse to minor units, no `parseFloat`/`toFixed`; minor-to-input string), `api.ts` mutations, `TransactionForm.tsx` (add/edit, inline field errors, prerequisite message, delete confirm with focus return). Depends on: 5, 7.

## Waves
Strictly sequential: Stories 001-003 all write `transactions.routes.ts`, `transactions.service.ts` and `transactions.routes.test.ts`, and Stories 004-005 share `api.ts`, so none can share a wave.

| Wave | Items | Files | File-disjoint | Notes |
|--|--|--|--|--|
| 1 | Enabler-001 | 4 | yes (single item) | migration, schemas, repository |
| 2 | Story-001 | 4 | yes (single item) | creates routes, service, index and route tests |
| 3 | Story-002 | 3 | yes (single item) | extends the wave-2 files |
| 4 | Story-003 | 3 | yes (single item) | extends the same files; cannot share wave 3 |
| 5 | Story-004 | 5 | yes (single item) | web page |
| 6 | Story-005 | 4 | yes (single item) | edits `api.ts` from wave 5 |

## Dialects Loaded
- `backend-nodejs` - API module, repository, migration
- `frontend-react` - page, form
- `testing-unit` - mandatory
- `testing-integration` - mandatory
- `testing-performance` - Story-003 AC-5 (10,000 rows, p95 < 200 ms)

## New Files
All listed in the items' Impacted Files; no other new files except the allowance below.

## Toolchain
| Tool | Version |
|--|--|
| node | >=22 <25 |
| pnpm | >=9 |
| typescript | ^5 |
| fastify | ^5 |
| zod | ^3 |
| better-sqlite3 | ^12 |
| react | ^18 |
| @tanstack/react-query | ^5 |
| vitest | ^2 |
| @testing-library/react | ^16 |
| axe-core | ^4 |

## Wave file allowances
| Item | Paths (backticked, `/**` allowed) |
|--|--|
| Enabler-001 | `api/src/modules/transactions/transactions.schemas.test.ts` |
| Story-004 | `web/src/features/transactions/TransactionsPage.test.tsx` |

## Risk Flags
- **Path prefix.** The framework default is `src/IDEA-001-budgetpal/...`, but the architecture, every backlog item and `static-rules.tsv` (`^api/src/`, `^web/src/`) fix the code at repo-root `api/` and `web/`. This plan follows the architecture; `check-wave-scope` only inspects `src/`, so wave-scope enforcement does not bite on these paths. Flagged for the verifier rather than changed.
- Table and column names of `categories`/`accounts` come from SPEC-003/004 migrations that are not merged here (`0030`, `0040-create-accounts.sql`); confirm before writing `0050`.
- Deleting an account/category with transactions relies on `ON DELETE RESTRICT` here; SPEC-004 proves its half with a test-only table, T-006 proves the real one.
- Story-004 formats money inline in `TransactionsPage.tsx` (`Intl`), because `money.ts` is Story-005's file and Story-005 must not edit a wave-5 file; `money.ts` provides parsing and edit-field formatting only.
- SPEC-006 will need to map signed CSV amounts onto a category kind (positive amounts, D-13); no work here. Its dedupe column lands in its own `0060` migration.
- Security-sensitive items (Story-001/002) are `high` Complexity.
- Sequential waves make this the longest chain in the idea; acceptable because the stories share files.

## Atomic test cases

| Test ID | Item | AC | Level | Description |
|--|--|--|--|--|
| T-001 | Enabler-001 | AC-1 | integration | migrate empty db: `transactions` columns, `ON DELETE RESTRICT` FKs and `(user_id, occurred_on)` index exist via pragma |
| T-002 | Enabler-001 | AC-2 | integration | migration file is `0050-transactions.sql`, no REAL/FLOAT/DECIMAL, applies on top of 0001-0049 and cannot be re-applied out of order |
| T-003 | Enabler-001 | AC-3 | unit | schemas accept valid input; reject unknown keys, 0, negative, fractional, > 999999999999 amounts, 2026-02-30, empty/201-char description, month `2026-13` |
| T-004 | Enabler-001 | AC-4 | integration | two users: every repository function called with user B's id on A's row returns nothing/changes nothing |
| T-005 | Enabler-001 | AC-5 | integration | `ownsAccount`/`ownsCategory` true for own rows, false for other user's and unknown ids |
| T-006 | Enabler-001 | AC-1 | integration | deleting an account or category referenced by a transaction fails with the FK error and the row stays (epic AC-8) |
| T-007 | Story-001 | AC-1 | integration | `inject` POST valid body returns 201 with stored row; row present in db with positive integer `amount_minor` |
| T-008 | Story-001 | AC-2 | integration | POST without cookie returns 401, nothing written |
| T-009 | Story-001 | AC-3 | integration | foreign or unknown `accountId`/`categoryId` returns 400 problem+json naming the field; table unchanged |
| T-010 | Story-001 | AC-4 | integration | bad date, amount 0/-5/1.5, 201-char description, unknown field each return 400 with field errors; table unchanged |
| T-011 | Story-001 | AC-5 | integration | captured pino output of a successful add contains neither description nor amount |
| T-012 | Story-001 | AC-6 | integration | router auto-registered; `/docs/json` contains `POST /transactions` |
| T-013 | Story-002 | AC-1 | integration | PATCH changed fields returns 200 with updated row and later `updated_at` |
| T-014 | Story-002 | AC-2 | integration | DELETE returns 204 and the row is gone |
| T-015 | Story-002 | AC-3 | integration | user B PATCH/DELETE on A's id and unknown id return 404; row unchanged |
| T-016 | Story-002 | AC-4 | integration | PATCH with foreign/unknown account or category id returns 400 with field error; row unchanged |
| T-017 | Story-002 | AC-5 | integration | empty patch, invalid value, unknown field return 400; row unchanged |
| T-018 | Story-002 | AC-6 | integration | PATCH and DELETE without cookie return 401 |
| T-019 | Story-002 | AC-1 | integration | log output of PATCH and DELETE contains no description or amount (epic AC-10) |
| T-020 | Story-003 | AC-1 | integration | seeded rows: 200 `{items,total,limit,offset}`, order date desc then id desc, default limit 50, paging by offset |
| T-021 | Story-003 | AC-2 | integration | `month`, `accountId`, `categoryId` filter alone and combined (AND); `total` counts the filtered set |
| T-022 | Story-003 | AC-3 | integration | limit 201, offset -1, `month=2026-13`, unknown query key each return 400 with field errors |
| T-023 | Story-003 | AC-4 | integration | user A lists, also with B's account id as filter: none of B's rows appear |
| T-024 | Story-003 | AC-5 | performance | 10,000 seeded rows, month list p95 < 200 ms over repeated calls |
| T-025 | Story-003 | AC-5 | integration | `EXPLAIN QUERY PLAN` of the month list uses the `(user_id, occurred_on)` index |
| T-026 | Story-003 | AC-6 | integration | no match returns `items: []`, `total: 0` |
| T-027 | Story-003 | AC-1 | integration | contract: `/docs/json` documents POST, GET list, PATCH, DELETE with matching status codes; sampled responses validate |
| T-028 | Story-004 | AC-1 | integration | feature registry lists the Transactions nav entry for `/transactions` |
| T-029 | Story-004 | AC-2 | unit | amount formatting from minor units via `Intl`; expense vs income shown by text or icon |
| T-030 | Story-004 | AC-2 | integration | mocked fetch: table renders date, description, account, category, amount |
| T-031 | Story-004 | AC-3 | integration | labelled selects fed from list endpoints; changing month/account/category refetches with those params |
| T-032 | Story-004 | AC-4 | integration | Previous/Next move offset by limit; range and total shown |
| T-033 | Story-004 | AC-5 | integration | empty state text, loading status and error status messages |
| T-034 | Story-004 | AC-6 | integration | axe: no serious/critical violation; filters keyboard operable; single-column class at 360 px |
| T-035 | Story-005 | AC-1 | integration | submit add form posts and list refetches; form resets |
| T-036 | Story-005 | AC-2 | unit | `money.ts` parses `12.50`->1250, `12`->1200, `0.05`->5; rejects `1.234`, `abc`; inline error shown in form |
| T-037 | Story-005 | AC-3 | integration | server 400 field errors render next to labelled inputs; entered values kept |
| T-038 | Story-005 | AC-4 | integration | Edit, change a field, save: PATCH sent and the row updates |
| T-039 | Story-005 | AC-5 | integration | Delete + confirm removes row; cancel changes nothing; confirm is keyboard operable and returns focus |
| T-040 | Story-005 | AC-6 | integration | with no accounts or no categories the form says what to create first |
| T-041 | Story-005 | AC-7 | integration | axe on form: no serious/critical violation; each control has visible label and focus style |

Counts: unit 3, integration 37, performance 1 (41). Per item <= 8 (SZ-4).

## Standards coverage

| Standard | Verifier check | Covered by |
|--|--|--|
| api-standards | OpenAPI 3.x document present, Swagger UI at `/docs`, routes and verbs match, status codes match | T-012, T-027, QG-API-CONFORMANCE via verifier (D-04: document generated from zod and served at `/docs/json`, not checked in) |
| api-standards / D-11 | errors as problem+json with field errors | T-009, T-010, T-016, T-017, T-022 |
| data (money, D-13; migrations, D-05) | integer minor units, forward-only numbered migration | T-002, T-003, T-036 |
| security (authz and isolation, D-08; validation, D-10) | 401 without session, 404 cross-user, strict schemas | T-004, T-008, T-015, T-018, T-022, T-023 |
| operations (logging, D-16) | no descriptions or amounts logged | T-011, T-019 |
| accessibility (WCAG 2.2 AA, D-20) | axe, labels, keyboard, not colour alone | T-029, T-033, T-034, T-039, T-041 |

## Gates coverage

| Gate | Covered by |
|--|--|
| QG-ARCH-CONFORMANCE | verifier:compare Decisions table and Toolchain with manifests and imports |
| QG-TRACE | check:QG-TEST, verifier:check-traceability -Spec SPEC-005 |
| QG-SCOPE | verifier:quality-gate -Spec scopes from this table |
| QG-QUALITY | check:QG-LOCK, check:QG-BUILD, check:QG-LINT, check:QG-TEST, check:QG-COV, check:QG-SECRETS, check:QG-DEPS, check:QG-SAST |
| QG-STATIC | check:QG-STATIC |
| QG-API-CONFORMANCE | T-012, T-027 |
| QG-ISOLATION | T-004, T-005, T-015, T-023 |
| QG-VALIDATION | T-003, T-010, T-017, T-022 |
| QG-A11Y | T-034, T-041, verifier:visual review of the page in light and dark |
| QG-PROD | verifier:each numbered item QG-PROD-1 to QG-PROD-6 in the rows below |
| QG-PROD-1 | verifier:owned by SPEC-001 and unchanged here (spec AC-10) |
| QG-PROD-2 | T-011, T-019 |
| QG-PROD-3 | verifier:owned by SPEC-001 and unchanged here (spec AC-10) |
| QG-PROD-4 | verifier:owned by SPEC-001 and unchanged here (spec AC-10) |
| QG-PROD-5 | T-002, verifier:rollback documentation owned by SPEC-001 |
| QG-PROD-6 | verifier:owned by SPEC-001 and unchanged here (spec AC-10) |
| QG-BUGS | verifier:check-run-conformance -Scope bugs |
| GR-001 | n/a: spec changes no compose file |
| GR-002 | static-rules:SR-002, T-004, T-015, T-023, verifier:every route has requireUser |
| GR-003 | static-rules:SR-002 SR-003 |
| GR-004 | T-010, T-017, T-022, verifier:every route has schema and strict bodies |
| GR-005 | n/a:no cookie or nginx change and no CORS plugin added |
| GR-006 | static-rules:SR-006 SR-007 |
| GR-007 | static-rules:SR-008 SR-009, T-002, T-036 |
| GR-008 | static-rules:SR-010, T-011, T-019 |
| GR-009 | n/a: no CSV import in this spec |
| GR-010 | n/a: no hashing or tokens in this spec |
| GR-011 | n/a: no header or nginx change |
| GR-012 | verifier:every package in the Decisions table is imported by src and in the lockfile and the spec adds no other library |
| GR-013 | static-rules:SR-014 SR-015 |
| GR-014 | verifier:migration is `0050-transactions.sql` in range 0050-0059, T-002 |
| GR-015 | n/a: no config or `.env.example` change |
| GR-016 | static-rules:SR-017 |
| GR-017 | n/a: no Dockerfile change |
| GR-018 | verifier:no CSRF or rate limiter or audit or SBOM dependency or table is added |

## Routing
Written by `kcc route` from the Complexity column above; do not fill it by hand.

## Verification Steps
1. `pnpm --filter api test -- transactions` -> T-001..T-027 green (includes two-user, validation, log, OpenAPI and perf tests).
2. `pnpm --filter web test -- transactions` -> T-028..T-041 green including axe.
3. `pnpm -r typecheck && pnpm -r lint` (QG-BUILD, QG-LINT).
4. `quality-gate -Spec SPEC-005` green: QG-STATIC rules SR-002/003/006-010/014/015/017, lockfile, secrets, audit, coverage floor.
5. `check-traceability -Spec SPEC-005` exits 0: every epic and item AC has a passing test.
6. Verifier: `/docs` lists the four transaction routes; migration `0050` only; Decisions vs manifests.
7. Epic AC map: AC-1 T-007; AC-2 T-002, T-007; AC-3 T-013..T-016; AC-4 T-020..T-021; AC-5 T-008, T-015, T-018, T-023; AC-6 T-009, T-016; AC-7 T-010, T-017, T-022; AC-8 T-006; AC-9 T-028..T-041; AC-10 T-011, T-019.

## Scope
Medium (23 files across API and web, 6 sequential waves).

## Confidence
Confidence: 90%
Below the 95% default only because SPEC-003/004 tables and the kernel helper names are unverified (no merged code in this lane) and the `api/`/`web/` vs `src/IDEA-...` path question is open; no design risk otherwise.

## Related
- Epic spec: [[SPEC-005-transactions]]
- Idea-specs index: [[../IDEA-001-budgetpal-Specs]]
- All specs: [[../../specs|All specs MOC]]
