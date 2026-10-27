# Enabler-001: Workspace scaffold and env template

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-001-walking-skeleton]] | P0 | S | Ready | devops-cloud | None | Enabler-002, Enabler-003 |

## Outcome Statement
Enable every later item to build and test in one place by creating the pnpm workspace (`api/`, `web/`), the root manifest and the env template, so that the stack, lockfile and secrets rules are fixed once.

## Acceptance Criteria
- [ ] AC-1 - Given a checkout, when `pnpm install` runs, then the workspace resolves `api` and `web`, engines require `node >=22 <25` and `pnpm >=9`, the root `package.json` has a SemVer `version`, and the lockfile is committed.
- [ ] AC-2 - Given `.env.example`, when read, then it lists `PORT`, `DATABASE_PATH`, `SESSION_SECRET`, `CURRENCY`, `LOG_LEVEL`, `COOKIE_SECURE` as names with empty values and contains no secret.
- [ ] AC-3 - Given `.gitignore`, when a `.env` file, `node_modules`, a build output folder or a `*.db` file is created, then git ignores it.

## INVEST
I PASS · N PASS · V PASS (unblocks all items) · E PASS · S PASS · T PASS (file checks)

## Impacted Files
- `package.json` - workspace root: scripts (`build`, `test`, `lint`), engines, SemVer version
- `pnpm-workspace.yaml` - packages `api`, `web`
- `.gitignore` - env files, deps, build output, db files
- `.env.example` - names only, empty values

## Test Hints
- unit: a vitest file reads `.env.example` and asserts the six names and empty values (AC-2); parses root `package.json` engines (AC-1)
- integration: `git check-ignore` on sample paths (AC-3); `pnpm install --frozen-lockfile` succeeds (AC-1)
