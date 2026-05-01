# Isaac Decision + Credential Handoff Checklist — 2026-05-01 16:30 UTC

Parent stream: TASK-0097 / TASK-0103

## Decision Gate (Tranche-AA)
Confirm explicit decision for each:
- TASK-0187
- TASK-0188
- TASK-0192
- TASK-0193
- TASK-0194
- TASK-0195

Allowed values per ID:
- `APPROVE_TRANSITION`
- `HOLD_SUPERSEDED`

## Credential Gate
Provide:
- `BASE_URL`
- `TEAM_SESSION_COOKIE`
- target `DECK_ID`

## Execute-once Trigger
When both gates are satisfied, run credentialed smoke once and attach evidence pack to TASK-0097/0103.

## Acceptance Criteria
- Decision table complete (all six IDs + timestamp).
- Credential tuple complete and validated.
- Trigger ownership explicitly assigned.
