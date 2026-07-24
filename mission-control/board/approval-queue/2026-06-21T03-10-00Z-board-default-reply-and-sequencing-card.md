# June 21 Board Default Reply And Sequencing Card

Timestamp: 2026-06-21T03:10:00Z
Owner: sentinel
Executed Child Task: `TASK-0457`
Scope: `TASK-0029`, `TASK-0030`, `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Fuse the current recommended owner reply block with the exact governed post-reply execution order so the live board can move from "decision bundle plus extra lookup" to one current copy-paste card.

## Why This Slice Was Chosen
- The live board still has no honest unattended apply lane.
- `TASK-0453` and `TASK-0454` already reduced reply friction, but both predate the new `TASK-0379` closeout preview and the exact default write sequence.
- The highest-leverage unattended move is one refreshed card that names both the reply block and the exact operator consequence of that reply.

## Recommended Default Reply
Use this if Isaac wants to close the TS-UI review pair, keep the tranche-AH recovery parent blocked, and retire the residue wrapper cleanly:

```text
BOARD DEFAULT REPLY
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0269 | decision=BLOCKED_KEEP | note=
TASK-0335 | decision=HOLD | note=
TASK-0379 | decision=CLOSE_SUPERSEDED | note=
```

## Immediate Sentinel Sequence If That Reply Lands
1. Close `TASK-0029` using `mission-control/board/approval-queue/2026-06-19T16-30-00Z-board-ui-closeout-preview-refresh.md`.
2. Close `TASK-0030` using the same parent-only closeout preview.
3. Close `TASK-0379` using `mission-control/board/approval-queue/2026-06-20T16-30-00Z-task-0379-superseded-closeout-preview.md`.
4. Leave `TASK-0269` blocked and `TASK-0335` untouched.

## Exact Write Scope

| Order | Task ID | Current Status | Planned Status | Governing Artifact |
|---|---|---|---|---|
| 1 | `TASK-0029` | `Ready for Review` | `Done` | June 19 TS-UI closeout preview |
| 2 | `TASK-0030` | `Ready for Review` | `Done` | June 19 TS-UI closeout preview |
| 3 | `TASK-0379` | `Todo` | `Done` | June 20 superseded closeout preview |

## Alternate Branches Still Available
- `HOLD_FOR_INTERACTIVE_REPLAY` on `TASK-0029` / `TASK-0030`:
  use the existing replay-hold path from the June 20 board-night bundle instead of closing the TS-UI parents.
- `TASK-0269 = REOPEN_ACTIVE` and `TASK-0335 = START_APPLY`:
  requires a fresh current-state execution bundle before any board mutation; do not reuse the drifted June 6 packet.
- `TASK-0379 = RESCOPE`:
  create only the bounded successor already defined for that branch; do not close `TASK-0379` in the same pass.

## Explicit Non-Writes
- Do not mutate `TASK-0269`.
- Do not start `TASK-0335`.
- Do not auto-close stale TS-UI child review leaves.
- Do not combine `START_APPLY` with `RESCOPE`.
- Do not replay the stale June 6 credential-cluster packet.

## Source Of Truth
- `mission-control/board/approval-queue/2026-06-20T03-10-00Z-board-night-decision-bundle.md`
- `mission-control/board/approval-queue/2026-06-20T06-30-00Z-stalled-board-decision-shortcut.md`
- `mission-control/board/approval-queue/2026-06-20T16-30-00Z-default-bundle-write-sequence-receipt.md`
- `mission-control/board/approval-queue/2026-06-20T16-30-00Z-task-0379-superseded-closeout-preview.md`

## Governance
- Card only.
- Does not mutate `BOARD.json`.
- Preserves the decision-first posture until Isaac supplies explicit row decisions.
