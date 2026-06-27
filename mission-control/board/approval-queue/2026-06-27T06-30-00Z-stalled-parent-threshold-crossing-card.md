# June 27 Stalled Parent Threshold-Crossing Card

Timestamp: 2026-06-27T06:30:00Z
Owner: sentinel
Executed Child Task: `TASK-0491`
Scope: `TASK-0107`, `TASK-0029`, `TASK-0030`, `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Carry the stalled lane forward without inventing fake implementation work: record that the TS-UI parent asks are now unambiguously stale, confirm the decomposition gate still holds mechanically, and give one exact current decision tuple for the live five-row lane.

## Stalled Open Set At Sweep Start
- `Doing >48h`: `0`
- `Ready for Review >24h`: `14`
- `Blocked`: `2` (`TASK-0107`, `TASK-0269`)

Detailed stale `Ready for Review` rows:
- `TASK-0421`, `TASK-0422`, `TASK-0435` -> child leaves under `TASK-0029`
- `TASK-0424`, `TASK-0425`, `TASK-0426`, `TASK-0427`, `TASK-0428`, `TASK-0430`, `TASK-0431`, `TASK-0432`, `TASK-0433` -> child leaves under `TASK-0030`
- `TASK-0029`, `TASK-0030` -> parent review asks now aged to `48.0h`

Recovery dependents still waiting on explicit owner branch choices:
- `TASK-0335` remains the apply slice under `TASK-0269`
- `TASK-0379` remains the residue branch under `TASK-0107`

## Mandatory Decomposition Gate Result
- No stalled row needed fresh implementation decomposition.
- The 12 stale TS-UI review leaves remain bounded `30-90m` children with explicit `acceptance_criteria` and `parent_id` linkage under `TASK-0029` or `TASK-0030`.
- `TASK-0335` and `TASK-0379` remain bounded `30-60m` branch-gated slices with explicit acceptance criteria.
- `TASK-0269` remains owner-decision-blocked rather than under-decomposed.

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
- It turns the stale board back into two parent review decisions plus the blocked recovery minimum instead of fourteen implied micro-decisions.
- It records that the late-night threshold has now actually been crossed, so the next owner pass can treat `TASK-0029` and `TASK-0030` as overdue parent asks rather than edge cases.
- It preserves the no-write boundary on blocked apply work while keeping the current decision surface compact and current.

## Governance
- Routing only.
- Does not mutate `BOARD.json` statuses.
- Preserves the explicit no-write boundary on `TASK-0269` and `TASK-0335` unless Isaac chooses the reopen/apply branch.
