# Board UI Interactive Replay Checklist

Timestamp: 2026-06-18T16:30:00Z
Owner: sentinel
Executed Child Task: `TASK-0447`
Scope: `TASK-0029`, `TASK-0030`

## Purpose
Make the `HOLD_FOR_INTERACTIVE_REPLAY` branch concrete so Isaac can request one exact viewport pass instead of reopening the TS-UI1.x bundle with a vague replay ask.

## When To Use This
Use this only if the current review packets are not sufficient and Isaac wants one human-visible replay before approving:
- `TASK-0029` -> `HOLD_FOR_INTERACTIVE_REPLAY`
- `TASK-0030` -> `HOLD_FOR_INTERACTIVE_REPLAY`

## Exact Replay Scope
1. Open `/board?task=TASK-0029` in an authenticated browser session.
2. Confirm the desktop detail rail opens with the selected task and preserves board context.
3. Switch to a narrow/mobile viewport and confirm the rail collapses without losing the selected task.
4. Reopen the same task and verify comment metadata still renders correctly after the reopen cycle.
5. Edit one safe field on a non-blocked task and confirm inline validation plus successful persistence.
6. Attempt a governed status move or approval request on a blocked row and confirm the preflight blocker is surfaced inline rather than failing as a surprise POST.

## Pass Conditions

### `TASK-0029`
- Route-bound task selection opens the right task consistently.
- Rail close/reopen behavior preserves the intended selected-row state.
- Mobile collapse behavior is legible and reversible.
- Comment metadata fidelity survives reopen.

### `TASK-0030`
- Save validation is inline and actionable.
- Successful save preserves audit-safe behavior.
- Approval/blocker messaging appears before a doomed request-approval submit.

## If Replay Passes
The narrow follow-up reply can be:

```text
BOARD UI BUNDLE
TASK-0029 | APPROVE_CLOSEOUT_BUNDLE
TASK-0030 | APPROVE_CLOSEOUT_BUNDLE
NOTE | interactive replay passed
```

## Governance
- This checklist is replay-scoping only.
- It does not mutate `BOARD.json`.
- It does not reopen unattended coding by itself.
