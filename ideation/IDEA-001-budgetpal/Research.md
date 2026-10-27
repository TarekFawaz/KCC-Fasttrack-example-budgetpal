---
title: Research - BudgetPal
idea-id: IDEA-001
tags:
  - framework/research
  - ideation
created: 2026-10-27
updated: 2026-10-27
status: active
version: 1.0.0
---

# Research: BudgetPal

## Domain

common

Personal budgeting with CRUD, CSV import and aggregate charts is a well-known problem space with many comparables (YNAB, Firefly III, Actual Budget). Nothing here is novel.

## Findings

Moderate pass (`--silent --assume`), only what changes a decision.

| Topic | Finding | Effect |
|--|--|--|
| Password hashing | OWASP and current guides recommend Argon2id (about t=3, m=64 MiB, p=1); bcrypt is still acceptable. Use a native `argon2` package, not pure JS. | E2 uses argon2id; bcrypt is the fallback if the native build fails in Docker. |
| SQLite driver | `better-sqlite3` needs a native build, which can fail on Alpine. Built-in `node:sqlite` (Node 22.5+) needs no native build but has a smaller API (no `transaction()` wrapper). | The technical brief picks one. Default: `better-sqlite3` on a Debian-slim image, so the compose build is predictable. |
| CSV import | Duplicate detection is normally a hash over date, amount, normalised description and account, checked per user. Banks differ in columns and date formats. | E6 needs a column-mapping step, a preview and a stable dedupe key. |
| Prior art | Firefly III and Actual Budget both import CSV with mapping and dedupe by hash. | Same shape; no new pattern needed. |

## Sources

- [bcrypt vs argon2 vs scrypt password hashing 2026](https://www.pkgpulse.com/guides/bcrypt-vs-argon2-vs-scrypt-password-hashing-2026)
- [bcrypt vs argon2 vs scrypt vs pbkdf2: a 2026 decision framework](https://securityboulevard.com/2026/06/bcrypt-vs-argon2-vs-scrypt-vs-pbkdf2-a-2026-decision-framework/)
- [Node.js Built-in SQLite: A Practical Guide](https://jangwook.net/en/blog/en/node-sqlite-builtin-practical-guide-2026)

The prior-art row comes from general knowledge, with no cited page.

## Related

- Idea: [[idea-001-budgetpal]]
- All ideas: [[../ideas|Ideas MOC]]
