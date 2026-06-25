# Signal Register v1 Current Entry Point Refresh
Generated: 2026-06-25 10:40 UTC
Task anchor: `TASK-0012` - EP-G Signal Register v1 for pressure tracking
Status: Approval-routing artifact only - not approved, not implemented, not Done

## Why this exists
- `TASK-0476` tightened the contract around seed parity versus allowed first-run divergence, but the live `TASK-0012a` approval surface is now split across June 24 and June 25 artifacts.
- The highest-leverage honest morning move is to collapse that spread back into one current entry point instead of creating another implicit reading chain.
- This refresh makes the active ask smaller: approve the bounded generator slice against the now-complete June 25 contract set, or hold it on one named branch.

## Current packet set
Read in this order:
1. `mission-control/review-packets/RP-2026-06-22T03-10-00Z-signal-register-v1-refresh.md`
2. `mission-control/board/approval-queue/2026-06-23T03-10-00Z-signal-register-generator-execution-contract.md`
3. `mission-control/artifacts/signal-register-v1-allowlist-template-2026-06-23.json`
4. `mission-control/board/approval-queue/2026-06-24T03-10-00Z-signal-register-generator-mapping-and-validation-spec.md`
5. `mission-control/board/approval-queue/2026-06-24T16-30-00Z-signal-register-post-approval-execution-handoff.md`
6. `mission-control/board/approval-queue/2026-06-25T03-10-00Z-signal-register-seed-parity-and-allowed-divergence-card.md`

## What is now fully frozen
- Input boundary:
  - read-only against `dashboard/data/signals.json`, `dashboard/data/buyers.json`, `dashboard/data/initiatives.json`, `dashboard/data/state_constraints.json`, and `mission-control/signal-pressure/out/pressure-delta.json`
- Policy boundary:
  - default-excluded initiatives stay excluded unless later explicitly approved otherwise
  - the allowlist template may narrow focus but may not bypass exclusion policy
- Output boundary:
  - generated output must match the June 22 seed shape while allowing deterministic row and prose divergence from the hand-written sample
- Validation boundary:
  - first run must publish a receipt covering schema parity, governance parity, included/excluded IDs, and expected seed divergence before any downstream consumer is switched over

## Exact owner decision surface
- `APPROVE_CURRENT_GENERATOR_SLICE`
  - Approves the current June 25 contract set as sufficient for the bounded first implementation run.
- `HOLD_FOR_SCHEMA_CHANGE`
  - Means the output shape or required fields still need revision.
- `HOLD_FOR_POLICY_CHANGE`
  - Means the exclusion or allowlist rules need revision before coding.
- `HOLD_FOR_CONSUMER_SCOPE`
  - Means the downstream handoff must be tightened before implementation starts.

## Recommended default
- Approve `APPROVE_CURRENT_GENERATOR_SLICE`.
- Reason:
  - the contract set now covers execution boundary, mapping rules, allowed divergence, and receipt expectations without opening hidden scope
  - implementation is still bounded to one read-only generator plus one receipt
  - no downstream workflow can start consuming the artifact without a separate verified first-run receipt

## Next Sentinel action after approval
1. Build the read-only generator at the proposed path.
2. Emit the first generated register artifact in the approved seed shape.
3. Fill the first-run validation receipt using the now-frozen template and stop there.

## Governance
- No implementation was started.
- No approval is implied by this card.
- `TASK-0012` remains not Done.
