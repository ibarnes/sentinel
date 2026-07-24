# Credentialed Smoke Operator Handoff Refresh - 2026-05-27T16-30-00Z

## Objective
Execute a one-pass authenticated smoke run for `POST /pipeline/run` and attach 201/400 evidence in one credential window.

## Required Inputs
1. Export `BASE_URL`
2. Export `TEAM_SESSION_COOKIE`
3. Optional but recommended for deterministic targeting:
   - `DECK_ID`
   - `INITIATIVE_ID`
   - `DECK_TYPE`
   - `BUYER_ID`

## One-Pass Commands
```bash
bash scripts/pipeline-run-credential-preflight.sh
bash scripts/pipeline-run-credentialed-once.sh
```

## PASS Criteria
- Valid request returns 201 with `runId` and `started` status.
- Invalid request returns 400 with expected validation payload.
- Evidence bundle exists under `mission-control/evidence/pipeline-run/credentialed-<timestamp>/` including:
  - `valid-response.json`
  - `invalid-response.json`
  - `evidence-report.md`
  - `transition-plan.json`

## If Blocked
- Re-run:
```bash
bash scripts/pipeline-run-credential-preflight.sh
bash scripts/pipeline-run-credential-env-check.sh
```
- Attach blocker artifacts and keep TASK-0097/TASK-0103 in progress until credentials are supplied.
