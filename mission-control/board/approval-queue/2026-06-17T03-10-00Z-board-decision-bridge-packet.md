# June 17 Board Decision Bridge Packet

Timestamp: 2026-06-17T03:10:00Z
Owner: sentinel
Executed Child Task: `TASK-0441`
Scope: `TASK-0029`, `TASK-0030`, `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Fuse the only two live board decision surfaces into one current packet so Isaac can answer the board UI closeout lane and the blocked recovery minimum in one pass without reconciling multiple older cards.

## Decomposition Gate
Current work was decomposed before execution into the smallest honest slices:

1. `TASK-0441` - publish one current bridge packet with exact reply tokens and dependency order
   - status: completed in this sweep
   - acceptance: one packet covers both live decision surfaces without mutating `BOARD.json`
2. `TASK-0335` - apply tranche-AH transitions only if Isaac marks `TASK-0335 | decision=START_APPLY`
   - dependency: requires explicit owner decision on `TASK-0269` / `TASK-0335`
   - acceptance: deterministic before/after delta log under `mission-control/board/sweeps/`
3. Parent closeout writeback for `TASK-0029` and `TASK-0030`
   - dependency: requires `APPROVE_CLOSEOUT_BUNDLE` or split approval
   - acceptance: only parent rows move; stale evidence leaves remain untouched
4. `TASK-0379` residue handling
   - dependency: requires `CLOSE_SUPERSEDED` or `RESCOPE`
   - acceptance: either explicit closure or a newly defined scope, not ambiguous limbo

## Live Surface A: Board UI Bundle
- `TASK-0029` - `Ready for Review`
  - packet: `mission-control/review-packets/RP-2026-06-15T10-40-00Z-board-task-detail-rail-review-refresh.md`
  - remaining boundary: only a human-requested viewport replay, not an unattended coding gap
- `TASK-0030` - `Ready for Review`
  - packet: `mission-control/review-packets/RP-2026-06-15T06-30-00Z-board-task-editing-lane-refresh.md`
  - remaining boundary: reviewer decision only unless replay exposes a real defect

Decision branches:
- `APPROVE_CLOSEOUT_BUNDLE`
  - effect: authorize governed parent-only closeout of `TASK-0029` and `TASK-0030`
- `HOLD_FOR_INTERACTIVE_REPLAY`
  - effect: keep both parents `Ready for Review`; no more unattended coding
- `SPLIT_DECISION`
  - effect: approve `TASK-0030` now and hold `TASK-0029` only for viewport replay

## Live Surface B: Recovery Minimum
- `TASK-0269` - `Blocked`
- `TASK-0335` - `Todo`
- `TASK-0379` - `Todo`

Decision branches:
- `TASK-0269`: `BLOCKED_KEEP` or `CLOSE_SUPERSEDED` or `REOPEN_ACTIVE`
- `TASK-0335`: `START_APPLY` or `HOLD`
- `TASK-0379`: `CLOSE_SUPERSEDED` or `RESCOPE`

## Recommended Defaults
- `TASK-0029`: `APPROVE_CLOSEOUT_BUNDLE`
- `TASK-0030`: `APPROVE_CLOSEOUT_BUNDLE`
- `TASK-0269`: `BLOCKED_KEEP`
- `TASK-0335`: `HOLD`
- `TASK-0379`: `CLOSE_SUPERSEDED`

## Copy-Paste Reply Block
```text
BOARD DECISION BRIDGE
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0269 | decision=BLOCKED_KEEP | note=
TASK-0335 | decision=HOLD | note=
TASK-0379 | decision=CLOSE_SUPERSEDED | note=
```

## If Isaac Chooses the Recommended Defaults
1. Sentinel closes out `TASK-0029` and `TASK-0030` only, using the governed parent-only write preview already published.
2. `TASK-0269` remains honestly blocked.
3. `TASK-0335` stays queued but not executed.
4. `TASK-0379` becomes eligible for explicit superseded closeout instead of lingering as ambiguous residue.

## Governance
- This packet is routing only.
- No `Done` transitions were applied here.
- No blocked recovery row was mutated.
- The board stays honest: decision first, apply second.
