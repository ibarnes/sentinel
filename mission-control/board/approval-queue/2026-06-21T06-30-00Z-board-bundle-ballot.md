# June 21 Board Bundle Ballot

Timestamp: 2026-06-21T06:30:00Z
Owner: sentinel
Executed Child Task: `TASK-0458`
Scope: `TASK-0029`, `TASK-0030`, `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Turn the five live stalled-board decisions into a few coherent whole-board reply bundles so Isaac can answer from a phone-sized ballot instead of mixing row-by-row instructions.

## Live Stalled Surface Covered
- TS-UI review parents: `TASK-0029`, `TASK-0030`
- Blocked recovery minimum: `TASK-0269`, `TASK-0335`, `TASK-0379`

## Valid Whole-Board Bundles

| Bundle | Exact Reply | Immediate Sentinel Action | Explicit Non-Writes |
|---|---|---|---|
| Default close + park recovery | `TASK-0029=APPROVE_CLOSEOUT_BUNDLE`, `TASK-0030=APPROVE_CLOSEOUT_BUNDLE`, `TASK-0269=BLOCKED_KEEP`, `TASK-0335=HOLD`, `TASK-0379=CLOSE_SUPERSEDED` | Close the two TS-UI parents plus `TASK-0379` in the governed three-row order from the June 20/21 contracts | No `TASK-0269` mutation. No `TASK-0335` apply. No replay request. |
| Hold for replay + keep recovery parked | `TASK-0029=HOLD_FOR_INTERACTIVE_REPLAY`, `TASK-0030=HOLD_FOR_INTERACTIVE_REPLAY`, `TASK-0269=BLOCKED_KEEP`, `TASK-0335=HOLD`, `TASK-0379=CLOSE_SUPERSEDED` | Keep both TS-UI parents in review and use the replay checklist path if Isaac wants viewport follow-through; close `TASK-0379` only if explicitly kept on the parked branch | No TS-UI closeout. No tranche-AH apply. No residue rescope. |
| Execute tranche-AH now | `TASK-0029=APPROVE_CLOSEOUT_BUNDLE`, `TASK-0030=APPROVE_CLOSEOUT_BUNDLE`, `TASK-0269=REOPEN_ACTIVE`, `TASK-0335=START_APPLY`, `TASK-0379=CLOSE_SUPERSEDED` | Close the TS-UI parents, rebuild the fresh current-state `TASK-0335` execution bundle, then run only the approved tranche-AH apply path | Do not reuse the drifted June 6 packet. Do not `RESCOPE` `TASK-0379` in the same pass. |
| Park recovery but rescope residue | `TASK-0029=APPROVE_CLOSEOUT_BUNDLE`, `TASK-0030=APPROVE_CLOSEOUT_BUNDLE`, `TASK-0269=BLOCKED_KEEP`, `TASK-0335=HOLD`, `TASK-0379=RESCOPE` | Close the TS-UI parents, keep tranche-AH blocked, and create only the next bounded successor for the residue lane | No tranche-AH apply. No auto-close of the rescope target. |

## Recommended Reply

```text
BOARD BUNDLE BALLOT
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0269 | decision=BLOCKED_KEEP | note=
TASK-0335 | decision=HOLD | note=
TASK-0379 | decision=CLOSE_SUPERSEDED | note=
```

## Invalid Combinations To Avoid
- `TASK-0269 = BLOCKED_KEEP` with `TASK-0335 = START_APPLY`
- `TASK-0269 = CLOSE_SUPERSEDED` with `TASK-0335 = START_APPLY`
- `TASK-0335 = START_APPLY` with `TASK-0379 = RESCOPE`
- Split TS-UI directions where one parent is approved and the other is held unless Isaac explicitly wants asymmetric review

## Source Of Truth
- `mission-control/board/approval-queue/2026-06-18T03-10-00Z-board-recovery-decision-combination-matrix.md`
- `mission-control/board/approval-queue/2026-06-19T16-30-00Z-board-ui-closeout-preview-refresh.md`
- `mission-control/board/approval-queue/2026-06-20T16-30-00Z-default-bundle-write-sequence-receipt.md`
- `mission-control/board/approval-queue/2026-06-20T16-30-00Z-task-0379-superseded-closeout-preview.md`
- `mission-control/board/approval-queue/2026-06-21T03-10-00Z-board-default-reply-and-sequencing-card.md`

## Governance
- Ballot only.
- Does not mutate `BOARD.json`.
- Exists to reduce contradiction and reply friction, not to invent an unattended apply lane.
