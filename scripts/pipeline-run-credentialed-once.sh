#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-}"
TEAM_SESSION_COOKIE="${TEAM_SESSION_COOKIE:-}"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT_DIR="mission-control/evidence/pipeline-run/credentialed-${STAMP}"

if [[ -z "$BASE_URL" || -z "$TEAM_SESSION_COOKIE" ]]; then
  echo "ERROR: BASE_URL and TEAM_SESSION_COOKIE must be set" >&2
  exit 2
fi

mkdir -p "$OUT_DIR"

bash scripts/pipeline-run-smoke-capture.sh \
  --base-url "$BASE_URL" \
  --cookie "$TEAM_SESSION_COOKIE" \
  --out-dir "$OUT_DIR"

node scripts/pipeline-run-evidence-report.mjs \
  --dir "$OUT_DIR" \
  --out "$OUT_DIR/evidence-report.md"

node scripts/pipeline-run-transition-plan.mjs \
  --dir "$OUT_DIR" \
  --out "$OUT_DIR/transition-plan.json"

echo "OUTPUT_DIR=$OUT_DIR"
