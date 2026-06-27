# Signal Register v1 Approval Ping Ready Surface
Generated: 2026-06-27 03:10 UTC
Task anchor: `TASK-0012` - EP-G Signal Register v1 for pressure tracking
Status: Approval-routing artifact only - not approved, not implemented, not Done

## Why this exists
- The current Signal Register lane is now mechanically bounded, but the shortest valid approval ask is still split across the June 26 review packet, the frozen path contract, and the older owner reply card.
- The honest night move is to collapse that into one send-ready surface so approval can be requested without reconstructing the packet by hand.
- This artifact stays routing-only and does not authorize implementation.

## Smallest current reading set
Read these in order:
1. `mission-control/review-packets/RP-2026-06-26T16-30-00Z-signal-register-board-native-execution-readiness.md`
2. `mission-control/board/approval-queue/2026-06-26T16-30-00Z-signal-register-exact-first-run-paths-and-cli-contract.md`
3. `mission-control/board/approval-queue/2026-06-25T16-30-00Z-signal-register-current-owner-reply-refresh.md`

## Exact send-ready approval ping
```text
Signal Register v1 is now bounded to one approval-gated two-step sequence:
- TASK-0486 = build the read-only generator only
- TASK-0487 = emit one first run, fill one receipt, and stop for review

Current packet:
1. RP-2026-06-26T16-30-00Z-signal-register-board-native-execution-readiness.md
2. 2026-06-26T16-30-00Z-signal-register-exact-first-run-paths-and-cli-contract.md
3. 2026-06-25T16-30-00Z-signal-register-current-owner-reply-refresh.md

If approved as written, reply with:
TASK-0012 = APPROVE_CURRENT_GENERATOR_SLICE
TASK-0012A_POLICY = KEEP_DEFAULT_EXCLUSIONS
TASK-0012A_ALLOWLIST = USE_TEMPLATE_AS_NARROWING_ONLY
TASK-0012A_RECEIPT = REQUIRE_FROZEN_TEMPLATE
TASK-0012A_NEXT = EXECUTE_TASK-0486_THEN_TASK-0487_AND_STOP_AFTER_RECEIPT
```

## What approval authorizes
- `TASK-0486`
  - create `scripts/signals-feed/build-signal-register-v1.mjs`
  - emit `mission-control/artifacts/signal-register-v1-generated-first-run.json`
- `TASK-0487`
  - fill `mission-control/review-packets/RP-2026-06-26T16-30-00Z-signal-register-first-run-validation-receipt.md`
  - stop after receipt publication

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

## Governance
- This artifact does not approve anything by itself.
- No implementation was started while producing it.
- `TASK-0012` remains not Done.
