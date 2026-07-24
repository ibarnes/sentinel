# Credentialed Smoke Operator Handoff Refresh — 2026-05-27T03:10:00Z

## Execute on first authenticated window

BASE_URL="\${BASE_URL}" \
COOKIE="\${COOKIE}" \
DECK_ID="\${DECK_ID}" \
bash scripts/pipeline-run-smoke.sh

## Required Attachments back to board
- Raw command output (stdout/stderr)
- Captured HTTP response fragments proving:
  - valid request => 201 + runId + status=started
  - invalid request => deterministic 400

## Attach evidence to
- TASK-0097
- TASK-0103
