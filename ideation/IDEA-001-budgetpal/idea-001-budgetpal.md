---
idea-id: IDEA-001
title: BudgetPal
aliases:
  - IDEA-001-budgetpal
tags:
  - framework/idea
  - ideation
created: 2026-10-27
updated: 2026-10-27
status: Ready for spec
version: 1.0.0
architecture-depth: lite
source_prompt: |
  BudgetPal: a personal budgeting web app that helps a user see where their money goes and stay within monthly budgets. Backend REST API (TypeScript on Node, SQLite) and a web frontend (React + Vite). Features: simple sign-up and login (email + password, hashed with a standard library, cookie session; per-user data isolation enforced server-side; no CSRF tokens, no rate limiting, no lockout, no audit log, no session rotation or proxy-aware IP handling: this is a local single-user tool, not an internet-facing service); accounts and categories the user manages; transactions they add, edit, delete and import from a CSV bank export (with duplicate detection); monthly budgets per category with progress and over-budget warnings; a dashboard with spending by category and month-over-month trend charts; validated inputs everywhere. Runs locally with docker-compose (api + web). No external services, no email. Keep the security and operations scope to what a local personal tool needs: plain JSON logs, config from environment, a health endpoint; no SBOM or image-scan requirements, no production-readiness checklist. Split the work into small specs (each buildable in about 30 minutes of agent time) with a thin walking skeleton first (health endpoint, one table, one page, compose up), then auth, then one feature per spec, so that file-disjoint work can proceed in parallel. --fasttrack --silent --assume --depthlevel 2 (one pass, three files and nothing else: the idea file (its '## Phases' carries the order of the epics), a short Research.md with a '## Domain' line (common | specialised | novel), and SpecWriterStarter.md with at most the spec budget of epics, the first one a walking skeleton. No QuickRoadmap.md: ROADMAP.md supersedes it. Collect open questions under '## Open questions' instead of asking)
---

# IDEA-001-budgetpal: BudgetPal

## Original Request

**Input class:** raw-text

> BudgetPal: a personal budgeting web app that helps a user see where their money goes and stay within monthly budgets. Backend REST API (TypeScript on Node, SQLite) and a web frontend (React + Vite). Features: simple sign-up and login (email + password, hashed with a standard library, cookie session; per-user data isolation enforced server-side; no CSRF tokens, no rate limiting, no lockout, no audit log, no session rotation or proxy-aware IP handling: this is a local single-user tool, not an internet-facing service); accounts and categories the user manages; transactions they add, edit, delete and import from a CSV bank export (with duplicate detection); monthly budgets per category with progress and over-budget warnings; a dashboard with spending by category and month-over-month trend charts; validated inputs everywhere. Runs locally with docker-compose (api + web). No external services, no email. Keep the security and operations scope to what a local personal tool needs: plain JSON logs, config from environment, a health endpoint; no SBOM or image-scan requirements, no production-readiness checklist. Split the work into small specs (each buildable in about 30 minutes of agent time) with a thin walking skeleton first (health endpoint, one table, one page, compose up), then auth, then one feature per spec, so that file-disjoint work can proceed in parallel. --fasttrack --silent --assume --depthlevel 2 (one pass, three files and nothing else: the idea file (its '## Phases' carries the order of the epics), a short Research.md with a '## Domain' line (common | specialised | novel), and SpecWriterStarter.md with at most the spec budget of epics, the first one a walking skeleton. No QuickRoadmap.md: ROADMAP.md supersedes it. Collect open questions under '## Open questions' instead of asking)

## Reasoning

- **Interpretation:** a local, single-machine personal finance tracker. A user records or imports transactions, groups them by category and account, sets a monthly budget per category, and sees where money went. Not an internet-facing service.
- **Framing:** a classic CRUD + aggregation app. The hard parts are small: CSV import with duplicate detection, month-bucketed budget progress, and aggregate queries for charts. The stack is fixed by the human (TypeScript/Node, SQLite, React + Vite, docker-compose).
- **Category:** `new-idea`.
- **Security scope (human-stated, not assumed):** no CSRF tokens, rate limiting, lockout, audit log, session rotation, or proxy-aware IP handling. Still required: standard-library password hashing, cookie session, server-side per-user isolation, validated inputs. Ops scope: JSON logs, env config, health endpoint; no SBOM, image scan, or production-readiness checklist.
- **Planned questions** (fast track: collected under `## Open questions`, not asked): 1. CSV format. 2. Currency. 3. Budget model and thresholds. 4. Income and transfers. 5. Sign-up policy.

## Brief

BudgetPal is a local-only personal budgeting web app (React + Vite frontend, TypeScript/Node REST API on SQLite, run with docker-compose). A user signs up, manages accounts and categories, adds, edits, deletes or CSV-imports transactions (duplicates detected), sets monthly budgets per category with progress and over-budget warnings, and reads a dashboard of spending by category and a month-over-month trend. The work is split into 8 small specs: a walking skeleton, auth, then one feature per spec, ordered so that file-disjoint specs can run in parallel.

## Original Human Statement

```text
BudgetPal: a personal budgeting web app that helps a user see where their money goes and stay within monthly budgets. Backend REST API (TypeScript on Node, SQLite) and a web frontend (React + Vite). Features: simple sign-up and login (email + password, hashed with a standard library, cookie session; per-user data isolation enforced server-side; no CSRF tokens, no rate limiting, no lockout, no audit log, no session rotation or proxy-aware IP handling: this is a local single-user tool, not an internet-facing service); accounts and categories the user manages; transactions they add, edit, delete and import from a CSV bank export (with duplicate detection); monthly budgets per category with progress and over-budget warnings; a dashboard with spending by category and month-over-month trend charts; validated inputs everywhere. Runs locally with docker-compose (api + web). No external services, no email. Keep the security and operations scope to what a local personal tool needs: plain JSON logs, config from environment, a health endpoint; no SBOM or image-scan requirements, no production-readiness checklist. Split the work into small specs (each buildable in about 30 minutes of agent time) with a thin walking skeleton first (health endpoint, one table, one page, compose up), then auth, then one feature per spec, so that file-disjoint work can proceed in parallel. --fasttrack --silent --assume --depthlevel 2 (one pass, three files and nothing else: the idea file (its '## Phases' carries the order of the epics), a short Research.md with a '## Domain' line (common | specialised | novel), and SpecWriterStarter.md with at most the spec budget of epics, the first one a walking skeleton. No QuickRoadmap.md: ROADMAP.md supersedes it. Collect open questions under '## Open questions' instead of asking)
```

## Idea Planning

| Field | Value |
|--|--|
| Status | Ready for spec |
| Current step | handoff |
| Architecture depth | lite (depthlevel 2 default; `Assumed under AutoPolicy`, no human override) |
| Category | new-idea |
| Recommended handoff | `/spec-create` with [[SpecWriterStarter]] |
| Likely epics/specs | 8, listed under `## Epics (likely specs)`; specs not yet created (TBD) |

## Generated Files

- Research: [[Research]]
- Spec-writer starter: [[SpecWriterStarter]]
- Specialist briefs (`TechnicalDecisionBrief.md`, `SecurityDecisionBrief.md`): written by the skill after this state; linked once they exist.
- Not written under fast track: Questionnaire, HumanAnswers, ROI, Conclusion, QuickRoadmap.

## Assumptions

All `Assumed under AutoPolicy` (`--silent --assume`), low-risk; none touches a prohibited area (the security exclusions are human-stated).

| # | Assumption | Why | Confidence |
|--|--|--|--|
| A1 | Depth `lite`; multiple specs, not one | depthlevel 2; distinct concerns: scaffold, auth, categories, accounts, transactions, import, budgets, dashboard | 90% |
| A2 | Money stored as integer minor units, one currency per install | Avoids float error; no FX needed for a local tool | 80% |
| A3 | Each module owns its own folders (`api/src/modules/<x>`, `web/src/features/<x>`) and numbered migration files; the skeleton provides auto-registration of routes and nav entries | Keeps specs file-disjoint so they can run in parallel | 85% |
| A4 | Auth uses sessions in SQLite and an HttpOnly, SameSite=Lax cookie; hashing is argon2id (or bcrypt) | Standard-library hashing as requested; SameSite=Lax is the zero-cost mitigation given the no-CSRF-token scope. The security brief confirms | 80% |
| A5 | Charts via one small React chart library; dashboard aggregates computed in SQL | Common, low risk | 85% |

## Open questions

Defaults below apply unless the ASK state returns a different answer (at most 5).

1. **CSV format:** which bank export columns? Default: header-detected `date`, `description`, `amount` (signed), optional `account`/`category`, with a column-mapping step. Duplicate key: user + account + date + amount + normalised description. -> **Assumed: yes**, see [[Assumptions]].
2. **Currency:** a single currency per install, set via an env var and shown as a symbol? Default: yes. -> **Assumed: yes**, see [[Assumptions]].
3. **Budgets:** one amount per category per month, no rollover. Warn at 80% of the budget, and show "over budget" at more than 100%. Default: yes. -> **Assumed: yes**, see [[Assumptions]].
4. **Income and transfers:** categories have a kind (`expense` or `income`). The dashboard counts expenses only. No account-to-account transfers in v1. Default: yes. -> **Assumed: yes**, see [[Assumptions]].
5. **Sign-up:** open registration, so several local users are possible, each isolated server-side? Default: yes. -> **Assumed: yes (open registration)**, see [[Assumptions]].

## Phases

Order of the epics (a number is a dependency order; epics on the same line can run in parallel):

1. **Phase 1, Foundation:** E1 walking skeleton, then E2 auth (sequential).
2. **Phase 2, Reference data:** E3 categories and E4 accounts (parallel, file-disjoint; both need E2).
3. **Phase 3, Core data:** E5 transactions (needs E3 and E4).
4. **Phase 4, Features on transactions:** E6 CSV import, E7 budgets and E8 dashboard (parallel, file-disjoint; all need E5).

## Epics (likely specs)

| Phase | Epic (likely SPEC) | One-line description |
|--|--|--|
| 1 | E1 walking-skeleton | API with `GET /health`, env config, JSON logs, migration runner and one table; one React page that calls it; `docker compose up` runs api + web. Defines the module and nav auto-registration. |
| 1 | E2 auth | Sign-up, login, logout, `me`; argon2id hashing; SQLite session with cookie; `requireUser` middleware; login and sign-up pages; shared validation helper. |
| 2 | E3 categories | Category CRUD (name, kind) scoped to the user, plus a page. |
| 2 | E4 accounts | Account CRUD (name, type, opening balance) scoped to the user, plus a page. |
| 3 | E5 transactions | Transaction add, edit, delete and list (filter by month, account, category), plus a page. |
| 4 | E6 csv-import | Upload a CSV, map columns, preview, import with duplicate detection and a result summary. |
| 4 | E7 budgets | Monthly budget per category, progress (spent vs budget), 80% and over-budget warnings, plus a page. |
| 4 | E8 dashboard | Spending by category chart and month-over-month trend chart for the chosen months. |

## Effort Estimate

n/a (fast track). Each epic is sized to about 30 minutes of agent time.

## Upfront Budget

n/a (fast track). The `fasttrack-approved` run event is the approval.

## Related

- Specs index: [[../../specs/IDEA-001-budgetpal-Specs/IDEA-001-budgetpal-Specs]]
- All ideas: [[../ideas|Ideas MOC]]
- Source protocol: [[../../.KCC/kernel/protocols/idea-layout]]
