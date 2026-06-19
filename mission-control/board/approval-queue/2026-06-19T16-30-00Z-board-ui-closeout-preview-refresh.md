# June 19 Board UI Closeout Preview Refresh

Timestamp: 2026-06-19T16:30:00Z
Owner: sentinel
Executed Child Task: `TASK-0451`
Scope: `TASK-0029`, `TASK-0030`
Decision prerequisite: June 19 combined owner reply surface in `mission-control/board/approval-queue/2026-06-19T03-10-00Z-stalled-board-owner-response-template.md`

## Purpose
Refresh the governed parent-only closeout preview so the TS-UI1.x review lane points at the current June 19 reply surface rather than relying on the older June 16 dry-run alone.

## Current Review Sources
- `TASK-0029` review packet: `mission-control/review-packets/RP-2026-06-15T10-40-00Z-board-task-detail-rail-review-refresh.md`
- `TASK-0030` review packet: `mission-control/review-packets/RP-2026-06-15T06-30-00Z-board-task-editing-lane-refresh.md`
- Branch contract: `mission-control/board/approval-queue/2026-06-17T16-30-00Z-board-ui-decision-outcome-matrix.md`
- Replay hold contract: `mission-control/board/approval-queue/2026-06-18T16-30-00Z-board-ui-interactive-replay-checklist.md`

## Approve-Both Preview

If Isaac replies with:

```text
BOARD NIGHT REPLY
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
```

Sentinel should perform only this write set:

| Task ID | Current Status | Planned Status | Required Comment Anchor |
|---|---|---|---|
| `TASK-0029` | `Ready for Review` | `Done` | Cite `RP-2026-06-15T10-40-00Z-board-task-detail-rail-review-refresh.md` plus the June 19 owner reply block |
| `TASK-0030` | `Ready for Review` | `Done` | Cite `RP-2026-06-15T06-30-00Z-board-task-editing-lane-refresh.md` plus the June 19 owner reply block |

## Split Approval Preview

If Isaac approves one parent and holds the other, Sentinel should mutate only the approved parent row:

| Branch | Write Set | Explicit Non-Writes |
|---|---|---|
| Approve `TASK-0029`, hold `TASK-0030` | Move only `TASK-0029` to `Done` with approval comment | `TASK-0030` stays `Ready for Review`; no stale child cleanup; no recovery-lane mutation |
| Hold `TASK-0029`, approve `TASK-0030` | Move only `TASK-0030` to `Done` with approval comment | `TASK-0029` stays `Ready for Review`; no stale child cleanup; no recovery-lane mutation |

## Explicit Non-Writes
- Do not auto-close stale evidence leaves under either parent.
- Do not touch `TASK-0269`, `TASK-0335`, or `TASK-0379`.
- Do not reopen implementation work unless an interactive replay reveals a real defect.

## Why This Refresh Still Matters
- `TASK-0440` proved the narrow write scope on June 16, but the live owner reply surface changed on June 19.
- This refresh keeps the approval path current without inventing new coding.
- The board stays reversible because only the parent rows move on approval.

## Governance
- Preview only.
- Does not mutate `BOARD.json`.
- Preserves the parent-only closeout boundary.
