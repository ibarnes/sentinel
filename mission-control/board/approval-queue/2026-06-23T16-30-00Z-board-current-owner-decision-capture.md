# June 23 Current Owner Decision Capture

Timestamp: 2026-06-23T16:30:00Z
Owner: sentinel
Executed Child Task: `TASK-0469`
Scope: `TASK-0029`, `TASK-0030`, `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Provide one same-day fill-ready owner reply surface for the live five-row board lane so Isaac can answer from a current June 23 tuple without reconciling the older June 19 template against newer June 22 and June 23 proof artifacts.

## Live Status Snapshot
- `TASK-0029` = `Ready for Review`
- `TASK-0030` = `Ready for Review`
- `TASK-0269` = `Blocked`
- `TASK-0335` = `Todo`
- `TASK-0379` = `Todo`

Canonical packet anchor:
- `mission-control/board/approval-queue/2026-06-23T10-40-00Z-board-current-decision-surface-index.md`

## Recommended Default Closeout Branch

```text
BOARD MIDDAY REPLY
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0269 | decision=BLOCKED_KEEP | note=
TASK-0335 | decision=HOLD | note=
TASK-0379 | decision=CLOSE_SUPERSEDED | note=
```

Immediate Sentinel action after explicit owner send:
- execute only the governed three-row closeout path for `TASK-0029`, `TASK-0030`, and `TASK-0379`
- keep `TASK-0269` blocked
- do not start `TASK-0335`

## Replay Hold Branch

```text
BOARD MIDDAY REPLY
TASK-0029 | decision=HOLD_FOR_INTERACTIVE_REPLAY | note=run the exact authenticated replay checklist
TASK-0030 | decision=HOLD_FOR_INTERACTIVE_REPLAY | note=run the exact authenticated replay checklist
TASK-0269 | decision=BLOCKED_KEEP | note=
TASK-0335 | decision=HOLD | note=
TASK-0379 | decision=CLOSE_SUPERSEDED | note=
```

Immediate Sentinel action after explicit owner send:
- keep the TS-UI parents in review
- open the replay checklist only if Isaac explicitly wants the interactive pass
- do not reopen recovery or infer new implementation work

## Recovery Reopen + Apply Branch

```text
BOARD MIDDAY REPLY
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0269 | decision=REOPEN_ACTIVE | note=run tranche-AH apply now
TASK-0335 | decision=START_APPLY | note=
TASK-0379 | decision=CLOSE_SUPERSEDED | note=
```

Immediate Sentinel action after explicit owner send:
- close the TS-UI parents through the governed closeout path
- rebuild one fresh current-state recovery execution bundle before any recovery mutation
- keep `TASK-0379` out of the active lane except for explicit close-superseded handling

## Recovery Planning-Only Branch

```text
BOARD MIDDAY REPLY
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0269 | decision=REOPEN_ACTIVE | note=planning only
TASK-0335 | decision=HOLD | note=
TASK-0379 | decision=RESCOPE | note=create the bounded residue successor only
```

Immediate Sentinel action after explicit owner send:
- keep `TASK-0335` parked
- create only the bounded `TASK-0379` successor contract
- do not mix `START_APPLY` with `RESCOPE`

## Why This Is Current
- Uses the June 23 canonical index as the top-level source of truth.
- Preserves the June 22 fast path for the recommended branch.
- Reflects the June 23 no-drift receipt and current live statuses from `BOARD.json`.

## Governance
- Routing only.
- Does not mutate `BOARD.json`.
- Exists to lower reply burden, not to authorize action without an explicit owner tuple.
