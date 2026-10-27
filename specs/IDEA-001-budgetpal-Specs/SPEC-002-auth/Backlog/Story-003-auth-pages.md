# Story-003: Sign-up and login pages

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-002-auth]] | P0 | M | Ready | frontend-react, testing-unit | Story-002 | None |

## Statement
As a person using the web app, I want sign-up and login pages and a log-out control, so that I can use BudgetPal without calling the API by hand.

## Acceptance Criteria
- [ ] AC-1 - Given the sign-up page, when I submit a valid email and password, then I am logged in and sent to the home page.
- [ ] AC-2 - Given invalid input or a server 400 or 409, when I submit, then inline field errors show next to the labelled inputs and focus moves to the first error.
- [ ] AC-3 - Given the login page, when I submit wrong credentials, then one generic error shows; correct credentials log me in.
- [ ] AC-4 - Given I am logged in, when I use the log-out control in the app shell, then the session ends and I land on the login page.
- [ ] AC-5 - Given the two pages, then they are keyboard reachable with visible focus, pass an axe check, use CSS-variable tokens and are usable down to 360 px.
- [ ] AC-6 - Given the feature folder, then `feature.ts` registers the routes (`/signup`, `/login`) and the log-out nav entry through the SPEC-001 registry, with no edit to shared files.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `web/src/features/auth/feature.ts` - route and nav registration
- `web/src/features/auth/SignUpPage.tsx` - form, inline errors
- `web/src/features/auth/LoginPage.tsx` - form, generic error
- `web/src/features/auth/authApi.ts` - signup, login, logout and `me` calls via TanStack Query
- `web/src/features/auth/auth.test.tsx` - Testing Library and axe tests

## Test Hints
- unit: submit, error and redirect flows with a mocked API (AC-1 to AC-4); axe on both pages (AC-5); registry picks up `feature.ts` (AC-6)
- integration: manual run against `docker compose up` sign-up, log-out, log-in (AC-1, AC-3, AC-4)
