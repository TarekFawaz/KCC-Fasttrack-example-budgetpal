---
title: "SPEC-010 Story-003 AC-1 Bug-001"
tags:
  - testing
  - bug
  - severity/major
created: 2026-10-28
updated: 2026-10-28
version: 1.0.0
status: verified
---

# Bug-001: Transactions use native `<select>` instead of the kit Select

- **Spec:** SPEC-010
- **Backlog item:** Story-003 (AC-1 and AC-2; spec AC-6)
- **Severity:** major
- **Bug item:** [[../../../specs/IDEA-001-budgetpal-Specs/SPEC-010-shadcn-ui/Backlog/Bug-001-transactions-use-native-select]]

## Evidence
Verifier-run `grep -rn "<select" web/src/features`: 10 native selects across accounts, budgets, categories, import and transactions; `grep -rn "components/ui/select" web/src`: only `kit.test.tsx`. Transactions filters (`TransactionsPage.tsx:164,180`) and form (`TransactionForm.tsx:277,298`) are native, contradicting "Select filters" and "Label, Input and Select". Behaviour, labels and axe results are fine (434/434 tests pass); the gap is the required component.

## Re-verification (scoped pass at `4ec21d5`)
Fixed in `4ec21d5`: `TransactionsPage.tsx` and `TransactionForm.tsx` import and use the kit Select (`@/components/ui/select`); no `<select` remains in the transactions folder (grep). Regression tests `SPEC-010 T-029` (4) and `SPEC-010 T-030` (4) in `TransactionsPage.test.tsx` query role `combobox` by name and pass; `test:coverage` 445/445, exit 0. Status: verified.
