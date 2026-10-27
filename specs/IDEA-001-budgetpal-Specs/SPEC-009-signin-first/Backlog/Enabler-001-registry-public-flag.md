# Enabler-001: Registry `public` flag and multi-feature modules

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-009-signin-first]] | P1 | S | Ready | frontend-react | None | Story-001 |

## Outcome Statement
Enable the route guard and the auth pages by adding a `public` flag to the feature registry and letting one `feature.ts` register several features, so that `/login`, `/signup` and `/logout` are reachable and the guard knows which routes need a session.

## Acceptance Criteria
- [ ] AC-1 - Given a feature without `public`, when the registry is built, then `public` is `false`; given `public: true` it is kept; given a non-boolean `public` the build throws and names the file.
- [ ] AC-2 - Given a module that exports a `features` array (alongside or instead of `default` / `feature`), when the registry is built, then every entry is registered, validated and sorted like any other feature.
- [ ] AC-3 - Given the same `id` twice (across files or inside one `features` array), when the registry is built, then it throws "Duplicate feature id" naming both places.
- [ ] AC-4 - Given the existing registry behaviour (order, id tie-break, malformed module error, empty input), then it is unchanged and the T-012 tests still pass.
- [ ] AC-5 - Given the exported pure helper `isPublic(feature)`, then it returns the flag with the default applied, so the guard never reads the raw field.

## INVEST
I PASS · N PASS · V PASS (unblocks the guard and the auth pages) · E PASS · S PASS · T PASS

## Impacted Files
- `web/src/kernel/registry.ts` - `public?: boolean` on `Feature`, `features` array export, `isPublic`
- `web/src/kernel/registry.test.ts` - flag, array export, duplicate and malformed cases (extends T-012)

## Test Hints
- unit: build from fake modules with and without `public`, with `features`, with a duplicate inside one array and a bad `public` value (AC-1 to AC-3, AC-5)
- unit: the T-012 cases run unchanged (AC-4)
