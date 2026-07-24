# Credential-Window Preflight Refresh Pack — 2026-05-01 03:10 UTC

Parent stream: TASK-0097

## Objective
Reduce execution latency when credential window opens by pre-validating command chain and evidence destinations.

## Preflight checklist (fail-fast)
1. Confirm `BASE_URL` present and reachable (`/health` or root 200/302).
2. Confirm `TEAM_SESSION_COOKIE` present and non-empty.
3. Confirm target `DECK_ID` available for smoke call.
4. Confirm writable evidence path: `mission-control/evidence/pipeline-run/<timestamp>/`.

## Execution sequence
1. Run wrapper dry-run (`scripts/pipeline-run-smoke-capture.sh --dry-run` if available).
2. Run valid-path smoke (expect HTTP 201 + runId + started).
3. Run invalid-path smoke (expect HTTP 400 deterministic error payload).
4. Write evidence report with timestamps and payload snippets.

## Acceptance criteria
- Both HTTP assertions captured with timestamped artifacts.
- Evidence report saved and linked to TASK-0097.
- No `Done` transitions without approved RP.
