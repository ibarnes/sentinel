# Credential Blocker Evidence Refresh (2026-06-11T10:40:00Z)

- Parent Stream: TASK-0103
- Subtask Candidate: TASK-0409
- Sweep: Board Execution Sweep (Morning)
- Evidence Generated:
  - mission-control/evidence/pipeline-run/2026-06-11T10-40-00Z-preflight.md
  - mission-control/evidence/pipeline-run/2026-06-11T10-40-00Z-env-check.txt

## Current Blockers
- BASE_URL missing in unattended runtime.
- TEAM_SESSION_COOKIE missing in unattended runtime.
- No targeting input is present yet:
  - direct mode: DECK_ID
  - selector mode: INITIATIVE_ID + DECK_TYPE + optional BUYER_ID

## Why this matters
The `/pipeline/run` implementation lane is still technically ready, but the unattended runtime cannot produce the required 201, 400, and audit evidence bundle until both auth inputs and one valid targeting mode are supplied together.

## Next operator action
1. Export BASE_URL and TEAM_SESSION_COOKIE in the execution shell.
2. Provide either DECK_ID or the selector tuple INITIATIVE_ID, DECK_TYPE, and optional BUYER_ID.
3. Run `bash scripts/pipeline-run-credential-preflight.sh` and confirm status `PASS`.
4. Run `bash scripts/pipeline-run-credentialed-once.sh`.
5. If capture completes, run `bash scripts/pipeline-run-closeout.sh <evidence-dir>` if a direct closeout pass is still needed.
6. Attach the canonical evidence bundle to TASK-0103 / TASK-0097:
   - auth-smoke.log
   - valid-response.json
   - invalid-response.json
   - pipeline-run-created.audit.json
   - manifest.json
   - evidence-report.md
   - transition-plan.json
