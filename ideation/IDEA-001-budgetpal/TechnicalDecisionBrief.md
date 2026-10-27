# Technical Decision Brief

Fast track, `--silent --assume`, depthlevel 2. Choices marked "human" come from the idea statement; all others are `Assumed under AutoPolicy` from [[.KCC/kernel/protocols/standards-catalog]] defaults.

## Source
- [[idea-001-budgetpal]], [[Research]], [[SpecWriterStarter]]

## Confirmed Decisions
- Human-fixed: TypeScript on Node REST API, SQLite, React + Vite, docker-compose (api + web), local single-user tool, no external services.
- Human exclusions (do not add): CSRF tokens, rate limiting, lockout, audit log, session rotation, proxy-aware IP, SBOM, image scan, production-readiness checklist.
- Money: integer minor units, one currency per install via env (ISO 4217). Dates `YYYY-MM-DD`, timestamps UTC.
- Forward-only numbered migrations, one file per epic. Config from env, `.env.example` lists names only.
- Errors as RFC 9457 `application/problem+json` with field errors. Pagination: offset/limit is acceptable (local scale); recorded as a catalogue deviation.

## Architecture Depth
`standard` is not needed; `lite` (minimal) confirmed. Source: idea file, depthlevel 2 (`Assumed under AutoPolicy`, 90%).

## Architecture Style
Clean Architecture + DDD, scaled down: per module `routes -> service -> repository`, modules under `api/src/modules/<x>` and `web/src/features/<x>`. Chosen by default (backend/fullstack), opt-down not taken; architect records the ADR.

## API Standard
Default accepted: OpenAPI 3.1 generated from the zod schemas (`@asteasolutions/zod-to-openapi`), Swagger UI at `/docs` (`@fastify/swagger` + `@fastify/swagger-ui`), verifier-checked conformance. No `Idempotency-Key` (local tool).

## Tech Stack
- Selected (version ranges): `node >=22 <23` (LTS), `typescript@^5`, `fastify@^5` with `fastify-type-provider-zod`, `zod@^3`, `better-sqlite3@^11` on `node:22-bookworm-slim`, `argon2@^0.41` (bcrypt fallback), `@fastify/cookie`, `@fastify/session`-style SQLite session store (own table), `pino@^9` JSON logs, `csv-parse@^5` (RFC 4180). Web: `react@^18`, `vite@^5`, `react-router@^6`, `@tanstack/react-query@^5`, `recharts@^2`. Tests: `vitest@^2`, `supertest`/Fastify `inject`, `@testing-library/react`, `axe-core` checks. Package manager `pnpm@^9` workspace (`api/`, `web/`).
- Alternatives considered:
  - SQLite driver: `node:sqlite` (no native build, but smaller API, no `transaction()` wrapper, newer) - rejected for API gap; revisit if the native build fails.
  - Framework: Express 5 (largest ecosystem, no built-in schema/OpenAPI) - rejected; NestJS (heavy for 8 small specs) - rejected.
  - Base image: Alpine (smaller, native build risk for argon2/better-sqlite3) - rejected for Debian-slim predictability.
  - Charts: Chart.js (canvas, more imperative) - rejected; Recharts is declarative React.
  - Hashing: bcrypt (acceptable, legacy per catalogue) - fallback only.
  - Database: Postgres (overkill for local single-user) - rejected by human.
- Maintenance/cost notes: all open source, zero run cost; native modules need a build toolchain in the Docker build stage only; pin lockfile and run `pnpm audit` in the gate (no SBOM).

## Candidate Dialects
| Workstream | Dialect | Complexity | Rationale |
|--|--|--|--|
| API | backend-nodejs | low | Fastify + SQLite CRUD and SQL aggregates |
| Web | frontend-react | low | Vite SPA, feature folders |
| Packaging | devops-cloud (compose subset only) | low | two services, no cloud |
| Tests | testing-unit, testing-integration | low | vitest; two-user isolation test is mandatory |

Protocols not selected: mobile, data-engineering (a dashboard over one SQLite DB is not a pipeline), privacy-and-cybersecurity-regions (local, single install, no regional users stated).

## Open Decisions
- Items under `## Open questions` below; defaults in the idea file apply.

## Architecture Risks
- Native module builds (argon2, better-sqlite3) in Docker: mitigated by Debian-slim and a multi-stage build.
- Parallel specs touching shared files: mitigated by E1 auto-registration of routers and nav entries and one migration file per epic. Migration numbering collisions in parallel waves: reserve ranges per epic (E3 0030s, E4 0040s, and so on).
- SQLite file on a docker volume: single writer, fine at this scale; back up by copying the file.
- CSV import: encoding, date formats, large files; cap size (e.g. 5 MB) and rows.

## Candidate ADRs
- Fastify + zod + generated OpenAPI. `better-sqlite3` over `node:sqlite`. Debian-slim images.
- Waivers of catalogue defaults, all human-stated: no CSRF token (SameSite=Lax only), no rate limiting or lockout, no session rotation, no audit log, no SBOM or image scan, offset pagination.
- Auth: argon2id (m>=19 MiB, t=2, p=1), min length 8 password, server-side session in SQLite, `requireUser` plus query scoping by `user_id` in one place.
- Money as integer minor units; dedupe key hash.

## Candidate Guardrails
- Every data query is scoped by `user_id`; parameterised queries only; zod validation at every boundary.
- No floats for money; no secrets or passwords in logs or repo; modules never import from each other's folders except via the shared kernel.
- Cookie flags HttpOnly, SameSite=Lax; `Secure` only when behind TLS (local http).

## Candidate Quality Gates
- Typecheck, lint, vitest with coverage floor from settings, OpenAPI conformance check, two-user isolation test, `pnpm audit` (no high), axe check on pages, `docker compose up` smoke test hitting `/health`. QG-PROD does not apply.

## UX and UI
- Surface: web SPA (React + Vite), desktop-first, usable down to 360 px width.
- Design system: plain CSS modules with CSS variables for tokens; no UI kit (small app). `@radix-ui` primitives only if a dialog or select is needed.
- Theme: light and dark via `prefers-color-scheme`; neutral palette, green (within budget), amber (>=80%), red (over budget); status is never colour-only (icon and text too).
- Accessibility: WCAG 2.2 AA, keyboard reachable, visible focus, contrast >= 4.5:1, labelled inputs, axe in tests; charts get a data table alternative.
- Formatting: `Intl` for currency and dates, currency code from env.
- Responsive: single-column below 768 px, nav collapses to a top menu.
- Pages: sign-up, login, categories, accounts, transactions, import (upload, map, preview, result), budgets, dashboard; empty states and inline validation errors on each.
- Assets: no logo or images required; text and inline SVG icons only.

## Infrastructure and packaging
- Target: local only, `docker compose up` with services `api` (port 3000) and `web` (nginx static on 8080, proxying `/api` to api, so cookies stay same-origin).
- Environments: one (local); `.env.example` with `PORT`, `DATABASE_PATH`, `SESSION_SECRET`, `CURRENCY`, `LOG_LEVEL`, `COOKIE_SECURE`.
- Packaging: two multi-stage Docker images (Debian-slim build and runtime for api, nginx-unprivileged for web), non-root user, pinned base tags, SQLite on a named volume.
- Versioning: SemVer in root `package.json`; Conventional Commits; tags optional.
- Observability floor: single-line JSON logs to stdout with request id (pino); `GET /health` returns 200 `{status}` including a DB check; compose `healthcheck` on both services.
- Not in scope (human): CI pipeline, SBOM, image scan, production-readiness checklist. QG-PROD does not apply.
- Lockfile committed; `pnpm audit` run locally and in the quality gate.

## Architect Handoff
Write ADRs for the candidates above, including the human-stated waivers cited as such; create `architecture/` guardrails and nfrs (usability, maintainability, portability prioritised); fix the module and nav registry contract in E1 and the migration-number ranges so E3||E4 and E6||E7||E8 stay file-disjoint.

## Open questions
1. CSV format: default header-detected `date`, `description`, `amount` (signed), optional `account`/`category`, with a column-mapping step; date formats ISO and `DD/MM/YYYY`/`MM/DD/YYYY` chosen at mapping. Confirm? -> **Assumed: confirmed**, see [[Assumptions]].
2. Currency: a single currency per install via `CURRENCY` env (default `USD`)? Confirm the code. -> **Assumed: confirmed, default `USD`**, see [[Assumptions]].
3. Budget thresholds: warn at 80%, over budget above 100%, no rollover? -> **Assumed: confirmed**, see [[Assumptions]].
4. Income and transfers: category kind `expense|income`, dashboard counts expenses only, no transfers in v1? -> **Assumed: confirmed**, see [[Assumptions]].
5. Sign-up: open registration with several isolated local users (default), or one user only? -> **Assumed: open registration**, see [[Assumptions]].

## Confidence
Confidence: 88%

## Related
- Idea: [[idea-001-budgetpal]]
- Architecture governance: [[.KCC/kernel/protocols/architecture-governance]]
- Architecture styles: [[.KCC/kernel/protocols/architecture-styles]]
- API standards: [[.KCC/kernel/protocols/api-standards]]
- Dialect registry: [[.KCC/kernel/protocols/dialects/dialect-registry]]
