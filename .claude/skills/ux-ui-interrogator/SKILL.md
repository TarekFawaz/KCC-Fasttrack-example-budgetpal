---
name: ux-ui-interrogator
description: >
  Interrogate user-facing work for UX/UI, themes, colors, logos/icons, shapes, motion, audio, accessibility, responsive behavior, and design-system direction. Usage: /ux-ui-interrogator <idea-folder or spec request>

# Obsidian metadata (Obsidian vault + framework provenance)
title: UX/UI Interrogator Skill
tags:
  - framework/skill
  - lifecycle/interrogate
  - ux
created: 2026-05-25
updated: 2026-05-25
version: 0.5.0
status: active
copyright: KCC framework (c) 2026 Tarek Fawaz
homepage: https://tikasway.dev/kcc
license: Licensed under the terms in LICENSE
---

# UX/UI Interrogator

Interrogate user experience for: $ARGUMENTS

## Flags

`--depthlevel N` (1-5, default 5) sets how much detail you write; follow `.KCC/kernel/protocols/depth-levels.md` and never drop a required section. `--fasttrack`: run only when `auto` found a UX trigger the human must decide; keep the brief to decisions.

## Steps

1. Resolve `$ARGUMENTS` to an idea folder, spec request, or backlog item.
2. Delegate to **ux-ui-designer**.
3. Require `UXDecisionBrief.md` for user-facing work, or an explicit "UX brief
   not required" result for non-UI work.
4. Pass the UX brief to architect, spec-writer, planner, implementer, and verifier.
5. If confidence is below the active threshold, invoke `/critical-human-gate`.

## Constraints

- Do not implement UI.
- Do not skip for games, dashboards, web apps, mobile apps, reports, or internal tools.

## Spawning

Delegate to `ux-ui-designer` per `coordination/orchestrator.md` -> *Spawn protocol*: fresh subagent per unit; before each spawn run `.KCC/tools/kcc-route` (`-Agent <name> [-Spec SPEC-ID]`) and pass the model and effort it prints (its default is the agent's profile in `orchestrator.json` -> `agents[].spawn`), handover packet in, lean return out.


## Output economy

Honour `depthlevel` (1-5, default 5) from the AutoPolicy per `.KCC/kernel/protocols/depth-levels.md`; write each fact once, tables over prose, stay under the artifact length caps.
