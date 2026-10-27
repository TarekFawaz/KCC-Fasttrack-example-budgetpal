# Bug-002: OpenAPI document omits the 503 returned by GET /health

| Type | Parent | Source | Severity | Status | Story / AC | Regression test | Evidence |
|--|--|--|--|--|--|--|--|
| Bug | [[../SPEC-001-walking-skeleton]] | verifier | minor | verified | Story-001 / AC-1 | T-030 | [[../../../../TestResults/IDEA-001/SPEC-001/Story-001-AC-1-Bug-002]] |

## Reproduce
1. Read `api/openapi.json`: `/health` has only a `200` response.
2. `api/src/modules/health/index.ts` returns 503 problem+json when the query fails (T-026).

## Expected / Actual
- Expected: the contract lists 200 and 503 (`application/problem+json`), per api-standards status-code conformance.
- Actual: only 200 is documented. Add a 503 response schema, regenerate `api/openapi.json` (`UPDATE_OPENAPI=1`), extend T-030.

## Impacted Files
- `src/IDEA-001-budgetpal/api/src/modules/health/index.ts`
- `src/IDEA-001-budgetpal/api/openapi.json`
- `src/IDEA-001-budgetpal/api/test/health.test.ts`
- `src/IDEA-001-budgetpal/api/src/app.ts` (added by the Option A ruling below)
- `src/IDEA-001-budgetpal/api/test/app.test.ts` (wrapper unit test, T-011, added by the Option A ruling below)

## Fix
Option A applied. `app.ts` wraps `jsonSchemaTransform`: a response declared as `{ description?, content: { '<media type>': { schema: <zod> } } }` is converted per media type; bare zod responses go through the provider unchanged. `health/index.ts` declares `503` as `application/problem+json` with a `Problem` zod schema (`satisfies z.ZodType<Problem>`), `api/openapi.json` regenerated (`UPDATE_OPENAPI=1`). Tests: T-030 (503 listed under `application/problem+json`, 200 under `application/json`, live 503 matches), T-011 (wrapper: mixed, content-only and `hide` routes). Red first, then green; `pnpm -r build`, `pnpm lint`, `pnpm test` and QG-COV (100%) pass.

## Ruling needed
**Blocker.** The contract cannot list the 503 as `application/problem+json` (and the 200 as `application/json`) from the three Impacted Files. Probed with the installed versions (fastify-type-provider-zod 4.0.2, @fastify/swagger 9.9.2):
- A plain zod `503` schema documents it, but under `application/json` only.
- The native form `503: { content: { 'application/problem+json': { schema } } }` throws at startup: the provider's `jsonSchemaTransform` (wired in `api/src/app.ts`) accepts only zod schemas.
- `produces` is route-wide: it adds `application/problem+json` to the 200 and `application/json` to the 503.

No code was changed for this Bug; the red regression test was removed again so `pnpm test` stays green. T-030 stays FAIL until a ruling.

| Option | What changes | Cost |
|--|--|--|
| A. Wrap the transform (recommended) | In `api/src/app.ts`, replace `jsonSchemaTransform` with a wrapper that converts the zod schema inside a `content` entry; then `health/index.ts` declares `503: { description, content: { 'application/problem+json': { schema: Problem } } }`, regenerate `openapi.json`, extend T-030 | One file outside Impacted Files (`app.ts`, an Enabler-002 file) plus a unit test for the wrapper (T-011 area); about 15 lines. Gives later specs (400/401/404 problem responses) one pattern |
| B. Accept `application/json` for the 503 | Add a zod `503` schema in `health/index.ts`, regenerate, extend T-030 to the status code and body shape only | No scope change, but the contract names the wrong media type; set the Bug `wontfix` on the media-type part |
| C. Route-wide `produces` | `produces: ['application/json', 'application/problem+json']` | No scope change; each response lists a media type it never returns |
| D. Upgrade fastify-type-provider-zod | Newer major with `content` support | Library major bump, needs a Decisions row (D-03) and a lockfile change; largest cost |

**Recommended: A.** Answer `revise` with "Option A approved: edit `api/src/app.ts` for this Bug".

## Ruling

- 2026-10-27T15:55:27Z human: `revise` -> Status open - silent run: no human ruling; apply the recommended option of the Ruling needed section of each reopened Bug item
