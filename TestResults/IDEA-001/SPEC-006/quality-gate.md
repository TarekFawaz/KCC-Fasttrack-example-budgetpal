---
title: "Quality Gate SPEC-006"
tags:
  - kcc/quality-gate
status: pass
---

# Quality Gate - SPEC-006 (IDEA-001)

- Status: **pass** (exit 0)
- Workspace: `src/IDEA-001-budgetpal`
- Mode: full
- Coverage minimum: 80% (settings.quality.coverage_min_pct)
- Errors: 0  Warnings: 0  Deferred: 0

| Check | Stack | Project | Status | Command | Exit | Message | Evidence |
|--|--|--|--|--|--|--|--|
| QG-SCOPE | - | - | pass | `-` | - | scope from specs/IDEA-001-budgetpal-Specs/SPEC-006-csv-import/plan.md -> ## Gates coverage: test,build,lint,coverage,lock,secrets,deps,sast,static; not covered by the plan (the architecture decides the gates): sbom, image | specs/IDEA-001-budgetpal-Specs/SPEC-006-csv-import/plan.md |
| QG-STACK | - | - | pass | `-` | - | detected: node | src/IDEA-001-budgetpal |
| QG-LOCK | node | src/IDEA-001-budgetpal | pass | `-` | - | lockfile present | src/IDEA-001-budgetpal/pnpm-lock.yaml |
| QG-BUILD | node | src/IDEA-001-budgetpal | pass | `pnpm run build` | 0 | ok | TestResults/IDEA-001/SPEC-006/quality-gate-artifacts/log-1.txt |
| QG-LINT | node | src/IDEA-001-budgetpal | pass | `pnpm run lint` | 0 | ok | TestResults/IDEA-001/SPEC-006/quality-gate-artifacts/log-2.txt |
| QG-TEST | node | src/IDEA-001-budgetpal | pass | `pnpm run test` | 0 | ok | TestResults/IDEA-001/SPEC-006/quality-gate-artifacts/log-3.txt |
| QG-COV | node | src/IDEA-001-budgetpal | pass | `pnpm run test:coverage` | - | coverage 91.95% >= 80% (settings.quality.coverage_min_pct) | src/IDEA-001-budgetpal/coverage |
| QG-SECRETS | - | - | pass | `gitleaks dir --redact (full)` | 0 | gitleaks: no leaks (full) | TestResults/IDEA-001/SPEC-006/quality-gate-artifacts/gitleaks.json |
| QG-DEPS | - | - | pass | `osv-scanner --format json -L <lockfile>...` | 0 | osv-scanner: no known vulnerabilities | TestResults/IDEA-001/SPEC-006/quality-gate-artifacts/osv.json |
| QG-SAST | - | - | pass | `docker run --rm semgrep/semgrep semgrep scan --config auto --json` | 0 | semgrep: no findings at severity >= error | TestResults/IDEA-001/SPEC-006/quality-gate-artifacts/semgrep.json |
| QG-STATIC | - | - | pass | `static-rules scan (18 rule(s) from architecture/static-rules.tsv)` | 0 | static rules: 18 rule(s) over 150 file(s), no forbidden pattern found | - |
