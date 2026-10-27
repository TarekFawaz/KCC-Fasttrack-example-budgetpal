# Enabler-002: Session source and 401-aware query client

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-009-signin-first]] | P1 | M | Ready | frontend-react | None | Story-001 |

## Outcome Statement
Enable a single source of truth for "who is signed in" by adding a session hook on `GET /api/auth/me` and the one shared `QueryClient` that treats any 401 as "signed out", so that the guard and every feature react to a lost session the same way.

## Acceptance Criteria
- [ ] AC-1 - Given `kernel/session.ts`, when `useSession()` runs, then it reads `GET /api/auth/me` through TanStack Query with the existing key `['auth','me']` and returns `loading`, `authenticated` (with `{id, email}`), `anonymous` (HTTP 401, not an error) or `error` (any other failure); a 401 is never retried.
- [ ] AC-2 - Given `useSignOut()`, when it runs, then it calls `POST /api/auth/logout`; on success or on 401 it sets the session to anonymous and clears every other cached query.
- [ ] AC-3 - Given `kernel/queryClient.ts`, then it creates the one `QueryClient` (retry 1, no refetch on focus, as today) with a query-cache and a mutation-cache `onError`.
- [ ] AC-4 - Given any error with `status === 401` from a query or mutation (checked by shape, so `ApiProblem`, `DashboardProblem` and `CategoryApiError` all count), when the session is `authenticated`, then it becomes anonymous and the other cached queries are cleared; when the session is already anonymous nothing changes (a wrong-password 401 on login stays a form error). Other statuses are untouched.
- [ ] AC-5 - Given `main.tsx`, then it uses the exported client and the `source-rules` check still finds exactly one `new QueryClient(`.
- [ ] AC-6 - Given `test/session.ts`, then it offers a fetch mock helper (`mockSession`) for `me` as authenticated, anonymous or failing, used by the guard and page tests.

## INVEST
I PASS · N PASS · V PASS (every later story needs it) · E PASS · S PASS · T PASS

## Impacted Files
- `web/src/kernel/session.ts` - `useSession`, `useSignOut`, session query key and shape
- `web/src/kernel/queryClient.ts` - the one QueryClient with 401 handling
- `web/src/kernel/session.test.ts` - session states, sign-out, 401 handling with several error classes
- `web/src/test/session.ts` - `mockSession` helper for tests
- `web/src/main.tsx` - import the shared client

## Test Hints
- unit (Testing Library, mocked fetch): 200, 401, 500 and network failure give the four states (AC-1); sign-out clears the cache (AC-2)
- unit: a thrown `{status: 401}` from a query and from a mutation flips an authenticated session; the same error while anonymous does nothing; 403 and 500 do nothing (AC-4)
- unit: source-rules T-015 still passes (AC-5)
