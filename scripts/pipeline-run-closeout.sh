#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <evidence_dir>"
  exit 1
fi

EVIDENCE_DIR="$1"

echo "[1/2] Generating evidence report for: $EVIDENCE_DIR"
node scripts/pipeline-run-evidence-report.mjs "$EVIDENCE_DIR"

echo "[2/3] Generating transition plan"
node scripts/pipeline-run-transition-plan.mjs --dir "$EVIDENCE_DIR"

echo "[3/3] Printing closure checklist"
echo "- Evidence bundle contract:"
echo "  - auth-smoke.log"
echo "  - valid-response.json"
echo "  - invalid-response.json"
echo "  - pipeline-run-created.audit.json"
echo "  - manifest.json"
echo "  - evidence-report.md"
echo "  - transition-plan.json"
echo "- If report + transition plan are PASS:"
echo "  1) Update TASK-0111 comment with evidence path"
echo "  2) Update TASK-0103 comment and move to Ready for Review"
echo "  3) Update TASK-0097 comment and move to Ready for Review"
echo "  4) Update TASK-0095 comment and request review-safe transition"
echo "- If report or transition plan is BLOCKED:"
echo "  1) Keep TASK-0111 open"
echo "  2) Capture missing artifact names from report/plan"
