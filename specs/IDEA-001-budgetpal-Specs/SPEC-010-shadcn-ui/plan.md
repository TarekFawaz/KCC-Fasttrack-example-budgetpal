---
id: SPEC-010-plan
status: ready
version: 1.0.0
spec: SPEC-010
profile: fasttrack
---

# SPEC-010 Implementation Plan

Prefix: `W` = `src/IDEA-001-budgetpal/web`. Backlog files write `web/...`; both name the same files.

## Dependency Check
- SPEC-009 (sign-in first) is the only dependency. Its spec is Ready and it has no `plan.md` yet, so SPEC-010 is planned against its declared contracts: `kernel/AuthGate.tsx`, `kernel/session.ts`, `kernel/HealthDot.tsx`, Shell `actions`/`footer` slots, `src/test/session.ts` `mockSession`, `features/auth` multi-feature registry, `/` is the dashboard, Home page gone. **IMPLEMENT waits until SPEC-009 is APPROVED and merged**; Story-004 and the auth test rewrites cannot start before that.
- SPEC-006, SPEC-007 and SPEC-008 are the sources of the pages restyled here; their behaviour is not changed.
- No `Proposed` ADR blocks any item. D-22 (`Proposed`) concerns compose ports, which this spec does not touch.

## Architecture Gate Check
- Stack: Tailwind CSS 3.4 via PostCSS, shadcn/ui on Radix, lucide-react, cva, clsx, tailwind-merge 2, tailwindcss-animate (D-25, human-approved). Tailwind 4 and the `@tailwindcss/vite` plugin are NOT used, so `tailwind.config.ts` and `postcss.config.js` exist and join Enabler-002 (spec Risks) and the Dockerfile copies them. Recharts stays (D-19); no shadcn `chart`, no react-hook-form.
- C4 container: Web (C2 diagram in `architecture/architecture.md`). Decisions: D-19 (CSS-modules part superseded), D-25, D-26, D-20, D-01, D-23. No `arch.md` or `c4-*.md` under fasttrack.
- Gates: QG-ARCH-CONFORMANCE, QG-TRACE, QG-SCOPE, QG-QUALITY, QG-STATIC, QG-A11Y, QG-SMOKE, QG-PROD, QG-BUGS. The API contract, isolation, validation, credential and CSV-import gates do not apply (no API, no auth endpoint, no import endpoint, no migration); the architecture-docs gate is run-level.
- Human hint H-001: docker compose steps (QG-SMOKE) and SAST are **accepted-deferred, never PASS**. They are not retried and do not park the spec.
- Fitness functions: none beyond the gates. NFRs: D-20 (WCAG 2.2 AA, 360 px, light and dark by `prefers-color-scheme`). Budgets: none for web.

## Backlog Coverage
| Item | Type | Dialect | Complexity | Wave | Plan coverage | Notes |
|--|--|--|--|--|--|--|
| Enabler-001 | Enabler | frontend-react | medium | 1 | Covered | Dependencies, `@` alias, Dockerfile COPY lines (config files land in Enabler-002) |
| Enabler-002 | Enabler | frontend-react, testing-unit | high | 2 | Covered | Tokens, kit, `cn`, jsdom stand-ins, plus `tailwind.config.ts` and `postcss.config.js` (Tailwind 3); contrast maths |
| Story-001 | Story | frontend-react, testing-unit | medium | 3 | Covered | Dashboard and budgets |
| Story-002 | Story | frontend-react, testing-unit | high | 3 | Covered | Authentication pages; accounts, categories |
| Story-003 | Story | frontend-react, testing-unit | high | 3 | Covered | Transactions and CSV import; renders imported cells as plain text (GR-009) |
| Story-004 | Story | frontend-react, testing-unit | high | 4 | Covered | Sidebar, user menu, log out (authentication UI) |

## Ordered Changes
1. **Enabler-001** `W/package.json`, `pnpm-lock.yaml`: add `tailwindcss@^3.4`, `postcss@^8`, `autoprefixer@^10`, `tailwindcss-animate@^1.0.7`, `class-variance-authority@^0.7`, `clsx@^2`, `tailwind-merge@^2`, `lucide-react@^1`, and the Radix packages the kit needs (`react-slot`, `react-dialog`, `react-alert-dialog`, `react-label`, `react-select`, `react-dropdown-menu`, `react-tooltip`, `react-progress`, `react-tabs`, `react-separator`; ranges per D-25). No new scripts. Why: AC-1.
2. **Enabler-001** `W/vite.config.ts` (`resolve.alias` `@` -> `src`; proxy untouched; no Tailwind Vite plugin), `W/tsconfig.json` (`baseUrl`/`paths` `@/*`). Why: AC-2, AC-3.
3. **Enabler-001** `W/Dockerfile`: COPY `web/components.json web/tailwind.config.ts web/postcss.config.js` before the build step; stage names and pinned tags unchanged. Why: AC-4 (SR-018).
4. **Enabler-002** `W/tailwind.config.ts` (`darkMode: 'media'`, `content`, token colours mapped to `hsl(var(--x))`, `tailwindcss-animate`), `W/postcss.config.js` (tailwindcss, autoprefixer), `W/components.json`. Why: AC-1, AC-2.
5. **Enabler-002** `W/src/index.css`: `@tailwind` layers, tokens (light, dark under `@media (prefers-color-scheme: dark)`), sidebar and chart tokens, status ok/warning/over tokens, `:focus-visible` ring. No toggle, no storage. Why: AC-2.
6. **Enabler-002** `W/src/lib/utils.ts` (`cn`), `W/src/components/ui/*.tsx` (the 18 components of AC-5, copied and adapted: no raw-HTML prop, no storage, no cookie, Sidebar state not persisted), `W/src/hooks/use-mobile.ts`. `use-mobile.ts` stays here, not in Story-004, because `sidebar.tsx` imports it and the AC-6 smoke test mounts the Sidebar. Why: AC-4, AC-5.
7. **Enabler-002** `W/src/test/setup.ts`: `matchMedia` (switchable per test), `ResizeObserver`, pointer capture, `scrollIntoView`; keep `cleanup`. Tests: `lib/utils.test.ts`, `components/ui/kit.test.tsx`, `src/theme.test.ts`. Why: AC-3, AC-6.
8. **Story-001** dashboard: `DashboardPage.tsx`, `SpendingByCategory.tsx`, `TrendChart.tsx` (Cards, Tabs or Select, token colours via `hsl(var(--chart-n))`, table alternative kept); delete `dashboard.module.css`. Update the six dashboard tests. Why: AC-1, AC-2, AC-5, AC-6.
9. **Story-001** budgets: `BudgetsPage.tsx`, `BudgetForm.tsx`, `BudgetProgress.tsx` (Card, Input, Button, Progress, Badge with icon plus text); delete both `.module.css`; the contrast test now reads token pairs. Why: AC-3, AC-4, AC-6.
10. **Story-002** auth: `LoginPage.tsx`, `SignUpPage.tsx` (centred Card, a small shared field component in `features/auth/`, `style=` objects gone). Rewrite `auth.test.tsx` T-034. Why: AC-1, AC-2, AC-7.
11. **Story-002** accounts and categories: `AccountsPage.tsx`, `AccountForm.tsx` (AlertDialog replaces native `<dialog>`), `CategoriesPage.tsx`, `CategoryRow.tsx` (Badge for kind); delete both `.module.css`. Rewrite `AccountsPage.test.tsx`. Why: AC-3 to AC-7.
12. **Story-003** transactions: `TransactionsPage.tsx`, `TransactionForm.tsx` (Table in its own scroll container, Select filters, Dialog form, AlertDialog delete, Badge); delete the `.module.css`; rewrite the CSS check in `TransactionsPage.test.tsx`. Why: AC-1 to AC-3, AC-5 to AC-7.
13. **Story-003** import: `ImportPage.tsx` (stepper with `aria-current="step"`, Cards, preview Table; cells rendered as plain text); delete the `.module.css`. Why: AC-4 to AC-7.
14. **Story-004** `kernel/AppSidebar.tsx` (registry nav in `nav` "Main", icon map with fallback, collapse button, Sheet below 768 px with "Open menu" trigger, tooltips on collapsed entries, no persistence) and `kernel/Shell.tsx` (SidebarProvider, top bar with plain-text title, user menu with email and Log out, `main#main`, skip link; keeps the `features` prop). Why: AC-1 to AC-5, AC-7.
15. **Story-004** `kernel/AuthGate.tsx` passes user, sign-out and health dot to the Shell, drops the SPEC-009 log-out control; delete `kernel/shell.css`; `main.tsx` imports `index.css`. Rewrite `Shell.test.tsx`; update `AuthGate.test.tsx`, `HealthDot.test.tsx`. Why: AC-6, AC-7, AC-8.

## Waves
Authoritative; overrides the spec's `Wave` column (identical here).

| Wave | Items | Files | File-disjoint | Notes |
|--|--|--|--|--|
| 1 | Enabler-001 | package.json, lockfile, vite.config.ts, tsconfig.json, Dockerfile | yes (single item) | Toolchain first; no page file touched |
| 2 | Enabler-002 | config trio, index.css, lib, ui kit, hooks, test setup | yes (single item) | Needs the packages and alias from wave 1 |
| 3 | Story-001, Story-002, Story-003 | `features/{dashboard,budgets}`, `features/{auth,accounts,categories}`, `features/{transactions,import}` | yes: three disjoint folder sets, tests live in the owning folder | Stories read only `@/components/ui`, `@/lib`, `@/hooks` (kit frozen after wave 2); none touches `kernel/` |
| 4 | Story-004 | `kernel/*`, `main.tsx` | yes (single item) | Deletes `shell.css` last, after every `.module.css` reader is gone |

## Dialects Loaded
- `frontend-react` - React 18 pages and the shadcn kit
- `testing-unit` - mandatory; Testing Library and axe tests
- `testing-integration` - mandatory; mocked-API flows (build check, AuthGate + Shell)
- `testing-performance`, `testing-security` - not loaded: no item scopes them

## New Files
Under `W`: `tailwind.config.ts`, `postcss.config.js`, `components.json`, `src/index.css`, `src/lib/utils.ts`, `src/lib/utils.test.ts`, `src/hooks/use-mobile.ts`, `src/components/ui/*.tsx` (+ `kit.test.tsx`), `src/theme.test.ts`, `src/kernel/toolchain.test.ts`, `src/kernel/AppSidebar.tsx` (+ `AppSidebar.test.tsx`), a field component in `src/features/auth/`. Deleted: `shell.css` and the seven `*.module.css` files (dashboard, BudgetsPage, BudgetProgress, accounts, CategoriesPage, TransactionsPage, ImportPage).

## Toolchain
| Tool | Version |
|--|--|
| node | >=22 <25 |
| pnpm | >=9 |
| typescript | ^5 |
| react | ^18 |
| react-dom | ^18 |
| vite | ^5 |
| react-router-dom | ^6 |
| @tanstack/react-query | ^5 |
| recharts | ^2 |
| tailwindcss | ^3.4 |
| postcss | ^8 |
| autoprefixer | ^10 |
| tailwindcss-animate | ^1.0.7 |
| @radix-ui/react-* (per component) | ^1 / ^2 |
| lucide-react | ^1 |
| class-variance-authority | ^0.7 |
| clsx | ^2 |
| tailwind-merge | ^2 |
| vitest | ^2 |
| @testing-library/react | ^16 |
| axe-core | ^4 |

## Wave file allowances
| Item | Paths (backticked, `src/IDEA-001-budgetpal/...`, `/**` allowed) |
|--|--|
| Enabler-001 | `src/IDEA-001-budgetpal/web/src/kernel/toolchain.test.ts` |
| Enabler-002 | `src/IDEA-001-budgetpal/web/tailwind.config.ts`, `src/IDEA-001-budgetpal/web/postcss.config.js`, `src/IDEA-001-budgetpal/web/src/components/ui/**`, `src/IDEA-001-budgetpal/web/src/lib/**`, `src/IDEA-001-budgetpal/web/src/hooks/**`, `src/IDEA-001-budgetpal/web/src/theme.test.ts` |
| Story-001 | `src/IDEA-001-budgetpal/web/src/features/dashboard/**`, `src/IDEA-001-budgetpal/web/src/features/budgets/**` |
| Story-002 | `src/IDEA-001-budgetpal/web/src/features/auth/**`, `src/IDEA-001-budgetpal/web/src/features/accounts/**`, `src/IDEA-001-budgetpal/web/src/features/categories/**` |
| Story-003 | `src/IDEA-001-budgetpal/web/src/features/transactions/**`, `src/IDEA-001-budgetpal/web/src/features/import/**` |
| Story-004 | `src/IDEA-001-budgetpal/web/src/kernel/AppSidebar.tsx`, `src/IDEA-001-budgetpal/web/src/kernel/AppSidebar.test.tsx`, `src/IDEA-001-budgetpal/web/src/kernel/Shell.test.tsx`, `src/IDEA-001-budgetpal/web/src/kernel/AuthGate.test.tsx`, `src/IDEA-001-budgetpal/web/src/kernel/HealthDot.test.tsx` |

## Risk Flags
- **SZ-3 / SZ-4 (spec Risks, open human ruling).** Enabler-002 now owns the two Tailwind 3 config files too (7 files, shown here as allowances because I cannot edit backlog files); the three page stories keep one bullet per page group. Each item stays at or under 8 tests (SZ-4), so no split is requested. A human may still prefer splitting Enabler-002 (kit vs config) or `ImportPage.tsx`; the plan works either way because file-disjointness is by folder.
- **`cn` location.** D-25 text says `web/src/kernel/`; the backlog, `components.json` aliases and the shadcn copies use `@/lib/utils`. The plan follows the backlog (`web/src/lib/utils.ts`); the architect should correct the D-25 wording. It is a path, not a stack change.
- **CSP.** `web/nginx.conf` is NOT changed (a CSP change is a security decision). Radix scroll-lock and Recharts may inject a `<style>` the browser blocks; the effect is a missing scroll lock only. The verifier notes it as an observation; no `unsafe-inline`.
- **Dark scheme in jsdom.** Dark follows `prefers-color-scheme` only, and jsdom applies no CSS. Page axe tests toggle `matchMedia` and a `dark` class to exercise both branches; colour contrast is proven by the token-pair test (T-008), not by axe.
- **Unshippable middle.** `index.css` is first imported by `main.tsx` in Story-004 (wave 4). Waves 1 to 3 are not shippable alone; the lane merges as one pull request.
- **Coverage.** The kit is vendor copy with many unused exports. Keep it inside coverage first; if QG-COV falls under 80%, exclude only `src/components/ui/**` in `vite.config.ts` with a comment, and say so in the return.
- **Waived or deferred (H-001).** Docker compose smoke and SAST are accepted-deferred and never reported PASS. The Dockerfile change is proven only by text tests (T-005, T-013).
- **Lint.** The workspace ESLint also lints the kit and both new config files; fix generated-code lint errors in place.
- **SPEC-009 not yet built.** Names in Story-004 (`AuthGate`, slots, `mockSession`) come from SPEC-009's backlog; if SPEC-009 lands different names, adapt in Story-004 only.
- Standard vs plan: none differ.

## Atomic test cases
Name each test `SPEC-010 T-0nn ...` so the ID appears in the test name. Tests live beside the code (see allowances).

| Test ID | Item | AC | Level | Description |
|--|--|--|--|--|
| T-001 | Enabler-001 | AC-1 | unit | `web/package.json` lists every D-25 package within its range and the lockfile has an entry for each |
| T-002 | Enabler-001 | AC-2 | unit | A module imported through `@/kernel/registry` resolves and runs under vitest |
| T-003 | Enabler-001 | AC-2 | unit | `tsconfig.json` `paths` and the Vite alias both map `@` to `src`; no Tailwind Vite plugin in the config |
| T-004 | Enabler-001 | AC-3 | integration | Existing `build.test.ts` T-016 (build output, proxy rewrite) passes unchanged with the new dependencies |
| T-005 | Enabler-001 | AC-4 | unit | Dockerfile text COPYs `components.json`, `tailwind.config.ts`, `postcss.config.js` before the build RUN; stage names and pinned tags as SR-018 expects |
| T-006 | Enabler-002 | AC-1 | unit | `components.json` has the style, the `components`/`ui`/`lib`/`hooks` aliases, the CSS path and `iconLibrary: lucide` |
| T-007 | Enabler-002 | AC-2 | unit | `index.css` defines every listed token in a light block and a dark `prefers-color-scheme` block, status ok/warning/over, `:focus-visible`, and no toggle or storage; `tailwind.config.ts` has `darkMode: 'media'` and the animate plugin |
| T-008 | Enabler-002 | AC-3 | unit | Parse both schemes, compute contrast: text pairs >= 4.5:1, ring and border >= 3:1, status and sidebar pairs included |
| T-009 | Enabler-002 | AC-4 | unit | `cn` joins classes, drops falsy values and lets the last conflicting Tailwind class win |
| T-010 | Enabler-002 | AC-5 | unit | `components/ui` holds the 18 listed components plus `use-mobile`, none holds the raw-HTML prop, a storage name or `document.cookie` (names built from parts); Sidebar never persists |
| T-011 | Enabler-002 | AC-6 | unit | Setup stand-ins exist; `matchMedia` flips per test; `cleanup` still runs |
| T-012 | Enabler-002 | AC-6 | unit | Dialog, Select and Sidebar mount on desktop and mobile `matchMedia` with no error and no serious or critical axe violation |
| T-013 | Enabler-002 | AC-2 | unit | Every config file the Dockerfile COPYs exists; `postcss.config.js` lists tailwindcss and autoprefixer; `content` covers `src/**/*.{ts,tsx}` |
| T-014 | Story-001 | AC-1 | unit | Tabs or Select changes the dashboard range; charts sit in Cards; chart colours are `var(--...)` tokens; the table alternative is present |
| T-015 | Story-001 | AC-2 | unit | Existing dashboard suites (spending, trend, empty, error, `Intl` currency) pass with their queries and intent |
| T-016 | Story-001 | AC-3 | unit | Budget row: Progress with name and `aria-valuenow`, Badge with icon and text, Input and Button form, same inline validation errors |
| T-017 | Story-001 | AC-4 | unit | At 79%, 80%, 100%, 101% the status is ok, warning, warning, over, each with icon plus text |
| T-018 | Story-001 | AC-5 | unit | axe: no serious or critical violation on dashboard and budgets under both `matchMedia` schemes |
| T-019 | Story-001 | AC-5 | unit | Controls tab-reachable with the focus-ring class; no fixed width over 360 px in the two features' classes |
| T-020 | Story-001 | AC-6 | unit | The three `.module.css` files are gone, nothing imports them, no hex, `rgb()`, `hsl()` or palette-colour class in the two features |
| T-021 | Story-001 | AC-6 | unit | The budgets contrast test reads the status tokens from `index.css` and meets 4.5:1 and 3:1 |
| T-022 | Story-002 | AC-1 | unit | Login and sign-up: Card, Label, Input, Button; errors beside the field with icon, `aria-invalid`, `aria-describedby`; focus to first error |
| T-023 | Story-002 | AC-2 | unit | Wrong credentials give one generic error; login returns to the remembered target |
| T-024 | Story-002 | AC-3 | unit | Accounts list and form; delete opens `role="alertdialog"`, focus on Cancel, Escape cancels, no native `<dialog>` |
| T-025 | Story-002 | AC-4 | unit | Categories: Badge for kind (icon and text), inline rename and kind change, refused-delete reason beside the row |
| T-026 | Story-002 | AC-5 | unit | Existing auth, accounts and categories suites pass with role-and-name queries; labels, empty states and messages unchanged |
| T-027 | Story-002 | AC-6 | unit | axe in both schemes for login, sign-up, accounts, categories; keyboard reachable; no fixed width over 360 px |
| T-028 | Story-002 | AC-7 | unit | Both `.module.css` gone, no `style=` objects in auth, no hard-coded colour; rewritten auth T-034 and accounts CSS checks pass |
| T-029 | Story-003 | AC-1 | unit | Transactions Table in its own scroll container; Select filters, Badge, paging Buttons |
| T-030 | Story-003 | AC-2 | unit | Add and edit in a Dialog: title, description, focus trap, Escape closes, focus returns, inline errors |
| T-031 | Story-003 | AC-3 | unit | Delete AlertDialog (`alertdialog`, focus on Cancel); the row leaves only after the API confirms |
| T-032 | Story-003 | AC-4 | unit | Import stepper: `aria-current="step"`, focus on the step heading, preview Table with per-line errors, `=SUM(A1)` shown as plain text |
| T-033 | Story-003 | AC-5 | unit | Existing filter, paging, `Intl` amount, duplicate-skip, caps and by-line error tests pass with the same fixtures |
| T-034 | Story-003 | AC-6 | unit | axe in both schemes with the Dialog and AlertDialog open; keyboard reachable; no page-level scroll classes at 360 px |
| T-035 | Story-003 | AC-7 | unit | Both `.module.css` gone, no import of them, no hard-coded colour; the transactions CSS check rewritten to tokens |
| T-036 | Story-004 | AC-1 | unit | Nav "Main" lists non-public features in registry order with icons; a feature without an icon gets the fallback; `aria-current="page"` on the active entry |
| T-037 | Story-004 | AC-2 | unit | Collapse button is labelled; collapsed entries keep names (tooltip on hover and focus); no storage or cookie write |
| T-038 | Story-004 | AC-3 | unit | Mobile `matchMedia`: "Open menu" opens a Sheet, Escape closes, navigation closes it, focus returns; no horizontal overflow classes |
| T-039 | Story-004 | AC-4 | unit | Top bar shows the title as plain text; the page keeps exactly one `h1` |
| T-040 | Story-004 | AC-5 | integration | `mockSession` user: menu button named by email; menu shows email and Log out; Log out calls sign-out and lands on `/login`; arrows, Enter, Escape work |
| T-041 | Story-004 | AC-6 | integration | AuthGate + Shell: health dot in the sidebar footer, no separate log-out control, guard, redirects, loading and error states as before |
| T-042 | Story-004 | AC-7 | unit | Skip link, `nav`, `main#main`, banner exist; `shell.css` file absent; `main.tsx` imports `index.css` |
| T-043 | Story-004 | AC-8 | unit | axe for expanded, collapsed and mobile-open states in both schemes; every control has the focus-ring class |

Totals: 43 (unit 40, integration 3); at most 8 per item.

## Standards coverage
| Standard | Verifier check | Covered by |
|--|--|--|
| standards-catalog: Accessibility WCAG 2.2 AA | axe on every page, visible focus, contrast, status not colour-only, chart table alternative | T-008, T-012, T-018, T-019, T-027, T-034, T-043, T-014, T-017 |
| standards-catalog: Supply chain | committed lockfile, audit with no high production advisory | T-001, check:QG-LOCK, check:QG-DEPS |
| standards-catalog: Security (output encoding, no browser storage) | no raw HTML, no storage | T-010, T-037, check:QG-STATIC |
| standards-catalog: Testing | coverage floor 80%, traceability | check:QG-COV, check:QG-TEST, verifier:check-traceability |
| standards-catalog: Containers | non-root, pinned tags | T-005, T-013 |
| api-standards | no HTTP API added or changed | n/a: web-only spec, no API file in any item |

## Gates coverage
| Gate | Covered by |
|--|--|
| QG-ARCH-CONFORMANCE | T-001, T-003, verifier:Decisions table and Toolchain compared with web package.json and imports |
| QG-TRACE | verifier:check-traceability -Spec SPEC-010 exits 0 |
| QG-SCOPE | verifier:quality-gate -Spec SPEC-010 scopes from this table |
| QG-QUALITY | check:QG-LOCK, check:QG-BUILD, check:QG-LINT, check:QG-TEST, check:QG-COV, check:QG-SECRETS, check:QG-DEPS, verifier:SAST accepted-deferred per H-001 and never PASS |
| QG-STATIC | check:QG-STATIC, T-010, T-020, T-028, T-035 |
| QG-A11Y | T-012, T-018, T-027, T-034, T-043, verifier:visual review of light and dark and 360 px against vite preview |
| QG-SMOKE | T-005, T-013, verifier:compose smoke accepted-deferred per H-001 and never PASS |
| QG-BUGS | verifier:check-run-conformance -Scope bugs exits 0 |
| QG-PROD-1 | verifier:no health or api or compose file is changed by this spec |
| QG-PROD-2 | verifier:no logging code is touched |
| QG-PROD-3 | verifier:no configuration or secret is added, check:QG-SECRETS |
| QG-PROD-4 | verifier:api is not changed |
| QG-PROD-5 | verifier:no migration exists and rollback is a revert of the web files and the lockfile |
| QG-PROD-6 | verifier:README redeploy text is unchanged |
| GR-001, GR-005, GR-011 | n/a:no compose file or nginx.conf is changed and the CSP stays as is |
| GR-002, GR-003, GR-004, GR-008, GR-010, GR-014, GR-015, GR-016 | n/a:no API or SQL or migration or env file is touched |
| GR-006 | static-rules:SR-006 SR-007, T-036 |
| GR-007 | static-rules:SR-009 |
| GR-009 | T-032 |
| GR-012 | verifier:every package in D-25 is in web package.json and the lockfile and an import and no second chart or UI library exists |
| GR-013 | static-rules:SR-014 SR-015, T-010, T-037 |
| GR-017 | static-rules:SR-018, T-005, verifier:Docker run deferred by H-001 |
| GR-018 | verifier:no CSRF or rate-limit or audit or SBOM dependency appears |

## Routing

Written by `kcc route` from each item's Complexity, its files, its domain and CR-7 risk. `kcc-run` and the orchestrator read it;
do not edit it by hand (rerun `kcc route`).

| Item | Wave | Tier | Model | Effort | Why |
|--|--|--|--|--|--|
| Enabler-001 | 1 | balanced | claude-sonnet-5-5 | medium | agent default: balanced / medium |
| Enabler-002 | 2 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (token): effort high |
| Story-001 | 3 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (token): effort high |
| Story-002 | 3 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (authentication): effort high |
| Story-003 | 3 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (token): effort high |
| Story-004 | 4 | balanced | claude-sonnet-5-5 | high | agent default: balanced / medium; security-sensitive (authentication): effort high |

## Verification Steps
Run from `src/IDEA-001-budgetpal`:
1. `pnpm install --frozen-lockfile` (QG-LOCK) after wave 1; `pnpm audit --prod --audit-level high` (QG-DEPS; Enabler-001 AC-1).
2. `pnpm --filter @budgetpal/web build` (tsc plus vite; T-004) and `pnpm lint` after every wave.
3. `pnpm --filter @budgetpal/web test:coverage`; all of T-001 to T-043 pass, coverage at or above 80% (AC-9).
4. `grep` that no `*.module.css`, `shell.css`, `style=` object or hard-coded colour remains (T-020, T-028, T-035, T-042; AC-10).
5. `quality-gate -Spec SPEC-010` then `check-traceability -Spec SPEC-010`; each epic AC maps: AC-1 T-001..T-005, AC-2 T-007..T-008, AC-3 T-010..T-012, AC-4 T-036..T-040, AC-5 T-036, T-041, AC-6 T-014..T-035, AC-7 T-015, T-026, T-033, AC-8 T-018, T-027, T-034, T-043, AC-9 coverage run, AC-10 T-020, T-028, T-035.
6. Verifier visual pass at 360 px, light and dark, on `vite preview`; note the CSP scroll-lock observation. Docker compose and SAST are accepted-deferred (H-001).

## Scope
Large (about 70 files including tests): two enablers and four stories, one per page group.

## Confidence
Confidence: 95%

## Related
- Epic spec: [[SPEC-010-shadcn-ui]]
- Idea-specs index: [[../IDEA-001-budgetpal-Specs]]
- All specs: [[../../specs|All specs MOC]]
