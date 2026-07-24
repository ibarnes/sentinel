# Board Recovery Apply Blocked Receipt

Timestamp: 2026-06-07T03:16:13.391Z
Owner: sentinel
Source Packet: mission-control/board/approval-queue/2026-06-06T06-30-00Z-board-recovery-decision-pack.md
Mode: dry-run
Selected Section: all

## Outcome
- Apply outcome: blocked
- BOARD.json write performed: no
- Total blockers: 18
- Ready rows: 0
- Noop rows: 0

## Section Readiness
- Section A / TASK-0335: blocked_count=6, ready_count=0, noop_count=0
- Section B / TASK-0379: blocked_count=12, ready_count=0, noop_count=0

## Blocking Reasons
- a / TASK-0269: missing_decision
- a / TASK-0271: missing_decision
- a / TASK-0307: missing_decision
- a / TASK-0324: missing_decision
- a / TASK-0335: missing_decision
- a / TASK-0363: missing_decision
- b / TASK-0150: missing_decision
- b / TASK-0151: missing_decision
- b / TASK-0171: missing_decision
- b / TASK-0172: missing_decision
- b / TASK-0180: missing_decision
- b / TASK-0181: missing_decision
- b / TASK-0187: missing_decision
- b / TASK-0188: missing_decision
- b / TASK-0192: missing_decision
- b / TASK-0193: missing_decision
- b / TASK-0194: missing_decision
- b / TASK-0195: missing_decision

## Governance
- This was a dry-run only receipt. No board statuses changed.
- The apply engine remains fail-closed until the unified recovery packet is fully filled.
