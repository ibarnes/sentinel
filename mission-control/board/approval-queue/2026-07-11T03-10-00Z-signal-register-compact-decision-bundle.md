# Signal Register v1 Compact Decision Bundle
Generated: 2026-07-11 03:10 UTC
Task anchor: `TASK-0012` - EP-G Signal Register v1 for pressure tracking
Executed Child Task: `TASK-0560`
Status: Decision bundle only - not approved, not implemented, not Done

## Why this exists
- The July 10 lane already had a current owner reply block and send-ready approval ping, but the smallest honest decision surface still required hopping across multiple same-day routing artifacts.
- The highest-leverage night move is to collapse the live Signal Register ask into one compact bundle that preserves the exact approval tuple, output paths, and stopline without reopening implementation.
- This artifact stays routing-only and does not authorize coding.

## Minimum current reading set
Read these in order only if deeper context is needed:
1. `mission-control/review-packets/RP-2026-06-26T16-30-00Z-signal-register-board-native-execution-readiness.md`
2. `mission-control/board/approval-queue/2026-06-26T16-30-00Z-signal-register-exact-first-run-paths-and-cli-contract.md`
3. `mission-control/board/approval-queue/2026-07-10T16-30-00Z-signal-register-current-owner-reply-block.md`
4. `mission-control/board/approval-queue/2026-07-10T16-30-00Z-signal-register-approval-ping-current-reading-set-refresh.md`

## Exact default approval block
```text
TASK-0012 = APPROVE_CURRENT_GENERATOR_SLICE
TASK-0012A_POLICY = KEEP_DEFAULT_EXCLUSIONS
TASK-0012A_ALLOWLIST = USE_TEMPLATE_AS_NARROWING_ONLY
TASK-0012A_RECEIPT = REQUIRE_FROZEN_TEMPLATE
TASK-0012A_NEXT = EXECUTE_TASK-0486_THEN_TASK-0487_AND_STOP_AFTER_RECEIPT
```

## What that approval authorizes
- `TASK-0486`
  - create `scripts/signals-feed/build-signal-register-v1.mjs`
  - emit `mission-control/artifacts/signal-register-v1-generated-first-run.json`
- `TASK-0487`
  - fill `mission-control/review-packets/RP-2026-06-26T16-30-00Z-signal-register-first-run-validation-receipt.md`
  - stop after receipt publication

## Dependency sequence
1. Approval lands exactly as written above.
2. Execute `TASK-0486` only.
3. Execute `TASK-0487` only after local verification of `TASK-0486`.
4. Stop for review after the filled receipt.

## Hold branches

### Schema hold
```text
TASK-0012 = HOLD_FOR_SCHEMA_CHANGE
TASK-0012_SCHEMA_NOTE = <state exact field or shape revision needed>
TASK-0012A_NEXT = REVISE_CONTRACT_ONLY
```

### Policy hold
```text
TASK-0012 = HOLD_FOR_POLICY_CHANGE
TASK-0012_POLICY_NOTE = <state exact exclusion or allowlist change needed>
TASK-0012A_NEXT = REVISE_POLICY_SURFACE_ONLY
```

### Consumer-scope hold
```text
TASK-0012 = HOLD_FOR_CONSUMER_SCOPE
TASK-0012_CONSUMER_NOTE = <state exact downstream consumer requirement>
TASK-0012A_NEXT = TIGHTEN_HANDOFF_SCOPE_ONLY
```

## Why this is smaller than the prior loop
- One file now carries the exact approval tuple, exact outputs, and the hard stop after receipt.
- The July 10 same-day routing surfaces remain valid support docs, but this bundle is now the shortest truthful owner-facing entry point.
- No new implementation decomposition was invented because `TASK-0486` and `TASK-0487` already remain the bounded execution slices.

## Governance
- This artifact does not approve anything by itself.
- No implementation was started while producing it.
- `TASK-0012` remains not Done.
