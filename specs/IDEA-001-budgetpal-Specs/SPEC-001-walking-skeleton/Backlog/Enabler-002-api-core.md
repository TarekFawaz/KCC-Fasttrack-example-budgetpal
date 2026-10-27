# Enabler-002: API app, config, JSON logs, errors, module registry, OpenAPI

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-001-walking-skeleton]] | P0 | M | Ready | backend-nodejs | Enabler-001 | Enabler-004, Story-001 |

## Outcome Statement
Enable later specs to add API modules by building the Fastify app factory with validated env config, pino JSON logs, problem+json errors, security headers, OpenAPI and a module auto-registry, so that a new module needs only its own folder.

## Acceptance Criteria
- [ ] AC-1 - Given env values, when config loads, then it is parsed once with zod with defaults for `PORT` (3000), `LOG_LEVEL` (info), `CURRENCY` (USD), `COOKIE_SECURE` (false); an invalid value throws naming the variable and not its value; `SESSION_SECRET` is optional but at least 32 chars when set.
- [ ] AC-2 - Given a request, when the app logs, then the line is single-line JSON with a request id, and `req.headers.cookie`, `authorization` and bodies are not logged.
- [ ] AC-3 - Given a folder `api/src/modules/<x>/index.ts` exporting a Fastify plugin, when the app builds, then the plugin is registered without editing `app.ts`; a module folder without `index` is skipped with a warning log.
- [ ] AC-4 - Given an unknown route, a validation failure or a thrown error, when the app answers, then the body is `application/problem+json` (RFC 9457) with 404, 400 (field errors) or 500 (generic detail, no stack).
- [ ] AC-5 - Given any response, when headers are read, then `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and a self-only CSP are present; no CORS plugin is registered.
- [ ] AC-6 - Given the app, when `/docs/json` and `/docs` are requested, then an OpenAPI 3.1 document generated from the route zod schemas and Swagger UI are served.

## INVEST
I PASS · N PASS · V PASS (every module builds on it) · E PASS · S PASS (5 files) · T PASS

## Impacted Files
- `api/package.json` - deps: fastify, fastify-type-provider-zod, zod, zod-to-openapi, swagger, swagger-ui, cookie, pino, tsx, vitest
- `api/tsconfig.json` - strict TypeScript, ESM
- `api/src/kernel/config.ts` - zod env schema, `loadConfig()`
- `api/src/kernel/log.ts` - pino options with redaction allow-list
- `api/src/app.ts` - `buildApp(config)`: logger, error handler, headers, OpenAPI, module auto-registration

## Test Hints
- unit: config valid/invalid/default cases (AC-1); log line parses as one JSON object with `reqId`, no cookie (AC-2)
- integration: `app.inject` with a temp module folder (AC-3); 404, 400, 500 bodies (AC-4); header check (AC-5); `/docs/json` has `openapi: 3.1.x` (AC-6)
- tests in `api/test/` (not counted in Files)
