# Credential Window Env Template — 2026-03-13 16:30 UTC

Use this during the next credentialed execution window for TASK-0111/TASK-0103 closure.

## Required exports
```bash
export BASE_URL="https://<host>"
export TEAM_SESSION_COOKIE="team_session=<redacted>"
# Optional selector path when DECK_ID unknown
export INITIATIVE_ID="<initiative-id>"
export DECK_TYPE="buyer-mandate-mirror"
export BUYER_ID="<buyer-id>"
```

## One-pass command
```bash
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT="mission-control/evidence/pipeline-run/${STAMP}"
mkdir -p "$OUT"
./scripts/pipeline-run-credentialed-once.sh | tee "$OUT/credentialed-once.log"
```

## Required artifacts to attach
- `smoke-valid.json` (HTTP 201, includes `runId`, `status=started`)
- `smoke-invalid.json` (HTTP 400 deterministic error payload)
- `evidence-report.md` (PASS expected)
- `transition-plan.json`
- `transition-actions.md`

## Abort conditions
- Missing `BASE_URL` or `TEAM_SESSION_COOKIE`
- Valid-path request not returning HTTP 201
- Invalid-path request not returning HTTP 400
