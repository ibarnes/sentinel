# TASK-0379 RESCOPE Successor Candidate

Timestamp: 2026-06-18T16:30:00Z
Owner: sentinel
Executed Child Task: `TASK-0448`
Scope: `TASK-0379`

## Purpose
Define exactly what `RESCOPE` should mean for `TASK-0379` so Isaac does not have to choose between `CLOSE_SUPERSEDED` and a fuzzy undefined follow-on.

## Current Ambiguity
`TASK-0379` is already atomic for the apply path, but the alternate `RESCOPE` branch is still underspecified. That makes the owner choice noisier than it needs to be.

## Proposed Successor If Isaac Chooses `RESCOPE`

### Candidate Title
`Credential-cluster residue review: close superseded rows and preserve canonical survivors`

### Candidate Duration
`30-60m`

### Candidate Scope
- Re-read the June 6 credential-cluster decision pack plus canonical survivor set.
- Confirm which remaining residue rows are true closure candidates versus rows that still carry unique evidence.
- Publish one explicit close/survive table before any board mutation.

### Candidate Acceptance Criteria
- The candidate names every residue row considered in the credential cluster.
- Each row gets exactly one disposition: `CLOSE_SUPERSEDED`, `KEEP_OPEN`, or `NEEDS_OWNER_INPUT`.
- Canonical survivors `TASK-0355`, `TASK-0364`, `TASK-0374`, and `TASK-0375` are preserved explicitly.
- Any later apply step becomes a separate bounded child, not an implicit side effect of the rescope decision.

## Why This Is Better Than A Vague `RESCOPE`
- It keeps the residue lane within one 30-60 minute review slice.
- It separates analysis from mutation.
- It prevents `RESCOPE` from accidentally creating another oversized recovery branch.

## Owner Shortcut
If Isaac wants this path instead of immediate closure, the intended meaning is:

```text
BOARD RECOVERY BUNDLE
TASK-0379 | decision=RESCOPE | note=create the bounded residue review successor
```

## Governance
- This candidate is routing-only.
- It does not mutate `BOARD.json`.
- It does not close `TASK-0379` automatically.
