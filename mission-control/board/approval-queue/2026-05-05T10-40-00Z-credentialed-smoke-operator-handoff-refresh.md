# Credentialed Smoke Operator Handoff Refresh — 2026-05-05 10:40 UTC

## Objective
Provide a single-run operator packet for `TASK-0103` credential-window execution.

## One-Pass Command Chain (run only when credentials are present)
```bash
BASE_URL="${BASE_URL}" \
COOKIE="${COOKIE}" \
DECK_ID="${DECK_ID}" \
bash scripts/pipeline-run-smoke.sh
```

## Required Inputs
- `BASE_URL` (live admin-server URL)
- `COOKIE` (authenticated session cookie)
- `DECK_ID` (known valid deck ID)

## PASS Criteria
1. Valid request returns **201** with `runId` and `status=started`.
2. Invalid request returns **400** with deterministic validation error payload.
3. Artifacts stored under `mission-control/evidence/pipeline-run/<timestamp>/`.

## Post-Run Immediate Actions
- Attach artifact paths to `TASK-0097` and `TASK-0103` comments.
- Prepare transition request packet for parent closure (no Done transition without approved RP).
