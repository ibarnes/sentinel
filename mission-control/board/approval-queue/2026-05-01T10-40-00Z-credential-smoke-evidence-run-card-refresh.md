# Credential Smoke Evidence Run-Card Refresh — 2026-05-01 10:40 UTC

Parent stream: TASK-0097 / TASK-0281

## Objective
Minimize time-to-execution when credentials arrive by defining one-pass command/evidence flow.

## Inputs required
- `BASE_URL`
- `TEAM_SESSION_COOKIE`
- Target `DECK_ID`

## Run flow
1. Preflight check (env vars + endpoint reachability).
2. Valid request smoke (expect HTTP 201 with runId).
3. Invalid request smoke (expect HTTP 400 deterministic schema error).
4. Persist artifacts under `mission-control/evidence/pipeline-run/<timestamp>/`.

## Acceptance criteria
- 201 and 400 evidence both captured with timestamps.
- Report linked back to TASK-0097.
- No status moved to Done without approved RP.
