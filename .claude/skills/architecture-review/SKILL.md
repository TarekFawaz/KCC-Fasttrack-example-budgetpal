---
name: architecture-review
description: >
  Run the architecture-critic over the produced `architecture/` artifacts and print a semantic conformance verdict (CONFORMANT / DRIFT) plus specific drift findings and required fixes. Read-only and cheaper than the architect; it reviews, the architect fixes. Usage: /architecture-review [--depthlevel 1-5]

# Obsidian metadata (Obsidian vault + framework provenance)
title: Architecture Review Skill
tags:
  - framework/skill
  - lifecycle/meta
  - architecture
created: 2026-06-07
updated: 2026-06-07
version: 1.0.0
status: active
copyright: KCC framework (c) 2026 Tarek Fawaz
homepage: https://tikasway.dev/kcc
license: Licensed under the terms in LICENSE
---

# Architecture Review

Run a semantic conformance review of the architect's output via the
**architecture-critic** agent. This is the cheap, read-only second opinion that
catches drift (thin `architecture.md`, `.mmd`/`diagrams/` files, missing or
boilerplate supporting docs, degraded/placeholder design) and pushes the
architect back to standard.

## Flags

`--depthlevel N` (1-5, default 5) sets how much detail you write; follow `.KCC/kernel/protocols/depth-levels.md` and never drop a required section. `--fasttrack`: one lean pass. Read `architecture.md` (its `## Decisions` table stands in for ADRs) and `quality-gates.md` only; no spec `arch.md` exists in that profile, so never ask for one. Return the verdict and the drift findings in 150 words or less. If it says DRIFT the architect fixes those findings once; there is no re-review loop (the verifier's QG-ARCH-CONFORMANCE check still compares the code to the design).

## Steps

1. **Locate the architecture.** Find the `architecture/` folder. Note the
   active architecture depth (`lite` | `standard` | `deep`) from the source
   idea (`ideation/IDEA-{ID}-{slug}/idea-{ID}-{slug}.md`), defaulting to
   `standard` if absent. Gather the source idea / `TechnicalDecisionBrief.md`
   so the critic can judge fit.
2. **Invoke the architecture-critic** (`balanced`, read-only) with the active
   depth, the `architecture/` artifacts, and the source idea/tech brief. The
   critic reviews against [[.KCC/kernel/protocols/architecture-documentation]],
   [[.KCC/kernel/protocols/architecture-governance]],
   [[.KCC/kernel/protocols/architecture-styles]], and
   [[.KCC/kernel/protocols/api-standards]].
3. **Print the result** directly: the verdict (CONFORMANT / DRIFT), the
   findings table (issue / standard-rule / required fix), the semantic-fit
   note, and the critic's `Confidence: NN%`. Do not edit any architecture
   files - the critic is read-only and the architect owns the fixes.

## Related

- Architecture critic agent: [[../agents/architecture-critic]]
- Architect agent: [[../agents/architect]]
- Architecture documentation: [[.KCC/kernel/protocols/architecture-documentation]]
- Architecture governance: [[.KCC/kernel/protocols/architecture-governance]]

## Spawning

Delegate to `architecture-critic` per `coordination/orchestrator.md` -> *Spawn protocol*: fresh subagent per unit; before each spawn run `.KCC/tools/kcc-route` (`-Agent <name> [-Spec SPEC-ID]`) and pass the model and effort it prints (its default is the agent's profile in `orchestrator.json` -> `agents[].spawn`), handover packet in, lean return out.


## Output economy

Honour `depthlevel` (1-5, default 5) from the AutoPolicy per `.KCC/kernel/protocols/depth-levels.md`; write each fact once, tables over prose, stay under the artifact length caps.
