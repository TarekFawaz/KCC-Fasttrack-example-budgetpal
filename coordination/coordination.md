---
title: Coordination MOC
tags:
  - coordination
  - entrypoint
created: 2026-10-27
updated: 2026-10-27
version: 1.0.0
status: active
---

# Coordination

- `backchannel.jsonl` - append-only meta-agent event log.
- `orchestrator.md` - generated skill-to-agent route map.
- `orchestrator.json` - generated machine-readable route map.
- `.KCC/tools/backchannel-append.ps1` / `.sh` - deterministic event append helpers that refresh `dashboard/index.html`.
- `.KCC/tools/show-backchannel.ps1` / `.sh` - read-only human-readable backchannel viewers.