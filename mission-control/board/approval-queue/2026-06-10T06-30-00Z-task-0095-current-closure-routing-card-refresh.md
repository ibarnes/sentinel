# TASK-0095 Current Closure Routing Card Refresh (2026-06-10 06:30 UTC)

Parent: TASK-0095
Supporting children: TASK-0355, TASK-0398, TASK-0399, TASK-0400, TASK-0401

## Current State
- Endpoint wiring remains implemented; the unresolved gap is still live authenticated smoke proof, not code ambiguity.
- The current blocker snapshot is unchanged from 2026-06-09 10:40 UTC:
  - `BASE_URL` missing in unattended runtime
  - `TEAM_SESSION_COOKIE` missing in unattended runtime
  - no targeting input yet (`DECK_ID` or selector tuple `INITIATIVE_ID + DECK_TYPE [+ BUYER_ID]`)
- The June 7 routing card is now superseded as the primary operator surface because June 9 corrected the canonical evidence bundle and tightened the closeout sequence.

## Canonical Evidence Bundle
1. `auth-smoke.log`
2. `valid-response.json`
3. `invalid-response.json`
4. `pipeline-run-created.audit.json`
5. `manifest.json`
6. `evidence-report.md`
7. `transition-plan.json`

## Canonical Execution Path
1. Export `BASE_URL` and `TEAM_SESSION_COOKIE`.
2. Supply either `DECK_ID` or `INITIATIVE_ID + DECK_TYPE [+ BUYER_ID]`.
3. Run preflight:
   - `bash scripts/pipeline-run-credential-preflight.sh`
4. If preflight is PASS, run:
   - `bash scripts/pipeline-run-credentialed-once.sh`
5. If direct-path capture or post-run recheck is needed, run:
   - `bash scripts/pipeline-run-closeout.sh <evidence-dir>`

## Closure Rule
- Only request review-safe transition when both `evidence-report.md` and `transition-plan.json` say PASS.
- After PASS, the transition order remains:
  1. `TASK-0111`
  2. `TASK-0103`
  3. `TASK-0097`
  4. `TASK-0095`
  5. `TASK-0043`
- If either PASS artifact is BLOCKED, keep the chain open and use those files as the canonical missing-artifact report.

## Canonical References
- Blocker snapshot:
  - `mission-control/board/approval-queue/2026-06-09T10-40-00Z-credential-blocker-evidence-refresh.md`
- One-pass handoff:
  - `mission-control/board/approval-queue/2026-06-09T10-40-00Z-credentialed-smoke-operator-handoff-refresh.md`
- Evidence bundle contract:
  - `mission-control/board/approval-queue/2026-06-09T16-30-00Z-credential-artifact-contract-correction.md`
- Closeout sequence:
  - `mission-control/board/approval-queue/2026-06-09T16-30-00Z-credentialed-smoke-closeout-sequence.md`

## Governance
- No live smoke was attempted by this refresh.
- No board status mutation is justified until the credentialed evidence bundle exists and passes closeout.
