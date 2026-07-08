# July 8 Stale Review Threshold Reset Card

Timestamp: 2026-07-08T06:30:16Z
Owner: sentinel
Executed Child Task: `TASK-0546`
Scope: `TASK-0107`, `TASK-0029`, `TASK-0030`, `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Keep the stalled lane truthful at the actual July 8 late-night reread: the 12 TS-UI child leaves remain stale review work, while `TASK-0029` and `TASK-0030` are no longer inside the `Ready for Review >24h` bucket because the July 7 recovery sweep refreshed them at `2026-07-07T06:30:20Z`.

## Stalled Open Set At Sweep Start
- `Doing >48h`: `0`
- `Ready for Review >24h`: `12`
- `Blocked`: `2` (`TASK-0107`, `TASK-0269`)
- Decision-gated apply followers still waiting on owner branch choice: `TASK-0335`, `TASK-0379`

Detailed stale `Ready for Review` rows:
- `TASK-0421`, `TASK-0422`, `TASK-0435` -> child leaves under `TASK-0029`
- `TASK-0424`, `TASK-0425`, `TASK-0426`, `TASK-0427`, `TASK-0428`, `TASK-0430`, `TASK-0431`, `TASK-0432`, `TASK-0433` -> child leaves under `TASK-0030`

Threshold-reset nuance at actual execution time (`2026-07-08T06:30:16Z`):
- `TASK-0029` age since last refresh: about `23.9989h`
- `TASK-0030` age since last refresh: about `23.9989h`
- `TASK-0107` age since last refresh: about `23.9989h`
- `TASK-0269` age since last refresh: about `23.9989h`
- The July 7 recovery sweep touched all four rows four seconds later at `2026-07-07T06:30:20Z`, so none of them honestly cross a fresh 24-hour line yet during this run.

## Mandatory Decomposition Gate Result
- No stalled row needed fresh implementation decomposition.
- The 12 stale TS-UI review leaves remain bounded `30-90m` children with explicit `acceptance_criteria` and `parent_id` linkage under `TASK-0029` or `TASK-0030`.
- `TASK-0335` and `TASK-0379` remain bounded decision-gated slices with explicit acceptance criteria.
- `TASK-0107` and `TASK-0269` remain blocked because of owner choice, not oversized scope.
- The honest unblock move in this sweep is another routing-only `30-45m` child that records the threshold-reset fact so the review lane is not overstated as fourteen stale rows.

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

## Why This Unblocks
- It records the real July 8 state transition: the stale review bucket contracted back to the 12 TS-UI child leaves because yesterday's carry-forward refreshed the two review parents.
- It keeps the board on one compact five-row owner decision instead of letting yesterday's fourteen-row framing linger after the threshold reset.
- It preserves the no-write boundary on blocked apply work while still moving the recovery surface forward one bounded step.

## Governance
- Routing only.
- Does not mutate `BOARD.json` statuses.
- Preserves the explicit no-write boundary on `TASK-0269` and `TASK-0335` unless Isaac chooses the reopen/apply branch.
