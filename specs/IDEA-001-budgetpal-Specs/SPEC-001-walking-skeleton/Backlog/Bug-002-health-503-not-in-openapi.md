# Bug-002: OpenAPI document omits the 503 returned by GET /health

| Type | Parent | Source | Severity | Status | Story / AC | Regression test | Evidence |
|--|--|--|--|--|--|--|--|
| Bug | [[../SPEC-001-walking-skeleton]] | verifier | minor | blocked | Story-001 / AC-1 | T-030 | [[../../../../TestResults/IDEA-001/SPEC-001/Story-001-AC-1-Bug-002]] |

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
