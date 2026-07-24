# June 20 Stalled Board Decision Shortcut

Timestamp: 2026-06-20T06:30:00Z
Owner: sentinel
Executed Child Task: `TASK-0454`
Scope: `TASK-0029`, `TASK-0030`, `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Reduce reply friction on the stalled board surface to one copy-paste block aligned with the current June 20 decision bundle so the next owner response does not require re-reading the longer packet.

## What This Shortcut Covers
- `TASK-0029` and `TASK-0030` remain the only live TS-UI1.x parent approval asks.
- `TASK-0269`, `TASK-0335`, and `TASK-0379` remain the only live recovery-lane choices.
- The 12 stale review leaves stay grouped under the two TS-UI1.x parents instead of becoming 12 separate asks.

## Recommended Reply Block
```text
BOARD DECISION SHORTCUT
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0269 | decision=BLOCKED_KEEP | note=
TASK-0335 | decision=HOLD | note=
TASK-0379 | decision=CLOSE_SUPERSEDED | note=
```

## Alternate Reply Blocks

### Execute Now
```text
BOARD DECISION SHORTCUT
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0269 | decision=REOPEN_ACTIVE | note=run tranche-AH apply now
TASK-0335 | decision=START_APPLY | note=
TASK-0379 | decision=CLOSE_SUPERSEDED | note=
```

### Planning Only
```text
BOARD DECISION SHORTCUT
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0269 | decision=REOPEN_ACTIVE | note=planning only
TASK-0335 | decision=HOLD | note=
TASK-0379 | decision=RESCOPE | note=
```

## Source Of Truth
- current bundle: `mission-control/board/approval-queue/2026-06-20T03-10-00Z-board-night-decision-bundle.md`
- current TS-UI1.x closeout preview: `mission-control/board/approval-queue/2026-06-19T16-30-00Z-board-ui-closeout-preview-refresh.md`
- current recovery rebuild contract: `mission-control/board/approval-queue/2026-06-19T16-30-00Z-recovery-post-reply-execution-bundle-contract.md`

## Explicit Non-Writes
- Does not mutate `BOARD.json`.
- Does not close stale TS-UI1.x child review leaves.
- Does not authorize `TASK-0335` from the drifted June 6 packet.
- Does not mix `TASK-0335 = START_APPLY` with `TASK-0379 = RESCOPE`.
