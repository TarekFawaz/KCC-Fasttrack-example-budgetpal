# Enabler-002: Theme tokens, cn helper and component kit

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-010-shadcn-ui]] | P1 | M | Ready | frontend-react, testing-unit | Enabler-001 | Story-001, Story-002, Story-003 |

## Outcome Statement
Enable consistent, accessible styling by adding the theme tokens (light and dark), the `cn` helper and the shadcn components BudgetPal needs, so that the page stories only compose them.

## Acceptance Criteria
- [ ] AC-1 - Given `components.json`, then it records the shadcn style, the `@` aliases (`components`, `ui`, `lib`, `hooks`), the CSS file and `lucide` as the icon library.
- [ ] AC-2 - Given `index.css`, then it defines the shadcn token set (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, radius, sidebar and chart colours) as CSS variables in a light scheme and a dark scheme under `prefers-color-scheme`, plus a visible `:focus-visible` ring (3 px or `ring` token) and status tokens for ok, warning and over (D-20). It has no theme toggle and no storage.
- [ ] AC-3 - Given the token pairs (foreground on background, card, muted, primary, destructive, status colours, sidebar), then a test computes contrast and requires at least 4.5:1 for text and 3:1 for the ring and borders, in both schemes.
- [ ] AC-4 - Given `lib/utils.ts`, then `cn(...)` merges class names and resolves Tailwind conflicts (last wins), covered by unit tests.
- [ ] AC-5 - Given `components/ui`, then it holds the copied components: button, input, label, card, badge, alert, skeleton, separator, table, tabs, select, dialog, alert-dialog, progress, sidebar, sheet, tooltip, dropdown-menu (and the `use-mobile` hook they need). None contains the raw-HTML prop, browser storage or a cookie write, and the Sidebar does not persist its state.
- [ ] AC-6 - Given the jsdom setup, then `matchMedia`, `ResizeObserver`, pointer capture and `scrollIntoView` stand-ins exist, `matchMedia` can be switched per test, and the existing cleanup stays. A smoke test mounts a Dialog, a Select and a Sidebar with no error and no serious or critical axe violation.

## INVEST
I PASS · N PASS · V PASS (every page story needs it) · E PASS · S PASS (generated component copies count as one bullet) · T PASS

## Impacted Files
- `web/components.json` - shadcn configuration
- `web/src/index.css` - Tailwind entry, tokens for both schemes, focus ring
- `web/src/lib/utils.ts` - `cn` helper (+ `utils.test.ts` beside it)
- `web/src/components/ui/*.tsx` - the component copies listed in AC-5 and `web/src/hooks/use-mobile.ts`
- `web/src/test/setup.ts` - jsdom stand-ins (+ `kit.test.tsx` smoke and token tests beside the code)

## Test Hints
- unit: read `index.css`, parse both schemes and compute the contrast pairs (AC-2, AC-3; same idea as the budgets contrast test)
- unit: `cn` merge cases (AC-4); directory scan of `components/ui` for forbidden names (AC-5; assemble the names from parts so SR-014 and SR-015 stay quiet)
- unit (Testing Library + axe): smoke render of the Dialog, Select and Sidebar with `matchMedia` desktop and mobile (AC-6)
- Planner: if D-25 picks Tailwind 3, `tailwind.config.ts` and `postcss.config.js` join this item and `use-mobile.ts` moves to Story-004.
