# Credential Window Operator Card (One-Pass)

Timestamp: 2026-03-13T03:10:00Z

## Objective
Complete TASK-0111 evidence capture in a single authenticated window, then replay board transitions in deterministic order.

## Preflight (60s)
1. Export required vars:
   - `export BASE_URL="http://127.0.0.1:3000"`
   - `export TEAM_SESSION_COOKIE="<cookie>"`
2. Run preflight:
   - `scripts/pipeline-run-credential-preflight.sh`
3. Confirm report status = PASS.

## One-Pass Execute (3–5 min)
- Run:
  - `scripts/pipeline-run-credentialed-once.sh`
- Capture printed `OUTPUT_DIR=...`.

## Evidence Must Exist in OUTPUT_DIR
- `valid-response.json` (201 runId + started)
- `invalid-response.json` (400 deterministic validation)
- `smoke.log`
- `evidence-report.md`
- `transition-plan.json`

## Board Replay (2–3 min)
Use template: `mission-control/evidence/pipeline-run/2026-03-12T10-40-00Z-post-exec-board-replay-template.md`

Replay order:
1. TASK-0111
2. TASK-0103
3. TASK-0097
4. Evaluate TASK-0095 + TASK-0043 readiness

## Abort Conditions
- Missing preflight vars
- 201/400 shape mismatch
- Missing required artifacts

If aborted, attach blocker note + remediation to TASK-0111 and keep parent chain in-progress.
