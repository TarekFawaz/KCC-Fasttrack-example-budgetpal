---
spec: SPEC-007
status: ready
version: 1.0.0
profile: fasttrack
depthlevel: 2
---

# SPEC-007 Implementation Plan

## Dependency Check
SPEC-007 depends on SPEC-005 (transactions), which transitively needs SPEC-001 (app, migration runner, registries), SPEC-002 (`requireUser`, validation helper) and SPEC-003 (categories). None has code in this lane yet; that is not a planning blocker (IMPLEMENT waits for them to be APPROVED). Contracts planned against:
- SPEC-005 `0050-transactions.sql`: `transactions(user_id, category_id, occurred_on TEXT 'YYYY-MM-DD', amount_minor INTEGER > 0)`. Amounts are always positive; direction comes from the category kind (SPEC-005 AC-2), so spent = `SUM(amount_minor)` over transactions of `expense` categories.
- SPEC-003 `0030-categories.sql`: `categories(id, user_id, name, kind CHECK expense|income)`.
- SPEC-002 kernel: `api/src/kernel/require-user.ts`, `validate.ts`, `problem.ts`. SPEC-001 kernel: `db.ts`, `migrate.ts`, `app.ts` (module auto-registration), `web/src/kernel/registry.ts`.
- GR-006: the budgets repository reads `transactions` and `categories` by SQL and imports no other module.
No STOP. No `Proposed` ADR affects this spec (D-22 is about compose only).

## Architecture Gate Check
C4: API (module `budgets`: routes -> service -> repository), Web (feature `budgets`), SQLite database (`budgets` table). Decisions D-01, D-04, D-05, D-08, D-10, D-11, D-13, D-15, D-19, D-20 (all Accepted / Accepted (assumed)). The ordering follows D-01 (repository before service before routes, API before UI). Migration `0070` is in the E7 range (GR-014). Stack: TypeScript, Fastify 5, zod 3, better-sqlite3 12, React 18, TanStack Query 5, vitest 2, axe-core 4 (all declared in SPEC-001; this spec adds no package).
Gates: QG-ARCH-CONFORMANCE, QG-TRACE, QG-SCOPE, QG-QUALITY, QG-STATIC, QG-API-CONFORMANCE, QG-ISOLATION, QG-VALIDATION, QG-A11Y, QG-PROD, QG-BUGS

## Backlog Coverage
| Item | Type | Dialect | Complexity | Wave | Plan coverage | Notes |
|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | backend-nodejs | high | 1 | Covered | SQL and per-user scoping; migration 0070, repository, status rule |
| Story-001 | Story | backend-nodejs | high | 2 | Covered | authorization, validation of untrusted input; PUT and DELETE |
| Story-002 | Story | backend-nodejs | high | 3 | Covered | SQL aggregation across users' data; GET progress |
| Story-003 | Story | frontend-react | medium | 4 | Covered | page, month picker, form, hooks |
| Story-004 | Story | frontend-react | medium | 5 | Covered | progress bar, status, a11y |

## Ordered Changes
1. **Enabler-001** - `api/migrations/0070-budgets.sql`: `budgets(id, user_id FK users ON DELETE CASCADE, category_id FK categories ON DELETE CASCADE, month TEXT CHECK 'YYYY-MM' shape, amount_minor INTEGER CHECK > 0, created_at, updated_at)`, `UNIQUE(user_id, category_id, month)`; no REAL/FLOAT (SR-008). Why: AC-1.
2. **Enabler-001** - `budgets.status.ts`: pure `budgetStatus(spentMinor, budgetMinor)` -> `ok` if `spent*5 < budget*4`, `warning` if `spent <= budget`, else `over`; integer (BigInt) maths only, see Risk Flags. Why: AC-5.
3. **Enabler-001** - `budgets.repository.ts`: every function takes `userId` first: `upsert` (`INSERT ... ON CONFLICT DO UPDATE`, reports created vs replaced), `find`, `remove`, `listWithSpent(userId, month)` (one SQL: LEFT JOIN `transactions` on user, category, month range, `SUM`, joined to `categories` for name), `listUnbudgeted(userId, month)` (expense categories with spend and no budget), `categoryKind(userId, categoryId)` (reads `categories` by SQL, GR-006). Why: AC-2..AC-4, spec AC-3, AC-6.
4. **Story-001** - `budgets.schema.ts`: `.strict()` zod params (`month` `YYYY-MM` real month, `categoryId`), body `{amountMinor}` positive safe integer <= 999999999999, response schemas, OpenAPI metadata. Why: AC-3, spec AC-7.
5. **Story-001** - `budgets.service.ts`: category must exist for the user (else 404 as for foreign), kind `expense` (else 400), upsert (201 new / 200 replaced), delete (404 when absent). Why: AC-1, AC-2, AC-4, AC-5.
6. **Story-001** - `budgets.routes.ts` + `index.ts`: `PUT` and `DELETE /budgets/:month/:categoryId` behind `requireUser`, zod schemas on every route; no state change on GET. Depends on 5. Why: AC-1..AC-6.
7. **Story-002** - `budgets.progress.service.ts`: assemble `items` (`categoryId`, `categoryName`, `budgetMinor`, `spentMinor`, `percent` = display-only `Math.floor(spent*100/budget)`, `status` from step 2) and `unbudgeted` (`categoryId`, `categoryName`, `spentMinor`). Why: AC-1..AC-4.
8. **Story-002** - `budgets.progress.routes.ts` + `index.ts` (add route): `GET /budgets?month=YYYY-MM`, `requireUser`, zod query `.strict()`, month required. Why: AC-5, AC-6.
9. **Story-003** - `web/src/features/budgets/api.ts`: TanStack Query hooks (list by month, set, remove; invalidate the month list); calls `/api/budgets...`. Why: AC-2, AC-3, AC-5.
10. **Story-003** - `BudgetForm.tsx`: labelled amount input, parse to integer minor units without `parseFloat`/`toFixed` (string split on the currency's decimal digits from `Intl`), inline error. Why: AC-3, AC-4, AC-7.
11. **Story-003** - `BudgetsPage.tsx`, `BudgetsPage.module.css`, `feature.ts`: month picker defaulting to the current month, list, remove, empty state, nav entry via registry (`id`, `path`, `label`, `order`, `component`). Why: AC-1, AC-2, AC-5, AC-6, AC-7.
12. **Story-004** - `BudgetProgress.tsx` + `.module.css`: `role="progressbar"` with accessible name and `aria-valuenow`/min/max, bar capped at 100% width, status icon + text, over-budget amount text, light/dark tokens, single column at 360 px. Also swaps the plain row in `BudgetsPage.tsx` for `<BudgetProgress item currency />` and adds the unbudgeted list with "Add budget" (allowance row below; `BudgetsPage.tsx` is not in its Impacted Files). Why: AC-1..AC-6.
13. **Story-004** - `BudgetsPage.test.tsx`: progress, status, unbudgeted and axe tests. Why: AC-1..AC-6.

## Waves
Authoritative (matches the spec column). The chain is linear by dependency; consecutive items also share files (`index.ts`, `BudgetsPage.tsx` use), so there is no safe parallelism inside this spec. Parallelism is across specs (SPEC-006, SPEC-007, SPEC-008 build together; this spec owns only `api/src/modules/budgets`, `web/src/features/budgets`, migration `0070`).

| Wave | Items | Files | File-disjoint | Notes |
|--|--|--|--|--|
| 1 | Enabler-001 | 4 (+0) | yes (single item) | migration, repository, status |
| 2 | Story-001 | 4 (+2 tests) | yes (single item) | creates `index.ts` |
| 3 | Story-002 | 4 | yes (single item) | edits `index.ts` created in wave 2 |
| 4 | Story-003 | 5 (+2 tests) | yes (single item) | web page; needs the GET contract from wave 3 |
| 5 | Story-004 | 3 | yes (single item) | web progress component |

## Dialects Loaded
- `backend-nodejs` - API items (spec says `backend-node`; the dialect file is `backend-nodejs`)
- `frontend-react` - web items
- `testing-unit` - mandatory
- `testing-integration` - mandatory (Fastify `inject` on in-memory SQLite with real migrations)
- `testing-performance`, `testing-security` - not scoped by any item (isolation and validation are covered by integration tests)

## New Files
All paths follow the architecture layout (`api/`, `web/` at the repo root, as in every SPEC-001..008 backlog), not `src/IDEA-001-budgetpal/`.
- `api/migrations/0070-budgets.sql`
- `api/src/modules/budgets/`: `budgets.status.ts`, `budgets.repository.ts`, `budgets.repository.test.ts`, `budgets.schema.ts`, `budgets.service.ts`, `budgets.routes.ts`, `index.ts`, `budgets.progress.service.ts`, `budgets.progress.routes.ts`, `budgets.progress.test.ts`, plus allowance tests below
- `web/src/features/budgets/`: `feature.ts`, `BudgetsPage.tsx`, `BudgetForm.tsx`, `api.ts`, `BudgetsPage.module.css`, `BudgetProgress.tsx`, `BudgetProgress.module.css`, `BudgetsPage.test.tsx`, plus allowance tests below

## Toolchain
| Tool | Version |
|--|--|
| node | >=22 <25 |
| pnpm | >=9 |
| typescript | ^5 |
| fastify | ^5 |
| fastify-type-provider-zod | ^4 |
| zod | ^3 |
| better-sqlite3 | ^12 |
| react | ^18 |
| react-router | ^6 |
| @tanstack/react-query | ^5 |
| vitest | ^2 |
| @testing-library/react | ^16 |
| axe-core | ^4 |

## Wave file allowances
| Item | Paths (backticked, `/**` allowed) |
|--|--|
| Story-001 | `api/src/modules/budgets/budgets.routes.test.ts`, `api/src/modules/budgets/budgets.schema.test.ts` |
| Story-003 | `web/src/features/budgets/BudgetsPage.set.test.tsx`, `web/src/features/budgets/BudgetForm.test.tsx` |
| Story-004 | `web/src/features/budgets/BudgetsPage.tsx` |

## Risk Flags
- **Route prefix:** backlog text says `/api/budgets`; the web proxy and dev proxy strip `/api` (SPEC-001 Enabler-003 AC-4) and SPEC-005 registers `POST /transactions`. The API registers `/budgets...`; the web client calls `/api/budgets...`. Tests inject `/budgets`.
- **Paths:** the spec's `api/...` and `web/...` Impacted Files are kept as written (architecture D-01 layout); the planner prefix `src/IDEA-001-budgetpal/` is not used. The wave-scope gate reads those paths.
- **Story-004 vs Story-003 file ownership:** Story-004's Impacted Files omit `BudgetsPage.tsx`, yet the page must render `BudgetProgress`. Resolution: Story-003 renders each row as plain text in `BudgetsPage.tsx` (Story-003 owns it); Story-004 (a later wave, so no overlap) edits that file to use `BudgetProgress`, recorded in the allowance table. Spec-writer should add the file to Story-004's Impacted Files on the next spec revision.
- **Percent vs status:** status is decided on integers, never on the rounded `percent`. Use `spent*5 >= budget*4` (equals `spent*100 >= budget*80`) and `spent > budget`, evaluated with `BigInt` inside `budgets.status.ts` so large sums cannot lose precision; `percent` is display only.
- **Month filter in SQL:** use a range (`occurred_on >= @month || '-01' AND occurred_on < @next`) so the `(user_id, occurred_on)` index is used; `@next` computed in code from the validated month.
- **Deleted/changed categories:** decided: `budgets.category_id` is `ON DELETE CASCADE` (a budget is a limit, not a record; RESTRICT would stop category deletion for a harmless row). Progress queries ignore a budget whose category is no longer `expense`.
- **Test levels:** ACs exercised only through HTTP are integration tests (SZ-4 cap of 8 per item prevents a unit twin for each); pure logic (status, schemas, amount parsing) has unit tests.
- **OpenAPI:** `api-standards.md` asks for a checked-in OpenAPI document; D-04 generates and serves it from the zod schemas and no spec owns a shared checked-in file. This plan follows D-04 and tests that the served document lists the routes (T-013, T-020); the verifier decides whether a checked-in file is required.
- **Contrast/layout in jsdom:** axe contrast and viewport layout cannot be fully computed in jsdom; T-033/T-034 check tokens and CSS rules, and the verifier does a visual review at 360 px in both schemes.

## Atomic test cases
| Test ID | Item | AC | Level | Description |
|--|--|--|--|--|
| T-001 | Enabler-001 | AC-1 | integration | migrations on an empty DB: `budgets` columns, FKs, unique index; inserting amount 0 or a duplicate user+category+month fails |
| T-002 | Enabler-001 | AC-2 | integration | upsert same user/category/month twice: one row, amount replaced, created vs replaced flag |
| T-003 | Enabler-001 | AC-3 | integration | two users: B's find/remove/upsert/list on A's budget id or category returns nothing and A's row is unchanged |
| T-004 | Enabler-001 | AC-4 | integration | `listWithSpent` sums only the user's, month's and category's transactions; other months/users/categories excluded; unbudgeted list |
| T-005 | Enabler-001 | AC-5 | unit | `budgetStatus` at 79.99%, 80%, 100%, 100.01%, zero spent, large values |
| T-006 | Story-001 | AC-1 | integration | PUT valid body returns 201 then 200 with the replaced amount; body returned |
| T-007 | Story-001 | AC-2 | integration | income category 400; unknown and another user's category 404; table unchanged |
| T-008 | Story-001 | AC-3 | unit | schema rejects bad month (`2026-13`), 0, negative, fractional, string, over-max amount and unknown field |
| T-009 | Story-001 | AC-3 | integration | invalid month/amount/unknown field via inject: 400 problem+json with field errors, table unchanged |
| T-010 | Story-001 | AC-4 | integration | DELETE returns 204, budget gone; second DELETE 404 |
| T-011 | Story-001 | AC-5 | integration | user B PUT/DELETE on A's category/budget: 404 and A's row unchanged |
| T-012 | Story-001 | AC-6 | integration | PUT and DELETE without a session cookie return 401 |
| T-013 | Story-001 | AC-1 | integration | `/docs/json` lists PUT and DELETE `/budgets/{month}/{categoryId}` with the zod-derived schemas |
| T-014 | Story-002 | AC-1 | integration | GET with seeded data returns items with categoryId, name, budgetMinor, spentMinor, percent, status |
| T-015 | Story-002 | AC-2 | integration | spending 79%, 80%, 100%, 101% gives ok, warning, warning, over |
| T-016 | Story-002 | AC-3 | integration | expense category with spend and no budget appears in `unbudgeted`; income categories never do |
| T-017 | Story-002 | AC-4 | integration | month without budgets: 200 with empty `items` |
| T-018 | Story-002 | AC-5 | integration | missing, malformed or unknown query key: 400 problem+json |
| T-019 | Story-002 | AC-6 | integration | user B reads progress: none of A's items, unbudgeted or amounts |
| T-020 | Story-002 | AC-1 | integration | `/docs/json` lists GET `/budgets` with query and response schemas |
| T-021 | Story-002 | AC-1 | integration | captured pino output across PUT, GET, DELETE contains no amount values (GR-008) |
| T-022 | Story-003 | AC-1 | unit | with the registry, a "Budgets" nav link exists and the route opens with the current month selected |
| T-023 | Story-003 | AC-2 | unit | changing the month refetches with the new `month` |
| T-024 | Story-003 | AC-3 | unit | "12.50" saves `amountMinor` 1250 for an `Intl`-formatted currency; list updates and shows the formatted amount |
| T-025 | Story-003 | AC-4 | unit | empty, 0, negative, non-numeric: labelled inline error and no request; API 400 shown next to the field |
| T-026 | Story-003 | AC-5 | unit | remove keeps the row until the API confirms, then it disappears |
| T-027 | Story-003 | AC-6 | unit | no expense categories / no budgets: empty state with next step |
| T-028 | Story-003 | AC-7 | unit | keyboard-only flow reaches month, amount, save and remove; all have accessible names |
| T-029 | Story-004 | AC-1 | unit | row shows category, spent, budget, percent; progressbar has name and `aria-valuenow` |
| T-030 | Story-004 | AC-2 | unit | ok, warning, over each render icon and the exact text |
| T-031 | Story-004 | AC-3 | unit | 150% spent: bar width capped at 100% and the over-by amount text present |
| T-032 | Story-004 | AC-4 | unit | unbudgeted categories with spend listed; "Add budget" focuses the amount field |
| T-033 | Story-004 | AC-5 | integration | axe on the page in light and dark (matchMedia mocked): no serious/critical; token pairs >= 4.5:1 |
| T-034 | Story-004 | AC-6 | unit | CSS module is single-column with no fixed width above 360 px; no horizontal overflow rule |

## Standards coverage
| Standard | Verifier check | Covered by |
|--|--|--|
| api-standards | OpenAPI 3.x document, Swagger UI, routes match document, status codes | T-013, T-020, T-007, T-009, T-018 (see Risk Flags on the checked-in file) |
| Security: authorization and isolation | user-scoped queries, 404 across users | T-003, T-011, T-019 |
| Security: input validation | zod strict, 400 with field errors | T-008, T-009, T-018, T-025 |
| Data: money (integer minor units) | no floats, `Intl` for display | T-001, T-005, T-024, static-rules SR-008 SR-009 |
| Data: migrations (forward-only, numbered) | file `0070`, in E7 range | T-001, verifier:migration name and range |
| Operations: logging | no amounts in logs | T-021 |
| Accessibility: WCAG 2.2 AA | axe, status not colour-only, 360 px | T-028, T-030, T-033, T-034 |
| Supply chain: lockfile and audit | lockfile unchanged, no new package | check:QG-LOCK, check:QG-DEPS |

## Gates coverage
| Gate | Covered by |
|--|--|
| QG-ARCH-CONFORMANCE | verifier:compare-Decisions-table-with-manifests-and-imports-no-new-package |
| QG-TRACE | check:QG-TEST, verifier:check-traceability -Spec |
| QG-SCOPE | verifier:quality-gate scopes from this table |
| QG-QUALITY | check:QG-LOCK, check:QG-BUILD, check:QG-LINT, check:QG-TEST, check:QG-COV, check:QG-SECRETS, check:QG-DEPS, check:QG-SAST |
| QG-STATIC | check:QG-STATIC |
| QG-API-CONFORMANCE | T-013, T-020 |
| QG-ISOLATION | T-003, T-011, T-019 |
| QG-VALIDATION | T-008, T-009, T-018, T-025 |
| QG-A11Y | T-028, T-030, T-033, verifier:visual review at 360 px in light and dark |
| QG-PROD-1 | verifier:inherited-from-SPEC-001-no-health-or-compose-change |
| QG-PROD-2 | T-021, static-rules:SR-010 |
| QG-PROD-3 | verifier:budgets-code-reads-no-env-var-and-holds-no-host-or-secret |
| QG-PROD-4 | verifier:inherited-from-SPEC-001-module-uses-kernel-db-handle-and-opens-none |
| QG-PROD-5 | T-001, verifier:migration-0070-forward-only-rollback-is-restoring-SQLite-copy |
| QG-PROD-6 | verifier:inherited-from-SPEC-001-README-unchanged |
| QG-BUGS | verifier:check-run-conformance -Scope bugs |
| GR-001 | n/a: this spec touches no compose file |
| GR-002 | T-003, T-011, T-012, T-019, static-rules:SR-002 |
| GR-003 | static-rules:SR-002 SR-003 |
| GR-004 | T-008, T-009, T-018, verifier:every route has a `schema` |
| GR-005 | static-rules:SR-004 SR-005, verifier:GET `/budgets` changes no state |
| GR-006 | static-rules:SR-006 SR-007 |
| GR-007 | T-005, T-024, static-rules:SR-008 SR-009 |
| GR-008 | T-021, static-rules:SR-010 |
| GR-009 | n/a: no CSV or upload in this spec |
| GR-010 | n/a: no password or token code in this spec |
| GR-011 | n/a: headers come from the SPEC-001 app factory and this spec adds none |
| GR-012 | verifier:Decisions-table-against-manifests-and-imports-no-new-library |
| GR-013 | static-rules:SR-014 SR-015 |
| GR-014 | T-001, verifier:migration file `0070-budgets.sql` inside 0070-0079 |
| GR-015 | n/a: no configuration or `.env` change |
| GR-016 | static-rules:SR-017, T-009, T-018 |
| GR-017 | n/a: no Dockerfile change |
| GR-018 | verifier:no-CSRF-rate-limit-lockout-or-audit-dependency-or-table-added |

## Routing
Written by `kcc route` from the Complexity column above; do not fill it by hand.

## Verification Steps
1. `pnpm --filter api test -- budgets` - T-001..T-021 (Enabler-001, Story-001, Story-002).
2. `pnpm --filter web test -- budgets` - T-022..T-034 (Story-003, Story-004).
3. `pnpm -r build`, `pnpm -r lint`, `pnpm audit --prod` and the coverage floor via `quality-gate` (QG-QUALITY, QG-STATIC).
4. `.KCC/tools/check-wave-scope -Spec SPEC-007 -Wave N` per wave; `check-traceability -Spec SPEC-007`.
5. Manual check: `/docs` lists the three budget operations; budgets page at 360 px in light and dark.

## Scope
Large (20 source files across API, web and one migration, plus tests).

## Confidence
Confidence: 95%
Every AC has a test, gates and guardrails are mapped, and the two open points (category FK behaviour, `BudgetsPage.tsx` ownership) are decided in Risk Flags and the allowance table. Remaining uncertainty: column names of SPEC-003 and SPEC-005 tables were read from their backlog items, not from built migrations; the implementer re-checks them in wave 1.

## Related
- Epic spec: [[SPEC-007-budgets]]
- Roadmap: [[../ROADMAP]]
- Idea-specs index: [[../IDEA-001-budgetpal-Specs]]
- All specs: [[../../specs|All specs MOC]]
