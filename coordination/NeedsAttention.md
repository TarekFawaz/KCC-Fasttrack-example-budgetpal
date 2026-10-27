# Needs attention

Written by kcc-run under --silent --assume, which never stops for a human: every gate is answered by policy and recorded here.

- status: decided = the run went on with the safest continuing choice; check the decision.
- status: open = the spec could not continue and was left; a human must act (the run finished everything else, exit code 7).

## [open] SPEC-004 | merge-conflict | state  | 2026-10-27T17:40:47Z

- when: 2026-10-27T17:40:47Z
- spec: SPEC-004
- state: 
- gate: merge-conflict
- status: open
- decided: the merge of spec/SPEC-004 was aborted; the workspace is unchanged and the lane's work is on its branch
- why: the lane and the workspace both changed: src/IDEA-001-budgetpal/README.md, src/IDEA-001-budgetpal/api/test/auth-storage.test.ts, src/IDEA-001-budgetpal/test/live-stack.test.ts, src/IDEA-001-budgetpal/test/live-stack.ts
- todo: in the workspace run: git merge spec/SPEC-004 ; resolve the files, commit, then: kcc run --resume
- links: E:\Tikasway.dev\TestRounds\round-14-budgetpal\.kcc-lanes\SPEC-004

