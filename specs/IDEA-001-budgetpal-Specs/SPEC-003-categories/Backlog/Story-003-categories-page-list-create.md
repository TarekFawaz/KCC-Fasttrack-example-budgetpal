# Story-003: Categories page: list and create

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-003-categories]] | P1 | S | Ready | frontend-react, testing-unit | Story-001 | Story-004 |

## Statement
As a signed-in user, I want a Categories page that lists my categories and lets me add one, so that I can set up my expense and income groups without using the API directly.

## Acceptance Criteria
- [ ] AC-1 - Given the web app, when it builds, then `web/src/features/categories/feature.ts` registers the route and a "Categories" nav entry with no shared file edited.
- [ ] AC-2 - Given no categories, when the page opens, then it shows an empty state that explains how to add the first one; given categories, it lists name and kind (kind as text, not colour only), expense and income grouped or labelled.
- [ ] AC-3 - Given the form with a name and a kind, when submitted, then the category appears in the list and the form resets.
- [ ] AC-4 - Given an empty name or a duplicate name, when submitted, then the API field error or conflict is shown inline next to the field, announced to assistive tech, and the list is unchanged.
- [ ] AC-5 - Given the page, when checked with axe and the keyboard, then there are no violations, inputs have labels, and focus is visible.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `web/src/features/categories/feature.ts` - route and nav entry for the feature registry.
- `web/src/features/categories/categories.api.ts` - TanStack Query hooks for list and create through the kernel API client.
- `web/src/features/categories/CategoriesPage.tsx` - list, empty state and create form.
- `web/src/features/categories/CategoriesPage.module.css` - styles with the CSS-variable tokens; single column below 768 px.
- `web/src/features/categories/CategoriesPage.test.tsx` - Testing Library tests with a mocked API and an axe check.

## Test Hints
- unit: `feature.ts` exports route and nav (AC-1) · component: empty and filled list (AC-2), create flow (AC-3), inline errors (AC-4), axe and label queries (AC-5).
