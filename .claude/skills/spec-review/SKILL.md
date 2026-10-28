---
name: spec-review
description: >
  Quick diff review of epic spec changes against epic criteria, story/enabler backlog items (under `Backlog/`), and the planner's atomic test-case table - without writing the full verifier report. Usage: /spec-review SPEC-003 [--fasttrack] [--depthlevel 1-5]

# Obsidian metadata (Obsidian vault + framework provenance)
title: Spec Review Skill
tags:
  - framework/skill
  - lifecycle/review
created: 2026-05-24
updated: 2026-09-21
version: 4.0.0
status: active
copyright: KCC framework (c) 2026 Tarek Fawaz
homepage: https://tikasway.dev/kcc
license: Licensed under the terms in LICENSE
---

# Spec Review

Quick review of $ARGUMENTS implementation.

## Flags

`--depthlevel N` (1-5, default 5) sets how much detail you write; follow `.KCC/kernel/protocols/depth-levels.md` and never drop a required section. `--fasttrack`: no butler, trace, or token-guard. The review checks are unchanged.

The review is a quick diff review, so the driver routes it at `balanced` tier and `high` effort at most (`model-routing.md`).

## Steps

1. Locate the spec folder under
   `specs/IDEA-{ID}-{slug}-Specs/SPEC-{ID}-{slug}/` and read
   `SPEC-{ID}-{slug}.md`, `Backlog/*.md` (incl. `Bug-*`), and `plan.md`
   (`## Waves`, `## Atomic test cases`); legacy v5: `backlog.md` fallback.
2. Run `git diff main..HEAD -- <impacted files from spec>` when git is
   available, scoped to `src/IDEA-{ID}-{slug}/...` plus any cross-cutting
   files declared in the spec.
3. Load the selected dialect files from
   `.KCC/kernel/protocols/dialects/` (including `testing-unit`,
   `testing-integration`, and `testing-performance` / `testing-security` if
   the plan loaded them) and apply their review/bug-fix checklists to the
   changed files.
4. For each spec acceptance criterion (`AC-N`), state whether the diff
   addresses it: YES / PARTIAL / NO.
5. For each `Backlog/` item, state whether
   each of its `AC-N`s appears satisfied: YES / PARTIAL / NO.
6. Spot-check the atomic test-case table: for a sample of Test IDs, confirm
   a matching test exists (search by Test ID in test names / annotations
   under `src/IDEA-{ID}-{slug}/`).
7. List any changed files not declared in the spec's impacted files or
   outside `src/IDEA-{ID}-{slug}/`.
8. Verify architecture diagrams (inline ```mermaid``` in `.md`; no `.mmd`) and greenfield
   `src/IDEA-{ID}-{slug}/`, `docs/`, and per-idea `README.md` requirements
   when applicable.
9. Output a brief summary directly; do not create a file unless the user
   asks for the full `/spec-test` verifier report (which writes
   `review.md`).

## Spawning

Delegate to `verifier` per `coordination/orchestrator.md` -> *Spawn protocol*: fresh subagent per unit; before each spawn run `.KCC/tools/kcc-route` (`-Agent <name> [-Spec SPEC-ID]`) and pass the model and effort it prints (its default is the agent's profile in `orchestrator.json` -> `agents[].spawn`), handover packet in, lean return out.


## Output economy

Honour `depthlevel` (1-5, default 5) from the AutoPolicy per `.KCC/kernel/protocols/depth-levels.md`; write each fact once, tables over prose, stay under the artifact length caps.
