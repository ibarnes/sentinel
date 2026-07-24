# RP-2026-06-13T03-10-00Z — Board Task Detail Rail Route Binding

## Summary
Implemented the first user-visible delivery slice for `TASK-0029` on `/board`:
- persistent desktop detail rail instead of a purely transient overlay
- query-param route binding via `?task=TASK-ID`
- popstate, Escape, and backdrop close handling
- correct reopen behavior after creating a new task
- correct board comment author/timestamp rendering

Governance status: **Ready for Review** (not Done).

## Mandatory Decomposition Gate

### Parent Work Item
- `TASK-0029` — `TS-UI1.1 Implement board task detail drawer component + route/state binding`

### Execution Subtasks (30–90 minute units)
1. `TASK-0421` — ship persistent board detail rail with route-bound task selection
- Acceptance criteria:
  - Desktop keeps a non-blocking right-side detail rail visible.
  - Mobile retains collapsible behavior.
  - Opening a task writes `?task=TASK-ID` and browser navigation reopens the matching task.
- Dependency:
  - Existing `/board` task panel shell in `admin-server/src/server.js`

2. `TASK-0422` — harden panel state restore and task-detail fidelity
- Acceptance criteria:
  - Saving a newly created task reopens the saved record instead of dropping panel context.
  - Comment list shows stored author and created timestamp fields.
  - Reloaded board data restores the currently selected task when possible.
- Dependency:
  - `TASK-0421`

## What Changed
- File: `admin-server/src/server.js`
  - Reworked the board layout into a main-column plus persistent detail-rail shell.
  - Added route synchronization helpers for selected task state.
  - Added responsive panel/backdrop behavior for desktop vs mobile.
  - Fixed panel reopen after create and fixed comment metadata rendering.

## Verification
- Syntax check passed:
  - `node --check admin-server/src/server.js`

## Risk Notes
- Medium-low risk: the change is isolated to the `/board` template and client-side interactions.
- Manual authenticated browser validation is still recommended for drag/drop plus panel interactions across desktop and mobile breakpoints.

## Recommended Next Actions
1. Approve this RP.
2. Run authenticated browser smoke on `/board` for desktop and mobile panel behavior.
3. Continue with `TASK-0030` so the now-persistent panel gets stronger field-level validation and save ergonomics.
