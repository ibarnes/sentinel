# Credential Blocker Evidence Refresh (2026-06-08T16:30:00Z)

- Parent Stream: TASK-0103
- Subtask Candidate: TASK-0395
- Sweep: Board Progress Sweep (Midday)
- Evidence Generated:
  - mission-control/evidence/pipeline-run/2026-06-08T16-30-00Z-preflight.md
  - mission-control/evidence/pipeline-run/2026-06-08T16-30-00Z-env-check.txt

## Current Blockers
- BASE_URL missing in unattended runtime.
- TEAM_SESSION_COOKIE missing in unattended runtime.
- No targeting input is present yet (DECK_ID or selector tuple INITIATIVE_ID + DECK_TYPE + BUYER_ID).

## Why this matters
The canonical one-pass closure path is repaired, but live 201/400/audit evidence still cannot be produced until the runtime has both auth inputs and a concrete target.

## Next operator action
1. Export BASE_URL and TEAM_SESSION_COOKIE in the execution shell.
2. Provide either DECK_ID or the selector tuple INITIATIVE_ID, DECK_TYPE, and BUYER_ID.
3. Run scripts/pipeline-run-credential-preflight.sh and confirm status PASS.
4. Run scripts/pipeline-run-credentialed-once.sh.
5. Attach the resulting four-artifact bundle (201, 400, manifest.json, pipeline-run-created.audit.json) to TASK-0103 / TASK-0097.
