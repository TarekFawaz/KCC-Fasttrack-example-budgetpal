# Needs attention

Written by kcc-run under --silent --assume, which never stops for a human: every gate is answered by policy and recorded here.

- status: decided = the run went on with the safest continuing choice; check the decision.
- status: open = the spec could not continue and was left; a human must act (the run finished everything else, exit code 7).

## [decided] SPEC-002 | quality-deferred-on-exit-3 | state 16 TEST | 2026-10-27T16:57:33Z

- when: 2026-10-27T16:57:33Z
- spec: SPEC-002
- state: 16 TEST
- gate: quality-deferred-on-exit-3
- status: decided
- decided: accepted the deferred check by policy (not a pass)
- why: QG-DEFERRED (human): quality-gate deferred checks QG-SAST, not a pass. missing tools: semgrep. Install them through toolchain-preflight, then re-run quality-gate
- todo: install the missing tool (semgrep) and re-run the quality gate: .KCC/tools/quality-gate -Spec SPEC-002
- links: coordination/gates/GATE-001.md, coordination/run/logs/state-16-SPEC-002-3.log

## [decided] SPEC-002 | quality-deferred-on-exit-3 | state 16 TEST | 2026-10-27T16:57:33Z

- when: 2026-10-27T16:57:33Z
- spec: SPEC-002
- state: 16 TEST
- gate: quality-deferred-on-exit-3
- status: decided
- decided: accepted the deferred check by policy (not a pass)
- why: QG-DEFERRED (human): quality-gate deferred checks QG-SAST, not a pass. missing tools: semgrep. Install them through toolchain-preflight, then re-run quality-gate
- todo: install the missing tool (semgrep) and re-run the quality gate: .KCC/tools/quality-gate -Spec SPEC-002
- links: coordination/gates/GATE-001.md, coordination/run/logs/state-16-SPEC-002-3.log

