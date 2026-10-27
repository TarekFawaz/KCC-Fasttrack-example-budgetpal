# Story-001: Route guard and session bootstrap

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-009-signin-first]] | P1 | M | Ready | frontend-react, testing-unit | Enabler-001, Enabler-002 | Story-002, Story-003 |

## Statement
As a visitor, I want the app to ask me to sign in before it shows anything, so that no page or navigation is reachable without a session.

## Acceptance Criteria
- [ ] AC-1 - Given the app starts, when the session is loading, then only a neutral `role="status"` "Loading..." shows: no header, nav, footer or page content, and no redirect.
- [ ] AC-2 - Given `GET /api/auth/me` fails with something other than 401, when the app starts, then an alert and a Retry button show, with no redirect and no nav; Retry asks again.
- [ ] AC-3 - Given an anonymous visitor, when they open `/login` or `/signup`, then the page renders without header, nav or footer; any other URL (also an unknown one) redirects with `replace` to `/login` and keeps `{pathname, search}` in router state as `from`.
- [ ] AC-4 - Given a signed-in user, when they open `/login` or `/signup`, then they are redirected to `/`; other public routes (such as `/logout`) still render.
- [ ] AC-5 - Given a signed-in user, then the shell shows the header, the nav built from the non-public features in registry order, the routes, a log-out control in the `actions` slot and the `footer` slot; public features are never in the nav.
- [ ] AC-6 - Given a signed-in user on a protected page, when any call returns 401, then the session turns anonymous, the previous user's cached data is not shown, and the user lands on `/login` with `from` set to that page.
- [ ] AC-7 - Given the guard is bypassed (a protected page rendered directly with an anonymous session), when it requests its data, then the API answer is 401 and AC-6 applies: the guard is a UX layer and the API stays the authority.
- [ ] AC-8 - Given the loading and error states, then each has no serious or critical axe violation.

## INVEST
I PASS (needs the two enablers) · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `web/src/kernel/AuthGate.tsx` - session states, public and protected routing, redirects, log-out control
- `web/src/kernel/AuthGate.test.tsx` - guard, redirect, 401 and axe tests
- `web/src/kernel/Shell.tsx` - optional `actions` and `footer` slots; nothing else changes
- `web/src/kernel/Shell.test.tsx` - slot tests; existing T-013 and T-014 cases stay
- `web/src/main.tsx` - mount `AuthGate` instead of `Shell`

## Test Hints
- unit (MemoryRouter, `mockSession`): loading, error and retry (AC-1, AC-2); redirect cases for anonymous and signed-in (AC-3, AC-4); nav content (AC-5)
- unit: a mocked 401 from a fake protected page (AC-6, AC-7); axe on loading and error (AC-8)
- Existing feature tests render `Shell` directly and need no change.
