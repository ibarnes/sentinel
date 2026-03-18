# Credential-Window Trigger Packet — 2026-03-18 06:30 UTC

## Objective
Execute one credential-window pass that unblocks `TASK-0097 -> TASK-0095 -> TASK-0043` using existing one-command tooling.

## Command Sequence (run in repo root)
```bash
# 1) Optional preflight snapshot (writes status artifact)
bash scripts/pipeline-run-credential-preflight.sh

# 2) One-pass credentialed run (requires env)
BASE_URL="<https://...>" \
TEAM_SESSION_COOKIE="<session cookie value>" \
INITIATIVE_ID="<initiative id>" \
DECK_TYPE="buyer-mandate-mirror" \
bash scripts/pipeline-run-credentialed-once.sh
```

## Required Evidence Outputs
- Timestamped evidence directory under `mission-control/evidence/pipeline-run/<STAMP>/`
- `valid-response.json` with HTTP 201 and `runId`/`started`
- `invalid-response.json` with HTTP 400 deterministic payload
- `evidence-report.md` with PASS/BLOCKED checklist
- `transition-plan.json` (generated planner output)

## PASS Interpretation
If evidence report is PASS:
1. Add evidence paths to TASK-0097 comments.
2. Request transition of TASK-0097 to Ready for Review.
3. Replay closure chain comments/transitions for TASK-0095 then TASK-0043 (no Done transitions).

## BLOCKED Interpretation
If BLOCKED:
1. Capture missing artifact/env in TASK-0097 comment.
2. Keep chain statuses unchanged.
3. Schedule next credential window with exact missing requirement.
