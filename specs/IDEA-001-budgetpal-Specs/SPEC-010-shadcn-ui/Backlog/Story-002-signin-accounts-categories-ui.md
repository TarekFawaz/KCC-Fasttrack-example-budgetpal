# Story-002: Sign-in, accounts and categories restyled

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Story | [[../SPEC-010-shadcn-ui]] | P1 | M | Ready | frontend-react, testing-unit | Enabler-002 | Story-004 |

## Statement
As a user, I want the sign-in screens and the accounts and categories pages to look modern, so that the first screen and my reference data feel like a real product.

## Acceptance Criteria
- [ ] AC-1 - Given the login and sign-up pages, then each is a centred shadcn Card with Label, Input and Button; field errors stay beside their field (text with icon, `aria-invalid`, `aria-describedby`), and focus moves to the first error as before.
- [ ] AC-2 - Given the login page, then wrong credentials still show one generic error and the SPEC-009 return-to-target flow is unchanged.
- [ ] AC-3 - Given the accounts page, then accounts are listed in a Table or Card list with the add and edit form in shadcn Input and Button, and the delete confirmation is an AlertDialog (`role="alertdialog"`, focus starts on Cancel, Escape cancels) in place of the native `<dialog>`.
- [ ] AC-4 - Given the categories page, then categories are listed with a Badge for the kind (icon plus text), inline rename and kind change, and the refused-delete reason as text next to the row.
- [ ] AC-5 - Given the three features, then labels, ARIA names, roles, empty states and error messages are unchanged, so the existing tests keep their queries by role and name.
- [ ] AC-6 - Given each page, then it has no serious or critical axe violation in light and dark, is keyboard reachable with a visible focus ring and uses no fixed width over 360 px.
- [ ] AC-7 - Given the features, then `accounts.module.css` and `CategoriesPage.module.css` are deleted, the auth inline style objects are gone, and no hard-coded colour remains; the auth T-034 check and the accounts CSS check are rewritten as "tokens and classes only".

## INVEST
I PASS · N PASS · V PASS · E PASS · S PASS (a mechanical restyle; the planner may split per page if SZ-4 trips) · T PASS

## Impacted Files
- `web/src/features/auth/{LoginPage,SignUpPage}.tsx` - Card layout, shared field component, Button
- `web/src/features/accounts/{AccountsPage,AccountForm}.tsx` - Table or Card list, form, AlertDialog
- `web/src/features/accounts/accounts.module.css` - deleted
- `web/src/features/categories/{CategoriesPage,CategoryRow}.tsx` - list, Badge, inline edit controls
- `web/src/features/categories/CategoriesPage.module.css` - deleted

## Test Hints
- unit: all existing SPEC-002, SPEC-003 and SPEC-004 page flows pass with role and name queries (AC-2, AC-4, AC-5); AlertDialog focus and Escape (AC-3)
- unit: axe in light and dark for login, sign-up, accounts and categories (AC-6); scans for hard-coded colours, `.module.css` imports and the `style=` objects (AC-7)
- Tests beside the code (in scope, not counted in Files) are updated, not deleted: `auth.test` (T-034), `AccountsPage.test` (CSS read and native dialog), `AccountForm.test`, `CategoriesPage.test`, `CategoryRow.test`.
