# Story-004: Accounts page: edit and delete

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-004-accounts]] | P1 | S | Ready | frontend-react, testing-unit | Story-002, Story-003 | None |

## Statement
As a signed-in user, I want to edit or delete an account from the page, so that I can fix a wrong name or balance and remove accounts I no longer use.

## Acceptance Criteria
- [ ] AC-1 - Given a row, when I choose Edit, then the form is prefilled (balance shown as a decimal), and saving sends integer minor units and updates the row.
- [ ] AC-2 - Given an edit with a duplicate name or invalid field, when I save, then inline field errors show and the row is unchanged.
- [ ] AC-3 - Given a row, when I choose Delete and confirm in an accessible dialog, then the account is removed from the list.
- [ ] AC-4 - Given the API answers 409 because transactions use the account, when I confirm delete, then the dialog stays closed, the row stays and a message states the account is in use and cannot be deleted.
- [ ] AC-5 - Given the edit and delete controls, when I use only the keyboard, then every control is reachable, has an accessible name that includes the account name, and axe reports no serious or critical violation.

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS · T PASS

## Impacted Files
- `web/src/features/accounts/AccountsPage.tsx` - row actions, delete confirmation, in-use message
- `web/src/features/accounts/AccountForm.tsx` - edit mode with prefilled values
- `web/src/features/accounts/accounts.api.ts` - update and delete hooks

## Test Hints
- unit (AC-1, AC-2): Testing Library with mocked 200 and 400/409 answers; assert the PUT body uses minor units.
- unit (AC-3, AC-4): mocked 204 and 409 on DELETE; assert row and message.
- unit (AC-5): keyboard tab order, role and name queries, `axe-core`.
