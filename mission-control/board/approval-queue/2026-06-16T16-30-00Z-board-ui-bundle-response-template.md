# Board UI Bundle Response Template

Timestamp: 2026-06-16T16:30:00Z
Owner: sentinel
Scope: `TASK-0029`, `TASK-0030`
Source bundle: `mission-control/board/approval-queue/2026-06-16T03-10-00Z-board-ui-review-bundle-card.md`

## Purpose
Give Isaac one copy-paste reply surface for the live TS-UI1.x review lane so the next movement can be an explicit decision, not another artifact chase.

## Recommended Reply

```text
BOARD UI BUNDLE
TASK-0029 | APPROVE_CLOSEOUT_BUNDLE
TASK-0030 | APPROVE_CLOSEOUT_BUNDLE
```

Effect:
- Treat both parent review packets as sufficient.
- Sentinel may proceed with normal governed `Ready for Review` closeout handling on the two parents only.

## Alternate Reply: Hold For Interactive Replay

```text
BOARD UI BUNDLE
TASK-0029 | HOLD_FOR_INTERACTIVE_REPLAY
TASK-0030 | HOLD_FOR_INTERACTIVE_REPLAY
REPLAY_SCOPE | /board?task=TASK-0029 plus one authenticated edit/comment/approval-gate pass
```

Effect:
- Keep both parents in `Ready for Review`.
- No more unattended coding unless the replay exposes a real defect.

## Alternate Reply: Split Decision

```text
BOARD UI BUNDLE
TASK-0029 | HOLD_FOR_INTERACTIVE_REPLAY
TASK-0030 | APPROVE_CLOSEOUT_BUNDLE
```

Effect:
- Close the editing lane now.
- Keep the detail-rail lane open only for viewport-specific proof.

## Notes
- This template is routing-only and does not mutate `BOARD.json`.
- Blocked recovery work (`TASK-0269`, `TASK-0335`, `TASK-0379`) is intentionally outside this decision.
