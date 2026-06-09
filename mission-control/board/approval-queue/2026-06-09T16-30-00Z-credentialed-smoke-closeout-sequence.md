# Credentialed Smoke Closeout Sequence (2026-06-09T16:30:00Z)

- Parent Stream: TASK-0103
- Subtask Candidate: TASK-0401
- Sweep: Board Progress Sweep (Midday)

## Canonical Sequence
1. Export `BASE_URL` and `TEAM_SESSION_COOKIE`.
2. Supply either `DECK_ID` or the selector tuple `INITIATIVE_ID + DECK_TYPE [+ BUYER_ID]`.
3. Run preflight:
   - `bash scripts/pipeline-run-credential-preflight.sh`
4. If preflight is PASS, run the one-pass executor:
   - `bash scripts/pipeline-run-credentialed-once.sh`
5. If capture used the direct path or post-run recheck is needed, run:
   - `bash scripts/pipeline-run-closeout.sh <evidence-dir>`

## Closeout Rule
- Only request review-safe transition when both `evidence-report.md` and `transition-plan.json` say PASS.
- If either is BLOCKED, keep TASK-0103 / TASK-0097 open and capture the missing artifact names directly from those files.

## Transition Order After PASS
1. TASK-0111
2. TASK-0103
3. TASK-0097
4. TASK-0095
5. TASK-0043

