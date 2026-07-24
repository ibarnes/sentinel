# Board Build Window (Night) - 2026-06-09T03:10:00Z

## Selection
- Workflow C queue was still formally empty, so the highest-leverage executable board work remained stale Ready-for-Review recovery under `TASK-0107`.
- Unified recovery apply work stayed decision-gated: `TASK-0335` and `TASK-0379` still cannot execute without Isaac filling `mission-control/board/approval-queue/2026-06-06T06-30-00Z-board-recovery-decision-pack.md`.
- The remaining unattended lane was board-friction reduction: measure the orphaned stale-RFR set and separate strict metadata-safe repairs from merely plausible heuristics before any future writeback.

## Mandatory Decomposition Gate
- The residual orphaned stale-RFR cluster was too broad for blind cleanup, so tonight's work was split into bounded subtasks before execution:
  - Subtask A (30-60m): build a reusable classifier for stale Ready-for-Review rows missing `parent_id`.
  - Subtask B (30-45m): run the classifier against the live board and publish a machine-readable artifact with strict-vs-heuristic results.
  - Subtask C (conditional, 15-30m): apply only rows that pass a strict metadata-safe rule; otherwise record a no-apply receipt and queue the next narrower follow-up.
- Dependency sequence:
  - classifier script
  - live report artifact
  - strict-only metadata apply, if and only if non-empty

## Atomic Task Executed
1. Completed Subtask A + B
   - Added reusable report generator: `scripts/board/stale-rfr-parent-report.mjs`
   - Generated live artifact: `mission-control/artifacts/2026-06-09-stale-rfr-parent-report.json`
2. Conditional Subtask C was intentionally not executed
   - Result: `ready_for_immediate_metadata_apply_count = 0`
   - 14 rows are heuristic-only candidates and 19 rows remain explicit hold cases.
   - No `BOARD.json` mutation was justified because the report found no row that met a strict single-source lineage rule.

## Verification
- Ran:
  - `node scripts/board/stale-rfr-parent-report.mjs mission-control/board/BOARD.json --now 2026-06-09T03:10:00Z --out mission-control/artifacts/2026-06-09-stale-rfr-parent-report.json`
- Verified outcome:
  - stale `Ready for Review` rows: 151
  - stale rows missing `parent_id`: 33
  - immediate strict-apply candidates: 0
  - heuristic candidates: 14
  - hold / ambiguous rows: 19

## Governance
- No task moved to `Done`.
- No review-packet guardrail was bypassed.
- No board status changed.
- No metadata mutation was applied from heuristic inference alone.

## Artifacts
- `scripts/board/stale-rfr-parent-report.mjs`
- `mission-control/artifacts/2026-06-09-stale-rfr-parent-report.json`

## Next Queued Subtasks
1. Convert the 14 heuristic candidates into a human-reviewable routing card grouped by inference rule and parent stream, without mutating `BOARD.json`.
2. For the credential-smoke family, tighten the classifier with title-family allowlists only if backed by already-linked sibling precedent in the board.
3. Keep `TASK-0335` and `TASK-0379` parked until the unified recovery decision pack is filled.
