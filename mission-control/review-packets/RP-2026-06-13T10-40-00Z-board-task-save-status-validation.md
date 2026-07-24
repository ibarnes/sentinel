# RP-2026-06-13T10-40-00Z — Board Task Save Status Validation

## Summary
Implemented the next bounded `/board` delivery slice under `TASK-0030`:
- inline task-panel validation instead of a generic save failure
- detailed server error surfacing for save and governed move failures
- status-aware save sequencing so the selected status is applied immediately after save through the existing move gate

Governance status: **Ready for Review** (not Done).

## Mandatory Decomposition Gate

### Parent Work Item
- `TASK-0030` — `TS-UI1.2 Wire drawer form fields to existing task update APIs + validation`

### Execution Subtasks (30–90 minute units)
1. `TASK-0424` — add actionable save validation and error surfacing
- Acceptance criteria:
  - Missing title is shown inline in the task panel.
  - API save and move failures show returned error details.
  - Notice state clears when changing panel context.

2. `TASK-0425` — honor selected status on save through governed move sequencing
- Acceptance criteria:
  - New tasks can land in a selected non-Backlog status after create.
  - Existing task edits preserve field changes before status transition.
  - Blocked transitions keep saved edits and show the blocker reason.

## What Changed
- File: `admin-server/src/server.js`
  - Added a reusable task-panel notice area for validation, warning, and success messages.
  - Added detailed error parsing for task save and move responses.
  - Updated `saveTask()` to keep field PATCH behavior separate from governed status transitions, then apply status changes through `/api/tasks/:id/move`.

## Verification
- Syntax check passed:
  - `node --check admin-server/src/server.js`

## Risk Notes
- Medium-low risk: the change is isolated to board-detail client interactions and uses the already-existing move endpoint for status transitions.
- Manual authenticated smoke is still recommended for create/edit flows that target `Ready for Review` or `Done`, because those paths depend on runtime role and board-state gates.

## Recommended Next Actions
1. Approve this RP.
2. Run authenticated browser smoke for create/edit flows across `Backlog`, `Blocked`, and `Ready for Review`.
3. If review passes, advance the remaining ergonomics under `TASK-0030` or close the parent once the full save surface is covered.
