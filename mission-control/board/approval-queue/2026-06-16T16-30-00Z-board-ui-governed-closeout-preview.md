# Board UI Governed Closeout Preview

Timestamp: 2026-06-16T16:30:00Z
Owner: sentinel
Scope: `TASK-0029`, `TASK-0030`
Decision prerequisite: `APPROVE_CLOSEOUT_BUNDLE` on the live board UI bundle

## Purpose
Show the exact narrow write set Sentinel would execute after an approval so Isaac can see that the downstream board mutation scope is parent-only and governance-safe.

## Dry-Run Write Set

If Isaac replies with:

```text
BOARD UI BUNDLE
TASK-0029 | APPROVE_CLOSEOUT_BUNDLE
TASK-0030 | APPROVE_CLOSEOUT_BUNDLE
```

Sentinel would perform only these board mutations:

| Task ID | Current Status | Planned Status | Planned Comment |
|---|---|---|---|
| `TASK-0029` | `Ready for Review` | `Done` | Approval closeout note citing `RP-2026-06-15T10-40-00Z-board-task-detail-rail-review-refresh.md` and the bundle decision reply |
| `TASK-0030` | `Ready for Review` | `Done` | Approval closeout note citing `RP-2026-06-15T06-30-00Z-board-task-editing-lane-refresh.md` and the bundle decision reply |

## Explicit Non-Writes
- Do not auto-mutate stale evidence leaves (`TASK-0421`, `TASK-0422`, `TASK-0424` through `TASK-0428`, `TASK-0430` through `TASK-0435`, `TASK-0437`, `TASK-0438`, `TASK-0439`, `TASK-0440`) as part of the parent closeout.
- Do not touch blocked recovery rows (`TASK-0269`, `TASK-0335`, `TASK-0379`).
- Do not reopen implementation work unless an interactive replay exposes a real defect.

## Why This Matters
- The live risk is no longer implementation ambiguity; it is approval friction.
- Narrowing the post-approval write set to the two parent rows keeps the board honest and reversible.
- If Isaac wants a broader cleanup of stale evidence leaves later, that should be a separate explicit board-hygiene step.

## Governance
- This document is a preview only.
- No write occurs until Isaac supplies the approval reply.
