---
title: Spec-writer starter - BudgetPal
idea-id: IDEA-001
tags:
  - framework/handoff
  - ideation
created: 2026-10-27
updated: 2026-10-27
status: active
version: 1.0.0
---

# SpecWriterStarter: BudgetPal

Source idea: [[idea-001-budgetpal]] · Research: [[Research]]

## Problem

A person cannot easily see where their money goes or whether they are within monthly budgets. BudgetPal is a local-only app (docker-compose; api + web) that tracks transactions by account and category, sets monthly category budgets with warnings, and charts spending. Depth `lite`, fast track. The human excluded CSRF tokens, rate limiting, lockout, audit log, session rotation, proxy-aware IP handling, SBOM, image scan and a production-readiness checklist; do not add them.

## Epics (8, the spec budget; E1 is the walking skeleton)

| Epic | Title | Depends on | Owns (file-disjoint area) |
|--|--|--|--|
| E1 | walking-skeleton | none | repo scaffold, `api/src/{app,config,log,db}`, migrations runner, `web/src/{main,app shell}`, `docker-compose.yml`, README |
| E2 | auth | E1 | `api/src/modules/auth`, `web/src/features/auth`, shared validation helper |
| E3 | categories | E2 | `api/src/modules/categories`, `web/src/features/categories` |
| E4 | accounts | E2 | `api/src/modules/accounts`, `web/src/features/accounts` |
| E5 | transactions | E3, E4 | `api/src/modules/transactions`, `web/src/features/transactions` |
| E6 | csv-import | E5 | `api/src/modules/import`, `web/src/features/import` |
| E7 | budgets | E5 | `api/src/modules/budgets`, `web/src/features/budgets` |
| E8 | dashboard | E5 | `api/src/modules/dashboard`, `web/src/features/dashboard` |

Parallel waves: E3 || E4; E6 || E7 || E8. Each epic adds only its own numbered migration file and its own module and feature folders. E1 must provide auto-registration of API routers and web nav entries, so no two specs edit the same file.

## Seed acceptance criteria and backlog candidates

- **E1:** `docker compose up` serves the web page, which shows the API health status. `GET /health` returns 200 JSON. Config comes from env. Logs are single-line JSON. Migrations create one table. Enabler: module and nav registry. Story: see the health status on the home page.
- **E2:** sign-up, login, logout and `me`. Passwords are hashed with argon2id (bcrypt fallback). The session cookie is HttpOnly and SameSite=Lax. Every data route uses `requireUser`, and data is scoped by `user_id` server-side (user A cannot read user B's rows: this is a test). Invalid email or weak password returns 400. Stories: sign up, log in, log out. Enabler: `requireUser` plus a zod-style validation helper.
- **E3:** category CRUD with a kind (expense or income). Names are unique per user. A category in use cannot be deleted, or deleting needs a reassign. Validation on all fields.
- **E4:** account CRUD (name, type, opening balance in minor units). Names are unique per user. Same delete rule as E3.
- **E5:** transaction add, edit and delete (date, amount in minor units, description, account, category). List with month, account and category filters, and pagination. Accounts and categories must belong to the user.
- **E6:** CSV upload, column mapping, preview, import. Duplicates are skipped by the key user + account + date + amount + normalised description, and the result shows imported / skipped / invalid counts. Re-importing the same file adds nothing. Malformed rows are reported by line.
- **E7:** one budget amount per category per month. Progress is spent / budget. Warning at 80% and an over-budget flag above 100%, shown on the page. Only expense categories can have budgets.
- **E8:** spending by category for a month (chart plus table) and a month-over-month trend for the last N months. Aggregates are computed in SQL and scoped to the user. Empty-state handling.

## Impacted areas

New repo (no existing code): `api/`, `web/`, `docker-compose.yml`, `README.md`, `docs/`. Code goes in the agreed folders; the project's `src/` rule applies as the spec-writer sets it.

## Dependencies and unknowns for the spec-writer

- The five `## Open questions` in [[idea-001-budgetpal]] have defaults; use them unless the ASK state answers otherwise.
- Pick the SQLite driver (`better-sqlite3` vs `node:sqlite`) and the chart library in the technical brief.
- Keep each spec to about 30 minutes of agent time, within `spec_sizing` (at most 6 backlog items per spec).
- No specialist briefs exist yet. When they land, link them from here: `TechnicalDecisionBrief.md`, `SecurityDecisionBrief.md`.

## Recommended specialist interrogations

| Specialist | Reason |
|--|--|
| `/technical-interrogator` | Mandatory before specs: driver, validation library, chart library, test tools. |
| `/security-interrogator` | Auth and per-user isolation (E2). Keep to the human-stated scope. |
| `/ux-ui-interrogator` | User-facing web app; the design system is open (fast track: a short section in the technical brief). |
| `/infrastructure-interrogator` | Docker and compose packaging. Keep it local-only: no pipeline, no SBOM, no image scan. |

## Effort and budget

n/a (fast track); see [[idea-001-budgetpal]].

## Related

- Idea: [[idea-001-budgetpal]]
- All ideas: [[../ideas|Ideas MOC]]
