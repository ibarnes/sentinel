# Signal Register v1 Seed Parity and Allowed Divergence Card
Generated: 2026-06-25 03:10 UTC
Task anchor: `TASK-0012` - EP-G Signal Register v1 for pressure tracking
Status: Contract-clarification artifact only - not approved, not implemented, not Done

## Why this exists
- The June 22 seed is the approved target shape for `TASK-0012a`, but it is also a hand-written example artifact.
- The current generator contract freezes schema, input boundaries, filtering policy, and receipt rules, yet it does not say which parts of the seed must match exactly versus which parts may change on a deterministic first run.
- Without this clarification, the first approval reply can still stall on a false parity question: "Does generated mean identical to the hand-written seed entries?"

## Mandatory decomposition gate

### Subtask A - Identify seed elements that are schema-contract, not sample prose
- Timebox: `30-45 min`
- Acceptance criteria:
  - One artifact separates exact output-shape obligations from manual-example content.
  - Required per-entry fields remain aligned to the June 22 seed and June 23/24 generator contract set.
  - No implementation or approval-state mutation occurs.
- Dependencies:
  - `TASK-0471`
  - `TASK-0473`
  - `TASK-0475`

### Subtask B - Freeze allowed first-run divergence before coding begins
- Timebox: `30-45 min`
- Acceptance criteria:
  - Artifact names which fields may legitimately differ from the hand-written seed on the first generated run.
  - Artifact names which legacy/manual-only evidence refs must not be treated as generator requirements.
  - Validation receipt expectations are tightened without implying approval or implementation start.
- Dependencies:
  - Subtask A

## Exact parity requirements

### Top-level shape must match
- Generated output must include:
  - `generated_at`
  - `version`
  - `purpose`
  - `schema_notes`
  - `entries`
- `entries` must be an array of objects that each contain:
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

### Governance parity must match
- Generated output must preserve the June 23/24 contract boundaries:
  - read-only against approved source files
  - no silent bypass of default-excluded initiatives
  - explicit verification posture per row
  - validation receipt required before downstream consumption

## Allowed first-run divergence

### Entry membership may differ from the hand-written seed
- The first generated run does **not** need to reproduce the exact six June 22 sample rows.
- It **does** need to follow the approved inclusion, exclusion, ranking, and tie-break rules against the live source files at run time.
- A different entry set is acceptable when caused by:
  - changed `signals.json` contents
  - changed `pressure-delta.json` high-impact surface
  - filtered exclusion of default-blocked initiatives
  - deterministic ranking against the optional allowlist boundary

### Field text may differ when the contract only requires deterministic derivation
- `action_hook` does not need to text-match the June 22 hand-written wording.
- `why_it_matters` does not need to text-match the June 22 hand-written wording.
- `decision_owners` may differ from the sample seed when live constraint ownership or surviving initiative scope differs, as long as derivation follows the approved rules.

### Evidence references must follow the approved input boundary, not legacy seed examples
- The generator should only cite approved source files actually used for a row.
- The June 22 sample references to `memory/heartbeat-state.json` are treated as manual-example residue, not a generator requirement.
- A valid first generated run should **not** introduce `memory/heartbeat-state.json` unless a later approval explicitly adds it to the input contract.

### Version/timestamp values are expected to differ
- `generated_at` must be the actual first-run UTC timestamp.
- `version` may move within the approved `v1-*` family for generated output and does not need to remain the literal June 22 seed value.

## Not allowed to drift
- Do not drop required fields because the hand-written sample omitted a corner case.
- Do not preserve a hand-written seed row that now fails the approved exclusion policy just to force visual sameness.
- Do not pull in non-approved sources to imitate seed prose.
- Do not treat exact sentence parity as the acceptance bar for generated rows.

## Validation receipt addendum
- The first-run validation receipt should explicitly report:
  - schema parity: pass/fail against required top-level and per-entry fields
  - governance parity: pass/fail against exclusion and read-only boundaries
  - seed divergence summary: which differences from the June 22 sample are expected because the seed was illustrative rather than a frozen row-for-row golden file
- The receipt should call out any row that still references a non-approved source file, because that would be a contract violation rather than acceptable divergence.

## Recommended owner interpretation
- Approve the generator when the concern is row-for-row seed sameness rather than schema or policy mismatch.
- Use this card as the answer to the question:
  - "Match the seed shape exactly, yes. Match the hand-written sample rows and phrasing exactly, no."

## Governance
- No implementation was started.
- No generated artifact was created.
- No `BOARD.json` status transition is implied by this card.
- `TASK-0012` remains not Done.
