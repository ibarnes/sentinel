# Board Recovery Sweep (Late Night)

Timestamp: 2026-06-08T06:30:00Z
Board Source: mission-control/board/BOARD.json

## Stalled List
- In Progress >48h: TASK-0043 (182.0h), TASK-0097 (158.0h)
- Ready for Review >24h: 147 tasks after this sweep (down from 180 pre-action stale rows on the live board)
- Blocked status tasks: 0
- Material change since prior late-night sweep: TASK-0095 has exited the In Progress >48h set; the remaining overdue execution chain is now concentrated on TASK-0043 -> TASK-0097 and the stale-RFR queue is smaller and less orphaned after lineage repair.

## Mandatory Decomposition Gate Updates
1. Existing overdue oversized parents remain validly decomposed and should not be re-split blindly:
- TASK-0043 remains implementation-complete and dependency-gated on the credentialed smoke chain.
- TASK-0097 remains the live-execution parent with current executable children already in place, most recently TASK-0391 (one-pass path repair, now Ready for Review).

2. New executed child task:
- TASK-0392 (child-of:TASK-0107, 30-60m, Ready for Review) [executed]
- Scope: backfill missing parent_id on stale Ready-for-Review rows only where lineage is unambiguous from a single parent:* or child-of:* tag and the referenced parent exists.
- Acceptance:
  - each changed row gains exactly one valid parent_id
  - no task status changes occur
  - sweep artifact records touched IDs grouped by parent stream

## Recovery Plan
1. Do not spend more unattended time re-splitting TASK-0043 or TASK-0097; both are already decomposed enough, and the true blocker is still credentialed runtime input.
2. Keep unified recovery apply work on the single Isaac decision surface at mission-control/board/approval-queue/2026-06-06T06-30-00Z-board-recovery-decision-pack.md.
3. Continue board-friction reduction only where it is metadata-safe and makes the stale-RFR queue easier to compact or review.

## Unblock Action Taken
- Executed TASK-0392 and backfilled parent_id on 28 stale Ready-for-Review rows with unambiguous lineage.
- Parent-link normalization by stream:
  - TASK-0103: 12 tasks
  - TASK-0107: 7 tasks
  - TASK-0269: 5 tasks
  - TASK-0097: 4 tasks
- Changed IDs:
  - TASK-0273, TASK-0274, TASK-0286, TASK-0287, TASK-0288, TASK-0289, TASK-0290, TASK-0333, TASK-0336, TASK-0337, TASK-0341, TASK-0343, TASK-0344, TASK-0345, TASK-0348, TASK-0349, TASK-0352, TASK-0353, TASK-0360, TASK-0361, TASK-0363, TASK-0364, TASK-0376, TASK-0377, TASK-0378, TASK-0380, TASK-0381, TASK-0386
- Result:
  - stale Ready for Review >24h rows fell from 180 to 147 because the touched rows were refreshed during lineage repair
  - stale Ready-for-Review rows lacking parent_id fell from 92 to 65

## Isaac Decision Needed Next
- Fill mission-control/board/approval-queue/2026-06-06T06-30-00Z-board-recovery-decision-pack.md.
- That remains the only decision gate for:
  - TASK-0335 tranche-AH apply
  - TASK-0379 credential-cluster compaction apply
- Separate from board recovery, the execution lane still needs a credentialed smoke window with BASE_URL, TEAM_SESSION_COOKIE, and either DECK_ID or selector inputs to close TASK-0097 / TASK-0095 / TASK-0043.
