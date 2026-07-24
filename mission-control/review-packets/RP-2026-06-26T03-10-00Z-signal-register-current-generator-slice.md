# Review Packet: Signal Register v1 Current Generator Slice
Generated: 2026-06-26 03:10 UTC
Task anchor: `TASK-0012` - EP-G Signal Register v1 for pressure tracking
Status: Review packet only - not approved, not implemented, not Done

## Why this packet exists
- The current `TASK-0012a` contract is now substantively complete, but the reviewer-facing surface is still spread across multiple approval-queue cards.
- The honest night move is not more contract invention. It is to collapse the current June 25 state into one review packet that can be approved or held without cross-file reconstruction.
- This packet stays artifact-only and preserves every existing guardrail.

## Recommended reviewer path
Read these in order:
1. `mission-control/board/approval-queue/2026-06-25T10-40-00Z-signal-register-current-entry-point-refresh.md`
2. `mission-control/board/approval-queue/2026-06-25T10-40-00Z-signal-register-first-run-validation-receipt-template.md`
3. `mission-control/board/approval-queue/2026-06-25T16-30-00Z-signal-register-current-owner-reply-refresh.md`
4. `mission-control/board/approval-queue/2026-06-25T16-30-00Z-signal-register-approval-to-first-run-stopline.md`

Historical but still relevant background:
- `mission-control/board/approval-queue/2026-06-23T03-10-00Z-signal-register-generator-execution-contract.md`
- `mission-control/board/approval-queue/2026-06-24T03-10-00Z-signal-register-generator-mapping-and-validation-spec.md`
- `mission-control/board/approval-queue/2026-06-25T03-10-00Z-signal-register-seed-parity-and-allowed-divergence-card.md`

## What is frozen if approved
- Input boundary:
  - read-only against `dashboard/data/signals.json`, `dashboard/data/buyers.json`, `dashboard/data/initiatives.json`, `dashboard/data/state_constraints.json`, and `mission-control/signal-pressure/out/pressure-delta.json`
- Policy boundary:
  - default-excluded initiatives remain excluded unless explicitly changed later
  - the allowlist template may narrow focus but may not bypass exclusion policy
- Output boundary:
  - generated output must match the June 22 seed shape
  - deterministic row/prose divergence from the hand-written June 22 sample is allowed only where the June 25 parity card says so
- Validation boundary:
  - the first run must publish the frozen receipt template before any downstream consumer change
- Stopline:
  - build the read-only generator
  - emit one first-run artifact
  - publish one filled receipt
  - stop for review

## Exact approval block
```text
TASK-0012 = APPROVE_CURRENT_GENERATOR_SLICE
TASK-0012A_POLICY = KEEP_DEFAULT_EXCLUSIONS
TASK-0012A_ALLOWLIST = USE_TEMPLATE_AS_NARROWING_ONLY
TASK-0012A_RECEIPT = REQUIRE_FROZEN_TEMPLATE
TASK-0012A_NEXT = BUILD_GENERATOR_EMIT_FIRST_RUN_AND_STOP_AFTER_RECEIPT
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

## Why approval is now bounded enough
- The generator input set, mapping rules, exclusion rules, divergence policy, receipt skeleton, and stopline are all explicitly named.
- Approval does not authorize any downstream adoption work.
- Approval authorizes only one implementation session bounded to generator build, first-run emission, receipt publication, and stop.

## Governance
- This packet does not approve anything by itself.
- No implementation was started while producing it.
- `TASK-0012` remains not Done.
