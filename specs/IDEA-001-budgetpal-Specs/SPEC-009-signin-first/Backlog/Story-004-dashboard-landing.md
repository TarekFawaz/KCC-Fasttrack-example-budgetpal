# Story-004: Dashboard is the landing page, Home page retired

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-009-signin-first]] | P1 | S | Ready | frontend-react, testing-unit | Story-003 | None |

## Statement
As a signed-in user, I want to land on my dashboard, so that the first thing I see after login is my money, not a status line.

## Acceptance Criteria
- [ ] AC-1 - Given the dashboard `feature.ts`, then it registers path `/` (label "Dashboard", order 0, first in the nav) and `/dashboard` is no longer a route.
- [ ] AC-2 - Given a signed-in user, when they open `/` or finish login without a target, then the dashboard shows with the current month selected as before.
- [ ] AC-3 - Given the app source, then the Home page, its feature, its nav entry and the text "API: ok" no longer exist; no route named `home` is registered.
- [ ] AC-4 - Given the rewritten dashboard tests, then every assertion on `/dashboard` (path, href, `initialEntries`, registry entry) is updated to `/` and no dashboard test is dropped.
- [ ] AC-5 - Given the removed Home tests, then their coverage (loading, ok, unavailable states and axe) exists in `kernel/HealthDot.test.tsx` from Story-003 before the files are deleted.
- [ ] AC-6 - Given an unknown path such as the old `/dashboard`, when a signed-in user opens it, then "Page not found" shows inside the shell.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `web/src/features/dashboard/feature.ts` - path `/`, order 0
- `web/src/features/dashboard/DashboardPage.test.tsx` - path, nav and registry assertions updated
- `web/src/features/home/feature.ts` - deleted
- `web/src/features/home/HomePage.tsx` - deleted
- `web/src/features/home/HomePage.test.tsx` - deleted (coverage lives in Story-003)

## Test Hints
- unit: registry lists Dashboard first with path `/` and no `home` id (AC-1, AC-3); dashboard page at `/` (AC-2); updated T-022 cases (AC-4)
- unit: signed-in shell at `/dashboard` shows "Page not found" (AC-6); grep the web source for "API: ok" (AC-3)
- check: Story-003 tests pass before this story's deletions (AC-5)
