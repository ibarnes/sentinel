# Review Packet: Signal Register v1 Board-Native Execution Readiness
Generated: 2026-06-26 16:30 UTC
Task anchor: `TASK-0012` - EP-G Signal Register v1 for pressure tracking
Status: Review packet only - not approved, not implemented, not Done

## Why this packet exists
- The June 26 review packet already bounded the generator slice, but it still pointed at a prose stopline instead of the new board-native child rows.
- The honest midday move is to refresh the reviewer-facing surface so approval maps directly to `TASK-0486` then `TASK-0487`, with no hidden interpretation left in older handoff notes.
- This packet stays review-only and preserves every existing boundary.

## Recommended reviewer path
Read these in order:
1. `mission-control/review-packets/RP-2026-06-26T03-10-00Z-signal-register-current-generator-slice.md`
2. `mission-control/board/approval-queue/2026-06-26T10-40-00Z-signal-register-board-native-post-approval-subtasks.md`
3. `mission-control/board/approval-queue/2026-06-26T16-30-00Z-signal-register-exact-first-run-paths-and-cli-contract.md`

Supporting references if a hold branch is needed:
- `mission-control/board/approval-queue/2026-06-25T10-40-00Z-signal-register-first-run-validation-receipt-template.md`
- `mission-control/board/approval-queue/2026-06-25T16-30-00Z-signal-register-current-owner-reply-refresh.md`
- `mission-control/board/approval-queue/2026-06-25T03-10-00Z-signal-register-seed-parity-and-allowed-divergence-card.md`

## What approval now maps to
- `TASK-0486`
  - build only the read-only generator at `scripts/signals-feed/build-signal-register-v1.mjs`
- `TASK-0487`
  - emit one generated artifact
  - fill one receipt at the exact path frozen below
  - stop for review before any downstream adoption

## Exact approval block
```text
TASK-0012 = APPROVE_CURRENT_GENERATOR_SLICE
TASK-0012A_POLICY = KEEP_DEFAULT_EXCLUSIONS
TASK-0012A_ALLOWLIST = USE_TEMPLATE_AS_NARROWING_ONLY
TASK-0012A_RECEIPT = REQUIRE_FROZEN_TEMPLATE
TASK-0012A_NEXT = EXECUTE_TASK-0486_THEN_TASK-0487_AND_STOP_AFTER_RECEIPT
```

## Exact hold branches

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

## Why this is now mechanically clearer
- The review surface now points straight at board-native child rows instead of a prose-only future path.
- The exact generated artifact path and filled receipt path are frozen in one current contract card.
- Approval still authorizes only one bounded build-plus-first-run sequence, not rollout.

## Governance
- This packet does not approve anything by itself.
- No implementation was started while producing it.
- `TASK-0012` remains not Done.
