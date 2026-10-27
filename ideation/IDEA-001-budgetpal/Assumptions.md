---
title: Assumptions - BudgetPal (ASK state)
idea-id: IDEA-001
tags:
  - framework/ask
  - ideation
created: 2026-10-27
updated: 2026-10-27
status: active
version: 1.0.0
---

# Assumptions

Fast track, `--silent --assume`, depthlevel 2. Merges the `## Open questions` of
[[idea-001-budgetpal]], [[TechnicalDecisionBrief]] and [[SecurityDecisionBrief]]
(5 per domain, 15 total). Each answer cites the standards-catalogue default,
an architecture style, or the idea's own stated default; a CR-7 domain
question with no catalogue default is left open instead (see *Still open*
below) per `.KCC/kernel/protocols/auto-mode.md` -> CR-7.

| Question | Assumed answer | Rule followed | Risk |
|--|--|--|--|
| [Idea Q1] CSV format - which bank columns? | Header-detected `date`, `description`, `amount` (signed), optional `account`/`category`, with a column-mapping step; dedupe key = user + account + date + amount + normalised description | Standards catalogue - Data - CSV import/export (RFC 4180): header row, UTF-8, size/row limits; idea's own stated default | Low - mapping step covers format variance |
| [Idea Q2] Currency - single currency per install via env, shown as a symbol? | Yes | Standards catalogue - Data - Money (ISO 4217): integer minor units + currency code; idea's own stated default | Low - no FX needed for v1 |
| [Idea Q3] Budgets - one amount per category per month, no rollover, warn at 80%, over-budget above 100%? | Yes | Idea's own stated default (no catalogue row for business-logic thresholds; low-risk, reversible) | Low |
| [Idea Q4] Income and transfers - category kind `expense`/`income`, dashboard counts expenses only, no transfers in v1? | Yes | Idea's own stated default (product-scope choice, not CR-7) | Low - scope-narrowing, addable in v2 |
| [Idea Q5] Sign-up - open registration, several isolated local users? | Yes, open registration | Idea's own stated default + Standards catalogue - Security - Authorization and data isolation: deny-by-default, ownership enforced server-side, tested with two users, makes open registration safe | Low-medium - account enumeration accepted for a local tool (Security brief R10) |
| [Technical Q1] CSV format - header-detected, column-mapping, date formats ISO/`DD/MM/YYYY`/`MM/DD/YYYY` chosen at mapping? | Confirmed | Standards catalogue - CSV import (RFC 4180); idea default | Low - explicit mapping avoids silent date-format guessing |
| [Technical Q2] Currency - `CURRENCY` env, default `USD`? | Confirmed, default `USD` | Standards catalogue - Money (ISO 4217); default code is a reversible, low-risk implementation detail (env override available) | Low |
| [Technical Q3] Budget thresholds - warn 80%, over budget above 100%, no rollover? | Confirmed | Idea's own stated default | Low |
| [Technical Q4] Income/transfers - `expense`/`income` kind, dashboard expenses only, no transfers in v1? | Confirmed | Idea's own stated default | Low |
| [Technical Q5] Sign-up - open registration (default) or one user only? | Open registration | Standards catalogue - Authorization and data isolation (deny-by-default + per-user scoping test); idea default | Low-medium - enumeration accepted (Security brief R10) |
| [Security Q1] Password minimum - 15 characters (single-factor) or 8? | 15 characters, max >= 64, no composition rules | Standards catalogue - Security - Password storage (OWASP Password Storage Cheat Sheet / NIST SP 800-63B): "min length 8 (15 for single-factor)" - exact match | Low |
| [Security Q2] Network exposure - confirm ports bind to `127.0.0.1` only (G1)? | **Still open** - no assumption made | No standards-catalogue row addresses network-binding/exposure policy; this is a CR-7 domain (security posture / production deployment) question with no catalogue default | N/A - will be asked |
| [Security Q3] Session lifetime - 24 h idle, 30 d absolute, env-tunable? | Yes | Standards catalogue - Security - Sessions (OWASP Session Management Cheat Sheet): requires idle and absolute timeouts to exist; the specific durations are a reversible, env-tunable implementation detail, not the control itself | Low - tunable via env, not hardcoded |
| [Security Q4] Account/data deletion - include a "delete my account and data" action in E2? | No in v1 (Docker volume wipe is the accepted alternative) | Standards catalogue - Data - Personal data (GDPR principles) applies only when a region is triggered; Security brief's own region selection found no regional law applies to a local personal tool, so no deletion feature is required | Low - revisit if ever hosted (G1 trigger) |
| [Security Q5] Open registration - keep open (default), or restrict to one user? | Open registration | Standards catalogue - Authorization and data isolation (deny-by-default, per-user scoping, two-user test) makes open registration acceptable; idea's own default | Low-medium - enumeration accepted for a local tool (Security brief R10) |

## Still open

1. **[Security Q2] Network exposure** - confirm the ports bind to `127.0.0.1` only (G1). No catalogue default covers network-binding policy, so this is not assumed; it will be asked.

## Related

- [[idea-001-budgetpal]]
- [[TechnicalDecisionBrief]]
- [[SecurityDecisionBrief]]
- [[.KCC/kernel/protocols/auto-mode]] -> CR-7
- [[.KCC/kernel/protocols/standards-catalog]]
