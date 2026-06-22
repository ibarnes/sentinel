# June 22 Board Branch-to-Contract Operator Map

Timestamp: 2026-06-22T16:30:00Z
Owner: sentinel
Executed Child Task: `TASK-0464`
Scope: `TASK-0029`, `TASK-0030`, `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Turn the live five-row board lane into one direct branch map: if Isaac chooses a valid June 22 branch, this file points straight to the exact downstream contract and immediate next Sentinel action.

## Branch Map

| Branch | Decision Tuple | Open Next | Immediate Sentinel Action | Explicit Non-Write Boundary |
|---|---|---|---|---|
| Default closeout | `TASK-0029 = APPROVE_CLOSEOUT_BUNDLE`, `TASK-0030 = APPROVE_CLOSEOUT_BUNDLE`, `TASK-0269 = BLOCKED_KEEP`, `TASK-0335 = HOLD`, `TASK-0379 = CLOSE_SUPERSEDED` | `mission-control/board/approval-queue/2026-06-20T16-30-00Z-default-bundle-write-sequence-receipt.md` | execute the governed three-row closeout sequence only | do not reopen `TASK-0269`; do not start `TASK-0335`; do not create `RESCOPE` successor |
| Replay hold | `TASK-0029 = HOLD_FOR_INTERACTIVE_REPLAY`, `TASK-0030 = HOLD_FOR_INTERACTIVE_REPLAY`, `TASK-0269 = BLOCKED_KEEP`, `TASK-0335 = HOLD`, `TASK-0379 = CLOSE_SUPERSEDED` | `mission-control/board/approval-queue/2026-06-18T16-30-00Z-board-ui-interactive-replay-checklist.md` and `mission-control/board/approval-queue/2026-06-20T16-30-00Z-task-0379-superseded-closeout-preview.md` | keep TS-UI parents in review, run replay only if explicitly requested, and close `TASK-0379` only if Isaac keeps that parked branch | do not close `TASK-0029` / `TASK-0030`; do not reopen recovery |
| Recovery reopen + apply | `TASK-0269 = REOPEN_ACTIVE`, `TASK-0335 = START_APPLY`, plus an explicit `TASK-0379` branch | `mission-control/board/approval-queue/2026-06-19T16-30-00Z-recovery-post-reply-execution-bundle-contract.md` | rebuild a fresh current-state execution bundle before any board mutation | do not execute from the stale June 6 packet; do not infer a row set from older drifted artifacts |
| Recovery reopen + planning only | `TASK-0269 = REOPEN_ACTIVE`, `TASK-0335 = HOLD`, `TASK-0379 = RESCOPE` | `mission-control/board/approval-queue/2026-06-18T16-30-00Z-task-0379-rescope-successor-candidate.md` | create only the bounded `TASK-0379` successor and keep `TASK-0335` planning-only | do not start tranche-AH apply; do not mix `START_APPLY` with `RESCOPE` |

## Reading Order
1. Start with `mission-control/board/approval-queue/2026-06-22T06-30-00Z-board-default-branch-fast-path.md` if the goal is the shortest valid reply.
2. Open the downstream contract from the table only after the branch is known.
3. Ignore older packet chains unless the mapped contract explicitly sends you there.

## Why This Helped
- The fast-path card is the smallest reply surface, but not the smallest operator lookup surface.
- The live lane now has one same-day map from decision branch to execution contract.
- This keeps the next governed action branch-specific without reopening analysis churn.

## Governance
- Routing only.
- Does not mutate `BOARD.json`.
- Exists to lower operator lookup friction, not to authorize action without Isaac's choice.
