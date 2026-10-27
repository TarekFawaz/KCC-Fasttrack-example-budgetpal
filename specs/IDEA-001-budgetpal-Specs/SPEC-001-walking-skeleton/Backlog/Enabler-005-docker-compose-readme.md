# Enabler-005: Docker images, compose stack and README

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-001-walking-skeleton]] | P0 | M | Ready | devops-cloud | Story-001 | None |

## Outcome Statement
Enable the one-command local run by packaging `api` and `web` as non-root multi-stage images behind a loopback-only compose file and documenting run, backup and redeploy, so that `docker compose up --build` gives a working app.

## Acceptance Criteria
- Descoped by human decision 2026-10-27 (Docker registry steps skipped; not run, not a pass): AC-1 - Given `docker compose up --build`, when the build finishes, then `api` and `web` are healthy and `http://127.0.0.1:8080` shows "API: ok".
- [ ] AC-2 - Given the compose file, when read, then ports are `127.0.0.1:3000:3000` and `127.0.0.1:8080:8080`, each service has a `healthcheck`, env comes from `${VAR:-default}` with no secret value, and the db lives on the named volume `budgetpal-data`.
- [ ] AC-3 - Given the Dockerfiles, when read, then each uses a pinned base tag (`node:22-bookworm-slim`, pinned `nginx-unprivileged`), a multi-stage build with the toolchain in the build stage only, and a non-root `USER`.
- Descoped by human decision 2026-10-27 (Docker registry steps skipped; not run, not a pass): AC-4 - Given nginx, when `/api/health` is requested, then it proxies to `api:3000/health` (prefix stripped), serves the SPA with a fallback to `index.html`, and sets `nosniff`, `Referrer-Policy: no-referrer` and a self-only CSP.
- Descoped by human decision 2026-10-27 (Docker registry steps skipped; not run, not a pass): AC-5 - Given data written to the volume, when `docker compose down` then `up` runs, then `app_meta` and the migration records persist.
- [ ] AC-6 - Given the README, when read, then it covers prerequisites, `cp .env.example .env`, the run command, the env table, SQLite backup and restore (rollback path), and the redeploy note about the volume.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS (5 files) · T PASS (smoke test)

## Impacted Files
- `docker-compose.yml` - services `api`, `web`, volume `budgetpal-data`, loopback ports, healthchecks
- `api/Dockerfile` - build stage with toolchain, runtime on Debian-slim, non-root, `HEALTHCHECK`
- `web/Dockerfile` - Vite build stage, `nginx-unprivileged` runtime
- `web/nginx.conf` - static files, SPA fallback, `/api/` proxy, security headers
- `README.md` - run, env, backup and restore, redeploy

## Test Hints
- integration: smoke `docker compose up --build -d`, wait healthy, `curl 127.0.0.1:8080/api/health` returns 200 (AC-1, AC-4); `docker compose config` shows loopback ports (AC-2)
- unit: parse Dockerfiles for `USER` and pinned tags (AC-3); header check on a web response (AC-4)
- integration: write row, `down`, `up`, read row (AC-5); README contains required headings (AC-6)
