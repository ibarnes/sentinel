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
For the direct capture path (`scripts/pipeline-run-smoke-capture.sh`):
- `BASE_URL` (example: `http://localhost:8787`)
- `COOKIE` (full cookie header value, e.g., `connect.sid=...`)
- `DECK_ID` (target presentation deck id)

For the one-pass wrapper (`scripts/pipeline-run-credentialed-once.sh`):
- `BASE_URL`
- `TEAM_SESSION_COOKIE` (the wrapper maps this into `COOKIE` for the capture script)
- `DECK_ID` or the selector variables below

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

## Command Sequence (one-pass wrapper)
```bash
cd /home/ec2-user/.openclaw/workspace
BASE_URL="http://localhost:8787" \
TEAM_SESSION_COOKIE="connect.sid=<session-cookie>" \
DECK_ID="<deck-id>" \
bash scripts/pipeline-run-credentialed-once.sh
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
- [ ] Raw terminal output stored in `mission-control/evidence/pipeline-run/<timestamp>/auth-smoke.log`
- [ ] 201 response stored in `valid-response.json` and includes `runId`, `deckId`, and `status`.
- [ ] 400 response stored in `invalid-response.json` and includes validation error fields.
- [ ] Audit artifact includes `pipeline.run.created` with matching `entity_id=runId`, `meta.deckId`, and `meta.status=started`.
- [ ] `manifest.json`, `evidence-report.md`, and `transition-plan.json` are present in the same evidence directory.
- [ ] Task comments updated on `TASK-0097` and `TASK-0103` with exact artifact path.

## Pass/Fail Rule
- **PASS:** both 201 and 400 checks are observed in one run and evidence path is committed.
- **FAIL:** missing authenticated context, missing one branch, or missing evidence artifact.

## Canonical Evidence Bundle
- `auth-smoke.log`
- `valid-response.json`
- `invalid-response.json`
- `pipeline-run-created.audit.json`
- `manifest.json`
- `evidence-report.md`
- `transition-plan.json`
