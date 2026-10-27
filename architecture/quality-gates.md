---
title: "Quality Gates and Guardrails - BudgetPal"
aliases:
  - quality-gates
tags:
  - architecture
  - quality-gates
  - guardrails
  - kcc/v04
created: 2026-10-27
updated: 2026-10-27
version: 0.1.0
status: active
profile: fasttrack
idea-id: IDEA-001
---

# Quality Gates and Guardrails - BudgetPal

Fast-track profile: the guardrails and gates live in this one file. Decisions they come from are the `D-nn` rows in [[architecture]] `## Decisions`. The planner maps every gate it cites and every `GR-nnn` to something runnable in the plan's `## Gates coverage`; the verifier enforces them.

## Guardrails

Design constraints that later agents obey unless `architecture.md -> ## Decisions` is changed first. "Enforced by" names the `static-rules.tsv` rule ids that `quality-gate` QG-STATIC runs, plus the test or verifier step where a pattern cannot catch the rule.

| ID | Guardrail | Applies to | Decision | Enforced by | Status |
|--|--|--|--|--|--|
| GR-001 | Publish the `api` and `web` ports on `127.0.0.1` only (`127.0.0.1:3000:3000`, `127.0.0.1:8080:8080`). Exposing the app to a network reopens every human-waived control and region selection | `docker-compose*.yml` | D-22 | static-rules: SR-001; QG-SMOKE | active |
| GR-002 | Every data route sits behind `requireUser`; every repository function takes `userId` and every query is scoped by `user_id`; foreign keys (account, category) are checked to belong to the user on write; cross-user access returns 404 | `api/src/modules/*` | D-08 | static-rules: SR-002; QG-ISOLATION (two-user test per module); verifier: route list has `requireUser` on every non-public route | active |
| GR-003 | SQL runs only in `*.repository.ts` files, the migration runner and the kernel db module; parameterised queries only, never string-built SQL | `api/src` | D-08, D-10 | static-rules: SR-002, SR-003 | active |
| GR-004 | Every route declares a zod schema for body, params and query; bodies are `.strict()`; invalid input returns 400 problem+json with field errors and writes nothing | `api/src/modules/*` | D-03, D-10, D-11 | QG-VALIDATION (test per module); verifier: every route has `schema` | active |
| GR-005 | Session cookies are `HttpOnly` + `SameSite=Lax` (`Secure` from `COOKIE_SECURE`); no state-changing GET; no CORS plugin or `Access-Control-Allow-Origin`; the web reaches the api same-origin through the nginx proxy | `api/src`, `web/nginx.conf` | D-07 | static-rules: SR-004, SR-005; test: cookie attributes | active |
| GR-006 | Modules never import from another module's folder; shared code comes only from `api/src/kernel/`, `web/src/kernel/` and the shared UI kit `web/src/components/ui/` (D-25) | `api/src/modules/*`, `web/src/features/*` | D-01, D-25 | static-rules: SR-006, SR-007 | active |
| GR-007 | No floating point for money: integer minor units end to end; no `REAL`/`FLOAT`/`DECIMAL` money columns; no `parseFloat` or `toFixed` on amounts; display through `Intl` | `api/src`, `web/src`, migrations | D-13 | static-rules: SR-008, SR-009 | active |
| GR-008 | Never log passwords, hashes, session ids, cookies, CSV content or transaction descriptions and amounts; log through the pino allow-list serializers | `api/src` | D-16 | static-rules: SR-010; test: log output of login and import | active |
| GR-009 | CSV import is bounded (5 MB, 5000 rows), validated per row, deduped by a unique index inside a per-user transaction; the upload is never written to disk; cells are stored and rendered as plain text; no CSV export | `api/src/modules/*` | D-14 | static-rules: SR-011, SR-012; QG-IMPORT test | active |
| GR-010 | Password hashing only through `argon2` with the stated parameters (bcrypt only as the documented build fallback); no custom crypto, no MD5/SHA-1, no `Math.random` for ids or tokens; session ids from `crypto.randomBytes(32)` and stored hashed | `api/src` | D-06, D-07 | static-rules: SR-013; test: `$argon2id$` prefix | active |
| GR-011 | Security headers on api and web responses: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, CSP restricted to self; HSTS only when TLS is in front | `api/src`, `web/nginx.conf` | D-20 | test: response headers on api and web | active |
| GR-012 | Declared libraries are the ones used: the `## Decisions` and `## Toolchain` entries match `package.json` and the imports (no second HTTP framework, validator, ORM, hashing or chart library) | `api/`, `web/` | D-02, D-03, D-19 | QG-ARCH-CONFORMANCE; verifier: compare Decisions table with manifests and imports | active |
| GR-013 | Frontend never uses `dangerouslySetInnerHTML` and never keeps tokens, sessions or any data in `localStorage` or `sessionStorage` | `web/src` | D-10, D-19 | static-rules: SR-014, SR-015 | active |
| GR-014 | Migrations are forward-only, numbered, one file per epic inside the epic's reserved range (E1 0001-0009, E2 0010-0019, E3 0030-0039, E4 0040-0049, E5 0050-0059, E6 0060-0069, E7 0070-0079, E8 0080-0089); no edit of an applied migration | `api/migrations` | D-05 | verifier: migration file names and ranges per spec | active |
| GR-015 | Configuration only from environment; `.env.example` lists names with empty values; `.env` is git-ignored; no default credentials or seeded users | repo root, `api/src` | D-17 | static-rules: SR-016; QG-SECRETS | active |
| GR-016 | No stack traces or internal messages in client responses; errors are RFC 9457 problem+json | `api/src` | D-11 | static-rules: SR-017; test: 500 body | active |
| GR-017 | Containers run as a non-root user with pinned base tags | `api/Dockerfile`, `web/Dockerfile` | D-21 | static-rules: SR-018; verifier: Dockerfile `USER` | active |
| GR-018 | No security scope beyond the waivers table: no CSRF tokens, rate limiter, lockout, audit log, SBOM or image-scan pipeline, unless GR-001 is lifted by a new Decisions row | whole repo | D-22 | verifier: no such dependency or table appears | active |

## Quality gates

Gates copied from the framework catalogue that apply here, plus project gates. Evidence is mechanical where possible.

| ID | Gate | Evidence required | Applies to | Decision | Status |
|--|--|--|--|--|--|
| QG-ARCH-CONFORMANCE | The implemented stack matches the `## Decisions` and `## Toolchain` of `architecture.md` | Declared vs implemented language, framework, API style, persistence, UI libraries; verifier compares manifests and imports | every spec | D-01..D-24 | active |
| QG-ARCH-DOCS | `architecture.md` is a narrative document with embedded C1/C2 mermaid blocks, `## Decisions`, `## Toolchain`; no `.mmd`, no `architecture/diagrams/`, no ADR folder | `check-run-conformance -Scope architecture -RunProfile fasttrack` exits 0 (no critic loop under fast track) | run | D-01 | active |
| QG-TRACE | Every acceptance criterion is proven by a passing test | `check-traceability -Spec` exits 0 | every spec | - | active |
| QG-SCOPE | The gate runs what the plan's `## Gates coverage` declares | `quality-gate -Spec` scopes from the plan; uncovered checks report as out of scope | every spec with code | - | active |
| QG-QUALITY | Typecheck, lint, tests, coverage floor from `.KCC/settings.json` (`quality.coverage_min_pct`), committed lockfile, secrets scan, `pnpm audit` with no high-severity production advisory, SAST per settings | `quality-gate -Spec` exits 0 (exit 3 is a deferral, not a pass) | every spec with code | D-24 | active |
| QG-STATIC | The pattern-checkable guardrails hold | `quality-gate` check `QG-STATIC` runs every rule of `architecture/static-rules.tsv` (columns `id`, `files`, `forbidden`, `allowed_in`, `message`); a hit is a failure | every spec with code | GR-001..GR-017 | active |
| QG-API-CONFORMANCE | The API matches its OpenAPI 3.1 contract: the document is served, Swagger UI answers at `/docs`, and every route's responses validate against it | Contract test on `/docs` and `/docs/json`, schema validation of sampled responses | specs with an API | D-04 | active |
| QG-ISOLATION | Cross-user isolation holds in every module | Two-user test per module: user B gets 404 on user A's read, update and delete, and sees none of A's rows in lists and aggregates (dashboard, budgets) | E3-E8 | D-08 | active |
| QG-VALIDATION | Invalid input is rejected and nothing is written | Per module: invalid or unknown-field input returns 400 with a field-level error; table unchanged | every spec with an API | D-03, D-11 | active |
| QG-AUTH | Credential handling follows the decisions | Hash starts with `$argon2id$`; short (< 15) or common password returns 400; wrong password and unknown email return the same message; cookie is `HttpOnly` + `SameSite=Lax`; logout deletes the server-side row; expired session returns 401 | E2 | D-06, D-07 | active |
| QG-IMPORT | CSV import is safe and idempotent | Oversize file and row cap rejected; malformed rows reported by line; re-import adds nothing; `=SUM(A1)` stored and rendered as plain text | E6 | D-14 | active |
| QG-A11Y | Pages meet WCAG 2.2 AA | axe-core check with no serious or critical violation on every page; charts have a table alternative; status shown by icon and text, not colour alone | specs with UI | D-20 | active |
| QG-SMOKE | The compose stack starts and reports healthy | `docker compose up --build` then `GET /health` returns 200 with a DB check; both healthchecks pass; published ports bind `127.0.0.1` | E1 and every spec touching compose, Dockerfiles or config | D-18, D-21, D-22 | active |
| QG-PROD | Production readiness, trimmed to a local personal tool (see below) | the numbered items below | deployable specs: E1 and any spec changing the api, Dockerfiles or compose | D-16..D-18, D-21 | active (trimmed) |
| QG-BUGS | No open blocker or major bugs | `check-run-conformance -Scope bugs` exits 0 | every spec | - | active |

## QG-PROD checklist (trimmed)

The deployables are the `api` and `web` images started by compose. The human excluded the production-readiness checklist, SBOM and image scans for this local tool ("no SBOM or image-scan requirements, no production-readiness checklist"), so only the items that cost nothing and protect the data stay. The planner maps each numbered item as `QG-PROD-<n>`.

| # | Item | Evidence | Decision |
|--|--|--|--|
| 1 | Health endpoint with a DB check, plus compose `healthcheck` on both services | `GET /health` returns 200 `{status}`; `docker compose ps` shows both healthy | D-18 |
| 2 | Structured JSON logs with no secrets or personal data | single-line JSON with request id; log test (GR-008) | D-16 |
| 3 | Configuration from environment, no hard-coded secrets or hosts | `.env.example` names only; config validated by zod at start; SR-016 | D-17 |
| 4 | Graceful shutdown | on SIGTERM the api stops accepting requests, closes the SQLite handle and exits 0 | D-21 |
| 5 | Reversible data path | migrations are forward-only; rollback is restoring the copied SQLite file, documented in the root `README.md` | D-05 |
| 6 | Documented redeploy | README gives `docker compose up --build` and says the named volume `budgetpal-data` survives it | D-21 |

Waived by the human, not numbered, so nothing is expected from the planner or `quality-gate`:

| Waiver | What is not run | Reason |
|--|--|--|
| W1 | SBOM (`quality-gate` QG-SBOM) | human exclusion: no SBOM |
| W2 | Image scans: `image-scan` (source) and `image-scan-built` (images the compose file builds) | human exclusion: no image scan |
| W3 | Production-readiness checklist beyond items 1-6 | human exclusion |

Lifting GR-001 (exposing the app to a network) puts W1-W3 and the waivers table of [[architecture]] back in force.

## Related

- Architecture Document: [[architecture]]
- Machine-checkable rules: `architecture/static-rules.tsv`
