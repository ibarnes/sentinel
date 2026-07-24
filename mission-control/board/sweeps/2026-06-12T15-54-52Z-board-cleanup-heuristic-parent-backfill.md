# Board Cleanup Sweep — Heuristic Parent Backfill

Timestamp: 2026-06-12T15:54:52Z
Owner: sentinel
Board: `mission-control/board/BOARD.json`

## Intent
- Apply the already-reviewed metadata-only lineage cleanup for the bounded 14-row heuristic stale-Ready-for-Review cohort.
- Keep governance strict: no status changes, no Done transitions, no title/priority/tag rewrites.

## Preconditions
- Input matrix: `mission-control/artifacts/2026-06-12-stale-rfr-heuristic-review-matrix.json`
- Guarded preview accepted from `mission-control/board/approval-queue/2026-06-12T10-40-00Z-stale-rfr-heuristic-backfill-preview.md`.
- Mutation scope limited to `parent_id` plus audit comments.

## Result
- Reviewer-confirmable rows in matrix: 14
- Rows changed: 14
- Ready-for-Review rows missing parent_id before pass: 33
- Ready-for-Review rows missing parent_id after pass: 19
- Net orphan reduction: 14

## Changed Rows
| Task ID | New parent_id | Rule | Supporting refs |
|---|---|---|---|
| TASK-0293 | TASK-0103 | family_stem_consensus | TASK-0097, TASK-0103 |
| TASK-0294 | TASK-0103 | family_stem_consensus | TASK-0097, TASK-0103 |
| TASK-0308 | TASK-0103 | family_stem_consensus | TASK-0097, TASK-0103 |
| TASK-0309 | TASK-0103 | family_stem_consensus | TASK-0097, TASK-0103 |
| TASK-0310 | TASK-0103 | family_stem_consensus | TASK-0097, TASK-0103 |
| TASK-0311 | TASK-0103 | family_stem_consensus | TASK-0097, TASK-0103 |
| TASK-0317 | TASK-0103 | family_stem_consensus | TASK-0097, TASK-0103 |
| TASK-0318 | TASK-0103 | family_stem_consensus | TASK-0097, TASK-0103, TASK-0317 |
| TASK-0325 | TASK-0103 | family_stem_consensus | TASK-0097, TASK-0103 |
| TASK-0326 | TASK-0103 | family_stem_consensus | TASK-0097, TASK-0103 |
| TASK-0374 | TASK-0103 | family_stem_consensus | TASK-0103, TASK-0097 |
| TASK-0375 | TASK-0103 | family_stem_consensus | TASK-0103, TASK-0097 |
| TASK-0265 | TASK-0264 | single_descendant_ref | TASK-0103, TASK-0264 |
| TASK-0285 | TASK-0284 | single_descendant_ref | TASK-0271, TASK-0284 |

## Governance
- No task status changed.
- No `Done` transitions applied.
- No task titles, priorities, tags, linked refs, or approvals were rewritten.
- New audit task added: `TASK-0418` under `TASK-0107` to record the cleanup pass.

## Files Changed
- `mission-control/board/BOARD.json`
- `mission-control/artifacts/2026-06-12-heuristic-parent-backfill-delta.json`
- `mission-control/board/sweeps/2026-06-12T15-54-52Z-board-cleanup-heuristic-parent-backfill.md`

## Next Recommendation
- Do not generalize this into broad status cleanup. The next safe board-hygiene move is either explicit reviewer-approved compaction/supersession work or continued bounded metadata cleanup only where lineage is equally deterministic.
