# Credential-Window Execution Checklist + Evidence Map (2026-06-01T10:40:00Z)

- Task: TASK-0364
- Parent Streams: TASK-0097, TASK-0103
- Sweep: Board Execution Sweep (Morning)

## Secure Handoff Steps
1. In a private shell session, export required credentials:
   - BASE_URL
   - TEAM_SESSION_COOKIE
2. Validate values are present without printing secret bodies:
   - bash scripts/pipeline-run-credential-env-check.sh
3. Run preflight and confirm status is PASS:
   - bash scripts/pipeline-run-credential-preflight.sh
4. Execute one credentialed pass:
   - bash scripts/pipeline-run-credentialed-once.sh
5. Attach generated evidence artifacts to TASK-0103/TASK-0097 and submit RP.

## Expected Outcomes (Gate)
- Valid request path: HTTP 201 with runId and status=started
- Deterministic invalid path: HTTP 400 with validation payload
- If either result is missing, keep stream in progress and capture blocker reason.

## Evidence Map
- Preflight: mission-control/evidence/pipeline-run/2026-06-01T10-40-00Z-preflight.md
- Env check: mission-control/evidence/pipeline-run/2026-06-01T10-40-00Z-env-check.txt
- Live run bundle after credentialed pass:
  - mission-control/evidence/pipeline-run/credentialed-<timestamp>/auth-smoke.log
  - mission-control/evidence/pipeline-run/credentialed-<timestamp>/valid-response.json
  - mission-control/evidence/pipeline-run/credentialed-<timestamp>/invalid-response.json
  - mission-control/evidence/pipeline-run/credentialed-<timestamp>/manifest.json

## Current Sweep Finding
- Gate remains BLOCKED in unattended runtime because BASE_URL and TEAM_SESSION_COOKIE are absent.
