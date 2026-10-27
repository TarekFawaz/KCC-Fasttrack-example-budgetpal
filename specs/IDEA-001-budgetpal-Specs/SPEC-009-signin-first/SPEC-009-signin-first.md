---
id: SPEC-009
title: Sign-in first
status: Ready
depends_on: [SPEC-006, SPEC-007, SPEC-008]
---

# SPEC-009: Sign-in first

| Priority | Category | Status | Wave | Depends on | Blocks | Index |
|--|--|--|--|--|--|--|
| P1 | Feature | Ready | 6 | [[../SPEC-006-csv-import/SPEC-006-csv-import\|SPEC-006]], [[../SPEC-007-budgets/SPEC-007-budgets\|SPEC-007]], [[../SPEC-008-dashboard/SPEC-008-dashboard\|SPEC-008]] | [[../SPEC-010-shadcn-ui/SPEC-010-shadcn-ui\|SPEC-010]] | [[../IDEA-001-budgetpal-Specs]] |

Source: human `/bug-report`, triaged as new requirements ("the web starts with the API status, and before login I can reach every page"). SPEC-010 carries the visual half of the same report.

## Delivery Brief
- **Who:** Anyone who opens BudgetPal in a browser (a visitor before login, a signed-in user after).
- **Gets:** A sign-in-first app. A visitor sees only the login and sign-up pages. After login the user lands on the dashboard and sees the navigation. The API health check is a small status dot in the footer, not a page.
- **Value:** The first screen is a product screen, not a developer status line, and no module or page is reachable before login.
- **Measured by:** Jsdom tests show: logged-out URLs redirect to `/login` and return to the target after login, a 401 from any call ends in `/login`, `/` is the dashboard, no "API: ok" page exists, and the dot has an accessible name.
- **Out of scope:** Any visual restyle ([[../SPEC-010-shadcn-ui/SPEC-010-shadcn-ui|SPEC-010]]), password reset, remember-me, a server-side change (the API already returns 401 to anonymous callers), an alias for the old `/dashboard` URL, browser storage of anything.

## Acceptance Criteria
- [ ] AC-1 - On load the SPA calls `GET /api/auth/me`. While it is pending the page shows only a neutral `role="status"` loading state (no nav, no page content, no redirect). A non-401 failure shows an alert with a Retry button and no redirect (Enabler-002, Story-001).
- [ ] AC-2 - A logged-out visitor can reach only `/login` and `/signup`. Any other URL (including an unknown one) redirects to `/login` and the target (path and query) is remembered in router state; after login the user returns to it, default `/`. Targets must be same-origin paths: `//host`, absolute URLs and auth paths fall back to `/` (Story-001, Story-002).
- [ ] AC-3 - A logged-in visitor who opens `/login` or `/signup` is redirected to `/` (Story-001).
- [ ] AC-4 - A 401 from any API call (query or mutation, any feature's error class) turns the session anonymous, clears cached server data and sends the user to `/login` with the current page remembered. A wrong-password 401 on `/login` while already anonymous changes nothing (Enabler-002, Story-001).
- [ ] AC-5 - A route has `public` (default false); the auth routes are public. The header, nav, log-out control and footer render only after login. A feature module may export a `features` array so one folder registers `/login`, `/signup` and `/logout` (Enabler-001, Story-001, Story-002).
- [ ] AC-6 - Log out ends the session, clears cached data and lands on `/login`; SPEC-002 Story-003 AC-4 keeps holding (Story-002).
- [ ] AC-7 - The "API: ok" Home page and its nav entry are gone. `/` is the dashboard, first in the nav (Story-004).
- [ ] AC-8 - The health check shows only as a status dot with an accessible name ("API status: ok", "unavailable" or "checking") in the shell footer. It is not a page and not in the nav. Each state has a non-colour cue (shape or icon) as well as colour (D-20) (Story-003).
- [ ] AC-9 - The guard is a UX layer. No API file changes. A test renders a protected page with the guard bypassed and shows its data calls get 401 and trigger AC-4; the existing per-module 401 tests stay green. The API remains the authority (Story-001).
- [ ] AC-10 - The loading, error, login and sign-up states have no serious or critical axe violation. The remembered target lives in router state only: no `localStorage` or `sessionStorage` (SR-015, GR-013) (Story-001, Story-002).
- [ ] AC-11 - Superseded and rewritten tests (section below) are updated, not deleted, with their coverage kept. Web coverage stays at or above the quality-gate floor (80%) (all items).

## Superseded and rewritten
- SPEC-001 Story-001 AC-3 (home shows "API: ok") and AC-5 ("Home" in the nav) are superseded by AC-7 and AC-8. AC-4 (axe) moves to the dot and the guard states; AC-1 and AC-2 (API `/health`) stand.
- SPEC-002 Story-003 AC-1 ("sent to the home page") now means the remembered target or `/`. AC-6 (log-out nav entry) is replaced by the shell log-out control plus the `/logout` route (AC-5).
- `web/src/features/home/HomePage.test.tsx`: states and axe move into `kernel/HealthDot.test.tsx` (Story-003), then the file is deleted with the page (Story-004). Its "no shared file references the home feature" check becomes "kernel imports no `features/*` module".
- `web/src/features/home/useHealth.test.tsx`: moved with `useHealth.ts` to `web/src/kernel/` (Story-003).
- `web/src/features/dashboard/DashboardPage.test.tsx`: `/dashboard` path, href and nav assertions become `/` (Story-004).
- `web/src/features/auth/auth.test.tsx`: T-030 and T-032 ("lands on the home page"), T-033 and T-035 (log-out entry, three-feature registry) are rewritten (Story-002).
- `web/src/kernel/registry.test.ts` is extended (Enabler-001). `web/src/kernel/Shell.test.tsx` is extended for the `actions` and `footer` slots (Story-001). No kernel test expects a "Home" nav entry today (the Shell tests use fake features), so none is removed. `source-rules.test.ts` and `build.test.ts` stay as they are; `new QueryClient` still appears once (it moves to `kernel/queryClient.ts`).

## Backlog
| Key | Type | Title | Status | Depends on | Wave | Files | File |
|--|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | Registry `public` flag and multi-feature modules | Ready | None | 1 | 2 | [[Backlog/Enabler-001-registry-public-flag]] |
| Enabler-002 | Enabler | Session source and 401-aware query client | Ready | None | 1 | 5 | [[Backlog/Enabler-002-session-and-query-client]] |
| Story-001 | Story | Route guard and session bootstrap | Ready | Enabler-001, Enabler-002 | 2 | 5 | [[Backlog/Story-001-route-guard]] |
| Story-002 | Story | Sign-in pages: return to target, log out | Ready | Story-001 | 3 | 5 | [[Backlog/Story-002-auth-pages-flow]] |
| Story-003 | Story | Health status dot in the shell footer | Ready | Story-001 | 3 | 5 | [[Backlog/Story-003-health-dot]] |
| Story-004 | Story | Dashboard is the landing page, Home page retired | Ready | Story-003 | 4 | 5 | [[Backlog/Story-004-dashboard-landing]] |

## Architecture references
- Decisions: D-01, D-07, D-08, D-19, D-20, D-26 (frontend auth flow), D-25 (UI kit, applies to SPEC-010)
- Containers: Web, API (`/api/auth/me`, `/health`) (C2 diagram)
- Architecture Document: [[../../../architecture/architecture]]

## Risks
- Wave order matters: Story-003 adds the dot and keeps the `useHealth` coverage before Story-004 deletes the Home page, so no coverage is lost in between.
- Existing feature tests render `Shell` directly. The gate is a separate `AuthGate` wrapper (Shell only gains optional slots), so those tests stay valid and need no session mock.
- SPEC-002 left `/signup` and `/logout` unreachable in the real app (the registry took one feature per module). Enabler-001 fixes it; Story-002 proves it through the real registry.
- The remembered target is router state, so a full page reload drops it and the user lands on `/`. Accepted: browser storage is forbidden (SR-015).
- Old `/dashboard` bookmarks show "Page not found" (no alias). Recorded as an open question.
- QG-PROD: n/a, web-only change; health, logs, config and shutdown stay with SPEC-001. Rollback is a revert of the web files; there is no migration.
