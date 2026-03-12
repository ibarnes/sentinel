# Credentialed Smoke Execution Pack — 2026-03-12T10:40:00Z

## Goal
Execute TASK-0111 in one credentialed window and capture deterministic evidence for TASK-0103/TASK-0097 closure.

## Preconditions
- Valid authenticated team session cookie exported to shell.
- API host reachable.

## Commands
```bash
export BASE_URL="http://127.0.0.1:3000"
export TEAM_SESSION_COOKIE="<paste_cookie_here>"

# Run authenticated smoke + capture artifacts
bash scripts/pipeline-run-smoke-capture.sh \
  --base-url "$BASE_URL" \
  --cookie "$TEAM_SESSION_COOKIE" \
  --out-dir "mission-control/evidence/pipeline-run/credentialed-$(date -u +%Y%m%dT%H%M%SZ)"

# Generate evidence completeness report
node scripts/pipeline-run-evidence-report.mjs \
  --dir "mission-control/evidence/pipeline-run/credentialed-$(date -u +%Y%m%dT%H%M%SZ)" \
  --out "mission-control/evidence/pipeline-run/credentialed-$(date -u +%Y%m%dT%H%M%SZ)/evidence-report.md"

# Generate transition plan + action card
node scripts/pipeline-run-transition-plan.mjs \
  --dir "mission-control/evidence/pipeline-run/credentialed-$(date -u +%Y%m%dT%H%M%SZ)" \
  --out "mission-control/evidence/pipeline-run/credentialed-$(date -u +%Y%m%dT%H%M%SZ)/transition-plan.json"
```

## Required Artifacts
- `valid-response.json`
- `invalid-response.json`
- `smoke.log`
- `evidence-report.md`
- `transition-plan.json`

## Completion Criteria
- Valid call: HTTP 201 with runId + started status.
- Invalid call: HTTP 400 with deterministic validation payload.
- Evidence paths posted to TASK-0111, TASK-0103, TASK-0097 comments.
