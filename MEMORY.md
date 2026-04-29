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

## Curated Update (2026-04-29)
- Durable decisions/rules/project status/scoring were refreshed in:
  - `memory/active.md` (latest curated snapshot)
  - `memory/2026-04-29.md` (daily summary)
- Durable status additions:
  - End-of-day closeout generated and dispatched (`mission-control/briefs/2026-04-28-eod-closeout.md`, Telegram target `8010080765`).
  - Workflow C queued-only control executed for 2026-04-28 (`mission-control/workflow-c/queue/2026-04-28.json`, `execute_immediately=false`).
  - Board recovery stream advanced via decomposition gate: `TASK-0263` to Ready for Review; `TASK-0266` queued as next dependency-routing step.
  - Verified DFC economic-statecraft signal added: `SIG-2026-04-29-DFC-ECONOMIC-STATECRAFT-ENERGY-ABUNDANCE-001`.
- Governance rule unchanged: no `Done` transitions without approved review packet.
- Scoring policy unchanged: no scoring model/weighting changes approved.
