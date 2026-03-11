# Pipeline Run Auth Smoke — Credentialed Execution Runbook

## Purpose
Execute authenticated smoke verification for `POST /api/presentation-studio/decks/:deckId/pipeline/run` in live context and capture deterministic evidence.

## Preconditions
- Valid authenticated session cookie for team/admin context.
- Target deck is known **or** can be resolved from selectors.
- `scripts/pipeline-run-smoke.sh` is present and executable.
- `scripts/pipeline-run-smoke-capture.sh` is present and executable.
- `scripts/pipeline-run-evidence-report.mjs` is available to generate review-ready report markdown.

## Required Environment Variables
- `BASE_URL` (example: `http://localhost:8787`)
- `COOKIE` (full cookie header value, e.g., `connect.sid=...`)
- `DECK_ID` (target presentation deck id)

### Optional Deck Auto-Resolve Variables
Use these only when `DECK_ID` is not known:
- `INITIATIVE_ID` (example: `USG`)
- `DECK_TYPE` (example: `buyer-mandate-mirror`)
- `BUYER_ID` (optional selector)

## Command Sequence
```bash
cd /home/ec2-user/.openclaw/workspace
BASE_URL="http://localhost:8787" \
COOKIE="connect.sid=<session-cookie>" \
DECK_ID="<deck-id>" \
bash scripts/pipeline-run-smoke-capture.sh

# Optional: render checklist report from the captured bundle
node scripts/pipeline-run-evidence-report.mjs "mission-control/evidence/pipeline-run/<STAMP>"
```

## Command Sequence (auto-resolve deck)
```bash
cd /home/ec2-user/.openclaw/workspace
BASE_URL="http://localhost:8787" \
COOKIE="connect.sid=<session-cookie>" \
INITIATIVE_ID="USG" \
DECK_TYPE="buyer-mandate-mirror" \
BUYER_ID="PIF" \
bash scripts/pipeline-run-smoke-capture.sh

# Optional checklist report
node scripts/pipeline-run-evidence-report.mjs "mission-control/evidence/pipeline-run/<STAMP>"
```

## Expected Results
1. Valid payload path returns **HTTP 201** with `runId` and `status: started`.
2. Invalid payload path returns **HTTP 400** with deterministic validation error payload.

## Evidence Checklist
- [ ] Raw terminal output stored in `mission-control/evidence/pipeline-run/<timestamp>-auth-smoke.log`
- [ ] 201 response block includes `runId`, `deckId`, and `status`.
- [ ] 400 response block includes validation error fields.
- [ ] Task comments updated on `TASK-0097` and `TASK-0103` with exact artifact path.

## Pass/Fail Rule
- **PASS:** both 201 and 400 checks are observed in one run and evidence path is committed.
- **FAIL:** missing authenticated context, missing one branch, or missing evidence artifact.