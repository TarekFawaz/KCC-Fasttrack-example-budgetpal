---
id: SPEC-009-plan
spec: SPEC-009
status: ready
version: 1.0.0
profile: fasttrack
---

# SPEC-009 Implementation Plan

Workspace root `W` = `src/IDEA-001-budgetpal/`. Backlog paths (`web/...`) are relative to `W`; the steps below write them in full. Web-only spec: no API, migration, compose or Dockerfile file changes.

## Dependency Check
- Depends on SPEC-006 (import), SPEC-007 (budgets), SPEC-008 (dashboard). All three have a `plan.md` and their web code is already in `W/web/src/features/{import,budgets,dashboard}`; their error classes (`DashboardProblem`, `CategoryApiError`, `ApiProblem`) are what the 401 handler (Enabler-002) must recognise by shape. SPEC-002 (auth pages, `/api/auth/me`, `/logout` 401 behaviour) and SPEC-001 (kernel registry, Shell, `useHealth`) are present transitively.
- IMPLEMENT waits until those dependencies are APPROVED. No STOP.

## Architecture Gate Check
Fast track: no `arch.md`, no standalone `c4-*.md`. Inputs: spec `## Architecture references`, `architecture/architecture.md` (`## Decisions`, `## Toolchain`, embedded C2), `architecture/quality-gates.md`.
- C2 containers: **Web** (`web/src/kernel`, `web/src/features/{auth,dashboard,home}`) and the **API** only as the authority behind `GET /api/auth/me` and `GET /api/health` (unchanged, D-08).
- Decisions followed: D-26 (guard, `public` flag, 401 handling, status dot, landing at `/`), D-19 (React Router v6, TanStack Query v5), D-01 / GR-006 (kernel imports no feature; features import only kernel), D-20 (axe, non-colour cue), D-07 (cookie session, no storage), D-23 (vitest + Testing Library + axe). D-25 (shadcn/ui) belongs to SPEC-010: no UI kit work here, styling stays in the existing `shell.css`.
- Stack conformance: no new package. Every import is already in `web/package.json` (`react-router-dom`, `@tanstack/react-query`). No deviation; no `Proposed` decision blocks an item (D-22 concerns compose only).
- Gates: QG-ARCH-CONFORMANCE, QG-TRACE, QG-SCOPE, QG-QUALITY, QG-STATIC, QG-A11Y, QG-BUGS
- Not cited: the API, compose, Dockerfile, import and production-readiness gates, because this is a web-only change.

## Backlog Coverage
| Item | Type | Dialect | Complexity | Wave | Plan coverage | Notes |
|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | frontend-react | low | 1 | Covered | `public` flag, `features` array export, `isPublic` |
| Enabler-002 | Enabler | frontend-react | high | 1 | Covered | session hook and global 401 handling (authentication state) |
| Story-001 | Story | frontend-react | high | 2 | Covered | route guard: authorization UX, redirect target handling |
| Story-002 | Story | frontend-react | high | 3 | Covered | login/sign-up/logout flow, untrusted `from` target (open-redirect) |
| Story-003 | Story | frontend-react | low | 3 | Covered | move `useHealth` to kernel, add `HealthDot` |
| Story-004 | Story | frontend-react | low | 4 | Covered | dashboard to `/`, delete Home feature |

## Ordered Changes
1. **Enabler-001** `W/web/src/kernel/registry.ts`: `public?: boolean` on `Feature`; validate it (non-boolean throws naming the file); accept a `features` array export next to `default`/`feature`; duplicate ids across files or inside one array throw "Duplicate feature id" naming both places; export pure `isPublic(feature)`. `registry.test.ts` extended. Why: Enabler-001 AC-1..AC-5, spec AC-5.
2. **Enabler-002** `W/web/src/kernel/queryClient.ts`: the one `QueryClient` (retry 1, no refetch on focus) with `QueryCache` and `MutationCache` `onError`; a status-401 error (shape check, no class import) while the session is `authenticated` sets `['auth','me']` to anonymous and removes every other query. `W/web/src/kernel/session.ts`: `SESSION_KEY = ['auth','me']`, `useSession()` (`loading | authenticated | anonymous | error`, no retry on 401), `useSignOut()` (POST `/api/auth/logout`; success or 401 sets anonymous and clears the cache). `W/web/src/test/session.ts`: `mockSession` fetch helper. `W/web/src/main.tsx`: import the shared client. Why: Enabler-002 AC-1..AC-6, spec AC-1, AC-4, AC-6.
3. **Story-001** `W/web/src/kernel/Shell.tsx`: optional `actions` and `footer` slots only; existing behaviour unchanged. `W/web/src/kernel/AuthGate.tsx`: loading `role="status"`; non-401 error alert with Retry; anonymous: `/login` and `/signup` render bare, all other URLs `Navigate replace` to `/login` with `state.from = {pathname, search}`; signed in: public auth routes redirect to `/`, other public routes (`/logout`) render, protected features inside `Shell` (nav built from non-public features via `isPublic`), log-out control in `actions`. `main.tsx` mounts `AuthGate`. Why: Story-001 AC-1..AC-8, spec AC-1..AC-5, AC-9, AC-10.
4. **Story-002** `W/web/src/features/auth/feature.ts`: export `features` array (`/login`, `/signup`, `/logout`, all `public: true`); `LoginPage.tsx` / `SignUpPage.tsx`: navigate to a safe `from` (same-origin path starting with a single `/`, not `//`, not an absolute URL, not `/login`, `/signup`, `/logout`) else `/`; `LogOutPage` uses `useSignOut`; `authApi.ts`: re-export `ME_KEY` from the kernel session, align `useLogOut` with `useSignOut`. `auth.test.tsx`: rewrite T-030, T-032, T-033, T-035, add target and safety cases. Why: Story-002 AC-1..AC-7, spec AC-2, AC-6, AC-10.
5. **Story-003** `git mv`-style move `features/home/useHealth.ts` and `.test.tsx` to `W/web/src/kernel/`; `kernel/HealthDot.tsx` (`role="status"`, name "API status: checking|ok|unavailable", a different shape or icon per state with `aria-hidden`); `AuthGate.tsx` passes the dot into the `footer` slot (signed-in only, so anonymous visitors trigger no `/api/health` request); `features/home/HomePage.tsx` import path updated so Home still builds until Story-004. Why: Story-003 AC-1..AC-7, spec AC-8.
6. **Story-004** `W/web/src/features/dashboard/feature.ts`: path `/`, order 0; `DashboardPage.test.tsx` and `TrendChart.test.tsx`: `/dashboard` becomes `/`, no test dropped; delete `features/home/{feature.ts,HomePage.tsx,HomePage.test.tsx}` only after `kernel/HealthDot.test.tsx` carries the states and axe coverage; unknown `/dashboard` shows "Page not found" in the shell. Why: Story-004 AC-1..AC-6, spec AC-7, AC-11.

## Waves
Authoritative wave map (overrides the spec's `Wave` column; it matches it).

| Wave | Items | Files | File-disjoint | Notes |
|--|--|--|--|--|
| 1 | Enabler-001, Enabler-002 | `kernel/registry{.ts,.test.ts}`; `kernel/session{.ts,.test.ts}`, `kernel/queryClient.ts`, `test/session.ts`, `main.tsx` | yes | Scaffold already exists (manifest, lockfile, vitest and lint config from SPEC-001); no new package, so no manifest edit |
| 2 | Story-001 | `kernel/AuthGate{.tsx,.test.tsx}`, `kernel/Shell{.tsx,.test.tsx}`, `kernel/shell.css`, `main.tsx` | yes (single item) | `main.tsx` was edited in wave 1, so it is not shared within a wave |
| 3 | Story-002, Story-003 | `features/auth/*` vs `kernel/{HealthDot*,useHealth*,AuthGate.tsx,shell.css}` + `features/home/{HomePage.tsx,useHealth*}` | yes | Story-002 never touches `AuthGate.tsx`; the log-out control already uses `useSignOut` from wave 1 |
| 4 | Story-004 | `features/dashboard/{feature.ts,DashboardPage.test.tsx,TrendChart.test.tsx}`, `features/home/*` deletes | yes (single item) | Deletes Home after wave 3 moved its tests |

## Dialects Loaded
- `frontend-react` - every item (React 18, Router v6, TanStack Query v5, Testing Library).
- `testing-unit` - mandatory (Vitest + Testing Library + jsdom + axe).
- `testing-integration` - mandatory (guard + real registry + real QueryClient with mocked fetch).
- `testing-performance` / `testing-security` - not loaded: no item scopes them. The open-redirect and storage checks are covered by unit tests T-023 and T-027.

## New Files
Under `W/web/src/`: `kernel/{session.ts,session.test.ts,queryClient.ts,AuthGate.tsx,AuthGate.test.tsx,HealthDot.tsx,HealthDot.test.tsx}`, `kernel/useHealth{.ts,.test.tsx}` (moved), `test/session.ts`. No docs, configs, migrations or generated code.

## Toolchain
| Tool | Version |
|--|--|
| node | >=22 <25 |
| pnpm | >=9 |
| typescript | ^5 |
| react | ^18 |
| react-dom | ^18 |
| vite | ^5 |
| react-router-dom | ^6 |
| @tanstack/react-query | ^5 |
| vitest | ^2 |
| @testing-library/react | ^16 |
| axe-core | ^4 |

## Wave file allowances
| Item | Paths (backticked, `src/IDEA-001-budgetpal/...`, `/**` allowed) |
|--|--|
| Story-001 | `src/IDEA-001-budgetpal/web/src/kernel/shell.css` |
| Story-003 | `src/IDEA-001-budgetpal/web/src/kernel/shell.css`, `src/IDEA-001-budgetpal/web/src/features/home/HomePage.tsx`, `src/IDEA-001-budgetpal/web/src/features/home/useHealth.ts`, `src/IDEA-001-budgetpal/web/src/features/home/useHealth.test.tsx` |
| Story-004 | `src/IDEA-001-budgetpal/web/src/features/dashboard/TrendChart.test.tsx` |

## Risk Flags
- **R1 Home page edit in Story-003.** `HomePage.tsx` imports `./useHealth`; moving the hook breaks it until Story-004 deletes the page. Story-003 repoints that one import to `../../kernel/useHealth` (a feature may import the kernel, SR-007 allows it) so the build stays green between waves 3 and 4.
- **R2 `TrendChart.test.tsx`.** It renders at `initialEntries={['/dashboard']}`; the spec's Impacted Files miss it. Story-004 updates it through the allowance (AC-4: no dashboard test dropped).
- **R3 Shell stays unguarded.** Existing feature tests render `Shell` directly; only optional slots are added, so none of them needs a session mock (T-017 keeps T-013/T-014).
- **R4 401 by shape.** `queryClient.ts` must not import feature error classes (GR-006); it tests `typeof error === 'object' && status === 401`.
- **R5 Reload drops the target.** Router state only (SR-015 / GR-013); a full reload lands on `/`. Accepted in the spec. Old `/dashboard` bookmarks show "Page not found" (spec open question).
- **R6 Accepted-deferred (H-001).** Per the human hint, SAST/semgrep and the docker registry steps (compose up, container, smoke) are accepted-deferred, never PASS; `check:QG-SAST` runs as deferred (exit 3 is not a pass) and nothing is installed or retried. QG-SMOKE does not apply to this web-only change anyway.
- **R7 Vitest config.** If `source-rules.test.ts` fails because a new file spells a storage name literally, build the name from parts as the existing test does (T-027 does the same).
- ADR status: every cited decision is `Accepted` or `Accepted (assumed)`.

## Atomic test cases
| Test ID | Item | AC | Level | Description |
|--|--|--|--|--|
| T-001 | Enabler-001 | AC-1 | unit | `buildRegistry` fake modules: no `public` gives `false`, `public: true` kept, `public: "yes"` throws naming the file |
| T-002 | Enabler-001 | AC-2 | unit | A module exporting `features: [a, b]` (with and without `default`) registers both, sorted by order then id |
| T-003 | Enabler-001 | AC-3 | unit | Same id in two files and twice inside one `features` array both throw "Duplicate feature id" naming both places |
| T-004 | Enabler-001 | AC-4 | unit | The original T-012 cases (order, id tie-break, malformed module error, empty input) still pass unchanged |
| T-005 | Enabler-001 | AC-5 | unit | `isPublic` returns the flag with default `false`, reading no raw field |
| T-006 | Enabler-002 | AC-1 | unit | `useSession` with fetch 200 / 401 / 500 / network failure gives `authenticated{id,email}` / `anonymous` / `error` / `error`, plus `loading` first; a 401 is requested once (no retry) |
| T-007 | Enabler-002 | AC-2 | unit | `useSignOut` POSTs `/api/auth/logout`; on 204 and on 401 the session is anonymous and other cached queries are gone |
| T-008 | Enabler-002 | AC-3 | unit | The exported client has retry 1, no focus refetch, and both cache `onError` hooks set |
| T-009 | Enabler-002 | AC-4 | integration | With an authenticated session, `{status: 401}` thrown by a query and by a mutation (ApiProblem, DashboardProblem, CategoryApiError shapes) turns the session anonymous and clears other queries |
| T-010 | Enabler-002 | AC-4 | unit | Already anonymous: a 401 changes nothing (login stays a form error); 403 and 500 leave an authenticated session untouched |
| T-011 | Enabler-002 | AC-5 | unit | `main.tsx` imports the shared client; the source scan still finds exactly one `new QueryClient(` (source-rules T-015 stays green) |
| T-012 | Enabler-002 | AC-6 | unit | `mockSession('authenticated' \| 'anonymous' \| 'failing')` answers `/api/auth/me` with 200, 401 and 500 |
| T-013 | Story-001 | AC-1 | unit | While `me` is pending only a `role="status"` "Loading..." shows: no header, nav, footer, content, no redirect |
| T-014 | Story-001 | AC-2 | unit | `me` 500: an alert and Retry show, no nav, no redirect; Retry fires a second `me` request |
| T-015 | Story-001 | AC-3 | unit | Anonymous: `/login`, `/signup` render bare (no header/nav/footer); `/budgets?month=2026-10` and an unknown path redirect with replace to `/login` with `from {pathname, search}` |
| T-016 | Story-001 | AC-4 | unit | Signed in: `/login` and `/signup` redirect to `/`; `/logout` still renders |
| T-017 | Story-001 | AC-5 | unit | Signed in: header, nav of non-public features in registry order (no auth entries), routes, log-out control in `actions`, `footer` slot; Shell slot tests added, T-013/T-014 unchanged |
| T-018 | Story-001 | AC-6 | integration | Real QueryClient + gate: a protected page's call returns 401, session turns anonymous, previous user's data gone, location is `/login` with `from` set to that page |
| T-019 | Story-001 | AC-7 | integration | A protected page rendered with the guard bypassed and an anonymous session gets 401 from its data call, which triggers the T-018 behaviour |
| T-020 | Story-001 | AC-8 | unit | axe: no serious or critical violation in the loading and error states |
| T-021 | Story-002 | AC-1 | integration | The real `features` registry lists `/login`, `/signup`, `/logout`, all with `isPublic` true |
| T-022 | Story-002 | AC-2 | integration | Sent to `/login` from `/budgets?month=2026-10`, login and sign-up both land on `/budgets?month=2026-10`; with no `from` they land on `/` |
| T-023 | Story-002 | AC-3 | unit | `from` of `//evil.example`, `https://evil.example`, `/login`, `/signup`, `/logout` lands on `/` after login |
| T-024 | Story-002 | AC-4 | integration | Shell log-out control posts logout, clears cache, session anonymous, lands on `/login` (SPEC-002 Story-003 AC-4 holds) |
| T-025 | Story-002 | AC-5 | integration | Expired session: the control and `/logout` get 401 and still end on `/login` |
| T-026 | Story-002 | AC-6 | unit | Wrong credentials, inline errors and focus-first-error as in SPEC-002; axe clean on `/login` and `/signup` |
| T-027 | Story-002 | AC-7 | unit | Auth sources contain no storage names (searched with names built from parts); the target travels in router state |
| T-028 | Story-003 | AC-1 | integration | Signed-in shell footer holds the dot; no `/health` route and no nav entry |
| T-029 | Story-003 | AC-2 | unit | `role="status"` with name "API status: checking" / "ok" / "unavailable" for pending, success, failure |
| T-030 | Story-003 | AC-3 | unit | Each state renders a different `aria-hidden` icon or shape besides colour |
| T-031 | Story-003 | AC-4 | unit | Moved `useHealth` cases: one attempt, `/api/health`, strict `status` and `db` check |
| T-032 | Story-003 | AC-5 | unit | No file in `kernel/` imports a `features/*` module (GR-006) |
| T-033 | Story-003 | AC-6 | unit | axe: no serious or critical violation in each state |
| T-034 | Story-003 | AC-7 | integration | Anonymous visitor: no dot in the DOM and no `/api/health` request |
| T-035 | Story-004 | AC-1 | unit | Dashboard `feature.ts` is path `/`, label "Dashboard", order 0, first in the registry nav; `/dashboard` is no route |
| T-036 | Story-004 | AC-2 | integration | Signed-in at `/`, and after login with no target, the dashboard shows with the current month selected |
| T-037 | Story-004 | AC-3 | unit | Source scan finds no "API: ok", no `features/home` folder, no `home` feature id registered |
| T-038 | Story-004 | AC-4 | unit | Updated T-022 cases (path, href, `initialEntries`, registry entry) now use `/`; the dashboard test count is not reduced |
| T-039 | Story-004 | AC-5 | unit | `kernel/HealthDot.test.tsx` carries the loading, ok, unavailable and axe cases (T-029, T-030, T-033) that the removed Home tests had |
| T-040 | Story-004 | AC-6 | integration | Signed in at `/dashboard`: "Page not found" shows inside the shell |

## Standards coverage
| Standard | Verifier check | Covered by |
|--|--|--|
| api-standards | no HTTP API added or changed; `GET /api/auth/me` and `/api/health` are consumed as is | n/a: web-only change |
| security: authorization | guard is UX only; the API stays the authority, a bypassed page gets 401 | T-018, T-019 |
| security: redirect and untrusted input | `from` accepts same-origin paths only | T-023 |
| security: sessions and browser storage | no `localStorage` or `sessionStorage`; cookie session only | T-027, check:QG-STATIC |
| accessibility WCAG 2.2 AA | axe clean on loading, error, login, sign-up, dot; status not colour-only | T-020, T-026, T-030, T-033 |
| supply chain: lockfile and audit | no dependency added; lockfile unchanged | check:QG-LOCK, check:QG-DEPS |

## Gates coverage
| Gate | Covered by |
|--|--|
| QG-ARCH-CONFORMANCE | verifier:compare the Decisions table and Toolchain with web/package.json and imports (no new library) |
| QG-TRACE | check:QG-TEST, verifier:check-traceability -Spec SPEC-009 |
| QG-SCOPE | verifier:quality-gate -Spec scoped from this table |
| QG-QUALITY | check:QG-LOCK, check:QG-BUILD, check:QG-LINT, check:QG-TEST, check:QG-COV, check:QG-SECRETS, check:QG-DEPS, check:QG-SAST |
| QG-STATIC | check:QG-STATIC, T-027, T-032 |
| QG-A11Y | T-020, T-026, T-030, T-033, verifier:visual review of the dot in light and dark schemes |
| QG-BUGS | verifier:check-run-conformance -Scope bugs |
| GR-001 | n/a: no compose file or port change |
| GR-002 | T-019 |
| GR-003 | n/a: no SQL |
| GR-004 | n/a: no API route |
| GR-005 | static-rules:SR-004 SR-005 |
| GR-006 | T-032, static-rules:SR-006 SR-007 |
| GR-007 | static-rules:SR-008 SR-009 |
| GR-008 | n/a: no API logging change |
| GR-009 | n/a: no CSV import change |
| GR-010 | n/a: no hashing or crypto code in this spec |
| GR-011 | n/a: security headers unchanged |
| GR-012 | verifier:every package in the Decisions table that this spec uses is in web/package.json and the lockfile and no second router or query or HTTP library exists |
| GR-013 | T-027, static-rules:SR-014 SR-015 |
| GR-014 | n/a: no migration |
| GR-015 | n/a: no configuration change |
| GR-016 | n/a: no API response change |
| GR-017 | n/a: no Dockerfile change |
| GR-018 | verifier:no rate limiter or csrf or audit or sbom dependency added |

## Routing

Written by `kcc route` from each item's Complexity, its files, its domain and CR-7 risk. `kcc-run` and the orchestrator read it;
do not edit it by hand (rerun `kcc route`).

## Verification Steps
Run from `W/`:
1. `pnpm --filter @budgetpal/web test` - all T-001..T-040 plus existing suites; wave 3 must show `kernel/HealthDot.test.tsx` green before wave 4 deletes Home.
2. `pnpm --filter @budgetpal/web test:coverage` - web coverage at or above 80% (spec AC-11, check:QG-COV).
3. `pnpm --filter @budgetpal/web build` - typecheck and Vite build (check:QG-BUILD).
4. `quality-gate -Spec SPEC-009` - lint, lock, secrets, deps, static rules (SR-006, SR-007, SR-014, SR-015). SAST and docker/compose steps stay accepted-deferred (H-001).
5. Search `web/src` for "API: ok" and `features/home`: no hits (T-037).
6. Verifier per spec AC-1..AC-11 using the Test IDs above.

## Scope
Medium (about 20 files across 6 items, all under `W/web/src`).

## Confidence
Confidence: 93%

Why below the 95% default: the web code was read directly, but the spec's Impacted Files miss `TrendChart.test.tsx`, `HomePage.tsx` and `shell.css` (covered by allowances above), and SPEC-006/007/008 are not yet APPROVED, so IMPLEMENT stays blocked on them.

## Related
- Epic spec: [[SPEC-009-signin-first]]
- Idea-specs index: [[../IDEA-001-budgetpal-Specs]]
- All specs: [[../../specs|All specs MOC]]
