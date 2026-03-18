# Tranche-L Approval Routing Card — 2026-03-18T03:10:00Z

## Decision Syntax
- `APPROVE: <TASK_ID>[, <TASK_ID>...]`
- `HOLD: <TASK_ID>[, <TASK_ID>...]` + reason

## Pending Approve/Hold Asks (Oldest RFR focus)
- TASK-0171 — Midday preflight artifact (credential chain)
- TASK-0172 — Midday wrapper dry-run evidence (credential chain)
- TASK-0180 — Midday progress preflight artifact (credential chain)
- TASK-0181 — Midday progress wrapper dry-run evidence (credential chain)

## Effect if Approved
- Reduces stale Ready-for-Review queue age.
- Keeps blocker-chain evidence artifacts formally decisioned while live credential step (`TASK-0159`) remains pending.

## Governance Guardrail
- No transitions to **Done** without approved RP.
