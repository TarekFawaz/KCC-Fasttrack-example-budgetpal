---
id: SPEC-001-plan
spec: SPEC-001
status: ready
version: 1.0.0
profile: fasttrack
---

# SPEC-001 Implementation Plan

Code root `R` = `src/IDEA-001-budgetpal/`. The backlog's Impacted Files (`api/...`, `web/...`, `docker-compose.yml`, `README.md`, `package.json`) are relative to `R`; every path below is written in full.

## Dependency Check
SPEC-001 has no dependencies (`depends_on: []`); it blocks SPEC-002. Every `Accepted` and `Accepted (assumed)` Decision it uses is settled. D-22 (loopback binding) is `Proposed`, but the human stated the scope and GR-001 applies it. It blocks no item here, so no STOP. It is listed in Risk Flags.

## Architecture Gate Check
Source: `architecture/architecture.md` (fast track: `## Decisions`, `## Toolchain`, embedded C2 diagram; no `arch.md`, no `c4-*.md`).
- C2 containers: **web** (nginx + React SPA; Enabler-003, Story-001, Enabler-005), **api** (Fastify; Enabler-002, Enabler-004, Story-001), **SQLite database** (Enabler-004, volume in Enabler-005).
- Ordering: D-24 scaffold first (Enabler-001); D-01 registries (Enabler-002, Enabler-003) before the first module and feature (Story-001); D-05 migrations (Enabler-004) before `/health` reads `app_meta`; D-21/D-22 compose last so images contain the finished code.
- Stack: pnpm workspace, TypeScript 5, Fastify 5, zod 3, better-sqlite3 12, pino 9, React 18, Vite 5, vitest 2, nginx-unprivileged. Matches D-02..D-05, D-16..D-24; nothing deviates.
- Budgets: API image under 400 MB (Verification Step 9). No NFR file in fast track.
- Gates: QG-ARCH-CONFORMANCE, QG-TRACE, QG-SCOPE, QG-QUALITY, QG-STATIC, QG-API-CONFORMANCE, QG-VALIDATION, QG-A11Y, QG-SMOKE, QG-PROD, QG-BUGS. The per-module gates for isolation, auth and import do not apply: their `Applies to` column is E2-E8, so none is cited.

## Backlog Coverage
| Item | Type | Dialect | Complexity | Wave | Plan coverage | Notes |
|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | devops-cloud | low | 1 | Covered | Workspace, root manifest, lockfile, lint/test config, `.gitignore`, `.env.example` |
| Enabler-002 | Enabler | backend-nodejs | high | 2 | Covered | Config/secret handling, log redaction, error bodies: security-sensitive |
| Enabler-003 | Enabler | frontend-react | medium | 2 | Covered | Registry as a pure function over `import.meta.glob` |
| Enabler-004 | Enabler | backend-nodejs | medium | 3 | Covered | SQL layer under `kernel/db/` (SR-002) |
| Story-001 | Story | frontend-react | low | 4 | Covered | Plus api health module and the checked-in OpenAPI document |
| Enabler-005 | Enabler | devops-cloud | medium | 5 | Covered | Dockerfiles, nginx, compose, README |

## Ordered Changes
1. **Enabler-001** `R/package.json`, `R/pnpm-workspace.yaml`, `R/.gitignore`, `R/.env.example` (+ `R/pnpm-lock.yaml`, `R/eslint.config.js`, `R/vitest.config.ts`, `R/tsconfig.base.json`).
   - Change: root manifest with SemVer `version`, `engines` (`node >=22 <25`, `pnpm >=9`), `packageManager`, `pnpm.onlyBuiltDependencies` (`better-sqlite3`, `esbuild`) so native builds run, scripts `build`/`test`/`lint` (`pnpm -r`), devDeps (vitest 2, eslint, typescript-eslint, `@vitest/coverage-v8`); `.env.example` has the six names with empty values and only comments otherwise.
   - Why: spec AC-3, AC-10 (prereq); Enabler-001 AC-1..3. Depends on: none.
2. **Enabler-002** `R/api/package.json`, `R/api/tsconfig.json`, `R/api/src/kernel/config.ts`, `R/api/src/kernel/log.ts`, `R/api/src/app.ts` (+ allowances).
   - Change: deps `fastify`, `fastify-type-provider-zod`, `zod`, `@asteasolutions/zod-to-openapi`, `@fastify/swagger`, `@fastify/swagger-ui`, `pino`, plus `better-sqlite3` and `@types/better-sqlite3` (installed here because Enabler-004's Impacted Files exclude `api/package.json`), devDeps `tsx`, `vitest`, `typescript`; scripts `dev`, `build` (`tsc`), `start` (`node dist/server.js`), `test`. `@fastify/cookie` is left out (SPEC-002 adds it, GR-012). `loadConfig(env)` parses once with zod (defaults, errors name variables only). `buildApp(config, { db? })` decorates `app.db`, uses `fastify-type-provider-zod` compilers, pino logger with request id and redaction of cookie, authorization and bodies, a not-found/validation/error handler that returns problem+json (no `.stack`, SR-017), `onSend` security headers, `@fastify/swagger` with `openapi: '3.1.0'` and `/docs`, and `modules.ts` auto-loading `src/modules/*/index.ts` (skip with a warning when `index` is missing). No CORS plugin.
   - Why: spec AC-3, AC-4, AC-6, AC-7, AC-9; Enabler-002 AC-1..6. Depends on: 1.
3. **Enabler-003** `R/web/package.json`, `R/web/vite.config.ts`, `R/web/index.html`, `R/web/src/main.tsx`, `R/web/src/kernel/registry.ts` (+ allowances).
   - Change: deps `react`, `react-dom`, `react-router-dom@^6` (the v6 DOM binding of D-19's `react-router@^6`), `@tanstack/react-query`, devDeps `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `axe-core`, `typescript`; `registry.ts` exports `buildRegistry(modules)` (sort by `order`, throw on duplicate `id`) and the `import.meta.glob('../features/*/feature.ts', { eager: true })` call; `Shell.tsx` (header + `nav`, `main`, focus style); `shell.css` tokens for light/dark and a 768 px breakpoint; one `QueryClient`; vite dev proxy `/api` -> `http://127.0.0.1:3000` with the prefix rewritten away; coverage setting in vite config.
   - Why: spec AC-6, AC-11 (shell); Enabler-003 AC-1..4. Depends on: 1.
4. **Enabler-004** `R/api/src/kernel/db/index.ts`, `R/api/src/kernel/db/migrate.ts`, `R/api/migrations/0001-init.sql`, `R/api/src/server.ts`.
   - Change: `openDb(path)` (mkdir parent, WAL, `foreign_keys=ON`); `runMigrations(db, dir)` (names `^\d{4}-[a-z0-9-]+\.sql$`, numeric order, one transaction per file, `_migrations(name, sha256, applied_at)`, checksum mismatch throws naming the file); `0001-init.sql` creates `app_meta`; `server.ts` exports `start()` and `registerShutdown(app, db, exit)` and runs `start()` when executed: config, openDb, migrate, `buildApp(config, { db })`, listen on `PORT` at `0.0.0.0` inside the container, SIGTERM/SIGINT close the server and the db then exit 0, and a migration failure exits non-zero before listening. The SQL files sit in `kernel/db/` rather than the spec's `kernel/db.ts` and `kernel/migrate.ts` because SR-002 allows SQL calls only in `*.repository.ts` and `api/src/kernel/db/` (GR-003); see Risk Flags.
   - Why: spec AC-5, AC-8; Enabler-004 AC-1..5. Depends on: 2.
5. **Story-001** `R/api/src/modules/health/index.ts`, `R/web/src/features/home/feature.ts`, `HomePage.tsx`, `useHealth.ts` (+ `R/api/src/modules/health/health.repository.ts`, `R/api/openapi.json`).
   - Change: health module registers public `GET /health` with a zod response schema `{status, db}`; the repository runs `SELECT 1 FROM app_meta LIMIT 1` through `app.db`; a thrown query returns 503 problem+json with a fixed title and no driver message. `useHealth` fetches `/api/health` with TanStack Query; `HomePage` renders "Checking...", "API: ok" with a check icon, or "API: unavailable" with a warning icon, inside `role="status"`; `feature.ts` exports `{id:'home', path:'/', label:'Home', order:0, component}`. `api/openapi.json` is the checked-in contract (api-standards); a test regenerates it with `UPDATE_OPENAPI=1` and otherwise compares it to the served `/docs/json`.
   - Why: spec AC-1, AC-2, AC-7, AC-9, AC-11; Story-001 AC-1..5. Depends on: 3, 4.
6. **Enabler-005** `R/docker-compose.yml`, `R/api/Dockerfile`, `R/web/Dockerfile`, `R/web/nginx.conf`, `R/README.md` (+ `R/.dockerignore`, `R/web/nginx.conf` health header file if needed).
   - Change: api image on `node:22-bookworm-slim` (build stage installs toolchain, `pnpm install --frozen-lockfile`, `tsc`; runtime copies `dist`, `migrations`, prod `node_modules`; `USER node`; `HEALTHCHECK` using node `fetch` on `/health`). web image: Vite build stage then a pinned `nginxinc/nginx-unprivileged:<x.y>-alpine` runtime (pin an exact tag chosen at implement time), SPA fallback, `/api/` proxy to `http://api:3000/` (prefix stripped), `nosniff`, `Referrer-Policy: no-referrer`, CSP `default-src 'self'`, no CORS header (SR-005). Compose: ports `127.0.0.1:3000:3000` and `127.0.0.1:8080:8080`, `${VAR:-default}` env without secrets, volume `budgetpal-data` at `/data` with `DATABASE_PATH=/data/budgetpal.db`, healthchecks, `depends_on: service_healthy`. README: prerequisites, `cp .env.example .env`, run, env table, backup and restore of the SQLite file (rollback), redeploy.
   - Why: spec AC-1, AC-9, AC-10, AC-12; Enabler-005 AC-1..6. Depends on: 5.

## Waves
Authoritative wave map (overrides the spec's `Wave` column; it matches it).

| Wave | Items | Files | File-disjoint | Notes |
|--|--|--|--|--|
| 1 | Enabler-001 | root manifest and config files | yes (single item) | Scaffold gives `quality-gate` a manifest, lockfile, lint and test config, coverage and `.gitignore` |
| 2 | Enabler-002, Enabler-003 | `api/**` vs `web/**` | yes: `api/` and `web/` trees do not overlap. `pnpm-lock.yaml` is a generated file, regenerated once by `pnpm install` after the wave merge, never hand-merged | Both depend only on Enabler-001 |
| 3 | Enabler-004 | `api/src/kernel/db/**`, `api/migrations/**`, `api/src/server.ts` | yes (single item) | Needs `app.ts` from Enabler-002 |
| 4 | Story-001 | `api/src/modules/health/**`, `api/openapi.json`, `web/src/features/home/**` | yes (single item) | Needs registries and `app_meta` |
| 5 | Enabler-005 | `docker-compose.yml`, Dockerfiles, `web/nginx.conf`, `README.md` | yes (single item) | Packages finished code |

## Dialects Loaded
- `devops-cloud` - Enabler-001, Enabler-005 (compose, Dockerfiles, env template).
- `backend-nodejs` - Enabler-002, Enabler-004 (Fastify, config, SQLite, migrations).
- `frontend-react` - Enabler-003, Story-001 (shell, registry, home page).
- `testing-unit` - mandatory.
- `testing-integration` - mandatory.

## New Files
All under `src/IDEA-001-budgetpal/`: the Impacted Files above plus `pnpm-lock.yaml`, `eslint.config.js`, `vitest.config.ts`, `tsconfig.base.json`, `.dockerignore`, `api/vitest.config.ts`, `api/src/kernel/errors.ts`, `api/src/kernel/modules.ts`, `api/src/kernel/db/*`, `api/src/modules/health/health.repository.ts`, `api/openapi.json`, `web/tsconfig.json`, `web/src/vite-env.d.ts`, `web/src/kernel/Shell.tsx`, `web/src/kernel/shell.css`, and tests under `test/`, `api/test/`, `web/src/**/*.test.tsx`.

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
| pino | ^9 |
| react | ^18 |
| react-dom | ^18 |
| vite | ^5 |
| react-router | ^6 |
| @tanstack/react-query | ^5 |
| vitest | ^2 |
| @testing-library/react | ^16 |
| axe-core | ^4 |
| docker compose | >=2 |

## Wave file allowances
| Item | Paths (backticked, `/**` allowed) |
|--|--|
| any | `src/IDEA-001-budgetpal/pnpm-lock.yaml` |
| Enabler-001 | `src/IDEA-001-budgetpal/test/**`, `src/IDEA-001-budgetpal/eslint.config.js`, `src/IDEA-001-budgetpal/vitest.config.ts`, `src/IDEA-001-budgetpal/tsconfig.base.json` |
| Enabler-002 | `src/IDEA-001-budgetpal/api/test/**`, `src/IDEA-001-budgetpal/api/vitest.config.ts`, `src/IDEA-001-budgetpal/api/src/kernel/errors.ts`, `src/IDEA-001-budgetpal/api/src/kernel/modules.ts` |
| Enabler-003 | `src/IDEA-001-budgetpal/web/src/**/*.test.tsx`, `src/IDEA-001-budgetpal/web/src/**/*.test.ts`, `src/IDEA-001-budgetpal/web/tsconfig.json`, `src/IDEA-001-budgetpal/web/src/vite-env.d.ts`, `src/IDEA-001-budgetpal/web/src/kernel/Shell.tsx`, `src/IDEA-001-budgetpal/web/src/kernel/shell.css`, `src/IDEA-001-budgetpal/web/src/test/**` |
| Enabler-004 | `src/IDEA-001-budgetpal/api/src/kernel/db/**`, `src/IDEA-001-budgetpal/api/test/**` |
| Story-001 | `src/IDEA-001-budgetpal/api/src/modules/health/health.repository.ts`, `src/IDEA-001-budgetpal/api/openapi.json`, `src/IDEA-001-budgetpal/api/test/**`, `src/IDEA-001-budgetpal/web/src/features/home/**` |
| Enabler-005 | `src/IDEA-001-budgetpal/.dockerignore`, `src/IDEA-001-budgetpal/test/**` |

## Risk Flags
- **Path root.** Backlog files name `api/...` and `README.md` without the `src/IDEA-001-budgetpal/` prefix; the plan prefixes them (workspace protocol). The `static-rules.tsv` regexes are anchored `^api/src/...`, `^web/...`, so `quality-gate` must evaluate them relative to `R`. If it scans from the repo root, QG-STATIC would pass vacuously. The verifier confirms the rules match files under `R` (Verification Step 8).
- **Spec Impacted Files vs SR-002/GR-003.** The spec lists `api/src/kernel/db.ts` and `migrate.ts`, but SR-002 allows `.prepare(`/`.exec(` only in `*.repository.ts` and `api/src/kernel/db/`. Plan follows the guardrail: `kernel/db/index.ts` and `kernel/db/migrate.ts`. The health query lives in `health.repository.ts`. Spec-writer should align Enabler-004 and Story-001 Impacted Files.
- **`api/package.json` ownership.** `better-sqlite3` is installed by Enabler-002 for Enabler-004 (listed in Enabler-002's Ordered Change; no library is left to the implementer).
- **Lockfile in a parallel wave.** Wave 2 items both change `pnpm-lock.yaml`; it is regenerated after merge, not merged by hand.
- **D-22 `Proposed`.** Loopback binding is applied as the human's stated scope (GR-001); no item waits on it.
- **react-router.** D-19 names `react-router@^6`; the DOM bindings ship as `react-router-dom@^6`, which depends on `react-router@^6`. The verifier's GR-012 comparison should accept it.
- **Native build.** `better-sqlite3` must compile (or fetch a prebuilt binary) in `node:22-bookworm-slim`; the fallback `node:sqlite` needs a new Decisions row, so stop and re-architect.
- **Windows host.** SIGTERM through `child.kill` does not run handlers on win32. T-022 tests shutdown in-process with an injected `exit`; T-023 spawns the real process only on non-win32, and QG-SMOKE covers the container (`docker stop` sends SIGTERM).
- **Docker/axe in CI.** T-031..T-036 need Docker; without it, `toolchain-preflight` defers them (not passes). jsdom cannot compute colour contrast, so dark-scheme contrast is a verifier visual check.
- **Hidden impact.** SPEC-002..008 add their own `api/migrations/00NN-*.sql`, module and feature folders only; no shared file may be edited by them (checked by AC-6 tests).

## Atomic test cases
| Test ID | Item | AC | Level | Description |
|--|--|--|--|--|
| T-001 | Enabler-001 | AC-1 | unit | Root `package.json`: SemVer `version`, `engines.node` `>=22 <25`, `engines.pnpm` `>=9`; `pnpm-workspace.yaml` lists `api` and `web` |
| T-002 | Enabler-001 | AC-1 | integration | `pnpm-lock.yaml` exists and `pnpm install --frozen-lockfile` exits 0 |
| T-003 | Enabler-001 | AC-2 | unit | `.env.example` holds exactly `PORT`, `DATABASE_PATH`, `SESSION_SECRET`, `CURRENCY`, `LOG_LEVEL`, `COOKIE_SECURE` with empty values |
| T-004 | Enabler-001 | AC-3 | integration | `git check-ignore` matches `.env`, `node_modules/x`, `dist/x`, `data/x.db` |
| T-005 | Enabler-002 | AC-1 | unit | `loadConfig` returns defaults `PORT=3000`, `LOG_LEVEL=info`, `CURRENCY=USD`, `COOKIE_SECURE=false`; valid values parse |
| T-006 | Enabler-002 | AC-1 | unit | Invalid `PORT`, `LOG_LEVEL`, short `SESSION_SECRET` throw an error naming the variable and not containing the value |
| T-007 | Enabler-002 | AC-2 | integration | A request logs one single-line JSON object with a request id; a request with cookie, authorization header and body leaves none of them in the output |
| T-008 | Enabler-002 | AC-3 | integration | A temp module folder with `index.ts` is registered without editing `app.ts`; a folder without `index` is skipped with a warning log |
| T-009 | Enabler-002 | AC-4 | integration | Unknown route 404, invalid body 400 with field errors, thrown error 500 all `application/problem+json`; 500 has generic detail and no stack |
| T-010 | Enabler-002 | AC-5 | integration | Responses carry `nosniff`, `Referrer-Policy: no-referrer`, self-only CSP; no `access-control-allow-origin` |
| T-011 | Enabler-002 | AC-6 | integration | `/docs/json` has `openapi` starting `3.1`; `/docs` returns Swagger UI HTML |
| T-012 | Enabler-003 | AC-1 | unit | `buildRegistry` sorts by `order` and throws on a duplicate `id` |
| T-013 | Enabler-003 | AC-1 | integration | Shell rendered with a fake feature shows its nav link and route content with no shared-file edit |
| T-014 | Enabler-003 | AC-2 | integration | Shell has header, `nav`, `main`; axe reports no serious/critical; `shell.css` has focus style, `prefers-color-scheme: dark` tokens, 768 px breakpoint |
| T-015 | Enabler-003 | AC-3 | unit | Grep over `web/src` (excluding tests): no `dangerouslySetInnerHTML`, `localStorage`, `sessionStorage`; exactly one `QueryClient` |
| T-016 | Enabler-003 | AC-4 | integration | `vite build` exits 0 and emits `dist/index.html`; resolved dev proxy for `/api` rewrites the prefix away |
| T-017 | Enabler-004 | AC-1 | unit | `openDb` on a missing nested folder creates it; `journal_mode` is `wal`, `foreign_keys` is 1 |
| T-018 | Enabler-004 | AC-2 | unit | Runner on an empty temp db applies files in numeric order, creates `app_meta`, records name and SHA-256 in `_migrations`; a failing file rolls back |
| T-019 | Enabler-004 | AC-3 | unit | Re-run applies nothing; edited applied file fails naming the file; a file outside the numbering pattern is rejected |
| T-020 | Enabler-004 | AC-4 | integration | `start()` with a temp db migrates, then listens on `PORT`; `app_meta` exists |
| T-021 | Enabler-004 | AC-4 | integration | Spawned `server.ts` with a bad SQL migration exits non-zero and never listens |
| T-022 | Enabler-004 | AC-5 | integration | `registerShutdown` with an injected `exit`: on SIGTERM and SIGINT the server stops, db closes, exit called with 0 |
| T-024 | Story-001 | AC-3 | unit | `useHealth` with mocked fetch yields loading, success and failure states |
| T-025 | Story-001 | AC-1 | integration | `app.inject('/health')` returns 200 `{status:"ok",db:"ok"}`; `/docs/json` documents `/health` |
| T-026 | Story-001 | AC-2 | integration | With the db closed `/health` returns 503 `application/problem+json` whose body has no driver message or stack |
| T-027 | Story-001 | AC-3 | integration | HomePage shows "Checking...", "API: ok" with check icon, "API: unavailable" with warning icon, all inside `role="status"` |
| T-028 | Story-001 | AC-4 | integration | axe on HomePage in light and dark `matchMedia` schemes: no serious/critical violation |
| T-029 | Story-001 | AC-5 | integration | Real registry lists "Home" at `/` order 0 and no shared file imports the home feature |
| T-030 | Story-001 | AC-1 | integration | Served `/docs/json` equals checked-in `api/openapi.json` (`UPDATE_OPENAPI=1` rewrites it); every route in it is implemented |
| T-032 | Enabler-005 | AC-2 | unit | `docker compose config` / parsed YAML: loopback ports only, `healthcheck` on both services, `${VAR:-default}` env without secret values, volume `budgetpal-data` |
| T-033 | Enabler-005 | AC-3 | unit | Dockerfiles: pinned tags (no `:latest`), `node:22-bookworm-slim`, multi-stage with toolchain only in build stage, non-root `USER` in the last stage |
| T-036 | Enabler-005 | AC-6 | unit | README has headings for prerequisites, `cp .env.example .env`, run command, env table, backup and restore, redeploy |
| T-037 | Enabler-005 | AC-2 | unit | `api` and `web` services publish on `127.0.0.1` for both ports (restating GR-001 for SR-001 evidence) |

## Standards coverage
| Standard | Verifier check | Covered by |
|--|--|--|
| api-standards | Checked-in OpenAPI 3.x document, Swagger UI served, routes match the document | T-011, T-025, T-030, file `api/openapi.json` |
| security (headers, errors, config) | `nosniff`, `Referrer-Policy`, CSP; problem+json without stack; zod env config | T-003, T-006, T-009, T-010, T-034 |
| data (migrations) | Forward-only numbered migrations with checksums, rollback path documented | T-018, T-019, T-036 |
| operations (logging, health, containers) | JSON logs without secrets, `/health` with DB check, non-root pinned images, graceful shutdown | T-007, T-025, T-026, T-033, T-022 |
| supply chain | Committed lockfile, `pnpm audit` | T-002, check:QG-LOCK, check:QG-DEPS |
| accessibility (WCAG 2.2 AA) | axe, no colour-only status | T-014, T-027, T-028 |

## Gates coverage
| Gate | Covered by |
|--|--|
| QG-ARCH-CONFORMANCE | verifier:compare the Decisions and Toolchain tables with `package.json` manifests and imports |
| QG-TRACE | check:QG-TEST, verifier:check-traceability -Spec exits 0 |
| QG-SCOPE | check:QG-TEST |
| QG-QUALITY | check:QG-LOCK, check:QG-BUILD, check:QG-LINT, check:QG-TEST, check:QG-COV, check:QG-SECRETS, check:QG-DEPS, check:QG-SAST |
| QG-STATIC | check:QG-STATIC, T-015, T-037 |
| QG-API-CONFORMANCE | T-011, T-025, T-030 |
| QG-VALIDATION | T-009 |
| QG-A11Y | T-014, T-028, verifier:visual review of the dark theme contrast and 360 px width |
| QG-SMOKE | T-031, T-035, T-037 |
| QG-PROD-1 | T-025, T-026, T-031, T-032 |
| QG-PROD-2 | T-007 |
| QG-PROD-3 | T-003, T-005, T-006, check:QG-SECRETS |
| QG-PROD-4 | T-022, T-023 |
| QG-PROD-5 | T-019, T-036 |
| QG-PROD-6 | T-036 |
| QG-BUGS | verifier:check-run-conformance -Scope bugs |
| GR-001 | static-rules:SR-001, T-037, T-031 |
| GR-002 | n/a: no data routes or user tables here and the only route is the deliberately public health check |
| GR-003 | static-rules:SR-002 SR-003, T-017 |
| GR-004 | T-009, verifier:every route (`/health`) declares a zod `schema` |
| GR-005 | static-rules:SR-005, T-010, T-034 |
| GR-006 | static-rules:SR-006 SR-007, T-008, T-013 |
| GR-007 | static-rules:SR-008 SR-009 |
| GR-008 | static-rules:SR-010, T-007 |
| GR-009 | n/a: no CSV import in this spec |
| GR-010 | n/a: no passwords or tokens in this spec |
| GR-011 | T-010, T-034 |
| GR-012 | verifier:compare the Decisions table with manifests and imports and confirm every package this spec adds is in the lockfile and imported |
| GR-013 | static-rules:SR-014 SR-015, T-015 |
| GR-014 | verifier:only `0001-init.sql` in range 0001-0009 under `api/migrations`, T-018, T-019 |
| GR-015 | static-rules:SR-016, T-003, T-004, T-006 |
| GR-016 | static-rules:SR-017, T-009, T-026 |
| GR-017 | static-rules:SR-018, T-033 |
| GR-018 | verifier:no out-of-scope security dependency or table appears in the manifests and migrations |

## Routing

Written by `kcc route` from each item's Complexity, its files, its domain and CR-7 risk. `kcc-run` and the orchestrator read it;
do not edit it by hand (rerun `kcc route`).

| Item | Wave | Tier | Model | Effort | Why |
|--|--|--|--|--|--|
| Enabler-001 | 1 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (secret): effort high |
| Enabler-002 | 2 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (secret): effort high |
| Enabler-003 | 2 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (token): effort high |
| Enabler-004 | 3 | balanced | claude-sonnet-5-5 | medium | agent default: balanced / medium |
| Story-001 | 4 | balanced | claude-sonnet-5-5 | medium | agent default: balanced / medium |
| Enabler-005 | 5 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (secret): effort high |

## Verification Steps
1. `pnpm install --frozen-lockfile` (T-002, QG-LOCK).
2. `pnpm -r build` and `pnpm lint` (QG-BUILD, QG-LINT).
3. `pnpm test` with coverage at or above `quality.coverage_min_pct` 80 (T-001..T-030, T-032, T-033, T-036, T-037; QG-TEST, QG-COV).
4. `pnpm audit --prod` shows no high-severity advisory (QG-DEPS); gitleaks finds no secret (QG-SECRETS); semgrep (QG-SAST).
5. `UPDATE_OPENAPI=1` once, then confirm `api/openapi.json` is committed and T-030 passes.
6. `docker compose up --build -d`, `docker compose ps` shows both healthy, `curl http://127.0.0.1:8080/api/health` (T-031, T-034, T-035; spec AC-1, AC-10).
7. `docker stop` the api container and check exit code 0 (spec AC-8, QG-PROD-4).
8. Run `quality-gate` and confirm the QG-STATIC rules matched files under `src/IDEA-001-budgetpal/` (Risk Flags).
9. `docker image ls` shows the api image under 400 MB.
10. Verifier visual check: home page in light and dark schemes at 360 px.

## Scope
Large (about 32 files across 6 items).

## Confidence
Confidence: 93%

## Related
- Epic spec: [[SPEC-001-walking-skeleton]]
- Roadmap: [[../ROADMAP]]
- Idea-specs index: [[IDEA-001-budgetpal-Specs]]

## Descoped by human decision (2026-10-27)
The human removed the Docker-registry steps from SPEC-001. These Test IDs are no longer part of the plan, were never run, and are not counted as passes: T-023 (real SIGTERM, win32), T-031 (compose smoke), T-034 (live web proxy and headers), T-035 (volume persistence). The static compose and Dockerfile checks (T-032, T-033, T-037) and the in-process shutdown test (T-022) stay in scope.

