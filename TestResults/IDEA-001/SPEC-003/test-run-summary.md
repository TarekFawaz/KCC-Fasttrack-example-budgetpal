---
spec: SPEC-003
commit: 21343ac0f24948a1dca4594565d4d1ced541a716
verifier-pass: 1 (full)
---

# SPEC-003 Test Run Summary

Verified at HEAD `21343ac`. Run from `src/IDEA-001-budgetpal`: `pnpm -r --if-present test` (exit 0; api 145 passed, 1 skipped [SPEC-001 SIGTERM, win32]; web 59 passed), plus `vitest run --reporter=json` in `api` and `web` (exit 0 each) and the root `vitest run` (exit 0). Per-test results come from the JSON reports: every Test ID T-001..T-035 appears in a test name under `categories/` and every matching test passed. `quality-gate -Spec SPEC-003` exit 0. No compose, image build or browser run was attempted (docker-registry unreachable, PREFLIGHT limit); no SPEC-003 Test ID needs one (QG-SMOKE does not apply to this spec). No bug files: no failing AC.

## Epic acceptance criteria
| AC | Status | Evidence |
|--|--|--|
| AC-1 | PASS | T-001, T-002, T-006, T-007 (201 `{id,name,kind,createdAt}`, listed; name trimmed 1-60, kind enum) |
| AC-2 | PASS | T-003, T-009, T-010, T-017 (unique `(user_id, name COLLATE NOCASE)`, 409 problem+json, list unchanged, another user may reuse the name) |
| AC-3 | PASS | T-006, T-011, T-019 (empty/61-char name, bad kind, extra field, empty object, id `abc` -> 400 problem+json with field errors, nothing written) |
| AC-4 | PASS | T-015, T-017 (PATCH name and kind, list shows it, rename to own name 200) |
| AC-5 | PASS | T-005, T-018, T-020, T-021 (RESTRICT row -> `CategoryInUseError` -> 409 "in use", category stays; unused -> 204) |
| AC-6 | PASS | T-004, T-012, T-013, T-022 (cross-user read/update/delete 404, A unchanged; no session 401) |
| AC-7 | PASS | T-024, T-025, T-026, T-027 (empty state, name + kind text, create resets form, inline `role=alert` errors) |
| AC-8 | PASS (jsdom) | T-029..T-035 (edit/cancel/delete, 409 text beside the row, axe clean in view/edit/confirm/error, accessible names, focus). Browser check against `docker compose up` is DEFERRED (docker-registry unreachable); not counted as evidence |
| AC-9 | PASS | T-014, T-016 (`/docs/json` has the 4 operations with body/params/response schemas; checked-in `api/openapi.json` carries both paths), T-023 (`feature.ts` registers route and nav; diff edits no shared web file) |

## Backlog items
| Item | Status | Evidence |
|--|--|--|
| Enabler-001 | PASS | AC-1..AC-5: T-001..T-006 |
| Story-001 | PASS | AC-1..AC-5: T-007..T-014 |
| Story-002 | PASS | AC-1..AC-6: T-015..T-022 |
| Story-003 | PASS | AC-1..AC-5: T-023..T-028 |
| Story-004 | PASS | AC-1..AC-5: T-029..T-035 |

## Atomic test cases
| Test ID | Item | AC | Level | Result | File |
|--|--|--|--|--|--|
| T-001 | Enabler-001 | AC-1 | unit | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.repository.test.ts |
| T-002 | Enabler-001 | AC-1 | integration | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.repository.test.ts |
| T-003 | Enabler-001 | AC-2 | unit | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.repository.test.ts |
| T-004 | Enabler-001 | AC-3 | unit | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.repository.test.ts |
| T-005 | Enabler-001 | AC-4 | unit | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.repository.test.ts |
| T-006 | Enabler-001 | AC-5 | unit | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.schema.test.ts |
| T-007 | Story-001 | AC-1 | integration | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.routes.test.ts |
| T-008 | Story-001 | AC-1 | unit | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.service.test.ts |
| T-009 | Story-001 | AC-2 | integration | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.routes.test.ts |
| T-010 | Story-001 | AC-2 | unit | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.service.test.ts |
| T-011 | Story-001 | AC-3 | integration | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.routes.test.ts |
| T-012 | Story-001 | AC-4 | integration | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.routes.test.ts |
| T-013 | Story-001 | AC-4 | integration | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.routes.test.ts |
| T-014 | Story-001 | AC-5 | integration | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.routes.test.ts |
| T-015 | Story-002 | AC-1 | integration | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.routes.test.ts |
| T-016 | Story-002 | AC-1 | integration | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.routes.test.ts |
| T-017 | Story-002 | AC-2 | integration | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.routes.test.ts |
| T-018 | Story-002 | AC-2 | unit | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.service.test.ts |
| T-019 | Story-002 | AC-3 | integration | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.routes.test.ts |
| T-020 | Story-002 | AC-4 | integration | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.routes.test.ts |
| T-021 | Story-002 | AC-5 | integration | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.routes.test.ts |
| T-022 | Story-002 | AC-6 | integration | PASS | src/IDEA-001-budgetpal/api/src/modules/categories/categories.routes.test.ts |
| T-023 | Story-003 | AC-1 | unit | PASS | src/IDEA-001-budgetpal/web/src/features/categories/CategoriesPage.test.tsx |
| T-024 | Story-003 | AC-2 | unit | PASS | src/IDEA-001-budgetpal/web/src/features/categories/CategoriesPage.test.tsx |
| T-025 | Story-003 | AC-2 | unit | PASS | src/IDEA-001-budgetpal/web/src/features/categories/CategoriesPage.test.tsx |
| T-026 | Story-003 | AC-3 | unit | PASS | src/IDEA-001-budgetpal/web/src/features/categories/CategoriesPage.test.tsx |
| T-027 | Story-003 | AC-4 | unit | PASS | src/IDEA-001-budgetpal/web/src/features/categories/CategoriesPage.test.tsx |
| T-028 | Story-003 | AC-5 | unit | PASS | src/IDEA-001-budgetpal/web/src/features/categories/CategoriesPage.test.tsx |
| T-029 | Story-004 | AC-1 | unit | PASS | src/IDEA-001-budgetpal/web/src/features/categories/CategoryRow.test.tsx |
| T-030 | Story-004 | AC-1 | unit | PASS | src/IDEA-001-budgetpal/web/src/features/categories/CategoryRow.test.tsx |
| T-031 | Story-004 | AC-2 | unit | PASS | src/IDEA-001-budgetpal/web/src/features/categories/CategoryRow.test.tsx |
| T-032 | Story-004 | AC-3 | unit | PASS | src/IDEA-001-budgetpal/web/src/features/categories/CategoryRow.test.tsx |
| T-033 | Story-004 | AC-4 | unit | PASS | src/IDEA-001-budgetpal/web/src/features/categories/CategoryRow.test.tsx |
| T-034 | Story-004 | AC-5 | unit | PASS | src/IDEA-001-budgetpal/web/src/features/categories/CategoryRow.test.tsx |
| T-035 | Story-004 | AC-5 | unit | PASS | src/IDEA-001-budgetpal/web/src/features/categories/CategoryRow.test.tsx |
