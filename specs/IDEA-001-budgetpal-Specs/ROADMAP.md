# Roadmap - IDEA-001: BudgetPal

Spec budget: 10 (human approved). Run profile: fasttrack (no Token Plan). SPEC-009 and SPEC-010 were added by a triaged `/bug-report` (new requirements).

## Execution Plan
| Order | Spec | Delivery | Depends on | Lane | Est. tokens | Restore point |
|--|--|--|--|--|--|--|
| 1 | [[SPEC-001-walking-skeleton/SPEC-001-walking-skeleton]] | `docker compose up` serves a web page showing the API `/health` status (the Home page is superseded by SPEC-009); env config, JSON logs, one migration, module and nav registry | None | A | tbd | CP after review |
| 2 | [[SPEC-002-auth/SPEC-002-auth]] | Sign up, log in, log out, `me`; `requireUser` and validation helper | SPEC-001 | A | tbd | CP after review |
| 3 | [[SPEC-003-categories/SPEC-003-categories]] | Manage expense and income categories | SPEC-002 | A | tbd | CP after review |
| 3 | [[SPEC-004-accounts/SPEC-004-accounts]] | Manage accounts with opening balance | SPEC-002 | B | tbd | CP after review |
| 4 | [[SPEC-005-transactions/SPEC-005-transactions]] | Add, edit, delete and filter transactions | SPEC-003, SPEC-004 | A | tbd | CP after review |
| 5 | [[SPEC-006-csv-import/SPEC-006-csv-import]] | Import a CSV bank export with column mapping and duplicate skipping | SPEC-005 | A | tbd | CP after review |
| 5 | [[SPEC-007-budgets/SPEC-007-budgets]] | Monthly category budgets with 80% and over-budget warnings | SPEC-005 | B | tbd | CP after review |
| 5 | [[SPEC-008-dashboard/SPEC-008-dashboard]] | Spending by category and month-over-month trend charts | SPEC-005 | C | tbd | CP after review |
| 6 | [[SPEC-009-signin-first/SPEC-009-signin-first]] | Sign-in first: route guard, `/` is the dashboard, API status as a footer dot | SPEC-006, SPEC-007, SPEC-008 | A | tbd | CP after review |
| 7 | [[SPEC-010-shadcn-ui/SPEC-010-shadcn-ui]] | Modern UI: Tailwind CSS and shadcn/ui, sidebar layout, every page restyled | SPEC-009 | A | tbd | CP after review |

## Optimisation Notes
- Specs with the same Order build in parallel lanes: SPEC-003 and SPEC-004 (Order 3); SPEC-006, SPEC-007 and SPEC-008 (Order 5).
- Every `Depends on` is a build-time dependency: SPEC-002 needs the SPEC-001 app, config and migration runner; SPEC-003/004 need `requireUser` from SPEC-002; SPEC-005 needs the category and account tables; SPEC-006/007/008 need the transactions table and API.
- Specs 001 to 008: each adds only its own `api/src/modules/<x>`, `web/src/features/<x>` and numbered migration file. SPEC-001 provides router and nav auto-registration, so no two specs edit the same file.
- SPEC-009 (Order 6) and SPEC-010 (Order 7) are sequential on purpose, not a missed parallel lane: both touch every page, the registry, `kernel/Shell.tsx`, `AuthGate.tsx` and `main.tsx`, so two lanes would collide. SPEC-009 depends on SPEC-006/007/008 so the guard and the landing are built against the complete app (it edits the dashboard route, the auth pages and the SPEC-001 Home page and tests); SPEC-010 restyles what SPEC-009 leaves.
- Inside SPEC-010 the three page stories (wave 3) are file-disjoint and may run side by side; the layout story waits for them because it deletes `shell.css`.
- SPEC-010 keeps six items but lists page folders as grouped bullets, so SZ-3 holds only per bullet, not per file (see its Risks); the planner may need a human ruling before splitting further.
- Take a restore point (`kcc-checkpoint`) after each spec reaches review.

## Related
- Index: [[IDEA-001-budgetpal-Specs]]
