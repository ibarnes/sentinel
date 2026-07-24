# Signal Register v1 Current Approval Bundle
Generated: 2026-06-24 10:40 UTC
Task anchor: `TASK-0012` - EP-G Signal Register v1 for pressure tracking
Status: Approval-routing artifact only - not approved, not implemented, not Done

## Why this exists
- `TASK-0012a` is now specified across a valid seed artifact, one execution contract, one allowlist template, and one mapping/validation supplement, but the approval ask is still spread across three dates.
- The board's live active lane remains honestly owner-gated elsewhere, so the highest-leverage unattended morning move is to collapse `TASK-0012` into one current approval surface instead of creating more stale routing fragments.
- This bundle makes the next owner decision binary: approve the generator slice as currently specified, or hold it with named gaps.

## Current packet set
Read in this order:
1. `mission-control/review-packets/RP-2026-06-22T03-10-00Z-signal-register-v1-refresh.md`
2. `mission-control/board/approval-queue/2026-06-23T03-10-00Z-signal-register-generator-execution-contract.md`
3. `mission-control/artifacts/signal-register-v1-allowlist-template-2026-06-23.json`
4. `mission-control/board/approval-queue/2026-06-24T03-10-00Z-signal-register-generator-mapping-and-validation-spec.md`

## What is now frozen
- Seed contract: the June 22 artifact shape and operating purpose remain the baseline for generated output.
- Input boundary: the generator is read-only against `signals.json`, `buyers.json`, `initiatives.json`, `state_constraints.json`, and `pressure-delta.json`.
- Policy boundary: test/quarantined/non-production initiatives remain excluded by default, and the first-run allowlist cannot silently bypass that rule.
- Output boundary: every emitted row must preserve explicit verification posture, evidence refs, and one concrete action hook.
- Validation boundary: a post-generation receipt is mandatory before downstream buyer-access or memo automation can depend on the generated register.

## Exact approval bundle
Approve together if Isaac wants `TASK-0012a` ready for implementation:
1. Approve the June 22 seed as the working artifact contract for `TASK-0012`.
2. Approve the June 23 execution contract as the implementation surface for `TASK-0012a`.
3. Approve the June 24 mapping and validation spec as the contract supplement for derivation, ranking, and receipt rules.
4. Approve the no-bypass default exclusion boundary for the six currently excluded initiative IDs unless later explicitly overridden.
5. Approve use of the first-run allowlist template only as a narrowing/prioritization input, not as a policy bypass.

## Hold branches
- `HOLD_FOR_SCHEMA_CHANGE`
  - Means the June 22 seed shape is not yet accepted as the generated output contract.
- `HOLD_FOR_POLICY_CHANGE`
  - Means the exclusion/allowlist boundary needs revision before implementation.
- `HOLD_FOR_CONSUMER_SCOPE`
  - Means buyer-access or memo consumers must be specified more tightly before the generator is approved.

## Recommended default
- Approve the full bundle as written.
- Reason:
  - it creates one bounded implementation slice instead of another manual curation loop
  - it preserves explicit no-bypass governance on excluded initiatives
  - it still requires a post-generation validation receipt before any downstream dependency is allowed

## Next Sentinel action after approval
1. Implement the deterministic generator read-only against the five named source files.
2. Emit the first generated register JSON in the June 22 seed shape.
3. Publish a validation receipt comparing the generated output to the seed contract and naming included/excluded IDs.

## Governance
- No `BOARD.json` status transition is implied by this bundle alone.
- No implementation was started.
- `TASK-0012` remains not Done.
