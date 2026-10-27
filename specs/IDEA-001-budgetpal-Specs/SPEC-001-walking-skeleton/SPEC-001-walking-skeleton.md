---
id: SPEC-001
title: Walking skeleton
status: Done
depends_on: []
---

# SPEC-001: Walking skeleton

| Priority | Category | Status | Wave | Depends on | Blocks | Index |
|--|--|--|--|--|--|--|
| P0 | Feature | Done | 1 | None | SPEC-002 | [[../IDEA-001-budgetpal-Specs]] |

## Delivery Brief
- **Who:** the budget owner (and the developers of SPEC-002..008, who build on this base).
- **Gets:** `docker compose up --build` starts `api` and `web`; the browser opens `http://127.0.0.1:8080` and shows the API health status. Under it: env config, single-line JSON logs, a migration runner with one table, and auto-registration of API modules and web features (router and nav), so later specs touch no shared file.
- **Value:** proves the whole stack (browser, nginx proxy, Fastify, SQLite on a volume) end to end, and fixes the contracts every later spec plugs into.
- **Measured by:** one `docker compose up --build` leaves both containers healthy, `GET /health` returns 200 with a DB check, and the home page shows "API: ok" with an icon and text.
- **Out of scope:** users, sessions, auth, any domain table (accounts, categories, transactions, budgets), CI pipeline, SBOM, image scan, production-readiness checklist beyond the trimmed QG-PROD items.

## Acceptance Criteria
- [ ] AC-1 - Given a clean checkout, when `docker compose up --build` runs, then `api` and `web` start, both report healthy, and `http://127.0.0.1:8080` shows the API health status from `/api/health`.
- [ ] AC-2 - Given the api is running, when `GET /health` is called, then it returns 200 JSON `{status:"ok", db:"ok"}`; when the database is unusable it returns 503 `application/problem+json` with no stack trace.
- [ ] AC-3 - Given the env, when the api starts, then config is read once and validated by zod (`PORT`, `DATABASE_PATH`, `SESSION_SECRET` optional, `CURRENCY`, `LOG_LEVEL`, `COOKIE_SECURE`); an invalid value exits non-zero naming the variable, never its value; `.env.example` holds names only, `.env` is git-ignored, no default credentials exist.
- [ ] AC-4 - Given any request, when the api logs, then each line is single-line JSON with a request id, and cookies, authorization headers and bodies are never logged.
- [ ] AC-5 - Given an empty database, when the api starts, then the runner applies the numbered SQL files in order, creates the `app_meta` table, records checksums, does nothing on a second start, and refuses to start if an applied file changed.
- [ ] AC-6 - Given a new folder `api/src/modules/<x>/index.ts` or `web/src/features/<x>/feature.ts`, when the app starts, then its router or its route and nav entry is registered with no edit to any shared file.
- [ ] AC-7 - Given an unknown route or an unhandled error, when the api answers, then the body is RFC 9457 `application/problem+json` with no stack trace or internal message.
- [ ] AC-8 - Given a running api, when it receives SIGTERM, then it stops accepting requests, closes the SQLite handle and exits 0.
- [ ] AC-9 - Given the api, when `/docs` and `/docs/json` are requested, then Swagger UI and an OpenAPI 3.1 document listing `/health` are served; api and web responses carry `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and a CSP limited to self.
- [ ] AC-10 - Given the compose file, when inspected and run, then both images run as a non-root user from pinned base tags, ports publish on `127.0.0.1` only, both services have a `healthcheck`, and data in the named volume `budgetpal-data` survives `docker compose down` then `up`.
- [ ] AC-11 - Given the home page, when axe-core runs, then there is no serious or critical violation; the status uses icon and text, not colour alone, in light and dark schemes, and works down to 360 px.
- [ ] AC-12 - Given the root `README.md`, when read, then it gives the run command, the env variable table, how to back up and restore the SQLite file (the rollback path), and the redeploy steps (`docker compose up --build`; the volume persists).

## Backlog
| Key | Type | Title | Status | Depends on | Wave | Files | File |
|--|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | Workspace scaffold and env template | Ready | None | 1 | 4 | [[Backlog/Enabler-001-workspace-scaffold]] |
| Enabler-002 | Enabler | API app, config, JSON logs, errors, module registry, OpenAPI | Ready | Enabler-001 | 2 | 5 | [[Backlog/Enabler-002-api-core]] |
| Enabler-003 | Enabler | Web shell with feature and nav registry | Ready | Enabler-001 | 2 | 5 | [[Backlog/Enabler-003-web-shell]] |
| Enabler-004 | Enabler | SQLite layer, migration runner, startup and shutdown | Ready | Enabler-002 | 3 | 4 | [[Backlog/Enabler-004-db-migrations]] |
| Story-001 | Story | See the API health status on the home page | Ready | Enabler-003, Enabler-004 | 4 | 4 | [[Backlog/Story-001-health-on-home]] |
| Enabler-005 | Enabler | Docker images, compose stack and README | Ready | Story-001 | 5 | 5 | [[Backlog/Enabler-005-docker-compose-readme]] |

## Architecture references
- Decisions: D-01 (modular monolith, registries), D-02, D-03, D-04, D-05, D-11, D-16, D-17, D-18, D-19, D-20, D-21, D-22, D-24 (guardrails GR-001, GR-005, GR-006, GR-008, GR-014..GR-017 in [[../../../architecture/quality-gates]])
- Containers: web (nginx + React SPA), api (Fastify), SQLite database (named volume)
- Architecture Document: [[../../../architecture/architecture]]

## Risks
- Native `better-sqlite3` fails to build in Docker - Debian-slim base, toolchain in the build stage only; `node:sqlite` fallback needs a new Decisions row.
- `/api` prefix: nginx strips `/api` before proxying, so the api serves `/health` at its root; later specs register routes without a prefix.
- Compose bound beyond loopback by a later edit - GR-001 and the compose check in QG-STATIC.
- Test files sit beside the code and are not counted in the per-item `Files` column.
