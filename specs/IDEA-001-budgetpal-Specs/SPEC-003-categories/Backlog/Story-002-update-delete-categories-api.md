# Story-002: Rename and delete categories (API)

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-003-categories]] | P1 | S | Ready | backend-nodejs, testing-integration | Story-001 | Story-004 |

## Statement
As a signed-in user, I want to rename, re-kind and delete my categories through the API, so that my list stays accurate and a category in use is never lost.

## Acceptance Criteria
- [ ] AC-1 - Given a category, when `PATCH /api/categories/:id` sends a new name or kind, then the response is 200 with the updated category and the list shows it.
- [ ] AC-2 - Given another category named "Rent", when the update renames this one to "rent", then the response is 409 problem+json and nothing changes; renaming to its own current name succeeds.
- [ ] AC-3 - Given an invalid body (empty name, bad kind, extra field, empty object) or a non-integer id, when sent, then the response is 400 problem+json with field errors.
- [ ] AC-4 - Given an unused category, when `DELETE /api/categories/:id` is called, then the response is 204 and it no longer lists.
- [ ] AC-5 - Given a category referenced by a row with a `RESTRICT` foreign key, when deleted, then the response is 409 problem+json whose detail says the category is in use, and the category remains.
- [ ] AC-6 - Given user A's category id, when user B calls `PATCH` or `DELETE` on it, then the response is 404 and A's category is unchanged; without a session the response is 401.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/modules/categories/categories.service.ts` - update and delete; maps duplicate, in-use and not-found outcomes.
- `api/src/modules/categories/categories.routes.ts` - `PATCH` and `DELETE` with schemas and `requireUser`.
- `api/src/modules/categories/categories.routes.test.ts` - added `inject` tests, including the two-user test and a temporary referencing table for AC-5.

## Test Hints
- integration: update (AC-1), duplicate rename and self-rename (AC-2), invalid input (AC-3), delete unused (AC-4), delete in use (AC-5), cross-user 404 and 401 (AC-6).
