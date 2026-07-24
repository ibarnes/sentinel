# June 22 Board Default-Branch Fast Path

Timestamp: 2026-06-22T06:30:00Z
Owner: sentinel
Executed Child Task: `TASK-0461`
Scope: `TASK-0029`, `TASK-0030`, `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Collapse the live five-row board lane to the smallest honest reply surface: one default send-now branch, one replay-hold fallback, and one explicit note about the only branch that still requires a fresh rebuild.

## Recommended Send-Now Branch
Use this if Isaac wants the shortest coherent answer and the least-risk write set.

```text
BOARD FAST PATH
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0269 | decision=BLOCKED_KEEP | note=
TASK-0335 | decision=HOLD | note=
TASK-0379 | decision=CLOSE_SUPERSEDED | note=
```

## Immediate Effect If Sent
1. Close `TASK-0029`.
2. Close `TASK-0030`.
3. Close `TASK-0379`.
4. Leave `TASK-0269` blocked.
5. Leave `TASK-0335` untouched.

Total writes: `3`

## Smallest Honest Fallback
Use this only if Isaac wants interactive replay before closing the TS-UI pair.

```text
BOARD FAST PATH ALT
TASK-0029 | decision=HOLD_FOR_INTERACTIVE_REPLAY | note=
TASK-0030 | decision=HOLD_FOR_INTERACTIVE_REPLAY | note=
TASK-0269 | decision=BLOCKED_KEEP | note=
TASK-0335 | decision=HOLD | note=
TASK-0379 | decision=CLOSE_SUPERSEDED | note=
```

Immediate effect:
- keep `TASK-0029` and `TASK-0030` in review
- keep `TASK-0269` blocked
- keep `TASK-0335` untouched
- close `TASK-0379` only if Isaac explicitly keeps that row on the parked branch

## Not Safe To Compress Further
- `TASK-0269 = REOPEN_ACTIVE` plus `TASK-0335 = START_APPLY` still requires a fresh current-state rebuild before any board mutation.
- `TASK-0379 = RESCOPE` is a different branch from `CLOSE_SUPERSEDED`; do not blend them into the default send-now path.

## Why This Helped
- The canonical June 21 packet set was already correct.
- The remaining friction was not missing analysis; it was reply size.
- This card turns the default branch into one tiny message without changing the governed write boundary.

## Source Of Truth
- `mission-control/board/approval-queue/2026-06-21T03-10-00Z-board-default-reply-and-sequencing-card.md`
- `mission-control/board/approval-queue/2026-06-21T06-30-00Z-board-bundle-ballot.md`
- `mission-control/board/approval-queue/2026-06-21T16-30-00Z-board-current-decision-surface-index.md`
- `mission-control/board/approval-queue/2026-06-21T16-30-00Z-board-decision-surface-consistency-receipt.md`

## Governance
- Card only.
- Does not mutate `BOARD.json`.
- Exists to minimize reply burden, not to bypass owner approval.
