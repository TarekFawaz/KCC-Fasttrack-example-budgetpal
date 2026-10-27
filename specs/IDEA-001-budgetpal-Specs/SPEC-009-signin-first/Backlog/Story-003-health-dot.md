# Story-003: Health status dot in the shell footer

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-009-signin-first]] | P2 | S | Ready | frontend-react, testing-unit | Story-001 | Story-004 |

## Statement
As a signed-in user, I want a small status dot for the API instead of a status page, so that I can still see when the backend is down without a developer screen.

## Acceptance Criteria
- [ ] AC-1 - Given the signed-in shell, then the footer slot holds a status dot; it is not a route and not in the nav.
- [ ] AC-2 - Given the health call, then the dot has `role="status"` and the accessible name "API status: checking", "API status: ok" or "API status: unavailable" for loading, success and failure.
- [ ] AC-3 - Given any state, then a non-colour cue differs per state (shape or icon, hidden from assistive tech) in addition to colour.
- [ ] AC-4 - Given `useHealth`, then it is a kernel hook with the behaviour and tests it had under `features/home` (one attempt, `/api/health`, strict `status` and `db` check).
- [ ] AC-5 - Given the kernel folder, then no file in it imports a `features/*` module (GR-006).
- [ ] AC-6 - Given light and dark schemes, then the dot and its states have no serious or critical axe violation.
- [ ] AC-7 - Given an anonymous visitor, then the dot is not shown and `/api/health` is not requested.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `web/src/kernel/HealthDot.tsx` - the dot, name and cue per state
- `web/src/kernel/HealthDot.test.tsx` - states, name, cue, axe, no features import (replaces the HomePage test coverage)
- `web/src/kernel/useHealth.ts` - moved from `features/home/useHealth.ts`
- `web/src/kernel/useHealth.test.tsx` - moved from `features/home/useHealth.test.tsx`
- `web/src/kernel/AuthGate.tsx` - pass the dot into the shell `footer` slot

## Test Hints
- unit (mocked fetch): the three states and their names (AC-2, AC-3); the moved hook cases (AC-4)
- unit: scan `kernel/*.tsx?` for `features/` imports (AC-5); axe on each state (AC-6); anonymous render has no dot and no health request (AC-7); in-shell presence (AC-1)
