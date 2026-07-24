# Credentialed Smoke Operator Handoff Refresh — 2026-05-07 10:40 UTC

## Objective
Keep a current one-pass execution card for immediate use in the next authenticated window.

## One-Pass Command
```bash
BASE_URL="${BASE_URL}" \
COOKIE="${COOKIE}" \
DECK_ID="${DECK_ID}" \
bash scripts/pipeline-run-smoke.sh
```

## PASS Criteria
1. Valid request returns **201** with `runId` and `status=started`.
2. Invalid request returns **400** deterministic validation response.
3. Evidence paths attached to `TASK-0097` and `TASK-0103`.

## Current Blocker Evidence
- `mission-control/evidence/pipeline-run/2026-05-07T10-40-00Z-preflight.md`
- `mission-control/evidence/pipeline-run/2026-05-07T10-40-00Z-env-check.txt`
