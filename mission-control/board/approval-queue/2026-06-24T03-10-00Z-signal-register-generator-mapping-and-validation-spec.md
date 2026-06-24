# Signal Register v1 Generator Mapping and Validation Spec
Generated: 2026-06-24 03:10 UTC
Task anchor: `TASK-0012` - EP-G Signal Register v1 for pressure tracking
Status: Contract artifact only - not approved, not implemented, not Done

## Why this exists
- `TASK-0465` froze the generator inputs and first-run allowlist shape, but it still left too much interpretation inside field derivation, ranking order, and post-run validation.
- The next honest overnight move is to remove that ambiguity without crossing into unapproved implementation.
- This spec turns `TASK-0012a` into a bounded implementation target by naming exact source-to-output mappings, exclusion precedence, and receipt expectations.

## Mandatory decomposition gate

### Subtask A - Freeze source-to-output derivation rules
- Timebox: `30-45 min`
- Acceptance criteria:
  - Every required output field from the June 22 seed contract maps to an exact source field or deterministic fallback.
  - Verification posture derivation is explicit and does not rely on operator memory.
  - Notes where the current source files are incomplete so the generator can preserve null/empty values honestly.
- Dependencies: `TASK-0465`

### Subtask B - Freeze first-run inclusion and ranking policy
- Timebox: `30-45 min`
- Acceptance criteria:
  - Default exclusions for test/quarantined initiatives are explicit and grounded in current `initiatives.json`.
  - Allowlist precedence is defined without allowing silent bypass of blocked initiative tags.
  - Ranking order names what wins when buyer overlap, initiative overlap, and freshness signals disagree.
- Dependencies: Subtask A

### Subtask C - Freeze validation receipt requirements
- Timebox: `30-45 min`
- Acceptance criteria:
  - Post-generation receipt requirements are concrete enough to compare output against the June 22 seed contract.
  - Verification commands are named for JSON parse, entry-shape checks, and exclusion confirmation.
  - Receipt explicitly preserves governance: no `BOARD.json` status change and no inference that `TASK-0012` is Done.
- Dependencies: Subtask B

## Deterministic field mapping

### Top-level output
- `generated_at`
  - Source: generator runtime timestamp in UTC ISO 8601.
- `version`
  - Source: hard-coded generator contract version for the first approved run, expected to stay in the `v1-*` family.
- `purpose`
  - Source: fixed string describing the register as a pressure-tracking action-handoff artifact.
- `schema_notes`
  - Source: static notes from the June 22 seed contract, updated only by explicit approval.
- `entries`
  - Source: filtered and ranked rows derived from `dashboard/data/signals.json` plus linked workspace surfaces.

### Per-entry output
- `signal_key`
  - Primary source: `signals.json[].signal_id`
  - Fallback: none. Rows without `signal_id` are invalid for emission.
- `verification_status`
  - Derive from `signals.json[].status` and `signals.json[].confidence`
  - Rule:
    - `verified` when status is `Verified`
    - `partial` when confidence is `High` or `Medium` and status is not `Verified`
    - `unverified` otherwise
- `impact_level`
  - Primary source: `signal-pressure/out/pressure-delta.json`
  - Rule:
    - `high` when the signal is present in the current high-impact surface or overlaps a top-focus buyer or force-included production initiative
    - `medium` otherwise
- `buyers`
  - Primary source: `signals.json[].buyer_ids`
  - Fallback: empty array when no buyer linkage exists
- `initiatives`
  - Primary source: `signals.json[].initiative_ids`
  - Filter: remove default-excluded initiatives unless explicitly force-included and approval says the override is valid
- `constraints`
  - Primary source: `state_constraints.json[]` joined on surviving initiative IDs where `status = open`
  - Fallback: empty array
- `decision_owners`
  - Primary source: initiative-specific owners from `state_constraints.json[].owner` when constraints exist
  - Fallback: `Isaac`
  - Optional additive owners:
    - include known external owner names only when they already appear in the current manual seed or linked source files
- `action_hook`
  - Primary source: deterministic template based on surviving buyer and initiative overlap
  - Rule: produce one next operating action, not a generic research prompt
- `why_it_matters`
  - Primary source: deterministic summary from signal title, buyer overlap, initiative overlap, and constraint posture
  - Rule: explain why this row matters now, not what the signal says in general
- `evidence_refs`
  - Minimum required sources:
    - `dashboard/data/signals.json`
  - Add linked sources only when actually used:
    - `dashboard/data/buyers.json`
    - `dashboard/data/initiatives.json`
    - `dashboard/data/state_constraints.json`
    - `mission-control/signal-pressure/out/pressure-delta.json`
- `source_registers`
  - Deterministic short names mirroring the files used for that row

## First-run inclusion and exclusion policy

### Hard exclusions
- Drop any row with neither buyer linkage nor initiative linkage.
- Drop initiative IDs that currently resolve to test or non-production surfaces.
- Current default-excluded initiatives from live `dashboard/data/initiatives.json`:
  - `INIT-001`
  - `INIT-653305`
  - `INIT-AI-OPT-A`
  - `INIT-AI-OPT-B`
  - `INIT-AI-OPT-C`
  - `INIT-AI-OPT-D`

### Allowlist boundary
- `mission-control/artifacts/signal-register-v1-allowlist-template-2026-06-23.json` may narrow or prioritize the first run.
- The allowlist may force buyer or production-initiative inclusion.
- The allowlist must not silently bypass the default exclusion of test/quarantined initiatives unless a later approval explicitly authorizes that override.

### Ranking order
1. Signals linked to surviving production initiatives that also map to allowlisted buyers.
2. Signals linked to allowlisted buyers without production-initiative overlap.
3. Signals linked to surviving production initiatives with open critical-path constraints.
4. Remaining signals with buyer or initiative linkage that still survive the exclusions.

### Tie-break order
1. Higher verification posture: `verified` over `partial` over `unverified`
2. More surviving buyer overlap
3. More surviving production-initiative overlap
4. Newer `observed_at`
5. Stable lexical `signal_id`

## Validation receipt contract

### Required receipt facts
- Generated artifact path and timestamp
- Entry count
- Included signal IDs
- Included buyer IDs
- Surviving initiative IDs
- Excluded initiative IDs with reason
- Any divergence from the June 22 seed contract with a plain-language explanation

### Required verification commands
- JSON parse:
  - `node -e "JSON.parse(require('fs').readFileSync('<artifact>','utf8')); console.log('signal-register-json-ok')"`
- Entry-shape check:
  - confirm every entry contains `signal_key`, `verification_status`, `impact_level`, `buyers`, `initiatives`, `constraints`, `decision_owners`, `action_hook`, `why_it_matters`, `evidence_refs`, and `source_registers`
- Exclusion confirmation:
  - confirm none of the six default-excluded initiative IDs survive unless a future approved override says otherwise

## Dependency sequence for the approved implementation
1. Use `TASK-0465` contract and allowlist template as the frozen input boundary.
2. Implement generator read-only against the five named source files.
3. Emit generated JSON in the June 22 seed shape.
4. Publish a validation receipt before any downstream workflow depends on the output.

## Approval asks
1. Approve this mapping and validation spec as the execution contract supplement for `TASK-0012a`.
2. Approve the no-bypass rule for the six currently excluded initiatives unless later explicitly overridden.
3. Approve a post-generation validation receipt before buyer-access or memo automation consumes the generated register.

## Governance
- No `BOARD.json` status transitions are implied by this artifact alone.
- No implementation was started.
- `TASK-0012` remains not Done.
