---
title: "Quality Gate SPEC-001"
tags:
  - kcc/quality-gate
status: fail
---

# Quality Gate - SPEC-001 (IDEA-001)

- Status: **fail** (exit 1)
- Workspace: `src/IDEA-001-budgetpal`
- Mode: full
- Coverage minimum: 80% (settings.quality.coverage_min_pct)
- Errors: 1  Warnings: 1  Deferred: 1

| Check | Stack | Project | Status | Command | Exit | Message | Evidence |
|--|--|--|--|--|--|--|--|
| QG-SCOPE | - | - | pass | `-` | - | scope from specs/IDEA-001-budgetpal-Specs/SPEC-001-walking-skeleton/plan.md -> ## Gates coverage: test,lock,build,lint,coverage,secrets,deps,sast,static; not covered by the plan (the architecture decides the gates): sbom, image | specs/IDEA-001-budgetpal-Specs/SPEC-001-walking-skeleton/plan.md |
| QG-STACK | - | - | pass | `-` | - | detected: node | src/IDEA-001-budgetpal |
| QG-LOCK | node | src/IDEA-001-budgetpal | pass | `-` | - | lockfile present | src/IDEA-001-budgetpal/pnpm-lock.yaml |
| QG-BUILD | node | src/IDEA-001-budgetpal | pass | `pnpm run build` | 0 | ok | TestResults/IDEA-001/SPEC-001/quality-gate-artifacts/log-1.txt |
| QG-LINT | node | src/IDEA-001-budgetpal | pass | `pnpm run lint` | 0 | ok | TestResults/IDEA-001/SPEC-001/quality-gate-artifacts/log-2.txt |
| QG-TEST | node | src/IDEA-001-budgetpal | pass | `pnpm run test` | 0 | ok | TestResults/IDEA-001/SPEC-001/quality-gate-artifacts/log-3.txt |
| QG-COV | node | src/IDEA-001-budgetpal | pass | `pnpm run test:coverage` | - | coverage 100% >= 80% (settings.quality.coverage_min_pct) | src/IDEA-001-budgetpal/coverage |
| QG-SECRETS | - | - | pass | `gitleaks dir --redact (full)` | 0 | gitleaks: no leaks (full) | TestResults/IDEA-001/SPEC-001/quality-gate-artifacts/gitleaks.json |
| QG-DEPS | - | - | pass | `osv-scanner --format json -L <lockfile>...` | 0 | osv-scanner: no known vulnerabilities | TestResults/IDEA-001/SPEC-001/quality-gate-artifacts/osv.json |
| QG-SAST | - | - | deferred | `-` | - | SAST: tool 'semgrep' is missing; deferred (not a pass) | tool-missing:semgrep |
| QG-STATIC | - | - | fail | `static-rules scan (18 rule(s) from architecture/static-rules.tsv)` | 1 | static rules: 1 forbidden-pattern hit(s) (rule(s): SR-018); first: api/Dockerfile:18 SR-018; first 20 in the evidence file | TestResults/IDEA-001/SPEC-001/quality-gate-artifacts/static-hits.txt |

## Missing tools (deferred - NOT a pass)

Approve through the toolchain-preflight gate, then re-run:

```powershell
powershell -ExecutionPolicy Bypass -File .KCC\tools\toolchain-preflight.ps1 -Tools semgrep
```

```bash
bash .KCC/tools/toolchain-preflight.sh semgrep
```
