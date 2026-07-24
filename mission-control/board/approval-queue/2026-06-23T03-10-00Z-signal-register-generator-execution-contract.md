# Signal Register v1 Generator Execution Contract
Generated: 2026-06-23 03:10 UTC
Task anchor: `TASK-0012` — EP-G Signal Register v1 for pressure tracking
Status: Contract artifact only — not approved, not implemented, not Done

## Why this exists
- The June 22 seed and review packet defined the next implementation slice, but the generator step was still too implicit to be an honest "start coding now" instruction.
- The board build window needs executable readiness, not another vague promise to automate later.
- This contract narrows `TASK-0012a` into one deterministic post-approval slice with explicit inputs, filters, output shape, and verification.

## Mandatory decomposition gate

### Subtask A — Freeze generator inputs and exclusion policy
- Timebox: `30-45 min`
- Acceptance criteria:
  - Exact source files are named.
  - Default exclusion rules are explicit for quarantined/test initiatives.
  - Allowlist override shape is defined for first-run curation.
- Dependencies: none
- Output: this contract + allowlist template

### Subtask B — Implement deterministic generator
- Timebox: `45-90 min`
- Acceptance criteria:
  - Reads current source files without mutating them.
  - Emits JSON in the same top-level shape as `mission-control/artifacts/signal-register-v1-seed-2026-06-22.json`.
  - Applies default exclusion rules and optional allowlist overrides consistently.
- Dependencies: Subtask A and explicit approval of the June 22 review packet
- Output: generated signal-register JSON artifact

### Subtask C — Publish validation receipt and handoff packet
- Timebox: `30-45 min`
- Acceptance criteria:
  - Compares generated output to the June 22 seed contract and explains any intentional differences.
  - Records entry count, included buyer IDs, and excluded initiative IDs.
  - States no board status transition is implied.
- Dependencies: Subtask B
- Output: review packet or sweep receipt

## Deterministic input contract
- Primary sources:
  - `dashboard/data/signals.json`
  - `dashboard/data/buyers.json`
  - `dashboard/data/initiatives.json`
  - `dashboard/data/state_constraints.json`
  - `mission-control/signal-pressure/out/pressure-delta.json`
- Optional operator policy input:
  - `mission-control/artifacts/signal-register-v1-allowlist-template-2026-06-23.json`

## Default filtering policy
1. Include only signals with at least one mapped buyer or initiative.
2. Prefer current high-value overlap with ranked buyers, active initiatives, or active constraint surfaces.
3. Exclude initiatives tagged as test, quarantined, sandbox, or non-production by default.
4. Allow explicit operator override through an allowlist for first-run curation.
5. Preserve verification posture as an output field instead of flattening low-confidence items out of existence.

## Output contract
- Top-level fields:
  - `generated_at`
  - `version`
  - `purpose`
  - `schema_notes`
  - `entries`
- Required per-entry fields:
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

## Verification contract
- JSON parse passes on emitted artifact.
- Output preserves required fields for every entry.
- Output excludes default-blocked initiatives unless explicitly allowlisted.
- Output includes explicit evidence refs and verification posture for every entry.

## Non-goals
- No approval-state mutation in `BOARD.json`.
- No inference that `TASK-0012` is Done.
- No silent promotion of quarantined/test initiatives into production routing.

## Approval asks
1. Approve this execution contract as the implementation surface for `TASK-0012a`.
2. Approve use of the allowlist template for the first generated run.
3. Approve a post-generation validation packet before any downstream buyer-access automation depends on the output.
