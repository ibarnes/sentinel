#!/usr/bin/env bash
set -euo pipefail

OUT_PATH="${1:-mission-control/evidence/pipeline-run/preflight-$(date -u +%Y-%m-%dT%H-%M-%SZ).md}"
BASE_URL="${BASE_URL:-}"
TEAM_SESSION_COOKIE="${TEAM_SESSION_COOKIE:-}"
DECK_ID="${DECK_ID:-}"
INITIATIVE_ID="${INITIATIVE_ID:-}"
DECK_TYPE="${DECK_TYPE:-}"
BUYER_ID="${BUYER_ID:-}"

mkdir -p "$(dirname "$OUT_PATH")"

status="PASS"
missing=()
target_mode="unset"
[[ -z "$BASE_URL" ]] && missing+=("BASE_URL")
[[ -z "$TEAM_SESSION_COOKIE" ]] && missing+=("TEAM_SESSION_COOKIE")
if [[ -n "$DECK_ID" ]]; then
  target_mode="direct"
elif [[ -n "$INITIATIVE_ID" && -n "$DECK_TYPE" ]]; then
  target_mode="selector"
else
  missing+=("DECK_ID or INITIATIVE_ID+DECK_TYPE")
fi
[[ ${#missing[@]} -gt 0 ]] && status="BLOCKED"

{
  echo "# Credentialed Smoke Preflight"
  echo
  echo "- Generated (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "- Status: $status"
  echo
  echo "## Checks"
  if [[ -z "$BASE_URL" ]]; then
    echo "- BASE_URL: MISSING"
  else
    echo "- BASE_URL: SET ($BASE_URL)"
  fi
  if [[ -z "$TEAM_SESSION_COOKIE" ]]; then
    echo "- TEAM_SESSION_COOKIE: MISSING"
  else
    echo "- TEAM_SESSION_COOKIE: SET (redacted)"
  fi
  if [[ "$target_mode" == "direct" ]]; then
    echo "- Targeting: DIRECT (DECK_ID=$DECK_ID)"
  elif [[ "$target_mode" == "selector" ]]; then
    echo "- Targeting: SELECTOR (INITIATIVE_ID=$INITIATIVE_ID, DECK_TYPE=$DECK_TYPE, BUYER_ID=${BUYER_ID:-<unset>})"
  else
    echo "- Targeting: MISSING"
  fi
  echo
  if [[ "$status" == "BLOCKED" ]]; then
    echo "## Remediation"
    echo "- Export missing variables and rerun preflight."
    echo "- Supply either DECK_ID or INITIATIVE_ID + DECK_TYPE (+ optional BUYER_ID)."
    echo "- If preflight passes, run: bash scripts/pipeline-run-credentialed-once.sh"
    echo "- Optional after capture: bash scripts/pipeline-run-closeout.sh <evidence-dir>"
  fi
} > "$OUT_PATH"

echo "$OUT_PATH"

if [[ "$status" != "PASS" ]]; then
  exit 2
fi
