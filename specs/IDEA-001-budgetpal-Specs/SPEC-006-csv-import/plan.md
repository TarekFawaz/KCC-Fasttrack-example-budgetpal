---
id: SPEC-006
title: SPEC-006 Implementation Plan
status: ready
version: 1.0.0
profile: fasttrack
depthlevel: 2
---

# SPEC-006 Implementation Plan

## Dependency Check
- SPEC-006 `depends_on: [SPEC-005]`; SPEC-005 needs SPEC-001 (scaffold, `buildApp`, module auto-registry, migration runner on `api/migrations/`, web shell), SPEC-003 and SPEC-004 (categories, accounts). No `plan.md` or code exists yet for any of them in this lane, so this plan targets their declared contracts: `transactions` table from `api/migrations/0050-transactions.sql` (`user_id`, `account_id`, `category_id`, `occurred_on`, `amount_minor` INTEGER, `description`, `created_at`, `updated_at`), `requireUser`, the kernel db/config/log modules. IMPLEMENT waits until those specs are APPROVED. No blocker for planning.
- Migration folder confirmed from SPEC-001 Enabler-004: `api/migrations/` (the spec's open risk is closed).

## Architecture Gate Check
- Stack conformance: Node 22/24, TypeScript 5, Fastify 5 + zod (D-03), better-sqlite3 12 (D-05), `csv-parse@^5` and `@fastify/multipart@^9` (D-14), React 18 + TanStack Query + CSS modules (D-19), vitest 2, Testing Library, axe-core (D-23). No deviation; no new library.
- C4 (embedded in `architecture.md`): containers Web, API, SQLite database; CSV flow flowchart (cap, parse, map, validate, preview, confirm, per-user transaction, dedupe, result). Order follows it: pure pipeline and repository first, preview route, commit route.
- Decisions applied: D-05, D-08, D-10, D-11, D-13, D-14, D-16, D-19, D-20, D-23. All `Accepted`/`Accepted (assumed)`; D-22 is `Proposed` but only affects compose, which this spec does not touch.
- Performance budget: 5000-row import < 10 s (T-029). NFR: no floats for money.
- Gates: QG-ARCH-CONFORMANCE, QG-TRACE, QG-SCOPE, QG-QUALITY, QG-STATIC, QG-API-CONFORMANCE, QG-ISOLATION, QG-VALIDATION, QG-IMPORT, QG-A11Y, QG-PROD, QG-BUGS

## Backlog Coverage
| Item | Type | Dialect | Complexity | Wave | Plan coverage | Notes |
|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | backend-nodejs, testing-unit | high | 1 | Covered | untrusted input parsing; adds `csv-parse`, `@fastify/multipart` |
| Enabler-002 | Enabler | backend-nodejs, testing-integration | high | 1 | Covered | SQL on financial data; migration 0060 |
| Story-001 | Story | backend-nodejs, testing-integration | high | 2 | Covered | file upload, authz |
| Story-003 | Story | frontend-react, testing-unit | medium | 2 | Covered | mocks API against Enabler-001 schemas |
| Story-002 | Story | backend-nodejs, testing-integration | high | 3 | Covered | bulk write, dedupe, timing |

## Ordered Changes
Paths follow the architecture workspace (`api/`, `web/`), as the backlog Impacted Files do (see Risk Flags R-1).
1. **Enabler-001** `api/package.json`, `pnpm-lock.yaml` - add `csv-parse@^5`, `@fastify/multipart@^9`; install. Why: D-14, no unnamed deps.
2. **Enabler-001** `api/src/modules/import/import.parser.ts` - `parseCsv(buffer)`: UTF-8 strict decode (fatal `TextDecoder`), BOM strip, byte cap 5 MB, row cap 5000, `csv-parse` sync, header detection; typed `ImportError` (code to 400). AC-1, AC-2.
3. **Enabler-001** `import.rows.ts` - mapping + date format (ISO, DD/MM/YYYY, MM/DD/YYYY, real-calendar check) + amount to integer minor units by string arithmetic (single `.` or `,`, at most 2 decimals, optional sign; no parseFloat/toFixed) + description (trim, 1-200); returns `{line, ok|reason}` with 1-based file line. AC-3, AC-4.
4. **Enabler-001** `import.dedupe.ts` - `normaliseDescription` (trim, collapse whitespace, lowercase), `dedupeKey` = sha256 over `userId|accountId|date|amountMinor|normalised`. AC-5.
5. **Enabler-001** `import.schemas.ts` - strict zod request (mapping, dateFormat, accountId, category fields per A-1) and response (preview, commit) schemas, registered for OpenAPI. AC-6.
6. **Enabler-002** `api/migrations/0060-import-dedupe.sql` - `ALTER TABLE transactions ADD COLUMN dedupe_key TEXT`; `CREATE UNIQUE INDEX ... ON transactions(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL`. INTEGER-only, forward-only, range 0060-0069.
7. **Enabler-002** `import.repository.ts` - `accountBelongsToUser`, category ownership/kind lookup (A-1), `insertBatch(userId, accountId, rows)` in one `db.transaction`, `INSERT ... ON CONFLICT DO NOTHING`, per-row inserted/duplicate via `changes`; own SQL only, no import of the transactions module (GR-006).
8. **Story-001** `import.service.ts` (preview use case), `import.routes.ts` (`POST /import/preview`, `requireUser`, multipart in memory with `limits.fileSize` 5 MB), `index.ts` (module plugin). Preview writes nothing. AC-1..AC-6.
9. **Story-003** `web/src/features/import/importApi.ts`, `ImportPage.tsx`, `ImportPage.module.css`, `feature.ts`. Depends on Enabler-001 schemas only (API mocked in tests).
10. **Story-002** `import.service.ts` (commit: re-parse same bytes with same code, validate, hash, `insertBatch`, counts), `import.routes.ts` (`POST /import/commit`). Depends on steps 2-8.

## Waves
| Wave | Items | Files | File-disjoint | Notes |
|--|--|--|--|--|
| 1 | Enabler-001, Enabler-002 | api/src/modules/import/{import.parser,import.rows,import.dedupe,import.schemas}.ts + parser.test; api/migrations/0060-import-dedupe.sql, import.repository.ts + test | yes | only Enabler-001 touches `api/package.json` and the lockfile |
| 2 | Story-001, Story-003 | api `index.ts`, `import.routes.ts`, `import.service.ts`, preview test; `web/src/features/import/*` | yes | api vs web trees |
| 3 | Story-002 | `import.routes.ts`, `import.service.ts`, commit test | yes | alone in its wave; it extends files created in wave 2 |

## Dialects Loaded
- `backend-nodejs` - Fastify routes, services, repository, migration.
- `frontend-react` - Import page, TanStack Query, CSS modules, a11y.
- `testing-unit` - mandatory (Enabler-001, Story-003).
- `testing-integration` - mandatory (Enabler-002, Story-001, Story-002).
- `testing-performance`, `testing-security` - not loaded; the 5000-row timing is an assertion inside an integration test (T-029).

## New Files
All paths in the Backlog Impacted Files: 5 (Enabler-001) + 3 (Enabler-002) + 4 (Story-001) + 5 (Story-003) + Story-002's `import.commit.test.ts`. Plus fixtures under `api/test/import/` (see allowances). No docs: the root README is SPEC-001's.

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
| @fastify/cookie | ^11 |
| @fastify/multipart | ^9 |
| better-sqlite3 | ^12 |
| pino | ^9 |
| csv-parse | ^5 |
| react | ^18 |
| react-dom | ^18 |
| vite | ^5 |
| react-router | ^6 |
| @tanstack/react-query | ^5 |
| vitest | ^2 |
| @testing-library/react | ^16 |
| axe-core | ^4 |

## Wave file allowances
| Item | Paths |
|--|--|
| Enabler-001 | `api/package.json`, `pnpm-lock.yaml` |
| Story-001 | `api/test/import/**` |
| Story-002 | `api/test/import/**` |

## Risk Flags
- **R-1 Paths.** The spec-writer prefix rule says `src/IDEA-{ID}-{slug}/...`, but the architecture (D-01), the static rules (`^api/src/`, `^web/src/`) and the SPEC-001 workspace fix `api/` and `web/` at the repo root. The plan follows the architecture and the backlog files; the wave-scope gate must read those roots.
- **R-2 PLANNING BLOCKER, spec gap (category and sign).** SPEC-005 stores `amount_minor` positive only, direction comes from the category kind, and `POST /transactions` requires an own category (`category_id` has an FK; its NOT NULL is not stated). SPEC-006 has no category input, yet signed CSV amounts (`-12.50`) must be inserted. Plan assumes **A-1**: preview/commit also take optional `expenseCategoryId` and `incomeCategoryId` (own categories of kind expense/income, checked in the repository); a negative row needs the expense one, a positive row the income one, else the row is reported invalid ("no category chosen"); amount stored as `abs`, dedupe key uses the signed value. This touches Enabler-001 schemas, Enabler-002 repository, both routes and the Story-003 selects, all inside existing Impacted Files, but adds behaviour beyond the written ACs. Needs spec-writer/human confirmation; if SPEC-005 makes `category_id` nullable, A-1 shrinks to the sign rule. Confidence reflects this.
- R-3 Manual transactions have `dedupe_key` NULL, so a manual entry is not matched by an import (accepted by the spec).
- R-4 Vitest include pattern must cover `api/src/**/*.test.ts` (backlog co-locates tests; SPEC-001 says `api/test/`); confirm in the SPEC-001 scaffold, else add to Enabler-001 allowances.
- R-5 Memory: 5 MB buffer plus 5000 parsed rows per request; bounded by caps; single writer SQLite, batch in one transaction.
- R-6 Multipart limit exceeded must map to 400 problem+json (not the plugin's 413); the route handler converts it.
- R-7 No `Proposed` ADR affects this spec.

## Atomic test cases
| Test ID | Item | AC | Level | Description |
|--|--|--|--|--|
| T-001 | Enabler-001 | AC-1 | unit | quoted commas/quotes, CRLF, BOM, empty file parse to headers + rows; header detected |
| T-002 | Enabler-001 | AC-2 | unit | 5001 rows, >5 MB, invalid UTF-8 each throw typed error mapping to 400 |
| T-003 | Enabler-001 | AC-3 | unit | ISO, DD/MM, MM/DD convert to YYYY-MM-DD; 31/02 and wrong format invalid; error carries 1-based line |
| T-004 | Enabler-001 | AC-4 | unit | `-12.50`->-1250, `12,5`->1250, `1000`->100000 exact integers |
| T-005 | Enabler-001 | AC-4 | unit | 3 decimals, `abc`, `1.234,56` invalid; empty description invalid |
| T-006 | Enabler-001 | AC-5 | unit | key equal for case/whitespace variants; differs when user, account, date, amount or description changes |
| T-007 | Enabler-001 | AC-6 | unit | request schema rejects extra fields; response schemas parse sample; registered in OpenAPI registry |
| T-008 | Enabler-002 | AC-1 | integration | migrate temp db holding SPEC-005 rows: `dedupe_key` exists, partial unique index present, old rows untouched |
| T-009 | Enabler-002 | AC-2 | integration | `accountBelongsToUser` true for owner, false for other user and unknown id |
| T-010 | Enabler-002 | AC-3 | integration | `insertBatch` with in-batch and cross-batch duplicates returns per-row inserted/duplicate |
| T-011 | Enabler-002 | AC-3 | integration | forced failure mid-batch rolls back every row |
| T-012 | Enabler-002 | AC-4 | integration | same row for users A and B stores two rows |
| T-013 | Enabler-002 | AC-5 | integration | migration text has no REAL/FLOAT/DECIMAL; repository source uses placeholders only; no `.prepare` outside `*.repository.ts` in module |
| T-014 | Enabler-002 | AC-2 | integration | category ownership/kind lookup (A-1) true only for own expense/income category |
| T-015 | Story-001 | AC-1 | integration | `inject` multipart with mapping: headers, suggested mapping, valid/invalid counts, first 20 valid rows, invalid by line with reason |
| T-016 | Story-001 | AC-2 | integration | no `mapping`: headers + suggested mapping by header names, no rows validated |
| T-017 | Story-001 | AC-3 | integration | `transactions` count unchanged; no fs write call (spy on `node:fs`) |
| T-018 | Story-001 | AC-4 | integration | no cookie returns 401 |
| T-019 | Story-001 | AC-4 | integration | other user's `accountId` returns 404, A's data unchanged |
| T-020 | Story-001 | AC-5 | integration | 6 MB, 5001 rows, missing column, malformed multipart: 400 problem+json with field errors, no stack |
| T-021 | Story-001 | AC-6 | integration | `/docs/json` lists `/import/preview` |
| T-022 | Story-001 | AC-6 | integration | captured pino output holds no CSV text, descriptions or amounts |
| T-023 | Story-002 | AC-1 | integration | 10-row file: `{imported, skipped, invalid, invalidRows}` correct; `=SUM(A1)` description stored verbatim |
| T-024 | Story-002 | AC-2 | integration | same file twice: second `imported` 0, `skipped` = valid rows; in-file duplicate counted skipped |
| T-025 | Story-002 | AC-3 | integration | 2 invalid of 10: 8 inserted, invalid reported by line, never inserted |
| T-026 | Story-002 | AC-4 | integration | foreign `accountId` returns 404, nothing written |
| T-027 | Story-002 | AC-4 | integration | users A and B import same rows: each keeps own rows, neither sees the other's |
| T-028 | Story-002 | AC-5 | integration | oversize returns 400 problem+json, no cookie returns 401, nothing written |
| T-029 | Story-002 | AC-6 | integration | 5000-row commit under 10 s; rows visible in `GET /transactions` by account and month |
| T-030 | Story-002 | AC-7 | integration | logs hold counts and request id only; route in OpenAPI document |
| T-031 | Story-003 | AC-1 | unit | "Import" nav entry from `feature.ts`; empty state shows picker, 5 MB / 5000-row limits, UTF-8 note |
| T-032 | Story-003 | AC-2 | unit | selects prefilled from suggested mapping; changing one re-requests preview |
| T-033 | Story-003 | AC-3 | unit | valid rows table, invalid lines with reason; Import disabled with zero valid rows |
| T-034 | Story-003 | AC-4 | unit | result shows imported/skipped/invalid as text with icon, invalid lines, link to transactions |
| T-035 | Story-003 | AC-5 | unit | 400 and 404 show inline field error; HTML and `=SUM(A1)` in a cell render as text |
| T-036 | Story-003 | AC-6 | unit | axe finds no violations on empty, mapping, preview and result steps |
| T-037 | Story-003 | AC-6 | unit | every control labelled; tab order; focus moves to preview and result headings |

## Standards coverage
| Standard | Verifier check | Covered by |
|--|--|--|
| api-standards (D-04) | OpenAPI 3.1 generated from zod, routes listed, responses match | T-007, T-021, T-030, check:QG-TEST |
| api-standards errors (RFC 9457) | problem+json with field errors, no stack | T-020, T-028 |
| CSV import (RFC 4180, D-14) | caps, UTF-8, header, per-row errors, dedupe | T-001, T-002, T-005, T-024 |
| Data: money (ISO 4217, D-13) | integer minor units, no floats | T-004, T-005, T-013 |
| Data: migrations (D-05) | forward-only, numbered, in range | T-008, T-013, verifier:file name `0060-*` inside 0060-0069 |
| Security: authz and isolation (D-08) | `requireUser`, user scoping, 404 cross-user | T-009, T-012, T-018, T-019, T-026, T-027 |
| Security: input validation (D-10) | strict zod, parameterised SQL, plain-text cells | T-007, T-020, T-023, T-035 |
| Operations: logging (D-16) | no CSV/descriptions/amounts logged | T-022, T-030 |
| Accessibility WCAG 2.2 AA (D-20) | axe, labels, focus, status not colour-only | T-034, T-036, T-037, verifier:page at 360 px |
| Supply chain (D-24) | lockfile committed, audit clean | check:QG-LOCK, check:QG-DEPS |

## Gates coverage
| Gate | Covered by |
|--|--|
| QG-ARCH-CONFORMANCE | verifier:compare Decisions table with manifests and imports |
| QG-TRACE | check:QG-TEST |
| QG-SCOPE | check:QG-TEST, verifier:plan Gates coverage run by quality-gate -Spec |
| QG-QUALITY | check:QG-BUILD, check:QG-LINT, check:QG-TEST, check:QG-COV, check:QG-LOCK, check:QG-SECRETS, check:QG-DEPS, check:QG-SAST |
| QG-STATIC | check:QG-STATIC |
| QG-API-CONFORMANCE | T-007, T-021, T-030 |
| QG-ISOLATION | T-009, T-012, T-019, T-026, T-027 |
| QG-VALIDATION | T-007, T-020, T-028 |
| QG-IMPORT | T-002, T-023, T-024, T-025, T-035 |
| QG-A11Y | T-036, T-037, verifier:360 px single-column and contrast in light and dark |
| QG-PROD-1 | verifier:owned by SPEC-001 and unchanged (spec AC-9 n/a) |
| QG-PROD-2 | T-022, T-030 |
| QG-PROD-3 | verifier:no new env variable and config owned by SPEC-001 (spec AC-9 n/a) |
| QG-PROD-4 | verifier:owned by SPEC-001 (spec AC-9 n/a) |
| QG-PROD-5 | T-008, verifier:forward-only migration and the SPEC-001 README documents the DB file restore |
| QG-PROD-6 | verifier:owned by SPEC-001 (spec AC-9 n/a) |
| QG-BUGS | verifier:check-run-conformance -Scope bugs |
| GR-001 | n/a: no compose change |
| GR-002 | static-rules:SR-002, T-009, T-019, T-026 |
| GR-003 | static-rules:SR-002 SR-003, T-013 |
| GR-004 | T-007, T-020, verifier:every import route has a zod `schema` |
| GR-005 | static-rules:SR-004 SR-005, n/a: no cookies set by this spec |
| GR-006 | static-rules:SR-006 SR-007 |
| GR-007 | static-rules:SR-008 SR-009, T-004, T-013 |
| GR-008 | static-rules:SR-010, T-022, T-030 |
| GR-009 | static-rules:SR-011 SR-012, T-002, T-017, T-024 |
| GR-010 | n/a: no password hashing or token ids in this spec |
| GR-011 | n/a: headers come from the SPEC-001 app factory |
| GR-012 | verifier:compare Decisions table with manifests and imports (csv-parse and multipart used and no second parser) |
| GR-013 | static-rules:SR-014 SR-015, T-035 |
| GR-014 | T-008, verifier:migration name inside range 0060-0069 and no applied file edited |
| GR-015 | n/a: no env or secrets change |
| GR-016 | static-rules:SR-017, T-020 |
| GR-017 | n/a: no Dockerfile change |
| GR-018 | verifier:no CSRF or throttle or audit table or SBOM dependency added |

## Routing

Written by `kcc route` from each item's Complexity, its files, its domain and CR-7 risk. `kcc-run` and the orchestrator read it;
do not edit it by hand (rerun `kcc route`).

| Item | Wave | Tier | Model | Effort | Why |
|--|--|--|--|--|--|
| Enabler-001 | 1 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; complexity high: effort high |
| Enabler-002 | 1 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; complexity high: effort high |
| Story-001 | 2 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (authz): effort high |
| Story-003 | 2 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (token): effort high |
| Story-002 | 3 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; complexity high: effort high |

## Verification Steps
1. `pnpm install --frozen-lockfile` then `pnpm -r build`, `pnpm -r lint`, `pnpm -r test` (all T-001..T-037).
2. `quality-gate -Spec SPEC-006` green (QG-LOCK, BUILD, LINT, TEST, COV >= 80, SECRETS, DEPS, SAST, STATIC).
3. Wave gate per wave: `check-wave-scope -Spec SPEC-006 -Wave N`.
4. Manual-by-verifier: re-import of the same file reports 0 imported (T-024); 5000 rows under 10 s (T-029); page at 360 px, keyboard only, light and dark.
5. `check-traceability -Spec SPEC-006` exits 0 (every AC has a passing Test ID).

## Scope
Large (22 files: 17 backlog files plus fixtures, lockfile, manifest).

## Confidence
Confidence: 82%
Below the 95% threshold only because of R-2: the category and sign handling is a spec gap resolved here by assumption A-1; confirm it (or amend SPEC-005/SPEC-006) before IMPLEMENT.

## Related
- Epic spec: [[SPEC-006-csv-import]]
- Architecture: [[../../../architecture/architecture]]
- Idea-specs index: [[../IDEA-001-budgetpal-Specs]]
