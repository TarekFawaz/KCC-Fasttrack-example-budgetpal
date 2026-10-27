---
title: Security Decision Brief - BudgetPal
idea-id: IDEA-001
tags:
  - framework/brief
  - security
created: 2026-10-27
updated: 2026-10-27
status: active
version: 1.0.0
---

# Security Decision Brief

Fast track, `--silent --assume`, depthlevel 2. No human asked. "Std" = standard-backed by `standards-catalog.md` -> Security. "Human" = scope the human stated in the idea (not assumed).

## Source

- [[idea-001-budgetpal]] (security scope in `## Reasoning` and the original request), [[Research]], [[SpecWriterStarter]]
- `.KCC/kernel/protocols/standards-catalog.md` (Security rows), `privacy-and-cybersecurity-regions.md` (Region selection)
- Sibling brief: `TechnicalDecisionBrief.md` (written in parallel; stack choices live there)

## Data Sensitivity

- **Class: personal financial data (confidential).** Email, password hash, account names and balances, transaction descriptions and amounts, budgets, and uploaded bank CSVs. Descriptions often hold merchant, payee and location detail.
- **Exposure: local only.** A single machine, run with docker-compose, no external services, no email, no telemetry. Data stays in a SQLite file on a Docker volume.
- **Reasoning:** the data is sensitive, but the exposure surface is the user's own machine and loopback network. The human scoped controls to that. The scope holds only while the app is not reachable from other hosts (see guardrail G1).

## Identity and Access

- **Authentication (Std + Human):** email + password. Argon2id via the native `argon2` package, OWASP floor m=19 MiB, t=2, p=1 (Research suggests t=3, m=64 MiB; use it if the container allows); bcrypt only as the Docker-build fallback. Length min 15 (single-factor), max >= 64, no composition rules, check against a bundled offline common-password list (no external service). Generic "invalid credentials" message.
- **Sessions (Std, trimmed by Human):** random 256-bit session id, only its hash stored in SQLite; cookie `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` set by env flag (off on plain-http localhost, on behind TLS). Idle and absolute timeouts (default 24 h idle, 30 d absolute; env-tunable). Logout deletes the server-side row. A fresh session id is issued at each login. Human excluded session rotation: no re-issue on privilege change (there are none).
- **Authorization (Std, kept):** deny by default. A `requireUser` middleware on every data route. Ownership is enforced in one place: repository functions take `userId` and every query is scoped by `user_id`. Foreign keys (account, category) are verified to belong to the user on write. Cross-user access returns 404, not 403. **Test with two users** on each module.
- **Roles:** one role (`user`). No admin. Open registration (idea default), several local users, each isolated.
- **Input handling (Std, kept, Human: "validated everywhere"):** schema validation (zod-style, chosen in the technical brief) at every API boundary with `.strict()` bodies; parameterised queries only; React output encoding and no `dangerouslySetInnerHTML`.

## Privacy, Compliance, and Audit

- **Regions in scope: none.** Region selection: users are the person running it locally, data is stored on their own machine, no sector or listing, no processor or third party. GDPR, NIS2, DORA, GCC PDPLs and US state laws are not triggered by a personal local tool. If it is ever hosted for others, re-run region selection (guardrail G1).
- **Audit log: excluded by Human.** No audit table. Standard application logs only.
- **Logging (Std, kept):** single-line JSON. Never log passwords, hashes, session ids, cookies, CSV content, or transaction descriptions and amounts. Log auth failures (event type, no credentials) and request ids. Redact by allow-list fields.
- **Retention and deletion:** data lives until the user deletes it or removes the Docker volume. A per-user "delete my account and data" action is a candidate (open question 4); not required for compliance.
- **Secrets (Std):** configuration from environment; `.env.example` lists names only, no values; `.env` in `.gitignore`. No secret is required by default (sessions are random server-side ids). No default credentials or seeded users.

## Risks

| # | Risk | Treatment |
|--|--|--|
| R1 | Cross-user data leak (IDOR) through a missed `user_id` scope | Central scoping, two-user test per module, deny by default (Std) |
| R2 | CSRF with no token (Human exclusion) | Accepted. Mitigated for free: `SameSite=Lax`; no state change on GET; mutating routes accept only `application/json` or multipart on upload; no permissive CORS. Residual: same-site attacker pages |
| R3 | Brute force / credential stuffing with no rate limit or lockout (Human exclusion) | Accepted for loopback. Argon2id cost slows guessing; 15-char minimum. Becomes unacceptable if G1 is broken |
| R4 | App published beyond loopback by a compose edit (`0.0.0.0`, port-forward, tunnel) | G1: publish ports on `127.0.0.1` only |
| R5 | Malicious or oversized CSV (huge file, many rows, odd encoding, formula-leading cells) | Size and row caps, streamed or bounded parse, strict row validation, report by line; cells are data only, rendered as text; no CSV export in v1 (formula-injection risk deferred) |
| R6 | Sensitive data in logs or error bodies | Field allow-list logger; generic error bodies, no stack traces to client |
| R7 | SQL injection / mass assignment | Parameterised queries; strict schemas that drop unknown fields |
| R8 | SQLite file and CSV uploads readable on the host | Accepted (user's own machine); keep the DB on a named volume; do not persist uploaded CSVs after import |
| R9 | Container runs as root; vulnerable dependencies | Non-root user in Dockerfiles; pinned lockfile; `npm audit` on demand only (no SBOM or image scan, Human) |
| R10 | Account enumeration through sign-up (open registration) | Accepted for a local tool; login message stays generic |

## Candidate Guardrails

- **G1 (trigger):** publish the api and web ports on `127.0.0.1` only. If the app is ever exposed to a network, the Human-excluded controls (CSRF tokens, rate limiting and lockout, session rotation, audit log, proxy-aware IP) and region selection become required, and a new ADR must reopen them.
- **G2:** every data route sits behind `requireUser`; every repository query takes `userId`. No raw `req.body` or `req.query` use outside the validator.
- **G3:** cookies are `HttpOnly` + `SameSite=Lax`; no state-changing GET; no `Access-Control-Allow-Origin: *`; the web app reaches the api same-origin (Vite proxy or reverse proxy) or via an explicit allow-listed origin.
- **G4:** password hashing only via the chosen library with the stated parameters; no custom crypto, no plaintext or reversible storage; never log credentials.
- **G5:** CSV import is bounded (max bytes, max rows), validated per row, and deduped inside a per-user transaction; the upload is not kept.
- **G6:** low-cost security headers on the api and web responses: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, a CSP restricted to self (Std). HSTS is off unless TLS is in front.
- **G7:** no new security scope beyond this brief (no CSRF tokens, rate limiter, lockout, audit log, SBOM or image-scan pipeline) unless G1 is triggered.

## Candidate Quality Gates

- **Q1 (E2/E3-E8):** two-user isolation test per module: user B gets 404 on user A's read, update and delete, and sees none of A's rows in lists and aggregates (dashboard, budgets).
- **Q2 (E2):** passwords stored as Argon2id hashes (assert the `$argon2id$` prefix); short or common password -> 400; wrong password and unknown email return the same message.
- **Q3 (E2):** cookie attribute test: `HttpOnly`, `SameSite=Lax`; logout invalidates the server-side session; expired session -> 401.
- **Q4 (all):** invalid input -> 400 with a field-level error and nothing written; unknown fields rejected.
- **Q5 (E6):** oversized file and row cap rejected; malformed rows reported by line; re-import adds nothing; a cell such as `=SUM(A1)` stored and rendered as plain text.
- **Q6 (E1):** log check: a login attempt and an import produce no password, cookie, or description in log output; `.env.example` has no values; compose publishes `127.0.0.1` only.
- **Q7 (verifier):** ASVS level 1 subset check (V2 auth, V3 sessions, V4 access control, V5 validation, V7 logging), minus the controls the Human excluded, recorded as accepted deviations.

## Deviations from the catalogue (all Human-stated)

| Catalogue default | Here | Reason |
|--|--|--|
| ASVS level 2 for financial data | ASVS L1 subset | Local single-user tool |
| CSRF token on state-changing requests | `SameSite=Lax` only | Human exclusion |
| Throttle and lockout on login and sign-up | none | Human exclusion |
| Session rotation on login and privilege change | new session per login, no rotation after | Human exclusion |
| Log auth events, access failures (audit) | app logs only, no audit table | Human exclusion |
| `Secure` cookie, HSTS | env flag, off on http localhost | No TLS locally |

Each needs an ADR from the architect that cites the Human statement (not a tie-break).

## Open questions

1. **Password minimum:** 15 characters (catalogue, single-factor) or 8 for convenience on a local tool? Default: 15 (max >= 64, no composition rules). -> **Assumed: 15**, catalogue-backed (Password storage), see [[Assumptions]].
2. **Network exposure:** confirm the ports bind to `127.0.0.1` only (G1). Default: yes. -> **Still open** - no catalogue default covers network-binding policy (CR-7); not assumed, see [[Assumptions]].
3. **Session lifetime:** 24 h idle, 30 d absolute? Default: yes, env-tunable. -> **Assumed: yes**, catalogue-backed (Sessions timeout requirement; durations are a tunable detail), see [[Assumptions]].
4. **Account and data deletion:** include a "delete my account and all data" action in E2? Default: no in v1 (the volume can be wiped); add if privacy tidiness matters. -> **Assumed: no in v1**, per region selection (no regional law triggered), see [[Assumptions]].
5. **Open registration:** keep it open (idea default), or allow only the first user, then close it, to shrink the surface? Default: open. -> **Assumed: open**, catalogue-backed (Authorization and data isolation), see [[Assumptions]].

## Confidence

Confidence: 91%

The gap to the 95% threshold is open questions 1 and 5 (policy choices, each with a catalogue-backed default) and the Human-excluded controls, which are accepted by the human's own statement but would turn into blockers if the app were exposed beyond loopback.
