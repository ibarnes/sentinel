# RP-0026 — TS-H1.1c smoke harness for `/pipeline/run`

## Summary
Added a reusable authenticated smoke harness script to verify `POST /api/presentation-studio/decks/{deckId}/pipeline/run` success and validation-failure paths.

## Scope Delivered
- Added executable script: `scripts/pipeline-run-smoke.sh`
- Covers both required acceptance checks for TASK-0095:
  - Valid payload path → expects `201`
  - Invalid payload path (scope=slide + missing `slideId`) → expects `400`
- Script outputs response bodies for evidence capture.

## How to Run
```bash
BASE_URL=http://127.0.0.1:3000 \
COOKIE='connect.sid=...' \
DECK_ID='<deck-id>' \
./scripts/pipeline-run-smoke.sh
```

## Current Status
- Harness implementation complete and lint/syntax-validated (`bash -n`).
- Live authenticated execution is blocked in this cron context due to no session cookie provided.

## Risk
- Low. Script is additive and does not alter runtime server behavior.

## Recommended Decision
- Approve harness artifact.
- Isaac to provide/confirm authenticated session run (or run directly) to close TASK-0095 final smoke evidence gate.
