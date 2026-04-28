# Credential Window Run Card — 2026-04-28 16:30 UTC

## Goal
Unblock TASK-0103/TASK-0097 by running authenticated smoke (201 + 400) in one credential window.

## Required env
- `BASE_URL`
- `TEAM_SESSION_COOKIE`

## Command sequence
```bash
export BASE_URL='https://<host>'
export TEAM_SESSION_COOKIE='<session-cookie>'
bash scripts/pipeline-run-credential-preflight.sh mission-control/evidence/pipeline-run/preflight-2026-04-28T16-30-00Z.md
bash scripts/pipeline-run-smoke-capture.sh mission-control/evidence/pipeline-run/2026-04-28T16-30-00Z-live-smoke
```

## Expected evidence
- `mission-control/evidence/pipeline-run/preflight-2026-04-28T16-30-00Z.md`
- `mission-control/evidence/pipeline-run/2026-04-28T16-30-00Z-live-smoke/evidence-report.md`

## Decision gate
- If 201 + 400 captured with expected payloads, move TASK-0103 and TASK-0097 to Ready for Review.
- If blocked/failing, attach failure artifacts and keep status In Progress with explicit blocker note.
