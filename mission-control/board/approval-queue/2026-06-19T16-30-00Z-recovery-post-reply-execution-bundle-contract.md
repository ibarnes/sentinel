# June 19 Recovery Post-Reply Execution-Bundle Contract

Timestamp: 2026-06-19T16:30:00Z
Owner: sentinel
Executed Child Task: `TASK-0452`
Scope: `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Turn the drift receipt's "build a fresh current-state execution bundle later" instruction into one exact contract so any future recovery apply step is rebuilt from live state after Isaac replies.

## Why This Was Needed
- `TASK-0450` proved the June 6 decision pack has material live-state drift.
- The active owner reply surface is now `mission-control/board/approval-queue/2026-06-19T03-10-00Z-stalled-board-owner-response-template.md`.
- Without this contract, "rebuild the bundle later" is still a fuzzy step.

## Required Inputs Before Any Apply-Safe Rebuild
1. One filled June 19 owner reply block covering:
   - `TASK-0269`
   - `TASK-0335`
   - `TASK-0379`
2. Live board state from `mission-control/board/BOARD.json`
3. Current drift context from `mission-control/board/approval-queue/2026-06-19T06-30-00Z-live-recovery-apply-preview-drift-receipt.md`

## Valid Branches

### Execute-Now Branch
Use only if Isaac replies:

```text
TASK-0269 | decision=REOPEN_ACTIVE
TASK-0335 | decision=START_APPLY
TASK-0379 | decision=CLOSE_SUPERSEDED
```

Bounded next build:
- Re-read live statuses for the tranche-AH rows actually touched by `TASK-0335`.
- Regenerate one current-state execution bundle that includes:
  - exact row set to mutate
  - expected before statuses
  - target statuses
  - deterministic delta-log path
- Keep `TASK-0379` out of the active lane except for explicit closeout if selected.

### Planning-Only Branch
Use only if Isaac replies:

```text
TASK-0269 | decision=REOPEN_ACTIVE
TASK-0335 | decision=HOLD
TASK-0379 | decision=RESCOPE
```

Bounded next build:
- Do not create an apply bundle for `TASK-0335`.
- Create only the bounded `TASK-0379` residue-review successor already defined by `TASK-0448`.
- Keep the reopened parent lane planning-only until a later explicit `START_APPLY`.

## Explicit Non-Writes
- Do not execute `TASK-0335` directly from the June 6 packet.
- Do not treat stale packet statuses as authoritative.
- Do not combine `START_APPLY` with `RESCOPE` in the same unattended pass.

## Build Output Contract
If the execute-now branch is chosen, the fresh bundle should produce exactly:
1. One current-state execution packet under `mission-control/board/approval-queue/`
2. One deterministic delta-log target path under `mission-control/board/sweeps/`
3. One parent comment on `TASK-0269` linking the regenerated execution packet

## Governance
- Contract only.
- Does not mutate `BOARD.json`.
- Narrows any future recovery apply to one current-state rebuild step after owner input.
