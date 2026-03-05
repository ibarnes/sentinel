#!/usr/bin/env bash
set -euo pipefail

# Smoke test for POST /api/presentation-studio/decks/{deckId}/pipeline/run
# Usage:
#   BASE_URL=http://127.0.0.1:3000 \
#   COOKIE='connect.sid=...' \
#   DECK_ID='<deck-id>' \
#   ./scripts/pipeline-run-smoke.sh

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
COOKIE="${COOKIE:-}"
DECK_ID="${DECK_ID:-}"

if [[ -z "$COOKIE" ]]; then
  echo "ERROR: COOKIE is required (team session cookie)." >&2
  exit 1
fi

if [[ -z "$DECK_ID" ]]; then
  echo "ERROR: DECK_ID is required." >&2
  exit 1
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
