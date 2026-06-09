# Credential Blocker Evidence Refresh (2026-06-09T10:40:00Z)

- Parent Stream: TASK-0103
- Subtask Candidate: TASK-0398
- Sweep: Board Execution Sweep (Morning)
- Evidence Generated:
  - mission-control/evidence/pipeline-run/2026-06-09T10-40-00Z-preflight.md
  - mission-control/evidence/pipeline-run/2026-06-09T10-40-00Z-env-check.txt

## Current Blockers
- BASE_URL missing in unattended runtime.
- TEAM_SESSION_COOKIE missing in unattended runtime.
- No targeting input is present yet (DECK_ID or selector tuple INITIATIVE_ID + DECK_TYPE + BUYER_ID).

## Why this matters
The implementation lane is ready for a live credentialed smoke, but the unattended runtime still cannot produce 201, 400, and audit evidence until both auth inputs and a concrete target are supplied together.

## Next operator action
1. Export BASE_URL and TEAM_SESSION_COOKIE in the execution shell.
2. Provide either DECK_ID or the selector tuple INITIATIVE_ID, DECK_TYPE, and BUYER_ID.
3. Run scripts/pipeline-run-credential-preflight.sh and confirm status PASS.
4. Run scripts/pipeline-run-credentialed-once.sh.
5. Attach the resulting evidence bundle (auth-smoke.log, valid-response.json, invalid-response.json, manifest.json, pipeline-run-created.audit.json, evidence-report.md, transition-plan.json) to TASK-0103 / TASK-0097.
