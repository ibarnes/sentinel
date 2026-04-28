# MEMORY INDEX

Use structured memory files instead of a single large memory blob.

Read these first when relevant:
- memory/core.md
- memory/active.md
- memory/workspace.md

Then read:
- memory/sessions/
- memory/projects/

Backup history of the legacy monolithic memory file:
- memory/backups/memory-md-git/index.md
- memory/backups/memory-md-git/index.json
- memory/backups/memory-md-git/*.md

If more detail is needed, inspect the relevant file directly.

## Curated Update (2026-04-28)
- Durable decisions/rules/project status/scoring were refreshed in:
  - `memory/active.md` (latest curated snapshot)
  - `memory/2026-04-28.md` (daily summary)
- Durable status additions:
  - Workflow C queued-only control executed (`mission-control/workflow-c/queue/2026-04-27.json`, `execute_immediately=false`).
  - Board recovery stream advanced via decomposition gate: `TASK-0253` + `TASK-0258` to Ready for Review; `TASK-0259`/`TASK-0260` queued as next dependency steps.
  - One verified high-impact signal-pressure alert surfaced (`SIG-2026-04-27-SYSCO-JETRO-DEAL-KIRSH-001`).
- Governance rule unchanged: no `Done` transitions without approved review packet.
- Scoring policy unchanged: no scoring model/weighting changes approved.
