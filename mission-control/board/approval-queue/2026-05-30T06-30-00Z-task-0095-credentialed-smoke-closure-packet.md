# TASK-0095 Credentialed Smoke Closure Packet (2026-05-30 06:30 UTC)

Parent: `TASK-0095`  
Dependency chain: `TASK-0097` -> `TASK-0103`

## One-Pass Execution Sequence
1. Run preflight env check (cookie + base URL + deck id).
2. Execute `scripts/pipeline-run-smoke.sh` for valid and invalid payload paths.
3. Capture artifacts under `mission-control/evidence/pipeline-run/<UTC>/`:
- `auth-smoke.log`
- `valid-response.json` (expect 201, runId, started)
- `invalid-response.json` (expect 400, validation payload)
- `pipeline-run-created.audit.json` (expect matching `pipeline.run.created` event)
4. Record audit event evidence for `pipeline.run.created` linked to returned `runId`.
5. Attach artifact paths to `TASK-0095`, `TASK-0097`, `TASK-0103` in one update.

## Acceptance Mapping (TASK-0095)
- 201 + runId + started -> satisfied by `valid-response.json`
- 400 actionable validation error -> satisfied by `invalid-response.json`
- audit event emitted with runId/deckId -> satisfied by `pipeline-run-created.audit.json`

## Fail-Fast Gate
- If credential/cookie missing, stop immediately and post blocker evidence refresh instead of partial run output.
