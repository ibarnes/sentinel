# June 18 Board Recovery Decision Combination Matrix

Timestamp: 2026-06-18T03:10:00Z
Owner: sentinel
Executed Child Task: `TASK-0445`
Scope: `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Publish one current recovery-lane branch matrix so Isaac can choose a coherent bundle for the live 3-row minimum instead of mixing contradictory row-level decisions.

## Dependency Order
1. Choose the lane posture for `TASK-0269`.
2. Choose whether `TASK-0335` should stay parked or execute now.
3. Choose whether `TASK-0379` should be explicitly closed as residue or reshaped into one new bounded task.

## Valid Decision Bundles

| Bundle | `TASK-0269` | `TASK-0335` | `TASK-0379` | Immediate Sentinel Action | Explicit Non-Writes |
|---|---|---|---|---|---|
| Parked minimum | `BLOCKED_KEEP` | `HOLD` | `CLOSE_SUPERSEDED` | Keep the tranche-AH lane blocked, leave `TASK-0335` unexecuted, and wait for future owner direction on any reopened recovery work | No tranche-AH apply. No credential-compaction rescope. No `BOARD.json` mutation from this reply alone. |
| Execute tranche-AH now | `REOPEN_ACTIVE` | `START_APPLY` | `CLOSE_SUPERSEDED` | Run `TASK-0335`, apply only the already-approved tranche-AH transitions, and publish the deterministic delta log under `mission-control/board/sweeps/` | No credential-compaction rescope. No stale UI leaf cleanup. No unrelated recovery rows move. |
| Archive the lane | `CLOSE_SUPERSEDED` | `HOLD` | `CLOSE_SUPERSEDED` | Close the parent/remainder recovery lane instead of executing it | No tranche-AH apply. No new execution child is created. |
| Keep tranche-AH parked but redefine residue | `BLOCKED_KEEP` | `HOLD` | `RESCOPE` | Leave tranche-AH blocked and write one new bounded compaction successor for the residue lane | No tranche-AH apply. No implicit closeout of the rescope target. |
| Reopen for planning only | `REOPEN_ACTIVE` | `HOLD` | `RESCOPE` | Reopen the parent lane for explicit follow-through planning without starting the apply step yet | No tranche-AH apply until a later `START_APPLY`. No implicit compaction writeback. |

## Invalid Combinations To Avoid
- `TASK-0269 = BLOCKED_KEEP` with `TASK-0335 = START_APPLY`
  - Why invalid: the parent says the lane stays blocked while the child says execute now.
- `TASK-0269 = CLOSE_SUPERSEDED` with `TASK-0335 = START_APPLY`
  - Why invalid: the parent says archive the lane while the child says run the apply.
- `TASK-0335 = START_APPLY` with `TASK-0379 = RESCOPE`
  - Why risky tonight: it creates two live execution surfaces at once instead of one deterministic follow-on step.

## Recommended Default Bundle

```text
BOARD RECOVERY BUNDLE
TASK-0269 | decision=BLOCKED_KEEP | note=
TASK-0335 | decision=HOLD | note=
TASK-0379 | decision=CLOSE_SUPERSEDED | note=
```

## If Isaac Wants Execution Now

```text
BOARD RECOVERY BUNDLE
TASK-0269 | decision=REOPEN_ACTIVE | note=run tranche-AH apply now
TASK-0335 | decision=START_APPLY | note=
TASK-0379 | decision=CLOSE_SUPERSEDED | note=
```

## Governance
- This matrix is routing-only.
- It does not mutate `BOARD.json`.
- It exists to keep the recovery lane to one coherent next move instead of contradictory partial instructions.
