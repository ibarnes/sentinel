# RP-2026-06-13T16-30-00Z — Board Task Inline Approval and Comment Flows

## Summary
Implemented the next bounded `/board` delivery slice under `TASK-0030`:
- inline comment validation, failure handling, and success recovery
- inline approval request handling with an optional review-packet title field
- visible review-packet and approval state inside the detail rail

Governance status: **Ready for Review** (not Done).

## Mandatory Decomposition Gate

### Parent Work Item
- `TASK-0030` — `TS-UI1.2 Wire drawer form fields to existing task update APIs + validation`

### Execution Subtasks (30–90 minute units)
1. `TASK-0426` — replace board-detail comment alerts with inline notice flow
- Acceptance criteria:
  - Unsaved-task and empty-comment cases surface inline inside the panel.
  - Comment API failures show returned error detail inline.
  - Successful comments clear the composer, keep the selected task open, and show a success notice.

2. `TASK-0427` — inline approval request UX and review-packet status in board detail rail
- Acceptance criteria:
  - Request Approval uses an inline optional title field instead of a browser prompt.
  - Approval request and approve failures show returned error detail inline.
  - The selected task shows current review-packet and approval status after reload.

## What Changed
- File: `admin-server/src/server.js`
  - Added a review-packet status card plus an optional inline review-packet title input to the task detail rail.
  - Added shared panel action-state helpers so comment and approval actions can show inline progress/errors without browser dialogs.
  - Updated comment, request-approval, and approve flows to reuse `readErrorMessage()` and success notices while preserving the selected task in the panel after reload.

## Verification
- Syntax check passed:
  - `node --check admin-server/src/server.js`

## Risk Notes
- Low-medium risk: changes are isolated to the board detail rail client flow and reuse the existing server endpoints for comments and approval transitions.
- Manual authenticated smoke is still recommended for `Request Approval` and `Approve`, because those paths remain role- and gate-dependent.

## Recommended Next Actions
1. Approve this RP.
2. Run authenticated browser smoke for comment, request-approval, and architect approve flows.
3. Decide whether `TASK-0030` now has enough coverage to close, or whether the remaining gap is the missing acceptance-criteria field from `TASK-0028`.
