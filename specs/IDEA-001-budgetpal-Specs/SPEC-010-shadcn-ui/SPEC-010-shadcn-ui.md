---
id: SPEC-010
title: Modern UI with shadcn/ui
status: Ready
depends_on: [SPEC-009]
---

# SPEC-010: Modern UI with shadcn/ui

| Priority | Category | Status | Wave | Depends on | Blocks | Index |
|--|--|--|--|--|--|--|
| P1 | Feature | Ready | 7 | [[../SPEC-009-signin-first/SPEC-009-signin-first\|SPEC-009]] | None | [[../IDEA-001-budgetpal-Specs]] |

Source: human `/bug-report`, triaged as new requirements ("UX is very basic and depends on a horizontal menu, make it more modern using https://ui.shadcn.com/"). The human approved Tailwind CSS plus shadcn/ui on Radix, copied into `web/src/components/ui`. D-25 supersedes the CSS-modules part of D-19.

## Delivery Brief
- **Who:** A signed-in BudgetPal user on a laptop or a phone.
- **Gets:** A modern app: a collapsible sidebar (a sheet on small screens) with icons, a top bar with the page title and a user menu, and every page restyled with shadcn/ui components, in light and dark.
- **Value:** The app looks and feels like a product, on desktop and at 360 px, with no change to what it does.
- **Measured by:** Every page renders inside the new frame, keeps its labels, roles and behaviour, has no serious or critical axe violation in either scheme, and the full web suite, build and lint pass.
- **Out of scope:** New features or screens, a manual theme toggle (it would need browser storage, GR-013), the shadcn chart component (it injects raw HTML; Recharts stays), react-hook-form, any API change, Docker or browser runs against compose.

## Acceptance Criteria
- [ ] AC-1 - Tailwind CSS and shadcn/ui are installed per D-25 (`components.json`, `@` alias, `cn` helper, lucide-react). `tsc`, `vite build`, the workspace lint and the vitest suite pass, and the web Dockerfile copies every new config file the build needs (Enabler-001, Enabler-002).
- [ ] AC-2 - Theme tokens are CSS variables with a light and a dark scheme chosen by `prefers-color-scheme` (D-20); there is no toggle and no storage. A test checks the token pairs for contrast (text 4.5:1, UI parts and focus ring 3:1) in both schemes (Enabler-002).
- [ ] AC-3 - The shadcn components used (list in Enabler-002) are copied into `web/src/components/ui`. None uses the raw-HTML prop, browser storage or a cookie for state; jsdom polyfills (`matchMedia`, `ResizeObserver`, pointer capture, `scrollIntoView`) live in the test setup (Enabler-001, Enabler-002).
- [ ] AC-4 - The horizontal menu is replaced by the shadcn Sidebar: icon plus label per feature, the active page marked with `aria-current="page"`, collapsible to icons, a sheet with a labelled trigger below 768 px, usable at 360 px. A top bar shows the page title and a user menu with the email from `/api/auth/me` and Log out (Story-004).
- [ ] AC-5 - Navigation is still built from the registry: a new `features/<x>/feature.ts` appears in the sidebar with a fallback icon and no shared file edit. The SPEC-009 guard, slots and redirects behave as before (Story-004).
- [ ] AC-6 - Login and sign-up use Card, Label, Input and Button; the dashboard uses Card, Tabs or Select for the range with Recharts and its data table kept; accounts and categories use Card, Table or list rows, Input and AlertDialog for delete confirm; transactions use Table, Dialog, AlertDialog, Select and Badge; budgets use Progress and Badge (icon plus text); the CSV import is a stepper with Cards and a preview Table (Story-001 to Story-003).
- [ ] AC-7 - Every page keeps its visible labels, ARIA names, roles and behaviour, and the intent of each existing Test ID. Inline errors stay beside the fields, status is never colour alone, and focus moves as before (all stories).
- [ ] AC-8 - Every page and the frame pass axe with no serious or critical violation in light and dark, are keyboard reachable with a visible focus ring, and have no fixed width wider than 360 px (all stories).
- [ ] AC-9 - Existing page tests are updated, not deleted, and web coverage stays at or above the quality-gate floor (80%). Tests that read `shell.css` or `*.module.css`, check hard-coded colours or use the native `<dialog>` are rewritten (section below).
- [ ] AC-10 - `shell.css` and every `*.module.css` are removed and no page uses a hard-coded colour; Recharts colours come from tokens (all stories).

## Static rules and tests that need attention
- `architecture/static-rules.tsv`: no row needs an update. SR-007 and SR-009 are not triggered by `@/components/ui/*` imports or Tailwind classes; SR-014 and SR-015 forbid the raw-HTML prop and `localStorage` or `sessionStorage` in every web file, so the kit must not contain them (no chart component, no theme persistence, no sidebar cookie).
- `web/src/kernel/source-rules.test.ts`: no change in code. It will now also scan `components/ui` and `lib`; Enabler-002 adds a case that the kit directory is non-empty.
- Must be rewritten: `kernel/Shell.test.tsx` (the `shell.css` test becomes an `index.css` token test, landmarks become sidebar, top bar and main), `features/auth/auth.test.tsx` T-034 (hex and `var(--` check becomes "no hard-coded colour"), `features/accounts/AccountsPage.test.tsx` (reads `accounts.module.css`; native `<dialog>` becomes `alertdialog`), `features/transactions/TransactionsPage.test.tsx` (reads `TransactionsPage.module.css`), `features/budgets/BudgetsPage.test.tsx` (reads `shell.css` and `BudgetProgress.module.css` for contrast; moves to the token test). Other page tests keep their queries by role and name and change only where markup roles change.

## Backlog
| Key | Type | Title | Status | Depends on | Wave | Files | File |
|--|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | Tailwind and shadcn toolchain | Ready | None | 1 | 5 | [[Backlog/Enabler-001-tailwind-shadcn-toolchain]] |
| Enabler-002 | Enabler | Theme tokens, cn helper and component kit | Ready | Enabler-001 | 2 | 5 | [[Backlog/Enabler-002-theme-and-kit]] |
| Story-001 | Story | Dashboard and budgets restyled | Ready | Enabler-002 | 3 | 5 | [[Backlog/Story-001-dashboard-budgets-ui]] |
| Story-002 | Story | Sign-in, accounts and categories restyled | Ready | Enabler-002 | 3 | 5 | [[Backlog/Story-002-signin-accounts-categories-ui]] |
| Story-003 | Story | Transactions and CSV import restyled | Ready | Enabler-002 | 3 | 5 | [[Backlog/Story-003-transactions-import-ui]] |
| Story-004 | Story | Sidebar layout and top bar | Ready | Story-001, Story-002, Story-003 | 4 | 5 | [[Backlog/Story-004-sidebar-layout]] |

## Architecture references
- Decisions: D-19 (CSS-modules part superseded), D-25 (Tailwind CSS and shadcn/ui), D-26 (frontend auth flow), D-20, D-01, D-23
- Containers: Web (C2 diagram)
- Architecture Document: [[../../../architecture/architecture]]

## Risks
- Sizing deviation (SZ-2 and SZ-3): seven pages plus the frame cannot fit six items of five single files. Stories 001 to 003 list one bullet per page folder, and each bullet names its files. The mechanical restyle is low risk, but the planner must check SZ-4 (8 tests per item) and may split a story per page group, which would exceed six items; this needs a human ruling (open question).
- Content-Security-Policy: `web/nginx.conf` sends `default-src 'self'` without `style-src`. Radix scroll-lock and Recharts may inject a `<style>` element that the browser blocks. Effects are cosmetic (no scroll lock gap), but a CSP change is a security decision, so it is not made here; the planner records the choice.
- Tailwind version: D-25 chooses 3 or 4. Version 4 needs only the Vite plugin and CSS config; version 3 adds `tailwind.config.ts` and `postcss.config.js`, which must also be copied in `web/Dockerfile`. The planner moves those two files into Enabler-002 and trims it.
- Existing page tests read CSS files and native `<dialog>`; the jsdom polyfills (Enabler-001) must land before any page restyle or tests fail for the wrong reason.
- Wave 3 stories each own one set of page folders; `shell.css` is deleted only in Story-004 (wave 4) because older page tests and CSS modules still read its tokens until then.
- QG-PROD: n/a, web-only; rollback is a revert of the web files and the lockfile, with no migration.
