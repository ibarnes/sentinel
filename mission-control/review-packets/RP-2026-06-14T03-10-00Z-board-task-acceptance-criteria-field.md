# RP-2026-06-14T03-10-00Z — Board Task Acceptance Criteria Field

## Summary
Implemented the next bounded `/board` delivery slice under `TASK-0030`:
- acceptance-criteria editing in the board detail rail
- save/create payload support for `acceptance_criteria`
- board schema validation for tasks that carry `acceptance_criteria` arrays

Governance status: **Ready for Review** (not Done).

## Mandatory Decomposition Gate

### Parent Work Item
- `TASK-0030` — `TS-UI1.2 Wire drawer form fields to existing task update APIs + validation`

### Execution Subtask (30–90 minute unit)
1. `TASK-0428` — add acceptance-criteria editing to board detail rail
- Acceptance criteria:
  - The detail rail exposes an acceptance-criteria field for existing and new tasks.
  - Save/create flows persist `acceptance_criteria` through the current task APIs.
  - Board schema and validation accept tasks carrying `acceptance_criteria` arrays.

## What Changed
- File: `admin-server/src/server.js`
  - Added `acceptance_criteria` to the board task schema and task patch sanitizer.
  - Added a newline-based acceptance-criteria textarea to the board detail rail.
  - Wired save/create flows so the panel persists acceptance criteria for both new and existing tasks.

## Verification
- Syntax check passed:
  - `node --check admin-server/src/server.js`

## Risk Notes
- Low risk: the change is isolated to board task serialization and the `/board` detail rail UI.
- Manual authenticated smoke is still recommended to confirm acceptance-criteria values round-trip correctly in the rendered panel.

## Recommended Next Actions
1. Approve this RP.
2. Run authenticated browser smoke for create/edit/reload behavior with multi-line acceptance criteria.
3. Reassess whether `TASK-0030` is now complete enough to move toward review closure, and whether `TASK-0028` can advance behind the accumulated child slices.
