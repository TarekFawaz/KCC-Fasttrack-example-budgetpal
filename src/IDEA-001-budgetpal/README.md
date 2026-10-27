# BudgetPal

Self-hosted personal budgeting. This workspace is a pnpm monorepo: `api/` (Fastify 5, zod, SQLite) and `web/` (React 18, Vite 5). SPEC-001 delivers the walking skeleton: the home page shows "API: ok" once the stack is healthy.

## Prerequisites

- Docker with Compose v2 (`docker compose version`), to run the stack.
- For development without Docker: Node.js `>=22 <25` and pnpm `>=9` (`pnpm install --frozen-lockfile`).

## Run

```sh
cp .env.example .env
docker compose up --build
```

Open <http://127.0.0.1:8080>. The page reads "API: ok" when the api and its database answer. The api is also on <http://127.0.0.1:3000> (`/health`, `/docs`).

Both ports are published on `127.0.0.1` only, so the app is reachable from this machine and not from the network. Do not change that to `0.0.0.0` or a bare port mapping without a decision on network exposure (GR-001).

Stop with `docker compose down` (the data volume is kept). The api shuts down on SIGTERM: it stops accepting requests, closes the database and exits 0.

## Environment variables

`.env.example` lists the names with empty values; an empty value means "use the default". `.env` is git-ignored: never commit it.

| Variable | Default | Meaning |
|--|--|--|
| `PORT` | `3000` | Api listen port. Fixed at 3000 inside the container (nginx proxies to `api:3000`); set it only for `pnpm dev` |
| `DATABASE_PATH` | `./data/budgetpal.db` (`/data/budgetpal.db` in the container) | SQLite file; the container keeps it on the `budgetpal-data` volume |
| `SESSION_SECRET` | none | At least 32 characters; required from SPEC-002 on, unused here. Generate with `openssl rand -hex 32`. No default exists |
| `CURRENCY` | `USD` | Three-letter ISO currency code |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` |
| `COOKIE_SECURE` | `false` | `true` when served over HTTPS; sets `Secure` on the session cookie |
| `SESSION_IDLE_HOURS` | `24` | A session unused for this many hours is gone (whole number, at least 1) |
| `SESSION_ABSOLUTE_DAYS` | `30` | A session ends this many days after login, however often it is used |

## Development without Docker

```sh
pnpm install --frozen-lockfile
pnpm -r build
pnpm lint
pnpm test
pnpm --filter @budgetpal/api dev     # http://127.0.0.1:3000
pnpm --filter @budgetpal/web dev     # http://127.0.0.1:5173, /api proxied to the api
```

The Docker smoke, header and persistence tests (T-031, T-034, T-035) run only when the Docker daemon is up, can create a network (the test run creates and removes one throwaway `budgetpal-probe-*` network; a host whose Docker address pools are used up cannot), and a build container can reach the npm registry (the test run probes with the Dockerfile's own `npm view pnpm@...`); otherwise they are skipped with the reason printed and reported as deferred, never as passed. Behind a TLS-intercepting proxy the image build fails at `npm install -g pnpm` until the build container trusts the proxy's CA.

## Backup and restore (rollback path)

The database is one SQLite file on the named volume `budgetpal-data`. Migrations are forward-only, so the rollback for a bad release is restoring a backup taken before it.

Backup (consistent copy, safe while the api runs):

```sh
mkdir -p backups
docker compose exec api node -e "const D=require('better-sqlite3');new D('/data/budgetpal.db',{readonly:true}).backup('/data/backup.db').then(()=>process.exit(0))"
docker compose cp api:/data/backup.db ./backups/budgetpal-$(date +%Y%m%d).db
docker compose exec api rm /data/backup.db
```

Restore (replaces the current data):

```sh
docker compose stop api
docker compose cp ./backups/budgetpal-YYYYMMDD.db api:/data/budgetpal.db
docker compose start api
```

Delete any `/data/budgetpal.db-wal` and `/data/budgetpal.db-shm` files left from the old database before starting (`docker compose run --rm --entrypoint sh api -c "rm -f /data/budgetpal.db-wal /data/budgetpal.db-shm"`). Keep backups outside the repository; `*.db` files are git-ignored.

## Redeploy

`docker compose up --build -d` rebuilds the images and recreates the containers; the volume `budgetpal-data` is kept, so the data survives and pending migrations run at start. `docker compose down` also keeps the volume. `docker compose down -v` deletes it and all data: back up first.

## Layout

- `api/` Fastify app, `src/kernel/` (config, logging, errors, db, migrations), `src/modules/*` (auto-loaded), `migrations/` (numbered SQL, `0001-0009` belong to SPEC-001, `0010-0019` to SPEC-002 auth, `0040-0049` to SPEC-004 accounts), `openapi.json` (checked-in contract).
- Auth storage (SPEC-002): `api/src/modules/auth/` holds `auth.repository.ts` (all SQL for `users` and `sessions`), `password.ts` (Argon2id m=19456 KiB, t=2, p=1; 15 to 128 characters; bundled offline `common-passwords.txt`) and `sessions.ts` (256-bit cookie id, only its SHA-256 stored, idle and absolute expiry). `api/src/kernel/validate.ts` and `problem.ts` give every route one zod validation helper and RFC 9457 error bodies.
- `web/` React shell, `src/kernel/` (registry, shell), `src/features/*` (auto-loaded), `nginx.conf` (static files, SPA fallback, `/api/` proxy, security headers).
- `test/` workspace and packaging checks.
- Accounts data layer (SPEC-004): `api/migrations/0040-create-accounts.sql` creates `accounts` (name unique per user ignoring case; `type` limited to checking, savings, credit_card, cash, other; `opening_balance_minor` is an integer in minor units, may be negative, at most 10^12 in absolute value). `api/src/modules/accounts/accounts.repository.ts` holds all SQL, every function takes `userId` first, and it throws `DuplicateName` on a name clash and `InUse` when a transaction still references the account (SQLite RESTRICT foreign key). `accounts.schemas.ts` holds the strict zod input and response schemas.
- Accounts API, create and list (SPEC-004 Story-001): `POST /api/accounts` (201, 400 field errors, 401, 409 on a duplicate name ignoring case) and `GET /api/accounts` (the signed-in user's accounts ordered by name). Both sit behind `requireUser`, which runs before body validation, so a request without a session is always 401. `accounts.service.ts` maps `DuplicateName` to a 409 problem; `index.ts` is the module the loader registers; the routes are in `openapi.json`. Tests: `pnpm --filter @budgetpal/api test -- accounts`.
