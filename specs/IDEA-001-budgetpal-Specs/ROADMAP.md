# Roadmap - IDEA-001: BudgetPal

Spec budget: 8 (fasttrack default, applied under `--silent --assume`). Run profile: fasttrack (no Token Plan).

## Execution Plan
| Order | Spec | Delivery | Depends on | Lane | Est. tokens | Restore point |
|--|--|--|--|--|--|--|
| 1 | [[SPEC-001-walking-skeleton/SPEC-001-walking-skeleton]] | `docker compose up` serves a web page showing the API `/health` status; env config, JSON logs, one migration, module and nav registry | None | A | tbd | CP after review |
| 2 | [[SPEC-002-auth/SPEC-002-auth]] | Sign up, log in, log out, `me`; `requireUser` and validation helper | SPEC-001 | A | tbd | CP after review |
| 3 | [[SPEC-003-categories/SPEC-003-categories]] | Manage expense and income categories | SPEC-002 | A | tbd | CP after review |
| 3 | [[SPEC-004-accounts/SPEC-004-accounts]] | Manage accounts with opening balance | SPEC-002 | B | tbd | CP after review |
| 4 | [[SPEC-005-transactions/SPEC-005-transactions]] | Add, edit, delete and filter transactions | SPEC-003, SPEC-004 | A | tbd | CP after review |
| 5 | [[SPEC-006-csv-import/SPEC-006-csv-import]] | Import a CSV bank export with column mapping and duplicate skipping | SPEC-005 | A | tbd | CP after review |
| 5 | [[SPEC-007-budgets/SPEC-007-budgets]] | Monthly category budgets with 80% and over-budget warnings | SPEC-005 | B | tbd | CP after review |
| 5 | [[SPEC-008-dashboard/SPEC-008-dashboard]] | Spending by category and month-over-month trend charts | SPEC-005 | C | tbd | CP after review |

## Optimisation Notes
- Specs with the same Order build in parallel lanes: SPEC-003 and SPEC-004 (Order 3); SPEC-006, SPEC-007 and SPEC-008 (Order 5).
- Every `Depends on` is a build-time dependency: SPEC-002 needs the SPEC-001 app, config and migration runner; SPEC-003/004 need `requireUser` from SPEC-002; SPEC-005 needs the category and account tables; SPEC-006/007/008 need the transactions table and API.
- Each spec adds only its own `api/src/modules/<x>`, `web/src/features/<x>` and numbered migration file. SPEC-001 provides router and nav auto-registration, so no two specs edit the same file.
- Take a restore point (`kcc-checkpoint`) after each spec reaches review.

## Related
- Index: [[IDEA-001-budgetpal-Specs]]
