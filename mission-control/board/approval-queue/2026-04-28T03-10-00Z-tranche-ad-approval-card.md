# Tranche-AD Approval Routing Card — 2026-04-28 03:10 UTC

Use this card to route decisions for the next stale Ready-for-Review cohort.

## Decision set (Approve / Defer / Hold)
- `TASK-0187` — Approve (TS-H1.1c.2as Capture sweep-time credential preflight artifact (midday progress sweep)).
- `TASK-0188` — Approve (TS-H1.1c.2at Run one-command credentialed wrapper dry-run and capture fail-fast evidence (midday progress sweep)).
- `TASK-0192` — Approve (TS-H1.1c.2au Capture sweep-time credential preflight artifact (morning execution sweep)).
- `TASK-0193` — Approve (TS-H1.1c.2av Run one-command credentialed wrapper dry-run and capture fail-fast evidence (morning execution sweep)).
- `TASK-0194` — Approve (TS-H1.1c.2aw Capture sweep-time credential preflight artifact (midday progress sweep)).
- `TASK-0195` — Approve (TS-H1.1c.2ax Run one-command credentialed wrapper dry-run and capture fail-fast evidence (midday progress sweep)).

## Transition-safe template (post-decision)
- Approve: move task to Done only when governance conditions are met; otherwise keep Ready for Review with approval recorded.
- Defer: add blocker rationale + next-check date (UTC).
- Hold: annotate dependency and retain current status.
