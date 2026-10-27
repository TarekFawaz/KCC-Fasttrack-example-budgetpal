# Needs attention

Written by kcc-run under --silent --assume, which never stops for a human: every gate is answered by policy and recorded here.

- status: decided = the run went on with the safest continuing choice; check the decision.
- status: open = the spec could not continue and was left; a human must act (the run finished everything else, exit code 7).

## [open] SPEC-001 | merge-conflict | state  | 2026-10-27T22:27:34Z

- when: 2026-10-27T22:27:34Z
- spec: SPEC-001
- state: 
- gate: merge-conflict
- status: open
- decided: the merge of spec/SPEC-001 was aborted; the workspace is unchanged and the lane's work is on its branch
- why: the lane and the workspace both changed: coordination/NeedsAttention-20261027222224.md, coordination/NeedsAttention-20261027222227.md, coordination/NeedsAttention.md
- todo: in the workspace run: git merge spec/SPEC-001 ; resolve the files, commit, then: kcc run --resume
- links: E:\Tikasway.dev\TestRounds\round-14-budgetpal\.kcc-lanes\SPEC-001

