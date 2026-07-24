# Credentialed Smoke Operator Handoff Refresh - 2026-05-30T03:10:00Z

## Objective
Keep TASK-0331 executable in one pass once authenticated runtime inputs are available.

## Prerequisites (required)
- BASE_URL
- TEAM_SESSION_COOKIE

## Optional targeting variables
- DECK_ID
- INITIATIVE_ID
- DECK_TYPE
- BUYER_ID

## Deterministic command sequence
1. scripts/pipeline-run-credential-env-check.sh
2. scripts/pipeline-run-credential-preflight.sh
3. scripts/pipeline-run-credentialed-once.sh

## Failure gate
- If step 1 reports missing BASE_URL or TEAM_SESSION_COOKIE, stop and do not proceed.
- If step 3 does not capture both 201 and 400 evidence payloads, keep TASK-0331 in Backlog and post blocker delta only.

## Evidence attach targets after PASS
- mission-control/evidence/pipeline-run/*credential*
- mission-control/board/sweeps/*board-build-window-night*.md
