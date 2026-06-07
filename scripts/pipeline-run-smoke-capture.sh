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
AUDIT_PATH="$RUN_DIR/pipeline-run-created.audit.json"
MANIFEST_PATH="$RUN_DIR/manifest.json"

(
  cd "$ROOT_DIR"
  bash scripts/pipeline-run-smoke.sh
) | tee "$LOG_PATH"

# pipeline-run-smoke.sh writes these temp files; capture them if present.
[[ -f /tmp/pipeline_run_valid.json ]] && cp /tmp/pipeline_run_valid.json "$VALID_PATH"
[[ -f /tmp/pipeline_run_invalid.json ]] && cp /tmp/pipeline_run_invalid.json "$INVALID_PATH"

RUN_ID=""
if [[ -f "$VALID_PATH" ]]; then
  RUN_ID="$(node -e 'const fs=require("fs");const p=process.argv[1];const d=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(String(d?.run?.runId || d?.runId || ""));' "$VALID_PATH" 2>/dev/null || true)"
fi

ACTIVITY_FILE="$ROOT_DIR/mission-control/activity/$(date -u +%Y-%m-%d).jsonl"
if [[ -n "$RUN_ID" && -f "$ACTIVITY_FILE" ]]; then
  node -e '
const fs=require("fs");
const file=process.argv[1];
const runId=process.argv[2];
const outPath=process.argv[3];
const lines=fs.readFileSync(file,"utf8").split("\\n").filter(Boolean);
const matches=lines.map((line)=>{ try { return JSON.parse(line); } catch { return null; } }).filter(Boolean).filter((event)=>event.event_type==="pipeline.run.created" && String(event.entity_id||"")===runId);
if (matches.length > 0) {
  fs.writeFileSync(outPath, JSON.stringify(matches[matches.length - 1], null, 2) + "\\n");
}
' "$ACTIVITY_FILE" "$RUN_ID" "$AUDIT_PATH"
fi

cat > "$MANIFEST_PATH" <<JSON
{
  "captured_at_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "stamp": "$STAMP",
  "base_url": "${BASE_URL:-}",
  "deck_id": "${DECK_ID:-}",
  "initiative_id": "${INITIATIVE_ID:-}",
  "deck_type": "${DECK_TYPE:-}",
  "buyer_id": "${BUYER_ID:-}",
  "run_id": "$RUN_ID",
  "artifacts": {
    "log": "mission-control/evidence/pipeline-run/$STAMP/auth-smoke.log",
    "valid": "mission-control/evidence/pipeline-run/$STAMP/valid-response.json",
    "invalid": "mission-control/evidence/pipeline-run/$STAMP/invalid-response.json",
    "audit": "mission-control/evidence/pipeline-run/$STAMP/pipeline-run-created.audit.json"
  }
}
JSON

echo "Evidence bundle: mission-control/evidence/pipeline-run/$STAMP"
