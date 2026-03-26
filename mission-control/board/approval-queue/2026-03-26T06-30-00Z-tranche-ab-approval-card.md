# Tranche-AB Approval Routing Card — 2026-03-26 06:30 UTC

Use this card to route decisions for newly stale Ready-for-Review items.

## Decision set (Approve / Defer / Hold)
- `TASK-0219` — Approve (oldest tranche-U digest already prepared).
- `TASK-0220` — Approve (routing card, low risk, unblocks queue hygiene).
- `TASK-0221` — Approve (tranche-V digest already packaged).
- `TASK-0222` — Approve (routing + transition prep).
- `TASK-0225` — Approve (tranche-X digest already prepared).

## Transition-safe template (post-decision)
- Approve: move task to Done only when governance conditions are met; otherwise keep Ready for Review with approval recorded.
- Defer: add blocker rationale + next-check date (UTC).
- Hold: annotate dependency and retain current status.
