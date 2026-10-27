# Story-004: Categories page: edit and delete

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-003-categories]] | P1 | S | Ready | frontend-react, testing-unit | Story-002, Story-003 | None |

## Statement
As a signed-in user, I want to rename, re-kind and delete a category on the page, so that I can keep my list tidy and understand why a category in use cannot be removed.

## Acceptance Criteria
- [ ] AC-1 - Given a listed category, when the user chooses Edit, changes the name or kind and saves, then the row shows the new values; Cancel restores the row without a request.
- [ ] AC-2 - Given an edit with an empty or duplicate name, when saved, then the error shows inline on the row and the row stays in edit mode.
- [ ] AC-3 - Given an unused category, when the user chooses Delete and confirms, then the row disappears from the list.
- [ ] AC-4 - Given a category in use, when the delete returns 409, then the row remains and a text message beside it says the category is in use and cannot be deleted.
- [ ] AC-5 - Given the edit and delete controls, when used by keyboard only, then each button has an accessible name containing the category name, focus moves to the edit field on Edit and back to the row after Save, Cancel or a refused delete, and axe reports no violations.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS (5 files) · T PASS

## Impacted Files
- `web/src/features/categories/CategoryRow.tsx` - row with view, edit and delete states, confirm step.
- `web/src/features/categories/CategoryRow.test.tsx` - row tests with a mocked API and an axe check.
- `web/src/features/categories/categories.api.ts` - add update and delete mutations that refresh the list.
- `web/src/features/categories/CategoriesPage.tsx` - render rows through `CategoryRow`.
- `web/src/features/categories/CategoriesPage.module.css` - row and message styles.

## Test Hints
- component: edit and cancel (AC-1), inline errors (AC-2), delete unused (AC-3), 409 message (AC-4), accessible names, focus and axe (AC-5).
