---
title: Orchestrator Map
tags:
  - coordination
  - generated
created: 2026-10-27
updated: 2026-10-27
version: 2.0.0
status: active
---

# Orchestrator Map

Single source for **who to spawn, on which model, at what effort, and how**.
Generated from `.KCC/capabilities/` + `.KCC/kernel/templates/orchestrator.md`
by `.KCC/tools/sync-adapters.ps1|.sh`. Do not hand-edit; change the agent's
`model-class` / `effort` frontmatter or this template, then resync.
Machine-readable twin: `coordination/orchestrator.json` (same data, plus the
butler-owned `active_session` pointer, which resync preserves).

## Spawn protocol

Every delegation from a skill, `auto`, or another agent follows these rules.

1. **Resolve, don't guess.** Look up the agent in the Agent Profiles table
   (or `orchestrator.json` → `agents[].spawn`). Use its harness model and
   effort. Never inherit the caller's model, and never raise it on your own,
   except by the complexity rule (7) or an approved deep spawn (11).
2. **Fresh context per unit.** Spawn a new subagent for each
   idea/spec/story/wave unit. Never fork or resume the caller's transcript.
   One unit, one agent, one return. A hand-back is short: a 10-line summary
   (what was written, the check result, confidence, open points) plus the
   list of files; never the agent's whole report. Wait for every agent you
   spawn (parallel ones too) before you finish: in a non-interactive session (`claude -p`,
   kcc-run) the session ends with your reply, so never run a subagent in the
   background there.
3. **Handover packet, not file dumps.** Pass ≤ 300 words:
   `goal`, `ids` (IDEA/SPEC/STORY), `read` (paths + headings, never
   contents), `write` (expected artifact paths), `constraints`,
   `confidence_threshold`, `budget` (token-guard estimate id, if one exists),
   `depthlevel` (1-5 from the AutoPolicy, default 5; omit at 5),
   `hints` (the active human hints for this agent: `kcc hint --pending --for
   <agent> --all`; omit when none),
   `protocols` (the domain protocols the briefs and ADRs selected for this
   idea, by name: `mobile-app-architecture`, `data-engineering-and-science`,
   `privacy-and-cybersecurity-regions` with its regions in scope; they are
   chosen from the idea's context by the interrogators and the architect,
   never by default, and an agent loads only the ones named; omit when none).
   Shape: `.KCC/kernel/protocols/handover.md`. Hints given while a subagent runs
   reach it by hook, and you relay them with `SendMessage`
   (`.KCC/kernel/protocols/hints.md`).
4. **Lazy reads.** Read a skill, this map and the state table once per
   session, then work from your notes: never re-read them per state, unit or
   retry. The agent reads only its packet's `read` list and its
   own profile inputs. For files over ~400 lines or any
   `.KCC/kernel/protocols/*`, Grep for the heading first and read that
   section only. Never load `.KCC/` wholesale.
5. **Lean return.** Reply with: the 10-line summary of rule 2 (≤ 150 words), artifact paths written,
   open questions, `Confidence: NN%`, and the `ActualTokenUsage` block
   (`.KCC/kernel/contracts/agent-contract.md`). No file echoes and no
   restated inputs.
6. **Parallel fan-out.** Spawn independent units from the same
   `plan.md -> ## Waves` wave in **one** message, then wait for all of them
   before starting the next wave (`.KCC/kernel/protocols/parallel-execution.md`).
7. **Model routing** (`.KCC/kernel/protocols/model-routing.md`). **Before every
   spawn, in every cycle, run the router and use its answer:**
   `.KCC/tools/kcc-route.ps1 -Agent <name> [-Spec SPEC-ID [-Wave N | -Item key]] [-Attempt n]`
   (bash: `kcc-route.sh --agent ...`). It prints `tier, model, effort, reasons`
   for the active harness; pass that `model` and `effort` to the spawn and name the
   reasons in the packet. A developer running a skill by hand does the same. The
   rules it applies: start from the agent's profile tier and effort, then move at
   most one tier, from signals:
   `research`/`architecture`/`security` never below balanced; a `novel`
   domain (`Research.md -> ## Domain`) one tier up and effort high; a
   `common` domain one tier down for spec, plan, docs and scaffold work;
   CR-7 risk or `Complexity: high` never below balanced and effort high; a
   large unit (> 3 items or > 5 files) effort one step up; a retry one tier
   up and one effort up (never for a verifier or critic, and REVIEW and a
   scoped TEST re-verification stay at balanced / high at most); under 20%
   budget left never above balanced unless risk. Name the tier, model id (`kernel/models.json`), effort and reasons
   in the packet and emit `model-selected`. Pin the id, never the alias
   (`haiku` can be an older generation; the Agent tool accepts the id).
   **The implementer runs on `balanced`.** It used to run on the executor class
   (Haiku on Claude); measured 2026-10-16, `claude-haiku-5-5` and `claude-sonnet-5-5`
   cost the same per token (`models.json -> tier_cost_observed`), so the cheaper
   class saved nothing and wrote weaker code (stale assertions, missing deliverables).
   Run `kcc route SPEC-ID` after each plan: it writes `## Routing` into `plan.md` (model
   and effort per backlog item, from its Complexity, files, domain and security words). Put each
   item's row in its handover packet; a wave runs on the strongest row of its items, and a retry
   after a FAIL raises the effort one step. A security-sensitive item (auth, crypto, secrets, personal data,
   untrusted input) never runs below `high` effort. Any move to `strong-reasoning` still needs the gate.
8. **Gates are scripts.** A delegate's work is done only when the state's
   exit-check tool passes (`.KCC/kernel/contracts/tool-contract.md`). Route
   violations to their `fix_owner`. Exit 3 (deferred) is never a pass.
9. **Continuity.** At the soft usage threshold, spawn nothing new; the hard
   threshold writes a restore point and suspends the run
   (`.KCC/kernel/protocols/session-continuity.md`).
10. **Meta-agents stay cheap.** `butler` and `token-guard` run at their
   profile (fast class, low effort) and keep their output short (a context
   pack or a budget table). Skip `butler-brief` for single-file, read-only
   questions.
11. **DeepThinking is a human-costed exception** (`.KCC/kernel/protocols/deep-thinking.md`).
   You may propose it in `auto` and under `--fasttrack`, only for the four tasks in
   `kernel/models.json -> deep_tasks` (not `human-directed`) and only when their trigger
   is clearly met; never from a silent run. Before each spawn emit `deep-proposed` with a
   cost range, ask the human once (approve at xhigh, approve at max, use strong, skip),
   emit `deep-approved` or `deep-declined`, then `deep-spawned` and, after the return,
   `deep-completed` with the actual cost. Tag every event `initiator: orchestrator`; at
   most `settings.json -> deep.max_per_run` per run. The human can also start one at any
   time with `/deep` (`initiator: human`, no run limit); never refuse or delay that.

### Harness binding

| Harness | How to spawn with the profile |
|---|---|
| Claude Code | `Agent(subagent_type: "<name>", prompt: <handover>)`. Model, effort, and tools come from `.claude/agents/<name>.md` frontmatter. Don't pass `model` except on an approved escalation (rule 7) or an approved deep spawn (rule 11). |
| Codex | Use `.codex/agents/<name>.md` (`model`, `model_reasoning_effort`) as the sub-session profile. |
| OpenCode | `@<name>` subagent from `.opencode/agents/<name>.md`. |
| Generic / Ollama | `.agents/manifest.json` or `ollama/agents.json`, keyed by agent name. |
| Switching harness | `.KCC/tools/kcc-handover.ps1\|.sh -To <harness> [-Launch] [-Unattended]`, then `auto resume` in the target. |

## Model classes

| Class | Claude | Default effort | Codex | OpenCode | Ollama | Intended use |
|-------|--------|----------------|-------|----------|--------|--------------|
| `strong-reasoning` | `claude-opus-5-5` | `high` | `gpt-6-astra` | `anthropic/claude-opus-5-5` | `qwen2.5:72b` | Escalations only: hard architecture or failing-review rework (human gate) |
| `balanced` | `claude-sonnet-5-5` | `medium` | `gpt-6.1-sol` | `anthropic/claude-sonnet-5-5` | `qwen2.5:32b` | Interrogation, architecture, spec writing, planning, verification, critique, migration |
| `fast-implementation` | `claude-haiku-5-5` | `low` | `gpt-6-luna` | `anthropic/claude-haiku-5-5` | `qwen2.5:14b` | Executor: implementation per approved plan; meta-agents (butler, token-guard) |
| `local-strong` | `claude-opus-5-5` | `high` | `gpt-6-astra` | `ollama/qwen2.5:72b` | `qwen2.5:72b` | Local strong reasoning via an Ollama-compatible harness |
| `local-fast` | `claude-haiku-5-5` | `low` | `gpt-6-luna` | `ollama/qwen2.5:7b` | `qwen2.5:7b` | Local low-cost support via an Ollama-compatible harness |

## Agent profiles

Only the agents and skills listed here exist in this workspace. One that a
protocol or skill names but these tables omit was set aside by `kcc tailor`
(`.KCC/kernel/protocols/tailoring.md`): skip its step, record `skipped:
tailored out` in the trace, and do not improvise its work.

| Agent | Class | Claude model | Effort | Codex model/effort | Tools (Claude) | Inputs -> Outputs |
|-------|-------|--------------|--------|--------------------|----------------|-------------------|
| `architect` | `balanced` | `claude-sonnet-5-5` | `high` | `gpt-6.1-sol` / `high` | Read, Glob, Grep, Write, Edit, Bash (Bash limited to: git log*, git diff*) | Technical, UX, security, infrastructure decision briefs (under `fasttrack` only `Techni... -> The Architecture Document at `architecture/architecture.md` (narrative + inline embedde... |
| `architecture-critic` | `balanced` | `claude-sonnet-5-5` | `medium` | `gpt-6.1-sol` / `medium` | Read, Glob, Grep | The active architecture depth (`lite` / `standard` / `deep`); the produced `architectur... -> A verdict (CONFORMANT or DRIFT); a findings list, each entry naming what is wrong, whic... |
| `butler` | `fast-implementation` | `claude-haiku-5-5` | `low` | `gpt-6-luna` / `low` | Read, Glob, Grep, Write, Edit | Brief mode: a SPEC-ID, agent name, or free-form topic. -> Brief mode: an ensured active trace session (`Traces/Session-{slug}-{datetime}/` copied... |
| `idea-interrogator` | `balanced` | `claude-sonnet-5-5` | `high` | `gpt-6.1-sol` / `high` | Read, Glob, Grep, Write, Edit, WebSearch, WebFetch, Bash (Bash limited to: git log*) | A short idea description from the human, plus the conversation mode (`auto` or `HITL`)... -> A populated `ideation/IDEA-{ID}-{slug}/` folder with `idea-{ID}-{slug}.md` (containing... |
| `implementer` | `balanced` | `claude-sonnet-5-5` | `medium` | `gpt-6.1-sol` / `medium` | Read, Glob, Grep, Write, Edit, Bash | A spec ID, wave, or backlog item (Story/Enabler/Bug); read `SPEC-{ID}-{slug}.md`, `Back... -> Code changes on a `spec/SPEC-{ID}` branch under `src/IDEA-{ID}-{slug}/`, real tests for... |
| `infrastructure-implementer` | `balanced` | `claude-sonnet-5-5` | `medium` | `gpt-6.1-sol` / `medium` | Read, Glob, Grep, Write, Edit, Bash | A SPEC-ID or IDEA-ID, plus the existing InfrastructureDecisionBrief.md from /infrastruc... -> Quality-gate, CI, and deploy pipeline files under .github/workflows/, azure-pipelines/,... |
| `infrastructure-planner` | `balanced` | `claude-sonnet-5-5` | `medium` | `gpt-6.1-sol` / `medium` | Read, Glob, Grep, Write, Edit, WebSearch, WebFetch | A source idea folder, technical brief, architecture request, or spec request. -> InfrastructureDecisionBrief.md with deployment shape, packaging decisions (containeriza... |
| `migrator` | `balanced` | `claude-sonnet-5-5` | `medium` | `gpt-6.1-sol` / `medium` | Read, Glob, Grep, Write, Edit, Bash | A path (file or directory) to the source workflow, plus an optional source-format hint... -> A `migrations/IMPORT-{NNN}/` folder containing `plan.md`, `mapping.md`, and draft `draf... |
| `planner` | `balanced` | `claude-sonnet-5-5` | `high` | `gpt-6.1-sol` / `high` | Read, Glob, Grep, Write, Edit, Bash (Bash limited to: git log*, git diff*) | A spec ID (e.g. SPEC-003); read `SPEC-{ID}-{slug}.md`, `arch.md` (full lifecycle; under... -> `specs/IDEA-{ID}-{slug}-Specs/SPEC-{ID}-{slug}/plan.md` with mandatory `## Waves` and `... |
| `repo-steward` | `balanced` | `claude-sonnet-5-5` | `low` | `gpt-6.1-sol` / `low` | Read, Glob, Grep, Write, Edit, Bash | A SPEC-ID and a task (`branch` / `hygiene` / `merge-lanes` / `pr-draft`); the spec file... -> Local branches and lane merge commits on `spec/SPEC-{ID}`; a hygiene report; `specs/IDE... |
| `security-analyst` | `balanced` | `claude-sonnet-5-5` | `high` | `gpt-6.1-sol` / `high` | Read, Glob, Grep, Write, Edit, WebSearch, WebFetch | A source idea folder, technical brief, architecture request, or spec request. -> SecurityDecisionBrief.md with sensitivity, controls, risks, guardrails, and quality gates. |
| `solution-cartographer` | `strong-reasoning` | `claude-opus-5-5` | `medium` | `gpt-6-astra` / `medium` | Read, Glob, Grep, Bash | A source path or current repo plus onboarding depth (`minimal`, `standard`, or `deep`). -> `solution/` baseline artifacts and a confidence-gated summary. |
| `solution-inspector` | `strong-reasoning` | `claude-opus-5-5` | `medium` | `gpt-6-astra` / `medium` | Read, Glob, Grep, Write, Edit, Bash | A path or current repo, plus optional --depth flag from /solution-onboard. -> Updates to .KCC/settings.json (workspace section) and a SolutionInspectionBrief.md insi... |
| `spec-writer` | `balanced` | `claude-sonnet-5-5` | `high` | `gpt-6.1-sol` / `high` | Read, Glob, Grep, Write, Edit, Bash (Bash limited to: git log*, git diff*) | A problem description, feature request, improvement need, source file/folder, direct hu... -> One or more `specs/IDEA-{ID}-{slug}-Specs/SPEC-{ID}-{slug}/` folders, each with `SPEC-{... |
| `technical-interrogator` | `balanced` | `claude-sonnet-5-5` | `medium` | `gpt-6.1-sol` / `medium` | Read, Glob, Grep, Write, Edit, WebSearch, WebFetch | A source idea folder, `SpecWriterStarter.md`, or ad-hoc spec request. -> `TechnicalDecisionBrief.md` plus recorded technical questions and answers, preferably i... |
| `token-guard` | `fast-implementation` | `claude-haiku-5-5` | `low` | `gpt-6-luna` / `low` | Read, Glob, Grep, Write, Edit | One of (a) a SPEC-ID - the agent reads the spec file, its plan (if any), and the impact... -> A compact budget table (per lifecycle step, per model-class) printed for human approval... |
| `ux-ui-designer` | `balanced` | `claude-sonnet-5-5` | `medium` | `gpt-6.1-sol` / `medium` | Read, Glob, Grep, Write, Edit, WebSearch, WebFetch | A source idea folder, spec request, UX prompt, or user-facing backlog item. -> UXDecisionBrief.md with design direction, theme choices, accessibility gates, assets, a... |
| `verifier` | `balanced` | `claude-sonnet-5-5` | `high` | `gpt-6.1-sol` / `high` | Read, Glob, Grep, Write, Edit, Bash (Bash limited to: git diff*, git log*) | A spec ID. -> `specs/IDEA-{ID}-{slug}-Specs/SPEC-{ID}-{slug}/review.md` (with `## Evidence`) and verd... |

## Skill routes

| Trigger | Skill | Agent invoked |
|---------|-------|---------------|
| `/adapt-workflow <path-or-repo> [--format=<hint>]` | `adapt-workflow` | `migrator` |
| `/architecture-review [--depthlevel 1-5]` | `architecture-review` | `architecture-critic` |
| `auto <input> [--silent --assume] [--accuracy NN%] [--budget NN CCY] [--parallel] [--fasttrack] [--depthlevel 1-5] ; auto IDEA-{ID} ; auto SPEC-{ID} ; auto all ; auto resume` | `auto` | `idea-interrogator`, `technical-interrogator`, `ux-ui-interrogator`, `security-interrogator`, `infrastructure-interrogator`, `architect`, `spec-writer`, `token-guard`, `planner`, `implementer`, `verifier`, `critical-human-gate` |
| `/bug-report <SPEC-ID ; description> [--severity blocker ; major ; minor]` | `bug-report` | `planner`, `implementer`, `verifier` |
| `/butler-brief <SPEC-ID or topic>` | `butler-brief` | `butler` |
| `/butler-remember <session-summary or path-to-trace>` | `butler-remember` | `butler` |
| `/critical-human-gate <agent confidence context>` | `critical-human-gate` | (none) |
| `/dashboard` | `dashboard` | (none) |
| `/deep <task-id ; question> [--agent <name>] [--effort xhigh ; max] [--spec SPEC-ID]` | `deep` | `architect`, `security-analyst`, `verifier` |
| `/hint <text> [--to all ; main ; subagents ; <agent>] [--expires <minutes>] ; /hint list ; /hint clear <H-NNN ; all>` | `hint` | (none) |
| `/idea-interrogator <idea> [--fasttrack] [--depthlevel 1-5]` | `idea-interrogator` | `idea-interrogator`, `technical-interrogator`, `ux-ui-designer`, `security-analyst`, `infrastructure-planner`, `token-guard` |
| `/infrastructure-interrogator <idea-folder or spec request>` | `infrastructure-interrogator` | `infrastructure-planner` |
| `/inspect` | `inspect` | (none) |
| `/security-interrogator <idea-folder or spec request>` | `security-interrogator` | `security-analyst` |
| `/solution-onboard <path-or-current-repo> [--depth=minimal ; standard ; deep] [--skip-inspector]` | `solution-onboard` | `solution-cartographer`, `solution-inspector` |
| `/spec-create <problem description or file-or-folder path or SpecWriterStarter.md> [--fasttrack] [--split-only ; --spec SPEC-NNN] [--depthlevel 1-5]` | `spec-create` | `technical-interrogator`, `ux-ui-designer`, `security-analyst`, `infrastructure-planner`, `architect`, `spec-writer` |
| `/spec-deploy SPEC-{ID} [--ci=github-actions ; azure-devops ; gitlab-ci ; jenkins] [--cloud=aws ; azure ; gcp ; onprem-k8s ; onprem-bare-metal]` | `spec-deploy` | `infrastructure-implementer` |
| `/spec-implement SPEC-003 [--wave N ; Story-001 ; Enabler-001 ; Bug-001] [--fasttrack] [--depthlevel 1-5]` | `spec-implement` | `implementer` |
| `/spec-merge SPEC-{ID}` | `spec-merge` | `repo-steward` |
| `/spec-plan SPEC-003 [--fasttrack] [--depthlevel 1-5]` | `spec-plan` | `planner` |
| `/spec-review SPEC-003 [--fasttrack] [--depthlevel 1-5]` | `spec-review` | `verifier` |
| `/spec-status` | `spec-status` | (none) |
| `/spec-test SPEC-003 [--fasttrack] [--depthlevel 1-5]` | `spec-test` | `verifier` |
| `/tailor-workflow [focus or extra context]` | `tailor-workflow` | (none) |
| `/technical-interrogator <idea-folder or spec request> [--fasttrack] [--depthlevel 1-5]` | `technical-interrogator` | `technical-interrogator` |
| `/token-estimate <SPEC-ID or IDEA-ID or "prompt:" + text>` | `token-estimate` | `token-guard` |
| `/ux-ui-interrogator <idea-folder or spec request>` | `ux-ui-interrogator` | `ux-ui-designer` |
