# Authenticated Smoke Preflight — 2026-03-09 06:30 UTC

Parent task: TASK-0097  
Unblock subtask executed: TASK-0125 (Done)

## Objective
Reduce friction for the credentialed `/pipeline/run` live smoke by preparing exact run inputs, output locations, and pass/fail expectations before cookie-backed execution.

## Required inputs (credentialed run)
- `BASE_URL` (default: `http://127.0.0.1:3000`)
- `COOKIE` (team session cookie; format `connect.sid=...`)
- `DECK_ID` (target deck UUID)

## Exact command
```bash
BASE_URL=http://127.0.0.1:3000 \
COOKIE='connect.sid=<SESSION_COOKIE>' \
DECK_ID='<DECK_ID>' \
./scripts/pipeline-run-smoke.sh | tee mission-control/evidence/pipeline-run/2026-03-09-auth-smoke.log
```

## Expected outputs
1. Valid payload request returns `HTTP 201` and JSON containing:
   - `runId`
   - `status: "started"`
2. Invalid payload request returns `HTTP 400` with actionable validation error payload.

## Evidence capture paths
- Raw command output log:
  - `mission-control/evidence/pipeline-run/2026-03-09-auth-smoke.log`
- Optional copied response payloads (script emits to `/tmp`):
  - `/tmp/pipeline_run_valid.json`
  - `/tmp/pipeline_run_invalid.json`

## Closure mapping
- TASK-0103 closes after attaching authenticated 201+400 evidence.
- TASK-0097 can move to Ready for Review once TASK-0103 evidence is attached.
- TASK-0095 can then move from In Progress to Ready for Review.
