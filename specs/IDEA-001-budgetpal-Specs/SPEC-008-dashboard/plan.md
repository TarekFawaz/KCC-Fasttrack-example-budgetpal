---
id: SPEC-008-plan
spec: SPEC-008
status: ready
version: 1.0.0
profile: fasttrack
---

# SPEC-008 Implementation Plan

Workspace root `W` = `src/IDEA-001-budgetpal/`. Backlog paths (`api/...`, `web/...`) are relative to `W`; every path below is written in full.

## Dependency Check
- SPEC-008 depends on SPEC-005 (transactions). SPEC-005 has a spec but no `plan.md` yet: this plan is built against its declared contract (`0050-transactions.sql`: `transactions(id, user_id, account_id, category_id, occurred_on TEXT, amount_minor INTEGER > 0, ...)`, index on `(user_id, occurred_on)`) and SPEC-003's `categories(id, user_id, name, kind)`. IMPLEMENT waits until SPEC-005 is APPROVED and merged. SPEC-005 transitively brings SPEC-001 (kernel, registries), SPEC-002 (`requireUser`), SPEC-003, SPEC-004.
- No STOP. Contract corrections that differ from this spec's wording are in Risk Flags (R1, R2).

## Architecture Gate Check
Fast track: no `arch.md`, no standalone `c4-*.md`. Inputs: spec `## Architecture references`, `architecture/architecture.md` (`## Decisions`, `## Toolchain`, embedded C2), `architecture/quality-gates.md`.
- C2 containers: **API** (`api/src/modules/dashboard`, D-01 `routes -> service -> repository`), **Web** (`web/src/features/dashboard`), **SQLite database** (read only; migration range 0080-0089, GR-014). Components follow D-01 module layout.
- Stack conformance: Fastify 5 + zod (D-03), OpenAPI from zod (D-04), better-sqlite3 (D-05), integer minor units + env `CURRENCY` (D-13), expense-only SQL aggregates (D-15), React 18 + TanStack Query + Recharts + CSS modules (D-19), WCAG 2.2 AA with table alternative (D-20), vitest + Testing Library + axe (D-23). No deviation; no `Proposed` decision blocks this spec (D-22 concerns compose only; this spec does not touch it).
- Gates: QG-ARCH-CONFORMANCE, QG-TRACE, QG-SCOPE, QG-QUALITY, QG-STATIC, QG-API-CONFORMANCE, QG-ISOLATION, QG-VALIDATION, QG-A11Y, QG-PROD, QG-BUGS

## Backlog Coverage
| Item | Type | Dialect | Complexity | Wave | Plan coverage | Notes |
|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | backend-nodejs | medium | 1 | Covered | module, schemas, month-range helper, migration 0080 |
| Story-001 | Story | backend-nodejs | high | 2 | Covered | user-scoped SQL aggregate over personal financial data |
| Story-002 | Story | backend-nodejs | high | 2 | Covered | user-scoped SQL aggregate, zero-fill window |
| Story-003 | Story | frontend-react | medium | 3 | Covered | page, pie + table, month picker, adds `recharts` |
| Story-004 | Story | frontend-react | medium | 4 | Covered | trend chart + table + range selector |

## Ordered Changes
1. **Enabler-001** `W/api/migrations/0080-dashboard-transactions-index.sql`: `CREATE INDEX IF NOT EXISTS idx_transactions_dashboard ON transactions(user_id, occurred_on)`; forward-only, no REAL types. Why: Enabler AC-2, epic perf target.
2. **Enabler-001** `W/api/src/modules/dashboard/schemas.ts`: zod `.strict()` query schemas (`month` `YYYY-MM` with month 01-12; `months` int 1-24 default 6; `end` `YYYY-MM` default current month), response schemas registered for OpenAPI, `monthRange(month)` returning half-open `[YYYY-MM-01, next-month-01)` (December rollover, leap February). Why: Enabler AC-3/AC-4, epic AC-3.
3. **Enabler-001** `W/api/src/modules/dashboard/index.ts`, `spending.routes.ts`, `trend.routes.ts`: module entry mounted under `/api/dashboard` by the SPEC-001 registry; two empty route plugins. Why: Enabler AC-1/AC-4.
4. **Story-001** `spending.repository.ts`: `spendingByCategory(userId, from, to)`: one prepared `GROUP BY` over `transactions` joined to `categories` with `kind='expense'`, `t.user_id = ? AND c.user_id = ?`, `occurred_on >= ? AND occurred_on < ?`, `SUM(amount_minor)`, `ORDER BY total DESC, name`. Why: epic AC-1..AC-4 (D-08, D-15).
5. **Story-001** `spending.service.ts`: `totalMinor` = sum of rows, `currency` from kernel config. `spending.routes.ts`: `GET /spending` with `requireUser`, zod query, problem+json on 400. Why: epic AC-1, AC-3.
6. **Story-002** `trend.repository.ts`: `monthlyTotals(userId, from, to)`: `substr(occurred_on,1,7)` `GROUP BY`, expense kind only, user-scoped, half-open range. `trend.service.ts`: build the N-month window ending at `end` (year boundary, default current month), zero-fill, oldest first. `trend.routes.ts`: `GET /trend` with `requireUser`. Why: epic AC-2, AC-3, AC-4.
7. **Story-003** `W/web/package.json` + `W/pnpm-lock.yaml`: add `recharts@^2` (allowance). `api.ts` (TanStack Query hook for spending), `SpendingByCategory.tsx` (Recharts pie + table with category, `Intl` amount, % share, total row; each slice is also a table row, patterns/labels not colour alone), `DashboardPage.tsx` (month picker default current month, loading/error with retry, empty state with link to transactions), `feature.ts` (route `/dashboard`, nav entry), `dashboard.module.css` (CSS-variable tokens, light/dark), `format.ts` (share and format helpers, allowance). Why: epic AC-5..AC-7.
8. **Story-004** `TrendChart.tsx` (Recharts chart, month table, 3/6/12 labelled selector, all-zero empty state, own loading/error), `api.ts` (add trend hook), `DashboardPage.tsx` (mount trend section below categories). Why: epic AC-5..AC-7.

## Waves
| Wave | Items | Files | File-disjoint | Notes |
|--|--|--|--|--|
| 1 | Enabler-001 | migration 0080, `schemas.ts`, `index.ts`, `spending.routes.ts`, `trend.routes.ts` | yes (single item) | Wave 1 is the module scaffold: manifest and lockfile already exist from SPEC-001, which this spec depends on transitively |
| 2 | Story-001, Story-002 | `spending.{repository,service}.ts` + `spending.routes.ts`; `trend.{repository,service}.ts` + `trend.routes.ts` | yes (spending.* vs trend.*) | Test files are disjoint too (see allowances) |
| 3 | Story-003 | `web/src/features/dashboard/{feature.ts,DashboardPage.tsx,SpendingByCategory.tsx,api.ts,dashboard.module.css}` | yes (single item) | Needs Story-001 |
| 4 | Story-004 | `TrendChart.tsx`, `api.ts`, `DashboardPage.tsx` | yes (single item) | Edits `api.ts` and `DashboardPage.tsx` that wave 3 creates, so it runs after it |

## Dialects Loaded
- `backend-nodejs` - Enabler-001, Story-001, Story-002
- `frontend-react` - Story-003, Story-004
- `testing-unit` - mandatory
- `testing-integration` - mandatory
- `testing-performance` / `testing-security` - not loaded: no item scopes them. The 10,000-row latency target is covered by smoke-level tests T-012 and T-020 (integration) and noted in Risk Flags R5.

## New Files
All under `W/`. Migration `api/migrations/0080-dashboard-transactions-index.sql`. Tests beside the code (see allowances). `web/src/features/dashboard/format.ts`. No docs, configs or generated code.

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
| better-sqlite3 | ^12 |
| pino | ^9 |
| react | ^18 |
| react-dom | ^18 |
| vite | ^5 |
| react-router | ^6 |
| @tanstack/react-query | ^5 |
| recharts | ^2 |
| vitest | ^2 |
| @testing-library/react | ^16 |
| axe-core | ^4 |

## Wave file allowances
| Item | Paths (backticked, `src/IDEA-001-budgetpal/...`, `/**` allowed) |
|--|--|
| Enabler-001 | `src/IDEA-001-budgetpal/api/src/modules/dashboard/schemas.test.ts`, `src/IDEA-001-budgetpal/api/src/modules/dashboard/dashboard.module.test.ts` |
| Story-001 | `src/IDEA-001-budgetpal/api/src/modules/dashboard/spending.test.ts` |
| Story-002 | `src/IDEA-001-budgetpal/api/src/modules/dashboard/trend.test.ts` |
| Story-003 | `src/IDEA-001-budgetpal/web/package.json`, `src/IDEA-001-budgetpal/pnpm-lock.yaml`, `src/IDEA-001-budgetpal/web/src/features/dashboard/format.ts`, `src/IDEA-001-budgetpal/web/src/features/dashboard/DashboardPage.test.tsx`, `src/IDEA-001-budgetpal/web/src/features/dashboard/SpendingByCategory.test.tsx`, `src/IDEA-001-budgetpal/web/src/features/dashboard/format.test.ts` |
| Story-004 | `src/IDEA-001-budgetpal/web/src/features/dashboard/TrendChart.test.tsx` |

## Risk Flags
- **R1 column name.** The spec text says `date` and index `(user_id, date)`; the SPEC-005 contract names the column `occurred_on`. Plan uses `occurred_on` everywhere; confirm against the merged `0050-transactions.sql` before coding. A mismatch is a stop-and-report, not a guess.
- **R2 amount sign.** SPEC-005 stores amounts as positive integers with direction from category kind, so the SQL sums `amount_minor` of `kind='expense'` categories (`ABS()` is harmless but unnecessary). This resolves the spec's first Risk. SPEC-005's index on `(user_id, occurred_on)` already exists; migration 0080 is therefore a safe `IF NOT EXISTS` index under its own name (satisfies Enabler AC-2); consider a covering index only if the p95 check fails.
- **R3 paths.** Backlog files use `api/...` and `web/...`; the plan prefixes the idea workspace `src/IDEA-001-budgetpal/`. The static rules (`^api/src/...`) are relative to that workspace root; SPEC-001 must place `api/` and `web/` there.
- **R4 cross-module reads (GR-006).** Story-001/002 join `categories` in their own SQL (read of SPEC-003's table, no import of that module). The kernel helper names (`requireUser`, config `CURRENCY`, DB handle, web API client) come from SPEC-001/002 merged code; the implementer adapts imports only. If the web kernel has no fetch client, `api.ts` uses `fetch` with same-origin `/api`.
- **R5 performance.** The 200 ms p95 target on 10,000 rows has no `testing-performance` dialect; T-012/T-020 seed 10,000 rows and assert a generous single-call bound. The verifier judges p95 (QG gate list below).
- **R6 dependency add (SZ-3 spill).** No earlier item adds `recharts` (D-19); Story-003 adds it to `web/package.json` and `pnpm-lock.yaml` through the allowances table (Story-003 already has 5 Impacted Files). Spec-writer may move this to a SPEC-001 enabler later; no stack change.
- **R7 ADR status.** All cited decisions are `Accepted` or `Accepted (assumed)`; D-22 is `Proposed` but affects no item here.
- Logging (D-16/GR-008): handlers log no amounts, descriptions or category names; covered by T-013, T-021.

## Atomic test cases
| Test ID | Item | AC | Level | Description |
|--|--|--|--|--|
| T-001 | Enabler-001 | AC-1 | integration | Boot app via `buildApp`; `GET /api/dashboard/spending` and `/trend` are routed (401, not 404) with no edit to a shared router file |
| T-002 | Enabler-001 | AC-2 | integration | Migrate a db that has `transactions`: index on `(user_id, occurred_on)` named `idx_transactions_dashboard` in `sqlite_master`; second runner pass changes nothing |
| T-003 | Enabler-001 | AC-3 | unit | `month=2026-13`, `months=0`, `months=25`, `end=abc` fail parsing; `months` defaults to 6; unknown query keys rejected |
| T-004 | Enabler-001 | AC-3 | unit | `monthRange('2026-02')` is `2026-02-01`..`2026-03-01`; `2025-12` rolls to `2026-01-01`; leap February 2028 |
| T-005 | Enabler-001 | AC-4 | integration | Generated OpenAPI 3.1 document lists both dashboard paths with query and response schemas |
| T-006 | Story-001 | AC-1 | unit | Service: `totalMinor` equals sum of category rows; rows kept in amount-descending order; amounts are integers |
| T-007 | Story-001 | AC-1 | integration | Seeded 2026-03 expenses: body has `month`, `currency`, `totalMinor`, `categories[{categoryId,name,amountMinor}]` sorted descending, sum matches |
| T-008 | Story-001 | AC-2 | integration | Income-kind transactions and other months (including 2026-02-28 and 2026-04-01 boundaries) are not counted |
| T-009 | Story-001 | AC-3 | integration | Month without expenses returns 200, `totalMinor: 0`, `categories: []` |
| T-010 | Story-001 | AC-4 | integration | Two-user isolation: B gets `totalMinor: 0` and no category name of A in the body (QG-ISOLATION) |
| T-011 | Story-001 | AC-5 | integration | No cookie gives 401; `month=bad` and unknown field give 400 `application/problem+json` with field error |
| T-012 | Story-001 | AC-1 | integration | 10,000 seeded rows answered by one call under a generous bound; query plan uses the `(user_id, occurred_on)` index |
| T-013 | Story-001 | AC-1 | integration | Captured log output of a spending request contains no amounts or category names (GR-008) |
| T-014 | Story-002 | AC-1 | unit | Window builder: `months=6,end=2026-03` yields 2025-10..2026-03, oldest first, across a year boundary |
| T-015 | Story-002 | AC-2 | unit | Gap months are zero-filled with `totalMinor: 0` |
| T-016 | Story-002 | AC-3 | unit | No `months`/`end` gives 6 points ending in the current month (fake clock) |
| T-017 | Story-002 | AC-1 | integration | Seeded expenses over several months: exactly 6 `{month,totalMinor}` points with correct sums and `currency` |
| T-018 | Story-002 | AC-4 | integration | Two-user isolation: B gets all-zero points; A's figures never appear (QG-ISOLATION) |
| T-019 | Story-002 | AC-5 | integration | 401 without session; 400 problem+json for `months=25`, `end=2026-99`; income-kind transactions excluded |
| T-020 | Story-002 | AC-1 | integration | 10,000 seeded rows, `months=24`, answered under a generous bound using the index |
| T-021 | Story-002 | AC-1 | integration | Captured log output of a trend request contains no amounts (GR-008) |
| T-022 | Story-003 | AC-1 | integration | Feature registry exposes a "Dashboard" nav entry for `/dashboard` with current month preselected |
| T-023 | Story-003 | AC-2 | unit | Share percentage (sum of shares consistent, zero total safe) and `Intl` money formatting with response `currency`; no `toFixed`/`parseFloat` |
| T-024 | Story-003 | AC-2 | integration | Mocked data renders a Recharts pie and a table: category, formatted amount, percent, total row |
| T-025 | Story-003 | AC-3 | integration | Changing the month picker refetches `/api/dashboard/spending?month=` and updates chart and table |
| T-026 | Story-003 | AC-4 | integration | Empty month shows the empty-state message with a link to transactions and renders no chart |
| T-027 | Story-003 | AC-5 | integration | Loading state shown while pending; failure shows an error message and Retry refetches |
| T-028 | Story-003 | AC-6 | integration | axe-core reports no violations on the rendered page; month picker has an accessible label |
| T-029 | Story-003 | AC-6 | integration | Every slice appears as a table row; each row carries text/pattern, not colour alone |
| T-030 | Story-004 | AC-1 | integration | Mocked trend renders one chart point per month, oldest first, ending at the selected month |
| T-031 | Story-004 | AC-2 | integration | A table with month and formatted amount is present alongside the chart |
| T-032 | Story-004 | AC-3 | integration | Selector offers 3/6/12 (default 6, labelled); changing it sends the new `months` and updates chart and table |
| T-033 | Story-004 | AC-4 | integration | All-zero points show the trend empty state, no flat chart |
| T-034 | Story-004 | AC-5 | integration | Trend loading and error (with retry) do not blank the category section |
| T-035 | Story-004 | AC-5 | integration | axe-core reports no violations with the trend section rendered |

## Standards coverage
| Standard | Verifier check | Covered by |
|--|--|--|
| api-standards (OpenAPI 3.x, `/docs`, routes match document) | document generated from zod (D-04) lists both routes; Swagger UI served; implemented routes equal documented routes | T-005, verifier:QG-API-CONFORMANCE contract test on `/docs` and `/docs/json` |
| api-standards (errors RFC 9457) | invalid input returns `application/problem+json` | T-011, T-019 |
| security: authorization and data isolation | two-user test, deny by default | T-010, T-018, T-001 |
| security: input validation | zod strict query; parameterised SQL | T-003, T-011, T-019, check:QG-STATIC |
| data: money (ISO 4217) | integer minor units plus `currency`; no floats | T-006, T-007, T-023 |
| data: migrations | forward-only numbered file in range | T-002, verifier:migration file `0080-...` inside 0080-0089 |
| operations: logging | no amounts or descriptions in logs | T-013, T-021 |
| accessibility WCAG 2.2 AA | axe clean, chart table alternative, not colour-only | T-028, T-029, T-031, T-035 |
| supply chain: lockfile and audit | `pnpm-lock.yaml` includes `recharts` | check:QG-LOCK, check:QG-DEPS |

## Gates coverage
| Gate | Covered by |
|--|--|
| QG-ARCH-CONFORMANCE | verifier:compare the Decisions table and Toolchain with package.json and imports |
| QG-TRACE | check:QG-TEST, verifier:check-traceability -Spec SPEC-008 |
| QG-SCOPE | verifier:quality-gate -Spec scoped from this table |
| QG-QUALITY | check:QG-LOCK, check:QG-BUILD, check:QG-LINT, check:QG-TEST, check:QG-COV, check:QG-SECRETS, check:QG-DEPS, check:QG-SAST |
| QG-STATIC | check:QG-STATIC |
| QG-API-CONFORMANCE | T-005, verifier:contract test on `/docs` and `/docs/json` |
| QG-ISOLATION | T-010, T-018 |
| QG-VALIDATION | T-003, T-011, T-019 |
| QG-A11Y | T-028, T-029, T-031, T-035, verifier:visual review of light and dark themes |
| QG-BUGS | verifier:check-run-conformance -Scope bugs |
| QG-PROD-1 | verifier:health and healthchecks unchanged by this spec (SPEC-001 owns them) and no new service |
| QG-PROD-2 | T-013, T-021 |
| QG-PROD-3 | verifier:no env variable added by this spec (it reads CURRENCY only) |
| QG-PROD-4 | verifier:graceful shutdown unchanged by this spec (SPEC-001 owns it) |
| QG-PROD-5 | verifier:migration 0080 is forward-only (rollback doc is SPEC-001 README) |
| QG-PROD-6 | verifier:redeploy docs unchanged by this spec (SPEC-001 owns them) |
| GR-001 | n/a: this spec does not touch compose files or published ports |
| GR-002 | T-010, T-018, static-rules:SR-002, verifier:`requireUser` on both routes |
| GR-003 | static-rules:SR-002 SR-003 |
| GR-004 | T-003, T-011, T-019, verifier:both routes declare a zod `schema` |
| GR-005 | static-rules:SR-004 SR-005 |
| GR-006 | static-rules:SR-006 SR-007 |
| GR-007 | T-006, T-023, static-rules:SR-008 SR-009 |
| GR-008 | T-013, T-021, static-rules:SR-010 |
| GR-009 | n/a: no CSV import or upload in this spec |
| GR-010 | n/a: this spec has no password or session or crypto code |
| GR-011 | n/a: security headers are owned by SPEC-001 and unchanged here |
| GR-012 | verifier:every package of the Decisions table used here is in the manifest and lockfile and imports and no second chart library exists |
| GR-013 | static-rules:SR-014 SR-015 |
| GR-014 | T-002, verifier:migration file name `0080-...` and range 0080-0089 |
| GR-015 | n/a: no configuration or `.env.example` change |
| GR-016 | T-011, static-rules:SR-017 |
| GR-017 | n/a: no Dockerfile change |
| GR-018 | verifier:no rate limiter or csrf or audit or SBOM dependency added |

## Routing

Written by `kcc route` from each item's Complexity, its files, its domain and CR-7 risk. `kcc-run` and the orchestrator read it;
do not edit it by hand (rerun `kcc route`).

| Item | Wave | Tier | Model | Effort | Why |
|--|--|--|--|--|--|
| Enabler-001 | 1 | balanced | claude-sonnet-5-5 | medium | agent default: balanced / medium |
| Story-001 | 2 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (session): effort high |
| Story-002 | 2 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (session): effort high |
| Story-003 | 3 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (token): effort high |
| Story-004 | 4 | balanced | claude-sonnet-5-5 | medium | agent default: balanced / medium |

## Verification Steps
1. `pnpm --filter api test -- dashboard` runs T-001..T-021; `pnpm --filter web test -- dashboard` runs T-022..T-035.
2. `quality-gate -Spec SPEC-008` must exit 0: lockfile, build, typecheck, lint, tests, coverage floor, secrets, `pnpm audit`, SAST, `QG-STATIC` against `architecture/static-rules.tsv` (exit 3 is a deferral, not a pass).
3. `check-traceability -Spec SPEC-008` maps every epic and backlog AC to a passing Test ID.
4. API contract: `GET /docs/json` lists `/api/dashboard/spending` and `/api/dashboard/trend`; Swagger UI at `/docs` answers.
5. Manual: with 10,000 seeded transactions both endpoints answer under 200 ms p95 (epic Measured-by); user B sees none of A's figures.
6. Epic AC-8: confirm no compose, Dockerfile, env or new-service change in the diff.

## Scope
Medium (5 backlog items, 21 files including tests and migration).

## Confidence
Confidence: 93%

Below the 95% threshold because SPEC-005 and SPEC-001 are unmerged: the column name `occurred_on` (R1), kernel helper names (R4) and the workspace root (R3) are confirmed only against specs, not code. PREFLIGHT/IMPLEMENT must re-check R1 against the merged `0050-transactions.sql` before writing SQL.

## Related
- Epic spec: [[SPEC-008-dashboard]]
- Roadmap / token plan: [[../ROADMAP]]
- Idea-specs index: [[../IDEA-001-budgetpal-Specs]]
- All specs: [[../../specs|All specs MOC]]
