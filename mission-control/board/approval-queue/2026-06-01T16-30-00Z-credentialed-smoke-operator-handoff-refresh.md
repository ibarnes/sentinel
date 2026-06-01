# Credentialed Smoke Operator Handoff Refresh (2026-06-01T16:30:00Z)

- Parent Stream: TASK-0103
- Subtask Candidate: TASK-0373
- Sweep: Board Progress Sweep (Midday)

## One-pass execution checklist
1. Set required env:
   - BASE_URL
   - TEAM_SESSION_COOKIE
2. Optional targeting env if needed:
   - DECK_ID, INITIATIVE_ID, DECK_TYPE, BUYER_ID
3. Run:
   - scripts/pipeline-run-credential-preflight.sh
   - scripts/pipeline-run-credentialed-once.sh
4. Collect and link evidence artifacts under mission-control/evidence/pipeline-run/.
5. Submit RP for review; do not move parent to Done without approved RP.

## Gate status
- Credential gate remains BLOCKED pending runtime secrets.
