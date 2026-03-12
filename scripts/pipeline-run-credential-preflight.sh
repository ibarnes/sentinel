#!/usr/bin/env bash
set -euo pipefail

OUT_PATH="${1:-mission-control/evidence/pipeline-run/preflight-$(date -u +%Y-%m-%dT%H-%M-%SZ).md}"
BASE_URL="${BASE_URL:-}"
TEAM_SESSION_COOKIE="${TEAM_SESSION_COOKIE:-}"

mkdir -p "$(dirname "$OUT_PATH")"

status="PASS"
missing=()
[[ -z "$BASE_URL" ]] && missing+=("BASE_URL")
[[ -z "$TEAM_SESSION_COOKIE" ]] && missing+=("TEAM_SESSION_COOKIE")
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
  echo
  if [[ "$status" == "BLOCKED" ]]; then
    echo "## Remediation"
    echo "- Export missing variables and rerun preflight."
    echo "- Then run: scripts/pipeline-run-closeout.sh <evidence-dir>"
  fi
} > "$OUT_PATH"

echo "$OUT_PATH"
