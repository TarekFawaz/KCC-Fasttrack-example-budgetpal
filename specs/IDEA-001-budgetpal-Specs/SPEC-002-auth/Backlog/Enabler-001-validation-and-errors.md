# Enabler-001: Validation helper and problem+json errors

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-002-auth]] | P0 | S | Ready | backend-nodejs, testing-unit | None | Story-001 |

## Outcome Statement
Enable every API route to validate body, params and query with zod and fail with an RFC 9457 problem body by adding one shared helper and error handler, so that no module hand-rolls validation or leaks a stack trace.

## Acceptance Criteria
- [ ] AC-1 - Given a route using the helper, when the body has a bad field, a missing field or an unknown field (`.strict()`), then the response is 400 `application/problem+json` with `errors[]` of `{field, message}` and the handler is not called.
- [ ] AC-2 - Given invalid params or query, when the request is made, then the same 400 shape is returned.
- [ ] AC-3 - Given an unexpected error in a handler, when it is thrown, then the response is a generic 500 problem body with no stack trace or internal message.
- [ ] AC-4 - Given a valid request, when validated, then the handler receives typed, parsed data.

## INVEST
I PASS · N PASS · V PASS (every later spec reuses it) · E PASS · S PASS · T PASS

## Impacted Files
- `api/src/kernel/validate.ts` - `validate({body, params, query})` preHandler helper over zod
- `api/src/kernel/problem.ts` - problem+json builder and Fastify error handler (new; SPEC-001 provides the app and logger only)
- `api/src/kernel/validate.test.ts` - tests via Fastify `inject`

## Test Hints
- unit: bad, missing and extra fields -> 400 shape (AC-1); params and query (AC-2); typed output (AC-4)
- integration: route throwing an Error -> generic 500, body lacks the message and stack (AC-3)
