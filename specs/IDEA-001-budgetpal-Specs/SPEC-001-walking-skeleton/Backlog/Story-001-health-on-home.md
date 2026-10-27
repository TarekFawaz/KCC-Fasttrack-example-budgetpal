# Story-001: See the API health status on the home page

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-001-walking-skeleton]] | P0 | S | Ready | frontend-react | Enabler-003, Enabler-004 | Enabler-005 |

## Statement
As a budget owner, I want the home page to show whether the API and its database are healthy, so that I know the app is running before I use it.

## Acceptance Criteria
- [ ] AC-1 - Given the api and db are up, when `GET /health` is called, then it returns 200 `{status:"ok", db:"ok"}` (a `SELECT` on `app_meta`) and is documented in OpenAPI.
- [ ] AC-2 - Given the db query fails, when `GET /health` is called, then it returns 503 `application/problem+json` without the driver message.
- [ ] AC-3 - Given the home page loads, when the health call succeeds, then it shows "API: ok" with a check icon and text; while loading it shows "Checking..."; on failure it shows "API: unavailable" with a warning icon and text, announced in a `role="status"` region.
- [ ] AC-4 - Given the home page, when axe-core runs in light and dark schemes, then there is no serious or critical violation.
- [ ] AC-5 - Given the home feature, when the app builds, then it appears in the nav as "Home" through `feature.ts` only (no shared file edited).

## INVEST
I PASS (needs only the two registries) · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/modules/health/index.ts` - public `GET /health` route with zod response schema, db check
- `web/src/features/home/feature.ts` - route `/`, label "Home", order 0
- `web/src/features/home/HomePage.tsx` - health status view (query, icon plus text, status region)
- `web/src/features/home/useHealth.ts` - TanStack Query hook for `/api/health`

## Test Hints
- unit: `useHealth` states with a mocked fetch (AC-3)
- integration: `app.inject('/health')` ok, then with the db closed gives 503 (AC-1, AC-2); Testing Library home page states plus axe (AC-3, AC-4); registry lists "Home" (AC-5)
- tests beside the code (not counted in Files)
