# Story-004: Sidebar layout and top bar

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-010-shadcn-ui]] | P1 | M | Ready | frontend-react, testing-unit | Story-001, Story-002, Story-003 | None |

## Statement
As a signed-in user, I want a sidebar with icons and a top bar with my account menu instead of a horizontal menu, so that I can move around the app quickly on a laptop or a phone.

## Acceptance Criteria
- [ ] AC-1 - Given the registry, then the sidebar lists the non-public features in registry order, each with an icon and a label inside `nav` named "Main"; the current page has `aria-current="page"`. A feature with no known icon gets a fallback icon, so a new `feature.ts` needs no shared-file edit.
- [ ] AC-2 - Given the desktop width, then a visible, labelled button collapses the sidebar to icons; collapsed entries keep their accessible names (tooltip text on hover and focus). The state is not persisted (no storage, no cookie).
- [ ] AC-3 - Given a width under 768 px, then the sidebar is hidden and a button named "Open menu" opens it in a Sheet (dialog semantics, focus trap, Escape closes, closes after navigation, focus returns to the button); nothing overflows horizontally at 360 px.
- [ ] AC-4 - Given the top bar, then it shows the current page title as plain text (not a heading, so each page keeps one `h1`), the menu trigger and a user menu.
- [ ] AC-5 - Given the user menu, then its button is named with the email from `/api/auth/me`; it opens a menu with the email and "Log out"; Log out runs the SPEC-009 sign-out and lands on `/login`; arrow keys, Enter and Escape work.
- [ ] AC-6 - Given the SPEC-009 slots, then the health dot sits in the sidebar footer, the separate log-out control from SPEC-009 is replaced by the user menu, and the guard, redirects, loading and error states behave as before.
- [ ] AC-7 - Given landmarks, then the skip link, `nav`, `main#main` and banner exist; `shell.css` is deleted and `main.tsx` imports `index.css`.
- [ ] AC-8 - Given expanded, collapsed and mobile-open states, then each has no serious or critical axe violation in light and dark, with a visible focus ring on every control.

## INVEST
I PASS (after the page stories, which keep reading tokens from `shell.css` until it goes) · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `web/src/kernel/Shell.tsx` - sidebar provider, top bar, user menu, main area (keeps the `features` prop)
- `web/src/kernel/AppSidebar.tsx` - nav from the registry, icon map with fallback, collapse, sheet
- `web/src/kernel/AuthGate.tsx` - pass the user and the health dot to the shell; drop the SPEC-009 log-out control
- `web/src/kernel/shell.css` - deleted
- `web/src/main.tsx` - import `index.css` in place of `shell.css`

## Test Hints
- unit (fake features, `mockSession`): order, icons, fallback, `aria-current` (AC-1); collapse and tooltip names (AC-2)
- unit (`matchMedia` mobile): Sheet open, Escape, navigation closes, focus returns (AC-3); top bar and user menu by keyboard (AC-4, AC-5); log-out call and redirect (AC-5, AC-6)
- unit: landmarks and no `shell.css` file (AC-7); axe in the three states and both schemes (AC-8); the SPEC-009 guard tests still pass unchanged (AC-6)
- Tests beside the code (in scope, not counted in Files) are updated, not deleted: `Shell.test` (landmarks and the `shell.css` check become sidebar and token checks), `AuthGate.test`, `HealthDot.test`.
