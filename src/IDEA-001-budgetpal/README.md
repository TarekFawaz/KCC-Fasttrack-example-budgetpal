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

The Docker smoke, header and persistence tests (T-031, T-034, T-035) are opt-in: they are accepted-deferred (human decision H-001), skipped with the reason printed and reported as deferred, never as passed, unless you run `BUDGETPAL_LIVE_STACK=1 pnpm test`. They bind the fixed host ports 3000 and 8080 and one compose project name, so run them on a daemon no other stack is using. Once opted in, they run only when the Docker daemon is up, a build container can reach the npm registry (the test run probes with the Dockerfile's own `npm view pnpm@...`) and the daemon can still create a network (the probe creates and removes a throwaway one; a host with many leftover stacks fails with `all predefined address pools have been fully subnetted`, fixed by removing unused networks with `docker network prune`); otherwise they are skipped with the reason printed and reported as deferred, never as passed. Behind a TLS-intercepting proxy the image build fails at `npm install -g pnpm` until the build container trusts the proxy's CA.

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
- Categories (SPEC-003): `api/src/modules/categories/` serves `POST` and `GET /api/categories` and `PATCH` and `DELETE /api/categories/:id` (all need a session; another user's id is a 404; a duplicate name ignoring letter case is a 409; deleting a category that other rows reference with `ON DELETE RESTRICT` is a 409 "in use"). Table `categories` comes from migration `0030-categories.sql` (`0030-0039` are reserved for it). The page is `web/src/features/categories/` (route `/categories`, nav entry "Categories").
- `web/` React shell, `src/kernel/` (registry, shell), `src/features/*` (auto-loaded), `nginx.conf` (static files, SPA fallback, `/api/` proxy, security headers).
- `test/` workspace and packaging checks.
- Accounts data layer (SPEC-004): `api/migrations/0040-create-accounts.sql` creates `accounts` (name unique per user ignoring case; `type` limited to checking, savings, credit_card, cash, other; `opening_balance_minor` is an integer in minor units, may be negative, at most 10^12 in absolute value). `api/src/modules/accounts/accounts.repository.ts` holds all SQL, every function takes `userId` first, and it throws `DuplicateName` on a name clash and `InUse` when a transaction still references the account (SQLite RESTRICT foreign key). `accounts.schemas.ts` holds the strict zod input and response schemas.
- Accounts API, create and list (SPEC-004 Story-001): `POST /api/accounts` (201, 400 field errors, 401, 409 on a duplicate name ignoring case) and `GET /api/accounts` (the signed-in user's accounts ordered by name). Both sit behind `requireUser`, which runs before body validation, so a request without a session is always 401. `accounts.service.ts` maps `DuplicateName` to a 409 problem; `index.ts` is the module the loader registers; the routes are in `openapi.json`. Tests: `pnpm --filter @budgetpal/api test -- accounts`.
- Accounts API, read, edit and delete (SPEC-004 Story-002): `GET/PUT/DELETE /api/accounts/:id`, all behind `requireUser`. An id that is malformed is 400; an id that is unknown or belongs to another user is the same 404 (no hint that it exists). `PUT` replaces name, type and opening balance (409 for a name another of the user's accounts has). `DELETE` is 204, or a 409 problem+json when a transaction still references the account. Tests: `api/src/modules/accounts/accounts.isolation.test.ts`. `api/openapi.json` was regenerated (`UPDATE_OPENAPI=1`).
- Accounts page, list and add (SPEC-004 Story-003): `web/src/features/accounts/` (`feature.ts` adds the "Accounts" nav entry at `/accounts`). Amounts are typed as decimal text and converted to integer minor units by string math (`money.ts`, no floats) and shown with `Intl` in the install currency, read from `VITE_CURRENCY` (default `USD`, the same default as the api `CURRENCY`). Set `VITE_CURRENCY` at web build time to match `CURRENCY` when it is not `USD`. Tests: `pnpm --filter @budgetpal/web test -- accounts`.
- Transactions data layer (SPEC-005): `api/migrations/0050-transactions.sql` creates `transactions` (`amount_minor` is a positive INTEGER in minor units; `occurred_on` is `YYYY-MM-DD` text; account and category foreign keys are `ON DELETE RESTRICT`; index on `(user_id, occurred_on)`). `api/src/modules/transactions/transactions.repository.ts` holds all SQL and every function takes `userId` first; `transactions.schemas.ts` holds the strict zod schemas.
- Add a transaction (SPEC-005 Story-001): `POST /api/transactions` (module `api/src/modules/transactions/`, auto-registered, in `/docs`; the path carries the `/api` prefix like every other module). The session guard runs first (401), then the strict body schema (400 with field errors), then `transactions.service.ts` checks that the account and category belong to the user (400 naming `accountId` / `categoryId`, same answer for foreign and unknown ids). Returns 201 with the stored row. Nothing from the body (description, amount) is logged. Tests: `transactions.routes.test.ts` (T-007..T-012). `api/openapi.json` was regenerated (`UPDATE_OPENAPI=1`).
- Edit and delete a transaction (SPEC-005 Story-002): `PATCH /api/transactions/:id` (any non-empty subset of the create fields; strict body) and `DELETE /api/transactions/:id` (204), both behind `requireUser`. An id that is unknown or belongs to another user is the same 404; a changed `accountId` / `categoryId` that is not the user's is a 400 naming the field; an empty patch, bad value, unknown field or malformed id is a 400. `updated_at` moves on every patch. Only the event and the id are logged. Tests: `transactions.routes.test.ts` (T-013..T-019). `api/openapi.json` was regenerated (`UPDATE_OPENAPI=1`).
- Transactions page (SPEC-005 Story-004): `web/src/features/transactions/` is auto-registered (nav entry Transactions, `/transactions`). It lists the user's transactions, newest first, 50 per page, with Previous and Next and a "Showing 1-50 of N" range, and month, account and category filters (the selects read `/api/accounts` and `/api/categories`; a filter change returns to the first page). Amounts are formatted with `Intl` from integer minor units (no floats); expense or income is shown as text plus an icon, taken from the category kind. Empty, loading and error states have their own messages. Tests: `TransactionsPage.test.tsx` (T-028..T-034, axe included).
- Budgets (SPEC-007): `api/migrations/0070-budgets.sql` and `api/src/modules/budgets/` hold one budget per user, expense category and month (integer minor units, `UNIQUE(user_id, category_id, month)`); `PUT` / `DELETE /budgets/:month/:categoryId` set, replace and remove it and `GET /budgets?month=YYYY-MM` returns the progress (the web client calls them under `/api`). Budgets page (Story-003): `web/src/features/budgets/` is auto-registered (nav entry Budgets, `/budgets`). A month picker starts on the current month; the form takes an expense category and an amount typed as decimal text (converted to integer minor units by string math, shown with `Intl` in the `VITE_CURRENCY` currency); invalid input shows an inline labelled error and sends nothing; Remove keeps the row until the api confirms. Empty states cover no expense categories and no budgets. Tests: `pnpm --filter @budgetpal/web test -- budgets` (T-022..T-028).
- Budget progress (SPEC-007 Story-004): each budget row in `web/src/features/budgets/BudgetProgress.tsx` shows category, budget, spent and percent, a `role="progressbar"` with an accessible name and `aria-valuenow`, and the status as an icon plus text ("Within budget", "Near limit: 80% used or more", "Over budget"), never colour alone. The bar is capped at full width; past 100% the amount over is written out. Expense categories with spending and no budget are listed below with an "Add budget" action that preselects the category and focuses the amount field. Status tokens (light and dark) live in `BudgetProgress.module.css` and are checked at 4.5:1; layout is a single column from 360 px. Tests: `BudgetsPage.test.tsx` (T-029..T-034, axe included).
- CSV import pipeline (SPEC-006 Enabler-001, Enabler-002): `api/src/modules/import/` holds the pure pipeline the preview and commit routes (later waves) share. `import.parser.ts` parses RFC 4180 text in memory (5 MB, 5000 data rows, strict UTF-8, BOM stripped, header detected) and throws `ImportError` (HTTP 400) on a rejected file; `import.rows.ts` maps columns and converts dates (`YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`) and amounts to signed integer minor units by string arithmetic (no floats; one `.` or `,` and at most 2 decimals); `import.dedupe.ts` builds the sha256 dedupe key; `import.schemas.ts` holds the strict zod contract. `api/migrations/0060-import-dedupe.sql` (`0060-0069` belong to SPEC-006) adds the nullable `transactions.dedupe_key` and a partial unique index on `(user_id, dedupe_key)`; manual transactions keep it NULL. `import.repository.ts` holds all SQL: `accountBelongsToUser`, `categoryHasKind`, and `insertBatch` (one transaction, `ON CONFLICT DO NOTHING`, per-row inserted or duplicate). Tests: `import.parser.test.ts` (T-001..T-007), `import.repository.test.ts` (T-008..T-014).
- CSV preview and Import page (SPEC-006 Story-001, Story-003): `POST /api/import/preview` (`api/src/modules/import/import.routes.ts`, module `index.ts`, `import.service.ts`) takes multipart `file` plus `accountId` and optionally `mapping` (JSON column indexes), `dateFormat`, `expenseCategoryId`, `incomeCategoryId`. Without `mapping` it returns the headers and a suggested mapping; with it, valid and invalid counts, the first 20 valid rows and every invalid row by line. The guard runs before the body (401), a foreign account is 404, a cap, bad mapping or malformed body is 400 problem+json with field errors. The upload stays in memory (5 MB multipart limit, nothing written to disk) and only counts are logged. Because SPEC-005 stores amounts positive and takes the direction from the category kind (plan assumption A-1), a negative row needs the expense category and a positive row the income category, else that row is reported invalid. The web page `web/src/features/import/` (nav entry "Import") walks upload, column mapping, preview and result; it asks for a new preview whenever a select changes and renders cell text only as text. Tests: `import.preview.test.ts` (T-015..T-022), `ImportPage.test.tsx` (T-031..T-037). `api/openapi.json` was regenerated (`UPDATE_OPENAPI=1`).
- CSV commit (SPEC-006 Story-002): `POST /api/import/commit` (same module, `import.routes.ts` + `import.service.ts#commit`) takes the same multipart fields as the preview, with `mapping` and `dateFormat` required. It re-reads the uploaded bytes with the preview's code (`analyse`), then stores every valid row through `insertBatch` in one transaction and answers `{imported, skipped, invalid, invalidRows[{line, reason}]}`. Amounts are stored as their absolute value in the expense or income category the sign selects (assumption A-1); the dedupe key uses the signed value, so re-importing a file, or a duplicate inside one file, is counted in `skipped`, and two users importing the same rows each keep their own. Invalid rows are reported by line and never stored; a foreign account is 404, a cap or bad field is 400 problem+json, no session is 401, and nothing is written in those cases. The handler logs only the counts. Tests: `import.commit.test.ts` (T-023..T-030, including 5000 rows under 10 s read back through `GET /api/transactions`). `api/openapi.json` was regenerated (`UPDATE_OPENAPI=1`) to list the route.
- Styling kit (SPEC-010 Enabler-002): Tailwind CSS 3.4 through PostCSS (`web/tailwind.config.ts`, `web/postcss.config.js`) and shadcn/ui components copied into `web/src/components/ui/` (`web/components.json`, `cn` in `web/src/lib/utils.ts`, `useIsMobile` in `web/src/hooks/use-mobile.ts`). `web/src/index.css` holds the design tokens: a light scheme and a dark scheme that follows the operating system through `prefers-color-scheme` (no toggle, nothing stored), status tokens for ok, warning and over, and a visible `:focus-visible` ring. Pairs are checked for contrast (4.5:1 text, 3:1 ring and borders) in `web/src/theme.test.ts`. The jsdom setup (`web/src/test/setup.ts`) supplies `matchMedia` (switch it per test with `setMatchMedia({ mobile, dark })`), `ResizeObserver`, pointer capture and `scrollIntoView`. The pages adopt the kit in the later SPEC-010 stories; `index.css` is first imported by the app entry in Story-004. Tests: `pnpm --filter @budgetpal/web test -- theme kit utils`.
