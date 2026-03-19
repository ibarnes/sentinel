# STATE_TRANSITION_PROTOCOL.md

## Purpose

The State Transition Protocol defines how the system converts raw signals into governed state changes, readiness updates, and board-eligible actions. Its purpose is to prevent ambiguity, block premature progression, and ensure every material move is evidence-backed, auditable, and sequence-aware.

---

## Core Principle

A signal does not matter because it exists.
A signal matters only if it changes system state.

Every valid transition must answer:

1. What was true before?
2. What is true now?
3. What constraint was removed, validated, introduced, or worsened?
4. What becomes possible next?
5. What remains blocking progress?

---

## Operating Rule

No initiative may advance based on narrative alone.
All meaningful progression must be represented as an explicit, evidence-backed state transition.

---

## Canonical State Ladder (v1)

1. `constraint_discovery`
2. `architecture_defined`
3. `governance_ready`
4. `capital_ready`
5. `execution_ready`

States are directional and cumulative unless a `regression` transition is recorded.

---

## State Definitions (v1)

### constraint_discovery
- **Required conditions**
  - Core problem/constraint explicitly defined
  - Relevant actors identified
  - At least one credible signal/evidence object exists
  - Initiative record exists
- **Blocks if**
  - No defined bottleneck
  - No linked evidence
  - No known buyer/actor path

### architecture_defined
- **Required conditions**
  - Thesis documented
  - Constraint-resolution logic documented
  - Key actors/roles mapped
  - Dependencies identified
  - At least one proposed transition path exists
- **Blocks if**
  - Architecture still conceptual
  - No dependency map
  - No actor alignment structure

### governance_ready
- **Required conditions**
  - Decision owner assigned
  - Governance path documented
  - Required approvals/gates known
  - Risks and assumptions documented
  - Review packet inputs present
- **Blocks if**
  - No decision owner
  - No governance route
  - Missing review materials

### capital_ready
- **Required conditions**
  - Capital stack logic defined
  - Commercial model documented
  - Material fundability constraints known
  - Evidence of viability/strategic necessity
  - Commitment path identified
- **Blocks if**
  - Unclear economic model
  - Critical counterparties not aligned
  - No commitment path

### execution_ready
- **Required conditions**
  - Required prior transitions completed
  - Critical constraints resolved
  - Scope clear enough for execution systems
  - Remaining unknowns not decision-blocking
  - Formal handoff package generatable
- **Blocks if**
  - Critical dependency unresolved
  - Scope ambiguity remains
  - Governance/capital assumptions unstable

---

## Transition Types

Allowed values:
- `constraint_release`
- `validation`
- `commitment`
- `regression`

---

## Required Transition Fields

- `id`
- `initiative_ids`
- `trigger_signal_ids`
- `from_state`
- `to_state`
- `transition_type`
- `summary`
- `state_before`
- `state_after`
- `constraints_resolved`
- `constraints_remaining`
- `evidence`
- `confidence` (0.00 - 1.00)
- `readiness_delta`
- `next_required_state`
- `timestamp`
- `provenance`

### Strongly Recommended
- `depends_on_transition_ids`
- `is_critical_path`
- `state_snapshot`
- `notes`

---

## Evidence Standard

1. Every transition must include at least one evidence item.
2. Evidence must support the claimed state change.
3. Confidence may not exceed evidence strength.
4. No readiness change without evidence.
5. No board gate satisfied through narrative-only claims.

---

## Readiness Scoring Rules (v1)

- Score range: `0-100`
- Score changes only via valid transitions
- Every score change must include `readiness_delta`
- Score may be capped by unresolved critical constraints (`max_possible_score`)

### Suggested ceilings
- `constraint_discovery`: 25
- `architecture_defined`: 45
- `governance_ready`: 65
- `capital_ready`: 85
- `execution_ready`: 100

---

## Governance Gate Rules

### Block move to "Ready for Review" if:
- Required transition is missing
- Required evidence is missing
- Decision owner missing
- Critical unresolved constraints remain
- Review packet inputs incomplete

### Block move to "Done" if:
- Initiative not in `execution_ready`
- Critical constraints unresolved
- Transition trail incomplete
- No evidence-backed terminal transition

---

## Action Discipline

No orphan actions.
Every action must map to:
1. A valid existing transition, or
2. A required next transition, or
3. A named unresolved constraint.

---

## Regression Rules

Regression transitions are mandatory when material deterioration appears.
- Must use `transition_type: regression`
- Must show degraded `state_after`
- Should reduce readiness score
- Should reopen blockers/gates

---

## Provenance Values

- `provided_by_isaac`
- `discovered_by_system`
- `imported_from_artifact`
- `inferred_from_linked_objects`

---

## Initiative-Derived Fields

Each initiative should maintain:
- `current_state`
- `readiness_score`
- `max_possible_score`
- `next_required_state`
- `critical_constraints`
- `last_transition_id`
- `last_transition_timestamp`
- `open_dependency_count`

---

## v1 Non-Negotiables

1. No state change without evidence-backed transition
2. No readiness change without valid transition
3. No board advancement through narrative alone
4. No orphan actions
5. No silent regression
6. No ambiguous current state when transition history exists
