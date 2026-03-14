#!/usr/bin/env bash
set -euo pipefail

OUT_PATH="${1:-}"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

base_url="${BASE_URL:-}"
cookie="${TEAM_SESSION_COOKIE:-}"
deck_id="${DECK_ID:-}"
initiative_id="${INITIATIVE_ID:-}"
deck_type="${DECK_TYPE:-}"
buyer_id="${BUYER_ID:-}"

status="PASS"
missing=()

if [[ -z "$base_url" ]]; then missing+=("BASE_URL"); fi
if [[ -z "$cookie" ]]; then missing+=("TEAM_SESSION_COOKIE"); fi

if (( ${#missing[@]} > 0 )); then
  status="BLOCKED"
fi

cookie_len=0
cookie_prefix=""
if [[ -n "$cookie" ]]; then
  cookie_len=${#cookie}
  cookie_prefix="${cookie:0:8}"
fi

report=$(cat <<EOF
# Credential Env Check

- Timestamp (UTC): ${STAMP}
- Status: ${status}

## Required env
- BASE_URL: $([[ -n "$base_url" ]] && echo "present" || echo "missing")
- TEAM_SESSION_COOKIE: $([[ -n "$cookie" ]] && echo "present" || echo "missing")

## Optional targeting env
- DECK_ID: ${deck_id:-<unset>}
- INITIATIVE_ID: ${initiative_id:-<unset>}
- DECK_TYPE: ${deck_type:-<unset>}
- BUYER_ID: ${buyer_id:-<unset>}

## Cookie sanity (redacted)
- TEAM_SESSION_COOKIE length: ${cookie_len}
- TEAM_SESSION_COOKIE prefix: ${cookie_prefix:-<unset>}

## Blocking reasons
$([[ ${#missing[@]} -gt 0 ]] && printf -- '- Missing: %s\n' "${missing[*]}" || echo "- None")
EOF
)

if [[ -n "$OUT_PATH" ]]; then
  mkdir -p "$(dirname "$OUT_PATH")"
  printf '%s
' "$report" > "$OUT_PATH"
  echo "wrote $OUT_PATH"
else
  printf '%s
' "$report"
fi

if [[ "$status" != "PASS" ]]; then
  exit 2
fi
