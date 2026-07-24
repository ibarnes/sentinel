# RP-2026-06-15T03-10-00Z - Board Gate Preflight Surface

## Scope
- Linked task: `TASK-0433`
- Parent lane: `TASK-0030`
- Area: `/board` detail rail + `/api/board` preflight metadata

## What Changed
- Added shared board-gate context loading in `admin-server/src/server.js` so `/api/board`, move, request-approval, and approve paths all evaluate against the same initiative/transition/gate-check snapshot.
- `/api/board` now returns per-task `gate_status` for:
  - `ready_for_review`
  - `done`
- The board detail rail now surfaces both gate states inline in the Review Packet box.
- The `Request Approval` button is disabled with an explicit tooltip when the `Ready for Review` gate is blocked, while the governed backend route remains unchanged.

## Why This Slice Matters
- The previous UI forced users to discover governance blockers only after clicking `Request Approval`.
- That behavior was technically safe but operationally noisy, especially for generic tasks with no `INIT-...` linkage.
- This slice converts the remaining approval-path gap from surprise failure into visible preflight guidance without weakening policy.

## Acceptance Check
1. `GET /api/board` returns `gate_status.ready_for_review` and `gate_status.done` for task rows.
2. Selecting a task in `/board` shows approval gate posture inline in the detail rail.
3. Tasks blocked from `Ready for Review` no longer invite a futile click on `Request Approval`.
4. Backend governance behavior is unchanged: blocked tasks are still rejected server-side if a client bypasses the UI.

## Verification
- `node --check admin-server/src/server.js`

## Reviewer Focus
1. Confirm exposing gate reasons in the board API is acceptable for authenticated board users.
2. Decide whether non-initiative operational tasks should eventually gain a governance-safe exemption, or remain explicitly blocked with this new preflight surface.
