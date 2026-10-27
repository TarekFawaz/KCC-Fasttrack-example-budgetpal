# Needs attention

Written by kcc-run under --silent --assume, which never stops for a human: every gate is answered by policy and recorded here.

- status: decided = the run went on with the safest continuing choice; check the decision.
- status: open = the spec could not continue and was left; a human must act (the run finished everything else, exit code 7).

## [decided] SPEC-001 | ruling | state 19 FIX | 2026-10-27T15:55:27Z

- when: 2026-10-27T15:55:27Z
- spec: SPEC-001
- state: 19 FIX
- gate: ruling
- status: decided
- decided: applied the recommended option of the ruling (as revise, ruling 1 of 2 allowed by policy)
- why: BUG-006 (human): SPEC-001 has blocked bug item(s) Bug-002; no fix can proceed without a human ruling. Bug-002 needs a ruling: **Blocker.** The contract cannot list the 503 as 'application/problem+json' (and the 200 as 'application/json') from the three Impacted Files. Probed with the installed versions (fastify-type-provider-zod 4.0.2, @fastify/swagger 9.9.2): - A plain zod '503' schema documents it, but under 'application/json' only. - The native form '503: { content: { 'application/problem+json': { schema } } }' throws at startup: the provider's 'jsonSchemaTransform' (wired in 'api/src/app.ts') accepts only zod schemas. - 'produces' is route-wide: it adds 'application/problem+json' to the 200 and 'application/json' ...
- todo: check that the Bug file(s) under Backlog/ and the Ruling section show the recommended option, and that it is acceptable (an architect-owned change such as a Decisions-table edit needs your approval)
- links: coordination/gates/GATE-001.md, coordination/run/logs/state-19-SPEC-001-1.log

## [decided] SPEC-001 | quality-deferred-on-exit-3 | state 16 TEST | 2026-10-27T16:03:12Z

- when: 2026-10-27T16:03:12Z
- spec: SPEC-001
- state: 16 TEST
- gate: quality-deferred-on-exit-3
- status: decided
- decided: accepted the deferred check by policy (not a pass)
- why: check-traceability exited 3 (output: coordination/run/logs/check-16_SPEC-001-2-check-traceability.out)
- todo: install the missing tool and re-run the quality gate: .KCC/tools/quality-gate -Spec SPEC-001
- links: coordination/gates/GATE-002.md, coordination/run/logs/state-16-SPEC-001-2.log

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

