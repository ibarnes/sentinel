# Stale-RFR Heuristic Backfill Preview

Timestamp: 2026-06-12T10:45:10.652Z
Owner: sentinel
Parent: TASK-0107
Child Task: TASK-0417
Input Matrix: mission-control/artifacts/2026-06-12-stale-rfr-heuristic-review-matrix.json

## Purpose
Show the exact stale Ready-for-Review rows that could be included in a future metadata-only parent backfill pass if a reviewer confirms the inferred lineage.

## Summary
- heuristic rows reviewed: 14
- reviewer-confirmable rows: 14
- remain-on-hold rows: 0

## Reviewer-Confirmable Preview
These rows are still review-only here. No `BOARD.json` mutation has been applied.

| Task ID | Proposed parent_id | Parent Title | Rule | Supporting Refs | Why it is bounded |
|---|---|---|---|---|---|
| TASK-0293 | TASK-0103 | TS-H1.1c.2b Execute credentialed authenticated smoke and attach evidence | family_stem_consensus | TASK-0097, TASK-0103 | Sibling task family and direct parent-stream refs agree on the same inferred parent, making this suitable for a guarded reviewer-approved metadata pass. |
| TASK-0294 | TASK-0103 | TS-H1.1c.2b Execute credentialed authenticated smoke and attach evidence | family_stem_consensus | TASK-0097, TASK-0103 | Sibling task family and direct parent-stream refs agree on the same inferred parent, making this suitable for a guarded reviewer-approved metadata pass. |
| TASK-0308 | TASK-0103 | TS-H1.1c.2b Execute credentialed authenticated smoke and attach evidence | family_stem_consensus | TASK-0097, TASK-0103 | Sibling task family and direct parent-stream refs agree on the same inferred parent, making this suitable for a guarded reviewer-approved metadata pass. |
| TASK-0309 | TASK-0103 | TS-H1.1c.2b Execute credentialed authenticated smoke and attach evidence | family_stem_consensus | TASK-0097, TASK-0103 | Sibling task family and direct parent-stream refs agree on the same inferred parent, making this suitable for a guarded reviewer-approved metadata pass. |
| TASK-0310 | TASK-0103 | TS-H1.1c.2b Execute credentialed authenticated smoke and attach evidence | family_stem_consensus | TASK-0097, TASK-0103 | Sibling task family and direct parent-stream refs agree on the same inferred parent, making this suitable for a guarded reviewer-approved metadata pass. |
| TASK-0311 | TASK-0103 | TS-H1.1c.2b Execute credentialed authenticated smoke and attach evidence | family_stem_consensus | TASK-0097, TASK-0103 | Sibling task family and direct parent-stream refs agree on the same inferred parent, making this suitable for a guarded reviewer-approved metadata pass. |
| TASK-0317 | TASK-0103 | TS-H1.1c.2b Execute credentialed authenticated smoke and attach evidence | family_stem_consensus | TASK-0097, TASK-0103 | Sibling task family and direct parent-stream refs agree on the same inferred parent, making this suitable for a guarded reviewer-approved metadata pass. |
| TASK-0318 | TASK-0103 | TS-H1.1c.2b Execute credentialed authenticated smoke and attach evidence | family_stem_consensus | TASK-0097, TASK-0103, TASK-0317 | Sibling task family and direct parent-stream refs agree on the same inferred parent, making this suitable for a guarded reviewer-approved metadata pass. |
| TASK-0325 | TASK-0103 | TS-H1.1c.2b Execute credentialed authenticated smoke and attach evidence | family_stem_consensus | TASK-0097, TASK-0103 | Sibling task family and direct parent-stream refs agree on the same inferred parent, making this suitable for a guarded reviewer-approved metadata pass. |
| TASK-0326 | TASK-0103 | TS-H1.1c.2b Execute credentialed authenticated smoke and attach evidence | family_stem_consensus | TASK-0097, TASK-0103 | Sibling task family and direct parent-stream refs agree on the same inferred parent, making this suitable for a guarded reviewer-approved metadata pass. |
| TASK-0374 | TASK-0103 | TS-H1.1c.2b Execute credentialed authenticated smoke and attach evidence | family_stem_consensus | TASK-0103, TASK-0097 | Sibling task family and direct parent-stream refs agree on the same inferred parent, making this suitable for a guarded reviewer-approved metadata pass. |
| TASK-0375 | TASK-0103 | TS-H1.1c.2b Execute credentialed authenticated smoke and attach evidence | family_stem_consensus | TASK-0103, TASK-0097 | Sibling task family and direct parent-stream refs agree on the same inferred parent, making this suitable for a guarded reviewer-approved metadata pass. |
| TASK-0265 | TASK-0264 | TS-H1.1c.2e Refresh credential preflight evidence snapshot | single_descendant_ref | TASK-0103, TASK-0264 | Exactly one descendant reference survives after ancestor reduction, so the inferred parent stream is bounded and reviewer-checkable. |
| TASK-0285 | TASK-0284 | BRS-2026-05-02a Build tranche-AH decision input validator + template | single_descendant_ref | TASK-0271, TASK-0284 | Exactly one descendant reference survives after ancestor reduction, so the inferred parent stream is bounded and reviewer-checkable. |

## Guardrails For Future Apply Pass
1. Require explicit reviewer confirmation for each row or for the whole bounded cluster before any metadata writeback.
2. Limit any future mutation to `parent_id` only; do not change task status, priority, title, tags, comments, or approvals.
3. Exclude any row that picks up a second plausible parent stream before the guarded pass runs.
4. Publish a before/after delta log in `mission-control/board/sweeps/` if a future apply pass is approved.

## Hold Rows
- None inside the current heuristic matrix.

## Recommended Next Step
If this preview is accepted, the next atomic task should be a guarded metadata-only apply pass for the reviewer-confirmed rows plus a deterministic before/after lineage delta receipt.

