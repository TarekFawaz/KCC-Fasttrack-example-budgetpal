# Story-002: Sign-in pages: return to target, log out

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-009-signin-first]] | P1 | M | Ready | frontend-react, testing-unit | Story-001 | None |

## Statement
As a returning user, I want to sign in, land where I was going and log out from the shell, so that sign-in feels like a normal app.

## Acceptance Criteria
- [ ] AC-1 - Given the auth `feature.ts`, then it exports a `features` array with `/login`, `/signup` and `/logout`, all `public: true`, so the real registry (not only a test registry) serves all three.
- [ ] AC-2 - Given a visitor sent to `/login` from `/budgets?month=2026-10`, when they log in or sign up, then they land on `/budgets?month=2026-10`; with no `from` they land on `/`.
- [ ] AC-3 - Given a `from` that is `//evil.example`, an absolute URL, or `/login`, `/signup` or `/logout`, when login succeeds, then the user lands on `/`.
- [ ] AC-4 - Given a signed-in user, when they use the shell log-out control, then `POST /api/auth/logout` runs, cached data is cleared, the session is anonymous and the user lands on `/login`; SPEC-002 Story-003 AC-4 holds.
- [ ] AC-5 - Given an already expired session, when the user logs out or opens `/logout`, then a 401 still ends on `/login`.
- [ ] AC-6 - Given the login and sign-up pages, then wrong credentials, inline errors and focus-first-error behave as in SPEC-002 and both pages pass axe.
- [ ] AC-7 - Given the auth sources, then they use no browser storage; the target travels in router state only.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `web/src/features/auth/feature.ts` - `features` array, `public: true` on all three
- `web/src/features/auth/LoginPage.tsx` - go to a safe `from` or `/`; `LogOutPage` uses the session sign-out
- `web/src/features/auth/SignUpPage.tsx` - same safe target after sign-up
- `web/src/features/auth/authApi.ts` - session key and `me` re-exported from the kernel; `useLogOut` aligned with `useSignOut`
- `web/src/features/auth/auth.test.tsx` - rewrite T-030, T-032, T-033, T-035; add target and safety cases

## Test Hints
- unit (MemoryRouter + real registry via `buildRegistry`): the three routes are registered and public (AC-1); target cases including the unsafe ones (AC-2, AC-3)
- unit: log-out control and `/logout` with 204 and 401 (AC-4, AC-5); existing error and axe cases stay (AC-6); source scan for storage names built from parts (AC-7)
