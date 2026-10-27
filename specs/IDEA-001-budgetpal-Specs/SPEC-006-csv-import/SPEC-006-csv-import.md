---
id: SPEC-006
title: CSV import
status: Ready
depends_on: [SPEC-005]
---

# SPEC-006: CSV import

| Priority | Category | Status | Wave | Depends on | Blocks | Index |
|--|--|--|--|--|--|--|
| P1 | Feature | Ready | 5 | [[../SPEC-005-transactions/SPEC-005-transactions\|SPEC-005]] | None | [[../IDEA-001-budgetpal-Specs]] |

## Delivery Brief
- **Who:** A BudgetPal user who keeps a CSV bank export and does not want to type each transaction.
- **Gets:** Upload a CSV, map its columns, pick the date format and account, preview valid and invalid rows, confirm, and see imported / skipped (duplicate) / invalid counts. Re-importing the same file adds nothing.
- **Value:** Months of history load in one step without double-counting.
- **Measured by:** A 5000-row file imports in under 10 s; a second import of the same file reports 0 imported; every malformed row is listed by line number.
- **Out of scope:** CSV export, saved mapping templates, bank-specific formats, encodings other than UTF-8, transfers, storing the uploaded file, editing rows in the preview.

## Acceptance Criteria
- [ ] AC-1 - Given a valid CSV, when the user uploads it, maps date, amount and description columns, and chooses date format and account, then a preview lists valid rows and rows with errors by line number, and writes nothing.
- [ ] AC-2 - Given a confirmed import, when it runs, then valid rows become transactions in the chosen account (amount as integer minor units, no floats) and the result shows imported, skipped and invalid counts.
- [ ] AC-3 - Given a row whose user + account + date + amount + normalised description already exists, when imported, then it is skipped and counted as a duplicate; re-importing the same file adds nothing (unique index enforces it).
- [ ] AC-4 - Given a file over 5 MB or 5000 rows, or a malformed or non-UTF-8 file, when uploaded, then the API returns 400 `problem+json` and nothing is written.
- [ ] AC-5 - Given an invalid row (bad date, non-numeric amount, empty description), when previewed or imported, then it is reported with its line number and never inserted; valid rows still import.
- [ ] AC-6 - Given user A and user B, when B posts an import naming A's account, then the API returns 404 and A's data is unchanged; imported rows belong only to the caller (two-user test).
- [ ] AC-7 - Given an import, then the upload is processed in memory (never written to disk) and CSV content, descriptions and amounts are never logged (GR-008, GR-009).
- [ ] AC-8 - Given the import page, when used by keyboard and screen reader, then labels, focus order, status text and a table alternative for the preview pass axe (WCAG 2.2 AA), with an empty state before upload and inline errors.
- [ ] AC-9 - Production readiness (QG-PROD): n/a - feature added to the SPEC-001 service, which owns health, JSON logs and env config; QG-PROD trimmed by the human.

## Backlog
| Key | Type | Title | Status | Depends on | Wave | Files | File |
|--|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | CSV parse, row validation, dedupe key and contract schemas | Ready | None | 1 | 5 | [[Backlog/Enabler-001-csv-parse-validate]] |
| Enabler-002 | Enabler | Dedupe migration and import repository | Ready | None | 1 | 3 | [[Backlog/Enabler-002-dedupe-migration-repository]] |
| Story-001 | Story | Preview a CSV with column mapping | Ready | Enabler-001 | 2 | 4 | [[Backlog/Story-001-preview-csv]] |
| Story-003 | Story | Import wizard page: upload, map, preview, result | Ready | Enabler-001 | 2 | 5 | [[Backlog/Story-003-import-wizard-page]] |
| Story-002 | Story | Confirm import and skip duplicates | Ready | Enabler-001, Enabler-002, Story-001 | 3 | 3 | [[Backlog/Story-002-commit-import]] |

## Architecture references
- Decisions: D-05 (SQLite, migrations), D-08 (user scoping), D-10, D-11 (validation, problem+json), D-13 (money), D-14 (CSV import), D-16 (logging), D-19, D-20 (web, accessibility), D-23 (tests)
- Containers: Web, API, SQLite database
- Architecture Document: [[../../../architecture/architecture]]

## Risks
- Dedupe column on the SPEC-005 `transactions` table - migration in the reserved range 0060-0069 adds `dedupe_key` and a partial unique index on `(user_id, dedupe_key)`; manual transactions keep it NULL, so a manual entry is not matched by an import (accepted, noted in the result help text).
- Module isolation (GR-006) forbids importing the transactions module - the import repository inserts into the table itself, scoped by `userId`.
- Stateless upload (no disk, GR-009) - the client re-sends the file with the mapping on confirm; the preview and commit parse the same bytes with the same code.
- Locale amounts (`1.234,56` vs `1,234.56`) - v1 accepts a plain decimal with `.` or `,` as the single separator; others are reported invalid, not guessed.
- Formula-injection text in cells - stored and rendered as plain text; no export in v1.
- Migration folder path is set by SPEC-001's runner - the planner confirms it before the Enabler-002 plan.
