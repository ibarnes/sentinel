# Tranche Transition Delta Template (Apply-Ready)

- Task: TASK-0363
- Parent Stream: TASK-0269
- Purpose: Replay approved tranche decisions into BOARD.json in one pass with rollback safety.

## Transition Table Template
| Task ID | Current Status | Target Status | Decision (Approve/Hold/Needs Changes) | Decision Note | Operator Initials | Applied At (UTC) |
|---|---|---|---|---|---|---|
| TASK-XXXX | Ready for Review | Done | Approve | RP approved; move per tranche decision |  |  |

## Replay Checklist
1. Confirm signed decision source is attached (RP/decision sheet).
2. Snapshot board before update:
   - cp mission-control/board/BOARD.json mission-control/board/history/BOARD.before-<timestamp>.json
3. Apply only rows marked Approve with explicit target status.
4. Validate JSON integrity:
   - jq empty mission-control/board/BOARD.json
5. Write delta log in mission-control/board/sweeps/<timestamp>-board-transition-delta.md with changed IDs/statuses.
6. Link delta log path in parent stream comments.

## Rollback Note
- If any incorrect transition is detected, restore from BOARD.before-<timestamp>.json and regenerate the delta log with corrected rows.
