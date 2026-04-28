# Tranche-AF Approval Routing Card — 2026-04-28 10:40 UTC

Use this card to route decisions for the next stale Ready-for-Review cohort.

## Decision set (Approve / Defer / Hold)
- `TASK-0209` — Approve (midday progress preflight evidence artifact).
- `TASK-0210` — Approve (midday progress fail-fast wrapper evidence artifact).
- `TASK-0215` — Approve (morning execution preflight evidence artifact).
- `TASK-0216` — Approve (morning execution fail-fast wrapper evidence artifact).
- `TASK-0217` — Approve (midday progress preflight evidence artifact).
- `TASK-0218` — Approve (midday progress fail-fast wrapper evidence artifact).

## Transition-safe template (post-decision)
- Approve: move task to Done only when governance conditions are met; otherwise keep Ready for Review with approval recorded.
- Defer: add blocker rationale + next-check date (UTC).
- Hold: annotate dependency and retain current status.
