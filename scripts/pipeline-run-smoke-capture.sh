#!/usr/bin/env bash
set -euo pipefail

# Wrapper for scripts/pipeline-run-smoke.sh that captures deterministic evidence bundle.
# Required env: BASE_URL, COOKIE, and either DECK_ID or INITIATIVE_ID+DECK_TYPE(+BUYER_ID)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVIDENCE_DIR="$ROOT_DIR/mission-control/evidence/pipeline-run"
STAMP="${STAMP:-$(date -u +%Y-%m-%dT%H-%M-%SZ)}"
RUN_DIR="$EVIDENCE_DIR/$STAMP"
mkdir -p "$RUN_DIR"

LOG_PATH="$RUN_DIR/auth-smoke.log"
VALID_PATH="$RUN_DIR/valid-response.json"
INVALID_PATH="$RUN_DIR/invalid-response.json"
MANIFEST_PATH="$RUN_DIR/manifest.json"

(
  cd "$ROOT_DIR"
  bash scripts/pipeline-run-smoke.sh
) | tee "$LOG_PATH"

# pipeline-run-smoke.sh writes these temp files; capture them if present.
[[ -f /tmp/pipeline_run_valid.json ]] && cp /tmp/pipeline_run_valid.json "$VALID_PATH"
[[ -f /tmp/pipeline_run_invalid.json ]] && cp /tmp/pipeline_run_invalid.json "$INVALID_PATH"

cat > "$MANIFEST_PATH" <<JSON
{
  "captured_at_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "stamp": "$STAMP",
  "base_url": "${BASE_URL:-}",
  "deck_id": "${DECK_ID:-}",
  "initiative_id": "${INITIATIVE_ID:-}",
  "deck_type": "${DECK_TYPE:-}",
  "buyer_id": "${BUYER_ID:-}",
  "artifacts": {
    "log": "mission-control/evidence/pipeline-run/$STAMP/auth-smoke.log",
    "valid": "mission-control/evidence/pipeline-run/$STAMP/valid-response.json",
    "invalid": "mission-control/evidence/pipeline-run/$STAMP/invalid-response.json"
  }
}
JSON

echo "Evidence bundle: mission-control/evidence/pipeline-run/$STAMP"
