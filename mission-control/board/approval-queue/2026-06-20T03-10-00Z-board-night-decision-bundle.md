# June 20 Board Night Decision Bundle

Timestamp: 2026-06-20T03:10:00Z
Owner: sentinel
Executed Child Task: `TASK-0453`
Scope: `TASK-0029`, `TASK-0030`, `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Compress the now-fragmented June 19 board decision surface into one operator-ready packet so Isaac can answer the live review lane and blocked recovery lane from one current artifact instead of reconciling the reply template, UI closeout preview, and recovery rebuild contract separately.

## Mandatory Decomposition Gate
Current work was decomposed before execution into the smallest honest slices:

1. `TASK-0453` - publish one current decision bundle that fuses reply tokens, write previews, and post-reply recovery contract
   - status: completed in this sweep
   - acceptance:
     - one artifact cites the exact June 19 owner reply surface plus the current TS-UI1.x and recovery follow-through contracts
     - packet keeps branch order and explicit non-writes visible in one place
     - artifact stays routing-only and does not mutate `BOARD.json`
2. TS-UI1.x parent closeout writeback
   - dependency: requires explicit `APPROVE_CLOSEOUT_BUNDLE` decision on `TASK-0029` and/or `TASK-0030`
   - acceptance: only approved parent rows move to `Done`; stale leaves remain untouched
3. `TASK-0335` recovery apply rebuild
   - dependency: requires `TASK-0269 = REOPEN_ACTIVE` and `TASK-0335 = START_APPLY`
   - acceptance: regenerate one current-state execution bundle before any apply-safe mutation
4. `TASK-0379` residue handling
   - dependency: requires explicit `CLOSE_SUPERSEDED` or `RESCOPE`
   - acceptance: either close residue cleanly or create only the bounded successor defined by `TASK-0448`

## Current Live Decision Surface

### Surface A: TS-UI1.x Parent Review Lane
- `TASK-0029` - `Ready for Review`
  - review packet: `mission-control/review-packets/RP-2026-06-15T10-40-00Z-board-task-detail-rail-review-refresh.md`
- `TASK-0030` - `Ready for Review`
  - review packet: `mission-control/review-packets/RP-2026-06-15T06-30-00Z-board-task-editing-lane-refresh.md`
- current write preview: `mission-control/board/approval-queue/2026-06-19T16-30-00Z-board-ui-closeout-preview-refresh.md`

Allowed decisions:
- `APPROVE_CLOSEOUT_BUNDLE`
- `HOLD_FOR_INTERACTIVE_REPLAY`

### Surface B: Recovery Lane Minimum
- `TASK-0269` - `Blocked`
- `TASK-0335` - `Todo`
- `TASK-0379` - `Todo`
- current reply anchor: `mission-control/board/approval-queue/2026-06-19T03-10-00Z-stalled-board-owner-response-template.md`
- current recovery rebuild contract: `mission-control/board/approval-queue/2026-06-19T16-30-00Z-recovery-post-reply-execution-bundle-contract.md`

Allowed decisions:
- `TASK-0269`: `BLOCKED_KEEP` or `REOPEN_ACTIVE`
- `TASK-0335`: `HOLD` or `START_APPLY`
- `TASK-0379`: `CLOSE_SUPERSEDED` or `RESCOPE`

## Recommended Default Bundle
Use this if Isaac wants to convert the board from ambiguous waiting into explicit closeout plus parked recovery:

```text
BOARD NIGHT DECISION BUNDLE
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0269 | decision=BLOCKED_KEEP | note=
TASK-0335 | decision=HOLD | note=
TASK-0379 | decision=CLOSE_SUPERSEDED | note=
```

Immediate Sentinel action:
1. Close only `TASK-0029` and `TASK-0030` through the parent-only governed write path.
2. Leave `TASK-0269` blocked.
3. Do not start `TASK-0335`.
4. Close `TASK-0379` only if explicitly confirmed as superseded.

## Execute-Now Recovery Bundle
Use this only if Isaac wants the tranche-AH lane reopened and rebuilt for immediate apply-safe execution:

```text
BOARD NIGHT DECISION BUNDLE
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0269 | decision=REOPEN_ACTIVE | note=run tranche-AH apply now
TASK-0335 | decision=START_APPLY | note=
TASK-0379 | decision=CLOSE_SUPERSEDED | note=
```

Immediate Sentinel action:
1. Close the TS-UI1.x parents only.
2. Rebuild one current-state execution bundle for `TASK-0335` from live board state before any apply step.
3. Keep `TASK-0379` out of the active lane except for explicit superseded closeout.

## Planning-Only Recovery Bundle
Use this only if Isaac wants recovery reopened for planning but not immediate apply:

```text
BOARD NIGHT DECISION BUNDLE
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0269 | decision=REOPEN_ACTIVE | note=planning only
TASK-0335 | decision=HOLD | note=
TASK-0379 | decision=RESCOPE | note=
```

Immediate Sentinel action:
1. Keep `TASK-0335` parked.
2. Create only the bounded `TASK-0379` residue-review successor defined by `TASK-0448`.
3. Do not mix `START_APPLY` with `RESCOPE` in the same unattended pass.

## Explicit Non-Writes
- Do not mark anything `Done` without approved RP-backed owner direction.
- Do not execute `TASK-0335` from the drifted June 6 packet.
- Do not auto-close stale child evidence leaves under `TASK-0029` or `TASK-0030`.
- Do not combine `TASK-0335 = START_APPLY` with `TASK-0379 = RESCOPE`.

## Why This Was The Highest-Leverage Night Slice
- June 19 produced the right ingredients but left them split across three artifacts.
- The board is blocked on decision clarity, not implementation depth.
- One current bundle reduces reply friction without violating governance or inventing blocked apply work.

## Governance
- Routing only.
- Does not mutate `BOARD.json`.
- Keeps the board in decision-first posture.
