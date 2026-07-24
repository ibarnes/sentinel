# July 1 Exact-Threshold Stalled Lane Card

Timestamp: 2026-07-01T06:30:00Z
Owner: sentinel
Executed Child Task: `TASK-0511`
Scope: `TASK-0107`, `TASK-0029`, `TASK-0030`, `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Record the live stalled set at the exact `24.0h` parent edge condition after the June 30 linkage touch so the late-night recovery lane stays truthful: the stale set is still the 12 TS-UI child leaves, while the compacted parent asks remain open and blocked but have not crossed the strict `Ready for Review >24h` threshold.

## Stalled Open Set At Sweep Start
- `Doing >48h`: `0`
- `Ready for Review >24h`: `12`
- `Blocked`: `2` (`TASK-0107`, `TASK-0269`)

Detailed stale `Ready for Review` rows:
- `TASK-0421`, `TASK-0422`, `TASK-0435` -> child leaves under `TASK-0029`
- `TASK-0424`, `TASK-0425`, `TASK-0426`, `TASK-0427`, `TASK-0428`, `TASK-0430`, `TASK-0431`, `TASK-0432`, `TASK-0433` -> child leaves under `TASK-0030`

Current open but not stale parent asks:
- `TASK-0029` and `TASK-0030` are each exactly `24.0h` old at this sweep boundary, so they remain review-gated parents but do not enter the strict `>24h` stale count yet.
- `TASK-0107` and `TASK-0269` are also exactly `24.0h` old at this boundary and remain explicitly blocked / decision-gated rather than executable implementation work.
- `TASK-0335` remains the apply slice under `TASK-0269`.
- `TASK-0379` remains the residue decision slice under `TASK-0107`.

## Mandatory Decomposition Gate Result
- No stalled row needed fresh implementation decomposition.
- The 12 stale TS-UI review leaves remain bounded `30-90m` children with explicit `acceptance_criteria` and `parent_id` linkage under `TASK-0029` or `TASK-0030`.
- `TASK-0335` and `TASK-0379` remain bounded decision-gated slices with explicit acceptance criteria.
- `TASK-0269` remains owner-decision-blocked rather than under-decomposed.
- The only honest unblock move in this sweep was another routing-only `30-45m` child that locks the exact-threshold reading and preserves one compact owner decision surface before any stale-parent re-expansion.

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
- It preserves the true stale set instead of prematurely counting the parent review rows as stale at the exact threshold boundary.
- It keeps the five-row decision surface current without reopening the 12 stale review leaves as separate approval asks.
- It gives the next owner pass one exact closeout-vs-replay / blocked-vs-reopen tuple before the parent clocks cross again.

## Governance
- Routing only.
- Does not mutate `BOARD.json` statuses.
- Preserves the explicit no-write boundary on `TASK-0269` and `TASK-0335` unless Isaac chooses the reopen/apply branch.
