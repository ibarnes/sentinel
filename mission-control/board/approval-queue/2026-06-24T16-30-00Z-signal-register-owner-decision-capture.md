# Signal Register v1 Owner Decision Capture
Generated: 2026-06-24 16:30 UTC
Task anchor: `TASK-0012` - EP-G Signal Register v1 for pressure tracking
Status: Decision-routing artifact only - not approved, not implemented, not Done

## Why this exists
- `TASK-0473` collapsed the active approval surface into one current bundle, but Isaac still has to translate that bundle into an exact reply.
- The next honest midday move is to reduce reply friction without starting the generator.
- This card gives one copy-pasteable decision surface for `TASK-0012a` while preserving the existing no-bypass governance boundary.

## Current packet set
Read in this order:
1. `mission-control/review-packets/RP-2026-06-22T03-10-00Z-signal-register-v1-refresh.md`
2. `mission-control/board/approval-queue/2026-06-23T03-10-00Z-signal-register-generator-execution-contract.md`
3. `mission-control/artifacts/signal-register-v1-allowlist-template-2026-06-23.json`
4. `mission-control/board/approval-queue/2026-06-24T03-10-00Z-signal-register-generator-mapping-and-validation-spec.md`
5. `mission-control/board/approval-queue/2026-06-24T10-40-00Z-signal-register-current-approval-bundle.md`

## Exact reply blocks

### Default approval
Use this when the bundle is approved as written:

```text
TASK-0012 = APPROVE_SEED_AND_GENERATOR_BUNDLE
TASK-0012A_POLICY = KEEP_DEFAULT_EXCLUSIONS
TASK-0012A_ALLOWLIST = USE_TEMPLATE_AS_NARROWING_ONLY
TASK-0012A_NEXT = IMPLEMENT_GENERATOR_AND_PUBLISH_VALIDATION_RECEIPT
```

### Hold for schema change
Use this when the June 22 seed shape is not yet the accepted output contract:

```text
TASK-0012 = HOLD_FOR_SCHEMA_CHANGE
TASK-0012_SCHEMA_NOTE = <state exact field or shape revision needed>
TASK-0012A_NEXT = REVISE_CONTRACT_ONLY
```

### Hold for policy change
Use this when the exclusion or allowlist policy needs revision before implementation:

```text
TASK-0012 = HOLD_FOR_POLICY_CHANGE
TASK-0012_POLICY_NOTE = <state exact exclusion or override change needed>
TASK-0012A_NEXT = REVISE_POLICY_SURFACE_ONLY
```

### Hold for consumer scope
Use this when the downstream buyer-access or memo consumer needs tighter scope first:

```text
TASK-0012 = HOLD_FOR_CONSUMER_SCOPE
TASK-0012_CONSUMER_NOTE = <state exact downstream consumer requirement>
TASK-0012A_NEXT = TIGHTEN_HANDOFF_SCOPE_ONLY
```

## Meaning of each branch
- `APPROVE_SEED_AND_GENERATOR_BUNDLE`
  - Approves the current contract set and allows the next bounded implementation slice to begin.
- `KEEP_DEFAULT_EXCLUSIONS`
  - Preserves the current six default-excluded initiative IDs as non-bypass unless Isaac later changes policy explicitly.
- `USE_TEMPLATE_AS_NARROWING_ONLY`
  - Keeps the allowlist template as prioritization input, not as a hidden override path.
- `IMPLEMENT_GENERATOR_AND_PUBLISH_VALIDATION_RECEIPT`
  - Starts only the already-defined read-only generator and mandatory receipt path, not downstream automation.

## Recommended default
- Choose the default approval block as written.
- Reason:
  - the contract surface is already explicit enough for a bounded implementation slice
  - it preserves the production-exclusion guardrail
  - it still requires a validation receipt before any downstream dependency can rely on the generated register

## Governance
- This artifact does not approve anything by itself.
- No implementation was started.
- `TASK-0012` remains not Done.
