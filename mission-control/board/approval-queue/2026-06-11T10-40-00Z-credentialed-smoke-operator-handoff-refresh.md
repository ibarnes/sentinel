# Credentialed Smoke Operator Handoff Refresh (2026-06-11T10:40:00Z)

- Parent Stream: TASK-0103
- Subtask Candidate: TASK-0410
- Sweep: Board Execution Sweep (Morning)

## One-pass execution checklist
1. Set required auth env:
   - BASE_URL
   - TEAM_SESSION_COOKIE
2. Set one targeting mode:
   - direct: DECK_ID
   - selector-based: INITIATIVE_ID, DECK_TYPE, optional BUYER_ID
3. Optional lowest-risk local target already identified:
   - direct: `DECK_ID=INIT-001::utc-internal::none`
   - selector: `INITIATIVE_ID=INIT-001`, `DECK_TYPE=utc-internal`
4. Run the gating check:
   - `bash scripts/pipeline-run-credential-preflight.sh`
5. Run the canonical one-pass executor:
   - `bash scripts/pipeline-run-credentialed-once.sh`
6. If a post-capture closeout pass is needed, run:
   - `bash scripts/pipeline-run-closeout.sh <evidence-dir>`
7. Confirm the evidence bundle contains:
   - auth-smoke.log
   - valid-response.json
   - invalid-response.json
   - pipeline-run-created.audit.json
   - manifest.json
   - evidence-report.md
   - transition-plan.json

## Gate Status
- Credential gate remains BLOCKED in unattended cron because BASE_URL and TEAM_SESSION_COOKIE are unset.
- Targeting is also still incomplete until either DECK_ID or the selector tuple is supplied in the same execution shell.

## PASS Closure Rule
- Do not move TASK-0103, TASK-0097, TASK-0095, or TASK-0043 from this packet alone.
- Only request the review-safe transition chain when both `evidence-report.md` and `transition-plan.json` say `PASS`.
- If either PASS artifact is blocked, keep the chain open and use those files as the canonical missing-artifact report.

## Canonical transition order after PASS
1. TASK-0111
2. TASK-0103
3. TASK-0097
4. TASK-0095
5. TASK-0043
