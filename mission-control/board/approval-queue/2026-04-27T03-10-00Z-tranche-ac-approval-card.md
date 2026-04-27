# Tranche-AC Approval Routing Card — 2026-04-27 03:10 UTC

Use this card to route decisions for newly stale Ready-for-Review items.

## Decision set (Approve / Defer / Hold)
- `TASK-0150` — Approve (TS-H1.1c.2u Publish credential-window operator card for one-pass execution).
- `TASK-0151` — Approve (TS-H1.1c.2v Build blocker-chain closure matrix with transition gates).
- `TASK-0171` — Approve (TS-H1.1c.2aj Capture sweep-time credential preflight artifact (midday execution window)).
- `TASK-0172` — Approve (TS-H1.1c.2ak Run one-command credentialed wrapper dry-run and capture fail-fast evidence (midday)).
- `TASK-0180` — Approve (TS-H1.1c.2ao Capture sweep-time credential preflight artifact (midday progress window)).
- `TASK-0181` — Approve (TS-H1.1c.2ap Run one-command credentialed wrapper dry-run and capture fail-fast evidence (midday progress window)).

## Transition-safe template (post-decision)
- Approve: move task to Done only when governance conditions are met; otherwise keep Ready for Review with approval recorded.
- Defer: add blocker rationale + next-check date (UTC).
- Hold: annotate dependency and retain current status.
