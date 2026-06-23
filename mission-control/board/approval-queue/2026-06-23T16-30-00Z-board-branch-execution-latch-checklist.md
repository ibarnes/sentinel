# June 23 Board Branch Execution Latch Checklist

Timestamp: 2026-06-23T16:30:00Z
Owner: sentinel
Executed Child Task: `TASK-0470`
Scope: `TASK-0029`, `TASK-0030`, `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Turn the live five-row lane into one latch checklist: after Isaac chooses a valid branch, this file states the exact next artifact to open, what inputs must be present, and what Sentinel still must not write.

## Latch Table

| Branch | Required Explicit Owner Tuple | Open Next | Required Inputs Before Any Write | Explicit No-Write Boundary |
|---|---|---|---|---|
| Default closeout | `TASK-0029 = APPROVE_CLOSEOUT_BUNDLE`, `TASK-0030 = APPROVE_CLOSEOUT_BUNDLE`, `TASK-0269 = BLOCKED_KEEP`, `TASK-0335 = HOLD`, `TASK-0379 = CLOSE_SUPERSEDED` | `mission-control/board/approval-queue/2026-06-20T16-30-00Z-default-bundle-write-sequence-receipt.md` | exact owner tuple, live `mission-control/board/BOARD.json`, current TS-UI parent closeout preview, current `TASK-0379` superseded-closeout preview | do not reopen `TASK-0269`; do not start `TASK-0335`; do not create a `RESCOPE` successor |
| Replay hold | `TASK-0029 = HOLD_FOR_INTERACTIVE_REPLAY`, `TASK-0030 = HOLD_FOR_INTERACTIVE_REPLAY`, `TASK-0269 = BLOCKED_KEEP`, `TASK-0335 = HOLD`, `TASK-0379 = CLOSE_SUPERSEDED` | `mission-control/board/approval-queue/2026-06-18T16-30-00Z-board-ui-interactive-replay-checklist.md` | explicit hold tuple, authenticated replay window if requested, live board state, current `TASK-0379` closeout preview if that row is still to be closed | do not close `TASK-0029` or `TASK-0030` from implied approval; do not reopen recovery |
| Recovery reopen + apply | `TASK-0269 = REOPEN_ACTIVE`, `TASK-0335 = START_APPLY`, plus explicit `TASK-0379` branch | `mission-control/board/approval-queue/2026-06-19T16-30-00Z-recovery-post-reply-execution-bundle-contract.md` | explicit owner tuple, live board state, current drift receipt, regenerated current-state execution bundle after reply | do not execute from the stale June 6 packet; do not infer untouched row statuses from older artifacts |
| Recovery planning-only | `TASK-0269 = REOPEN_ACTIVE`, `TASK-0335 = HOLD`, `TASK-0379 = RESCOPE` | `mission-control/board/approval-queue/2026-06-18T16-30-00Z-task-0379-rescope-successor-candidate.md` | explicit owner tuple, live board state, exact successor scope for the residue lane | do not start `TASK-0335`; do not mix `START_APPLY` with `RESCOPE` |

## Latch Rules
1. No branch is armed until the owner tuple is explicit in one message or one artifact.
2. `TASK-0335` may not run merely because `TASK-0269` is reopened; it also needs `START_APPLY`.
3. The June 6 recovery packet is historical context only once the June 19 drift receipt is in scope.
4. The June 23 canonical index remains the first file to open when branch uncertainty exists.

## Minimal Operator Sequence
1. Confirm the owner tuple against `mission-control/board/approval-queue/2026-06-23T16-30-00Z-board-current-owner-decision-capture.md`.
2. Open the exact branch contract from the table above.
3. Re-read live `BOARD.json` before any mutation branch.
4. Execute only the bounded write set named by that branch contract.

## Governance
- Governance-only checklist.
- Does not mutate `BOARD.json`.
- Exists to prevent stale-packet replay and accidental mixed-branch execution.
