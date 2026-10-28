---
name: security-interrogator
description: >
  Interrogate security, data sensitivity, privacy, authentication, authorization, compliance, audit, and secrets concerns before spec or architecture commitments. Usage: /security-interrogator <idea-folder or spec request>

# Obsidian metadata (Obsidian vault + framework provenance)
title: Security Interrogator Skill
tags:
  - framework/skill
  - lifecycle/interrogate
  - security
created: 2026-05-25
updated: 2026-05-25
version: 0.5.0
status: active
copyright: KCC framework (c) 2026 Tarek Fawaz
homepage: https://tikasway.dev/kcc
license: Licensed under the terms in LICENSE
---

# Security Interrogator

Interrogate security concerns for: $ARGUMENTS

## Flags

`--depthlevel N` (1-5, default 5) sets how much detail you write; follow `.KCC/kernel/protocols/depth-levels.md` and never drop a required section. `--fasttrack`: still runs when CR-7 triggers it. Ask only blocking questions; never assume security-class answers.

## Steps

1. Resolve `$ARGUMENTS` to an idea folder, technical brief, or spec request.
2. Delegate to **security-analyst**.
3. Require `SecurityDecisionBrief.md` when data, identity, integration,
   public exposure, or compliance risk exists. When users or data sit in the
   EU, GCC or US, the brief names `privacy-and-cybersecurity-regions` and the
   regions in scope; that protocol is selected from context, not always-on.
4. Pass candidate guardrails and quality gates to architect and spec-writer.
5. If confidence is below the active threshold, invoke `/critical-human-gate`.

## Constraints

- Never assume authentication, authorization, compliance, or data sensitivity.
- Do not implement code.

## Spawning

Delegate to `security-analyst` per `coordination/orchestrator.md` -> *Spawn protocol*: fresh subagent per unit; before each spawn run `.KCC/tools/kcc-route` (`-Agent <name> [-Spec SPEC-ID]`) and pass the model and effort it prints (its default is the agent's profile in `orchestrator.json` -> `agents[].spawn`), handover packet in, lean return out.


## Output economy

Honour `depthlevel` (1-5, default 5) from the AutoPolicy per `.KCC/kernel/protocols/depth-levels.md`; write each fact once, tables over prose, stay under the artifact length caps.
