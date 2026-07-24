# Signal Register v1 Board-Native Post-Approval Subtask Map
Generated: 2026-06-26 10:40 UTC
Task anchor: `TASK-0012` - EP-G Signal Register v1 for pressure tracking
Status: Routing artifact only - not approved, not implemented, not Done

## Why this exists
- The current review packet for `TASK-0012a` is complete enough for approval or hold, but the future implementation stopline still lived only in prose.
- The honest morning move is to turn that prose into explicit board-native atomic tasks so the next approved action is mechanically clear.
- This artifact stays routing-only and does not start the generator.

## Approval gate
- Do not execute either child below unless Isaac explicitly approves the current generator slice using the June 26 review packet tuple.
- Hold branches remain unchanged:
  - schema hold -> revise contract only
  - policy hold -> revise policy surface only
  - consumer-scope hold -> tighten handoff scope only

## Board-native atomic children

### `TASK-0486` - Build read-only Signal Register v1 generator script
- Timebox: `45-90 min`
- Output:
  - `scripts/signals-feed/build-signal-register-v1.mjs`
- Acceptance criteria:
  - Reads only `dashboard/data/signals.json`, `dashboard/data/buyers.json`, `dashboard/data/initiatives.json`, `dashboard/data/state_constraints.json`, `mission-control/signal-pressure/out/pressure-delta.json`, and the optional allowlist template.
  - Emits JSON in the approved June 22 seed shape with deterministic divergence allowed only where the June 25 parity card permits it.
  - Does not mutate upstream source files, `BOARD.json`, or downstream workflow config.

### `TASK-0487` - Emit first run, fill receipt, and stop for review
- Timebox: `30-45 min`
- Depends on:
  - `TASK-0486`
- Outputs:
  - `mission-control/artifacts/signal-register-v1-generated-first-run.json`
  - one filled receipt based on `mission-control/board/approval-queue/2026-06-25T10-40-00Z-signal-register-first-run-validation-receipt-template.md`
- Acceptance criteria:
  - Generated artifact parses as JSON and contains the required top-level and per-entry fields.
  - Receipt records included and excluded IDs, pass/fail verdicts, and seed-divergence notes.
  - Work stops after receipt publication with no downstream consumer switched to the generated artifact.

## Exact next action after approval
1. Move `TASK-0486` into execution and build the generator script only.
2. After `TASK-0486` passes local verification, execute `TASK-0487`.
3. Stop after the receipt is published; do not treat a passing receipt as broader rollout approval.

## Governance
- No board status moved to `Done` from this artifact alone.
- No implementation was started while producing it.
- `TASK-0012` remains not Done.
