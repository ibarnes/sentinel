# Board Recovery Live Decision Minimum

Timestamp: 2026-06-13T06:30:00Z
Owner: sentinel
Primary Parent: TASK-0269
Related Parent: TASK-0107
Executed Child Task: TASK-0423

## Purpose
Replace the stale 18-line recovery response block with the minimum live decision surface after the 2026-06-12 board compaction.

## Current Live State
- Checked against `mission-control/board/BOARD.json` at 2026-06-13 06:30 UTC.
- The historical Section A response rows `TASK-0271`, `TASK-0307`, `TASK-0324`, and `TASK-0363` are already `Done` and should not be treated as live response rows.
- The historical Section B credential-cluster rows `TASK-0150`, `TASK-0151`, `TASK-0171`, `TASK-0172`, `TASK-0180`, `TASK-0181`, `TASK-0187`, `TASK-0188`, `TASK-0192`, `TASK-0193`, `TASK-0194`, and `TASK-0195` are already `Done`.
- The only still-open decision-gated rows in this lane are `TASK-0269`, `TASK-0335`, and `TASK-0379`.

## Minimum Response Block
Use one short decision per row.

TASK-0269 | decision=BLOCKED_KEEP or CLOSE_SUPERSEDED or REOPEN_ACTIVE | note=
TASK-0335 | decision=START_APPLY or HOLD | note=
TASK-0379 | decision=CLOSE_SUPERSEDED or RESCOPE | note=

## Recommended Defaults
- `TASK-0269`: `BLOCKED_KEEP`
- `TASK-0335`: `HOLD`
- `TASK-0379`: `CLOSE_SUPERSEDED`

## Why This Is Smaller
- The old June 11 response block asked for 18 inputs that no longer match the live board.
- This refresh cuts the live decision surface down to the 3 rows that still exist as open work.
- `TASK-0379` now looks like a zero-scope residue row unless Isaac explicitly wants a new compaction target defined.

## Governance
- This artifact does not mutate `BOARD.json`.
- No apply step was attempted.
- `TASK-0335` remains the only live tranche-AH apply row, and it should run only after an explicit Isaac decision.
