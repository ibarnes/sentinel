# Credentialed Smoke Operator Handoff Refresh (2026-06-08T16:30:00Z)

- Parent Stream: TASK-0103
- Subtask Candidate: TASK-0396
- Sweep: Board Progress Sweep (Midday)

## One-pass execution checklist
1. Set required auth env:
   - BASE_URL
   - TEAM_SESSION_COOKIE
2. Set one targeting mode:
   - direct: DECK_ID
   - selector-based: INITIATIVE_ID, DECK_TYPE, BUYER_ID
3. Run the gating check:
   - scripts/pipeline-run-credential-preflight.sh
4. Run the canonical one-pass executor:
   - scripts/pipeline-run-credentialed-once.sh
5. Confirm the evidence bundle contains:
   - post-valid-201.json
   - post-invalid-400.json
   - manifest.json
   - pipeline-run-created.audit.json
   - evidence-report.md
   - transition-plan.json

## Gate Status
- Credential gate remains BLOCKED in unattended cron because BASE_URL and TEAM_SESSION_COOKIE are unset.
- Targeting is also still incomplete until either DECK_ID or the selector tuple is supplied.

## Closure Rule
- Do not move TASK-0097, TASK-0103, or TASK-0095 to Done from this packet alone.
- Use this handoff only to execute the live smoke window and attach the resulting committed evidence bundle for review.
