# Credentialed Smoke Operator Handoff Refresh — 2026-05-06 16:30 UTC

## Objective
Publish a single-run operator packet for `TASK-0103` live execution once credentials exist.

## One-Pass Command Chain (run only with credentials)
```bash
BASE_URL="${BASE_URL}" \
COOKIE="${COOKIE}" \
DECK_ID="${DECK_ID}" \
bash scripts/pipeline-run-smoke.sh
```

## Required Inputs
- `BASE_URL` (live admin-server URL)
- `COOKIE` (authenticated session cookie)
- `DECK_ID` (valid deck id)

## PASS Criteria
1. Valid call returns **201** with `runId` and `status=started`.
2. Invalid call returns **400** with deterministic validation payload.
3. Evidence artifacts saved under `mission-control/evidence/pipeline-run/<timestamp>/`.

## Immediate Post-Run
- Attach evidence paths to `TASK-0097` and `TASK-0103` comments.
- Prepare transition packet for parent closure request (no Done transition without approved review packet).

## Current Blocker Evidence
- `mission-control/evidence/pipeline-run/2026-05-06T16-30-00Z-preflight.md`
- `mission-control/evidence/pipeline-run/2026-05-06T16-30-00Z-env-check.txt`
