# Board UI Review Bundle Card

Timestamp: 2026-06-16T03:10:00Z
Owner: sentinel
Scope: `TASK-0029`, `TASK-0030`

## Purpose
Collapse the live board UI review surface into one approval decision card so the queue can move on a single current artifact instead of two parallel review asks plus older addenda.

## Live Queue State
- `TASK-0029` - `Ready for Review`
  - current packet: `mission-control/review-packets/RP-2026-06-15T10-40-00Z-board-task-detail-rail-review-refresh.md`
  - request timestamp: `2026-06-15T10:40:00Z`
  - remaining boundary: true viewport-driven replay is still blocked in unattended cron because the local scratch URL cannot be opened by the OpenClaw browser policy
- `TASK-0030` - `Ready for Review`
  - current packet: `mission-control/review-packets/RP-2026-06-15T06-30-00Z-board-task-editing-lane-refresh.md`
  - request timestamp: `2026-06-15T06:30:00Z`
  - remaining boundary: no known unattended coding gap; any further movement is reviewer decision or an explicitly requested browser replay

## What This Bundle Covers
1. TS-UI1.1 detail rail behavior:
   - persistent desktop rail
   - mobile collapse behavior
   - `?task=TASK-ID` route synchronization
   - selected-task reopen fidelity
2. TS-UI1.2 editing behavior:
   - inline save validation and returned error detail
   - governed status move sequencing
   - inline comment and approval notices
   - acceptance-criteria editing
   - legacy BOARD normalization before strict write validation
   - approval-gate preflight surface

## Decision Options
### Option A - `APPROVE_CLOSEOUT_BUNDLE`
Use this when the current authenticated contract-level evidence is sufficient.

Effect:
- approve `TASK-0029` against `RP-2026-06-15T10-40-00Z-board-task-detail-rail-review-refresh.md`
- approve `TASK-0030` against `RP-2026-06-15T06-30-00Z-board-task-editing-lane-refresh.md`
- permit normal governed `Ready for Review` -> `Done` closeout comments afterward

### Option B - `HOLD_FOR_INTERACTIVE_REPLAY`
Use this when one explicit viewport-driven pass is still required before approving the bundle.

Required replay scope:
1. open `/board?task=TASK-0029`
2. verify desktop rail open + mobile collapse behavior
3. create or edit a task and verify inline validation / persistence
4. add a comment and confirm inline success handling
5. verify `Request Approval` gate-preflight messaging on a blocked row

Effect:
- keep both tasks in `Ready for Review`
- do not add more unattended coding unless the replay exposes a real defect

### Option C - `SPLIT_DECISION`
Approve `TASK-0030` now and keep `TASK-0029` in `Ready for Review` only if Isaac specifically wants viewport proof of the detail rail itself.

## Recommendation
- Default recommendation: `APPROVE_CLOSEOUT_BUNDLE`
- Safe fallback: `HOLD_FOR_INTERACTIVE_REPLAY` only if Isaac wants one human-visible local replay before closing the UI lane

## Governance
- No task was moved to `Done` here.
- This card is a routing artifact only.
- `TASK-0107` and `TASK-0269` remain blocked and are intentionally outside this bundle.
