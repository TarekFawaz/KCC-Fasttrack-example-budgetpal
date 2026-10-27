# Story-003: Import wizard page: upload, map, preview, result

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-006-csv-import]] | P1 | M | Ready | frontend-react, testing-unit | Enabler-001 | None |

## Statement
As a BudgetPal user, I want an Import page that walks me through upload, column mapping, preview and result, so that I can bring in a bank export without leaving the app.

## Acceptance Criteria
- [ ] AC-1 - Given the app is running, then an "Import" nav entry appears via `web/src/features/import/feature.ts` (SPEC-001 registry) and the page shows an empty state with a file picker, the 5 MB / 5000-row limits and the UTF-8 note.
- [ ] AC-2 - Given a chosen file, when the user uploads it, then the page shows labelled selects for date, amount and description columns (pre-filled from the suggested mapping), the date format and the account, and re-requests the preview when they change.
- [ ] AC-3 - Given a preview, then valid rows show in a table and invalid rows are listed by line with the reason; "Import" is disabled while no valid row exists.
- [ ] AC-4 - Given the user confirms, when the commit returns, then the result shows imported, skipped (duplicates) and invalid counts as text with an icon (never colour only), the invalid lines, and a link to the transactions list.
- [ ] AC-5 - Given a 400 or 404 response, then the field-level error appears inline next to the control and no raw server text is rendered as HTML.
- [ ] AC-6 - Given the page, then every control has a label, focus is visible, focus moves to the preview and the result heading on each step, it works at 360 px, and axe reports no violations.

## INVEST
I PASS (tests mock the API against Enabler-001's schemas) · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `web/src/features/import/feature.ts` - route and nav entry
- `web/src/features/import/ImportPage.tsx` - step flow: upload, mapping, preview, result
- `web/src/features/import/importApi.ts` - TanStack Query calls (multipart to `/api/import/preview` and `/commit`)
- `web/src/features/import/ImportPage.module.css` - CSS-variable tokens, light and dark, single column below 768 px
- `web/src/features/import/ImportPage.test.tsx` - Testing Library and axe tests

## Test Hints
- unit: nav entry and empty state (AC-1) · mapping prefill and change triggers preview (AC-2) · invalid line list, disabled button (AC-3) · result counts text (AC-4) · 400 field error shown, HTML in a cell rendered as text (AC-5) · axe, keyboard order, focus after step change (AC-6)
