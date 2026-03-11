# Credentialed Smoke Handoff — 2026-03-11T10-40-00Z

## Goal
Execute authenticated smoke once and capture evidence that closes TASK-0111 / TASK-0103 acceptance criteria.

## Command (selector auto-resolve path)
```bash
BASE_URL="https://admin.unifiedstategroup.com" \
COOKIE='team_session=<PASTE_VALID_COOKIE>' \
INITIATIVE_ID='INIT-001' \
DECK_TYPE='utc-internal' \
./scripts/pipeline-run-smoke-capture.sh
```

## Alternate command (explicit DECK_ID path)
```bash
BASE_URL="https://admin.unifiedstategroup.com" \
COOKIE='team_session=<PASTE_VALID_COOKIE>' \
DECK_ID='<deck_id>' \
./scripts/pipeline-run-smoke-capture.sh
```

## Expected artifacts
- `manifest.json`
- `smoke.log`
- `valid-response.json` (HTTP 201 with runId + started status)
- `invalid-response.json` (HTTP 400 deterministic validation error)

## Validation
Run:
```bash
node scripts/pipeline-run-evidence-report.mjs --dir mission-control/evidence/pipeline-run/2026-03-11T10-40-00Z
```
Expect report status: **PASS**.

## Attach-back path
Add produced artifact directory path to TASK-0111, TASK-0103, TASK-0097 comments.
