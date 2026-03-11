#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <evidence_dir>"
  exit 1
fi

EVIDENCE_DIR="$1"

echo "[1/2] Generating evidence report for: $EVIDENCE_DIR"
node scripts/pipeline-run-evidence-report.mjs --dir "$EVIDENCE_DIR"

echo "[2/2] Printing closure checklist"
echo "- If report is PASS:"
echo "  1) Update TASK-0111 comment with evidence path"
echo "  2) Update TASK-0103 comment and move to Ready for Review"
echo "  3) Update TASK-0097 comment and move to Ready for Review"
echo "- If report is BLOCKED:"
echo "  1) Keep TASK-0111 open"
echo "  2) Capture missing artifact names from report"
