# Signal Register v1 Current Owner Reply Refresh
Generated: 2026-06-25 16:30 UTC
Task anchor: `TASK-0012` - EP-G Signal Register v1 for pressure tracking
Status: Decision-routing artifact only - not approved, not implemented, not Done

## Why this exists
- The June 24 owner decision card predates the June 25 seed-parity clarification and the frozen first-run receipt template.
- The honest midday move is to refresh the exact reply surface so Isaac can approve or hold the current contract set without reconciling older branches by hand.
- This keeps the active ask to one smallest valid reply tuple while preserving all existing policy and non-write boundaries.

## Current packet set
Read in this order:
1. `mission-control/board/approval-queue/2026-06-25T10-40-00Z-signal-register-current-entry-point-refresh.md`
2. `mission-control/board/approval-queue/2026-06-25T10-40-00Z-signal-register-first-run-validation-receipt-template.md`

## Exact reply blocks

### Default approval
Use this when the current June 25 contract set is approved as written:

```text
TASK-0012 = APPROVE_CURRENT_GENERATOR_SLICE
TASK-0012A_POLICY = KEEP_DEFAULT_EXCLUSIONS
TASK-0012A_ALLOWLIST = USE_TEMPLATE_AS_NARROWING_ONLY
TASK-0012A_RECEIPT = REQUIRE_FROZEN_TEMPLATE
TASK-0012A_NEXT = BUILD_GENERATOR_EMIT_FIRST_RUN_AND_STOP_AFTER_RECEIPT
```

### Hold for schema change
Use this when the output contract or required fields still need revision:

```text
TASK-0012 = HOLD_FOR_SCHEMA_CHANGE
TASK-0012_SCHEMA_NOTE = <state exact field or shape revision needed>
TASK-0012A_NEXT = REVISE_CONTRACT_ONLY
```

### Hold for policy change
Use this when the exclusion or allowlist policy needs revision before coding:

```text
TASK-0012 = HOLD_FOR_POLICY_CHANGE
TASK-0012_POLICY_NOTE = <state exact exclusion or allowlist change needed>
TASK-0012A_NEXT = REVISE_POLICY_SURFACE_ONLY
```

### Hold for consumer scope
Use this when the downstream handoff boundary needs tightening before implementation:

```text
TASK-0012 = HOLD_FOR_CONSUMER_SCOPE
TASK-0012_CONSUMER_NOTE = <state exact downstream consumer requirement>
TASK-0012A_NEXT = TIGHTEN_HANDOFF_SCOPE_ONLY
```

## Meaning of the refreshed approval block
- `APPROVE_CURRENT_GENERATOR_SLICE`
  - Approves the current June 25 contract set as sufficient for the bounded first implementation run.
- `KEEP_DEFAULT_EXCLUSIONS`
  - Preserves the current excluded-initiative boundary as non-bypass unless Isaac changes it explicitly later.
- `USE_TEMPLATE_AS_NARROWING_ONLY`
  - Keeps the allowlist as prioritization input only, not a hidden override path.
- `REQUIRE_FROZEN_TEMPLATE`
  - Requires the first-run receipt to use the exact June 25 evidence skeleton and verdict labels.
- `BUILD_GENERATOR_EMIT_FIRST_RUN_AND_STOP_AFTER_RECEIPT`
  - Approves only the read-only generator, one first generated artifact, one filled receipt, and then a stop for review.

## Recommended default
- Choose the default approval block as written.
- Reason:
  - the current June 25 contract set is now complete enough to bound the first run
  - it still preserves the exclusion guardrail and non-consumption boundary
  - it converts approval into one exact implementation stop line rather than open-ended execution

## Governance
- This artifact does not approve anything by itself.
- No implementation was started.
- `TASK-0012` remains not Done.
