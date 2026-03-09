#!/usr/bin/env bash
set -euo pipefail

# Smoke test for POST /api/presentation-studio/decks/{deckId}/pipeline/run
# Usage:
#   BASE_URL=http://127.0.0.1:3000 \
#   COOKIE='connect.sid=...' \
#   DECK_ID='<deck-id>' \
#   ./scripts/pipeline-run-smoke.sh
#
# Optional deck auto-resolve (if DECK_ID omitted):
#   INITIATIVE_ID=USG DECK_TYPE=buyer-mandate-mirror BUYER_ID=PIF

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
COOKIE="${COOKIE:-}"
DECK_ID="${DECK_ID:-}"
INITIATIVE_ID="${INITIATIVE_ID:-}"
DECK_TYPE="${DECK_TYPE:-}"
BUYER_ID="${BUYER_ID:-}"

if [[ -z "$COOKIE" ]]; then
  echo "ERROR: COOKIE is required (team session cookie)." >&2
  exit 1
fi

resolve_deck_id() {
  local code
  code=$(curl -sS -o /tmp/pipeline_run_resolve.json -w "%{http_code}" \
    -X POST "$BASE_URL/api/presentation-studio/decks/resolve" \
    -H "Content-Type: application/json" \
    -H "Cookie: $COOKIE" \
    --data "{\"initiativeId\":\"$INITIATIVE_ID\",\"deckType\":\"$DECK_TYPE\",\"buyerId\":\"$BUYER_ID\"}")

  if [[ "$code" != "200" && "$code" != "201" ]]; then
    echo "ERROR: deck resolve failed with HTTP $code" >&2
    cat /tmp/pipeline_run_resolve.json >&2 || true
    exit 1
  fi

  DECK_ID=$(node -e 'const fs=require("fs");const p="/tmp/pipeline_run_resolve.json";const d=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write((d.deckId||d.deck?.deckId||"").toString())')
  if [[ -z "$DECK_ID" ]]; then
    echo "ERROR: deck resolve succeeded but deckId missing in response" >&2
    cat /tmp/pipeline_run_resolve.json >&2 || true
    exit 1
  fi
}

if [[ -z "$DECK_ID" ]]; then
  if [[ -n "$INITIATIVE_ID" && -n "$DECK_TYPE" ]]; then
    echo "DECK_ID not supplied; attempting resolve via initiative/deck selectors..."
    resolve_deck_id
    echo "Resolved DECK_ID=$DECK_ID"
  else
    echo "ERROR: DECK_ID is required (or provide INITIATIVE_ID + DECK_TYPE [+ BUYER_ID] for auto-resolve)." >&2
    exit 1
  fi
fi

echo "[1/2] Valid payload -> expect 201"
VALID_CODE=$(curl -sS -o /tmp/pipeline_run_valid.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/presentation-studio/decks/$DECK_ID/pipeline/run" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  --data '{"scope":"deck","stages":["plan","draft","qa"]}')

echo "HTTP $VALID_CODE"
cat /tmp/pipeline_run_valid.json

echo ""
if [[ "$VALID_CODE" != "201" ]]; then
  echo "ERROR: expected 201 for valid payload" >&2
  exit 2
fi

echo "[2/2] Invalid payload -> expect 400"
INVALID_CODE=$(curl -sS -o /tmp/pipeline_run_invalid.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/presentation-studio/decks/$DECK_ID/pipeline/run" \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  --data '{"scope":"slide","stages":["plan"]}')

echo "HTTP $INVALID_CODE"
cat /tmp/pipeline_run_invalid.json

echo ""
if [[ "$INVALID_CODE" != "400" ]]; then
  echo "ERROR: expected 400 for invalid payload (missing slideId for scope=slide)" >&2
  exit 3
fi

echo "OK: pipeline/run smoke passed (201 + 400)."