# Enabler-001: CSV parse, row validation, dedupe key and contract schemas

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-006-csv-import]] | P1 | M | Ready | backend-nodejs, testing-unit | None | Story-001, Story-002, Story-003 |

## Outcome Statement
Enable preview and import to share one pure CSV pipeline by building the parser, row validator, dedupe-key function and the zod request/response schemas, so that both endpoints and the web page agree on one contract and one set of rules.

## Acceptance Criteria
- [ ] AC-1 - Given RFC 4180 text (quoted commas, quotes, CRLF), when parsed with `csv-parse`, then rows and headers are returned and a header row is detected.
- [ ] AC-2 - Given more than 5000 rows, over 5 MB, or invalid UTF-8, when parsed, then a typed error maps to 400 `problem+json`.
- [ ] AC-3 - Given a mapping (date, amount, description columns) and a date format (ISO, `DD/MM/YYYY`, `MM/DD/YYYY`), when a row is validated, then it yields `{date: YYYY-MM-DD, amountMinor: integer, description}` or an error with its 1-based line number.
- [ ] AC-4 - Given amounts such as `-12.50`, `12,5`, `1000`, when converted, then integer minor units are exact with no floating-point arithmetic; a value with more than 2 decimals or non-numeric text is invalid.
- [ ] AC-5 - Given the same user, account, date, amount and description differing only in case or whitespace, when hashed, then the dedupe key is identical (`sha256` over `user_id|account_id|date|amount_minor|normalised description`); changing any field changes it.
- [ ] AC-6 - Given the schemas, then request and response shapes for preview and commit (counts imported, skipped, invalid, plus invalid rows by line) are exported as strict zod schemas and registered for OpenAPI.

## INVEST
I PASS · N PASS · V PASS (unblocks all three stories) · E PASS · S PASS · T PASS (pure functions)

## Impacted Files
- `api/src/modules/import/import.parser.ts` - parse, caps, header detection
- `api/src/modules/import/import.rows.ts` - mapping, date and amount conversion, row validation
- `api/src/modules/import/import.dedupe.ts` - normalise description, dedupe key
- `api/src/modules/import/import.schemas.ts` - zod request/response schemas
- `api/src/modules/import/import.parser.test.ts` - unit tests for the above

## Test Hints
- unit: quoted fields, CRLF, empty file, BOM (AC-1) · cap and encoding errors (AC-2) · each date format, bad dates such as 31/02 (AC-3) · amount edge cases, negative, comma decimal (AC-4) · key equal/different cases (AC-5) · schema rejects extra fields (AC-6)
