# June 25 Stalled Lane Deadline and Default-Reply Card

Timestamp: 2026-06-25T06:30:00Z
Owner: sentinel
Executed Child Task: `TASK-0477`
Scope: `TASK-0107`, `TASK-0029`, `TASK-0030`, `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Carry the stalled lane forward without inventing fake implementation work: restate the true stall shape, confirm the decomposition gate is already satisfied, and give one smallest current owner reply surface for the live five-row lane.

## Stalled Open Set At Sweep Start
- `Doing >48h`: `0`
- `Ready for Review >24h`: `12`
- `Blocked`: `2` (`TASK-0107`, `TASK-0269`)

Additional edge condition:
- `TASK-0029` and `TASK-0030` were each exactly `24.0h` old at sweep start, so they were not yet stale by the strict `>24h` rule but would become the next aging parent review asks if no reply arrives before the next late-night recovery window.

## Mandatory Decomposition Gate Result
- No stalled row needed new implementation decomposition.
- The 12 stale `Ready for Review` leaves are still atomic `30-90m` slices already grouped under `TASK-0029` or `TASK-0030`.
- `TASK-0335` and `TASK-0379` remain atomic `30-60m` branch-gated slices.
- `TASK-0269` remains owner-decision-blocked rather than under-decomposed.

## Current Compacted Lane

### Review-only parent asks
- `TASK-0029` = close the board detail rail parent or hold for authenticated replay.
- `TASK-0030` = close the board editing parent or hold for authenticated replay.

Supporting stale leaves already compacted:
- `TASK-0029` children: `TASK-0421`, `TASK-0422`, `TASK-0435`
- `TASK-0030` children: `TASK-0424`, `TASK-0425`, `TASK-0426`, `TASK-0427`, `TASK-0428`, `TASK-0430`, `TASK-0431`, `TASK-0432`, `TASK-0433`

### Recovery minimum
- `TASK-0269` remains `Blocked`
- `TASK-0335` remains the apply slice, but only after explicit `REOPEN_ACTIVE + START_APPLY`
- `TASK-0379` remains the residue branch choice: `CLOSE_SUPERSEDED` or `RESCOPE`

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
- It keeps the recovery sweep honest about the actual blocker: owner routing, not missing implementation slices.
- It prevents the next sweep from treating the TS-UI parents as ambiguous stale asks.
- It reduces the live five-row lane to one copy-paste default tuple without authorizing any blocked apply work.

## Governance
- Routing only.
- Does not mutate `BOARD.json`.
- Preserves the explicit no-write boundary on `TASK-0269` and `TASK-0335` unless Isaac chooses the reopen/apply branch.
