# Signal Register v1 First-Run Validation Receipt Template
Generated: 2026-06-25 10:40 UTC
Task anchor: `TASK-0012` - EP-G Signal Register v1 for pressure tracking
Status: Receipt-template artifact only - not approved, not implemented, not Done

## Why this exists
- The current contract set already requires a first-run validation receipt, but the receipt content was still described narratively rather than as one exact fill-in template.
- The next honest morning move is to remove receipt ambiguity before implementation begins, so approval leads to one bounded execution session instead of another interpretation pass.
- This template freezes the minimum evidence required for the first generated run while preserving the non-write boundary.

## When to use this
- Only after Isaac approves the current `TASK-0012a` generator slice.
- Only after the first generated artifact exists at the proposed output path.
- Do not treat this template as permission to start implementation.

## Required receipt sections

### 1. Run metadata
- `generated_at`
- generator script path
- generated artifact path
- exact source file timestamps or hashes used for the run

### 2. Schema parity check
- Confirm the top-level fields exist:
  - `generated_at`
  - `version`
  - `purpose`
  - `schema_notes`
  - `entries`
- Confirm every entry contains:
  - `signal_key`
  - `verification_status`
  - `impact_level`
  - `buyers`
  - `initiatives`
  - `constraints`
  - `decision_owners`
  - `action_hook`
  - `why_it_matters`
  - `evidence_refs`
  - `source_registers`
- Record verification command output inline.

### 3. Governance parity check
- Confirm the run was read-only against the approved source set.
- Confirm no default-excluded initiative was emitted unless explicitly approved.
- Confirm no downstream workflow was switched to consume the artifact.
- Confirm `BOARD.json` status rows were not mutated as part of the run.

### 4. Included and excluded ID registry
- Included signal IDs
- Included buyer IDs
- Included initiative IDs
- Excluded initiative IDs with reason:
  - default exclusion
  - allowlist narrowing
  - missing qualifying signal
  - deterministic ranking cutoff

### 5. Seed divergence summary
- Which June 22 sample rows were not reproduced and why
- Which generated rows are new versus the hand-written sample and why
- Any prose differences in `action_hook` or `why_it_matters` that are expected from deterministic derivation rather than manual drafting
- Confirmation that no non-approved legacy source such as `memory/heartbeat-state.json` was pulled into generated evidence refs

### 6. Failure handling
- If schema parity fails:
  - stop and mark the receipt `FAIL_SCHEMA`
- If governance parity fails:
  - stop and mark the receipt `FAIL_GOVERNANCE`
- If only expected seed divergence exists:
  - mark the receipt `PASS_WITH_EXPECTED_DIVERGENCE`

## Suggested receipt skeleton

```text
# Signal Register v1 First-Run Validation Receipt
Generated: <UTC timestamp>
Generator script: scripts/signals-feed/build-signal-register-v1.mjs
Generated artifact: mission-control/artifacts/signal-register-v1-generated-first-run.json

## Run metadata
- Source files:
  - <path> - <timestamp or hash>

## Schema parity
- Result: <PASS|FAIL_SCHEMA>
- Verification commands:
  - <command>
  - <output>

## Governance parity
- Result: <PASS|FAIL_GOVERNANCE>
- Read-only boundary preserved: <yes/no>
- Exclusion boundary preserved: <yes/no>
- Downstream consumers switched: <no>
- BOARD.json mutated: <no>

## Included and excluded IDs
- Included signals: <...>
- Included buyers: <...>
- Included initiatives: <...>
- Excluded initiatives:
  - <id> - <reason>

## Seed divergence summary
- <expected difference>

## Final verdict
- <PASS_WITH_EXPECTED_DIVERGENCE|FAIL_SCHEMA|FAIL_GOVERNANCE>
```

## Governance
- This template does not authorize implementation.
- This template does not approve downstream consumption.
- `TASK-0012` remains not Done.
