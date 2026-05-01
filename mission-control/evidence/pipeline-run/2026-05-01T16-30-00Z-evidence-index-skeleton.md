# Evidence Index Skeleton — 2026-05-01 16:30 UTC

Parent stream: TASK-0097 / TASK-0103

## Goal
Provide deterministic evidence slots for authenticated smoke run once credentials are available.

## Required Artifacts
1. `preflight.md` (env + endpoint reachability)
2. `run-201.json` (successful authenticated request response)
3. `run-400.json` (negative test schema/error response)
4. `summary.md` (pass/fail + timestamps + reviewer notes)

## Acceptance Criteria
- All four artifacts linked in one index.
- 201 and 400 evidence both present with UTC timestamps.
- Linkback to TASK-0097 and TASK-0103 included.
