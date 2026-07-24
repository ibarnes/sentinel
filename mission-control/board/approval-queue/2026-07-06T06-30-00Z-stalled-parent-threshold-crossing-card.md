# July 6 Stalled Parent Threshold-Crossing Card

Timestamp: 2026-07-06T06:30:23Z
Owner: sentinel
Executed Child Task: `TASK-0536`
Scope: `TASK-0107`, `TASK-0029`, `TASK-0030`, `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Carry the stalled lane forward without inventing fake implementation work: record that the TS-UI parent asks have now crossed back into the strict stale bucket at the actual July 6 run time, confirm the decomposition gate still holds mechanically, and keep one exact current decision tuple in front of Isaac.

## Stalled Open Set At Sweep Start
- `Doing >48h`: `0`
- `Ready for Review >24h`: `14`
- `Blocked`: `2` (`TASK-0107`, `TASK-0269`)
- Decision-gated apply followers still waiting on owner branch choice: `TASK-0335`, `TASK-0379`

Detailed stale `Ready for Review` rows:
- `TASK-0421`, `TASK-0422`, `TASK-0435` -> child leaves under `TASK-0029`
- `TASK-0424`, `TASK-0425`, `TASK-0426`, `TASK-0427`, `TASK-0428`, `TASK-0430`, `TASK-0431`, `TASK-0432`, `TASK-0433` -> child leaves under `TASK-0030`
- `TASK-0029`, `TASK-0030` -> parent review asks now aged to about `24.006h` at actual execution time (`2026-07-06T06:30:23Z`)

Current blocked rows past the same threshold:
- `TASK-0107` -> `24.006h`
- `TASK-0269` -> `24.006h`

## Mandatory Decomposition Gate Result
- No stalled row needed fresh implementation decomposition.
- The 12 stale TS-UI review leaves remain bounded `30-90m` children with explicit `acceptance_criteria` and `parent_id` linkage under `TASK-0029` or `TASK-0030`.
- `TASK-0335` and `TASK-0379` remain bounded decision-gated slices with explicit acceptance criteria.
- `TASK-0107` and `TASK-0269` remain blocked because of owner choice, not oversized scope.
- The only honest unblock move in this sweep was another routing-only `30-45m` child that records the threshold crossing and keeps the live five-row decision surface compact.

## Current Compacted Lane

### Review-only parent asks
- `TASK-0029` = close the board detail rail parent or hold for authenticated replay.
- `TASK-0030` = close the board editing parent or hold for authenticated replay.

### Recovery minimum
- `TASK-0269` remains `Blocked` unless Isaac explicitly chooses `REOPEN_ACTIVE`.
- `TASK-0335` stays `HOLD` unless Isaac explicitly pairs `TASK-0269 = REOPEN_ACTIVE` with `START_APPLY`.
- `TASK-0379` stays a residue decision between `CLOSE_SUPERSEDED` and `RESCOPE`.

## Smallest Honest Owner Reply

```text
BOARD LATE-NIGHT DEFAULT
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0269 | decision=BLOCKED_KEEP | note=
TASK-0335 | decision=HOLD | note=
TASK-0379 | decision=CLOSE_SUPERSEDED | note=
```

Immediate Sentinel action if sent:
1. Close only `TASK-0029`, `TASK-0030`, and `TASK-0379`.
2. Keep `TASK-0269` blocked.
3. Do not start `TASK-0335`.

## Exact Alternate Branches
- If Isaac wants browser proof before closeout: use `HOLD_FOR_INTERACTIVE_REPLAY` for `TASK-0029` and `TASK-0030`, while keeping `TASK-0269 = BLOCKED_KEEP`, `TASK-0335 = HOLD`, `TASK-0379 = CLOSE_SUPERSEDED`.
- If Isaac wants recovery reopened: `TASK-0269 = REOPEN_ACTIVE` must be explicit, and `TASK-0335 = START_APPLY` is still a separate required decision. Do not infer it.
- If Isaac wants planning-only recovery: pair `TASK-0269 = REOPEN_ACTIVE` with `TASK-0335 = HOLD` and `TASK-0379 = RESCOPE`.

## Why This Unblocks
- It keeps the stalled-count narrative truthful at the actual July 6 run time instead of carrying forward July 5's exact-threshold reading.
- It preserves the parent-compacted five-row decision surface instead of letting the board drift back into fourteen implied micro-decisions.
- It records the threshold crossing without starting blocked apply work or mutating any board status.

## Governance
- Routing only.
- Does not mutate `BOARD.json` statuses.
- Preserves the explicit no-write boundary on `TASK-0269` and `TASK-0335` unless Isaac chooses the reopen/apply branch.
