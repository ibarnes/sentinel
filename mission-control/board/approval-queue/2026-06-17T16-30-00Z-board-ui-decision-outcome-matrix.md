# Board UI Decision Outcome Matrix

Timestamp: 2026-06-17T16:30:00Z
Owner: sentinel
Executed Child Task: `TASK-0444`
Scope: `TASK-0029`, `TASK-0030`

## Purpose
Spell out the exact next action for each live TS-UI1.x bundle branch so approval, hold, or split decisions have no hidden write scope.

## Outcome Matrix

| Branch | Parent Rows Affected | Immediate Sentinel Action | Explicit Non-Writes | Next Honest Ask |
|---|---|---|---|---|
| `APPROVE_CLOSEOUT_BUNDLE` for both parents | `TASK-0029`, `TASK-0030` | Execute the already-previewed parent-only closeout writeback and cite each active review packet plus the owner reply in closeout comments | No stale child leaves auto-close. No recovery rows (`TASK-0269`, `TASK-0335`, `TASK-0379`) move. | None unless Isaac later wants a separate stale-leaf hygiene pass |
| `HOLD_FOR_INTERACTIVE_REPLAY` for both parents | none | Keep both parents `Ready for Review`; do not reopen unattended coding | No parent or child status changes. No recovery-lane mutation. | Isaac names replay scope, e.g. authenticated `/board?task=TASK-0029` pass |
| Split: approve `TASK-0030`, hold `TASK-0029` | `TASK-0030` only | Close out editing lane parent only; keep detail-rail parent in review | No stale child leaves auto-close. No recovery-lane mutation. | Replay only for the held detail-rail branch |
| Split: approve `TASK-0029`, hold `TASK-0030` | `TASK-0029` only | Close out detail-rail parent only; keep editing lane parent in review | No stale child leaves auto-close. No recovery-lane mutation. | Replay or reviewer note only for the held editing branch |

## Why This Matters
- The remaining risk is branch clarity, not implementation depth.
- Parent-only closeout keeps the board reversible and audit-safe.
- Any cleanup of stale evidence leaves should be a later explicit hygiene step, never an implicit side effect of approval.

## Copy-Paste Reply Shapes

Approve both:

```text
BOARD UI BUNDLE
TASK-0029 | APPROVE_CLOSEOUT_BUNDLE
TASK-0030 | APPROVE_CLOSEOUT_BUNDLE
```

Hold both:

```text
BOARD UI BUNDLE
TASK-0029 | HOLD_FOR_INTERACTIVE_REPLAY
TASK-0030 | HOLD_FOR_INTERACTIVE_REPLAY
REPLAY_SCOPE | /board?task=TASK-0029 plus one authenticated edit/comment/approval-gate pass
```

Split:

```text
BOARD UI BUNDLE
TASK-0029 | HOLD_FOR_INTERACTIVE_REPLAY
TASK-0030 | APPROVE_CLOSEOUT_BUNDLE
```

## Governance
- This matrix is routing-only.
- It does not mutate `BOARD.json`.
- It intentionally preserves the existing recovery decision gate.
