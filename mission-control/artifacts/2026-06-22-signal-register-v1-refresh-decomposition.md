# Board Build Window — Signal Register v1 Refresh Decomposition
Generated: 2026-06-22 03:10 UTC
Task anchor: `TASK-0012` — EP-G Signal Register v1 for pressure tracking

## Why this queued task won tonight
- The June 21 live five-row board lane is still honestly decision-gated and already has a current routing packet set.
- `TASK-0012` is still queued, still materially useful, and now overlaps daily workflows that already consume `signals.json`, `buyers.json`, `initiatives.json`, and `pressure-delta.json`.
- The highest-leverage unattended move is to refresh the signal-register artifact path so tomorrow's operating system has one current action-handoff surface instead of fragmented signal references.

## Mandatory decomposition gate

### Subtask 1 — Refresh the v1 field contract against current data surfaces
- Timebox: `30-45 min`
- Acceptance criteria:
  - Explicitly names required fields for signal identity, verification state, buyer linkage, initiative linkage, constraint linkage, decision owner, action hook, and evidence refs.
  - Notes the current source files and one important boundary: quarantined/test initiatives should not become default production mappings without explicit approval.
  - Produces a reusable artifact, not just sweep commentary.
- Dependencies: none
- Output: current contract notes embedded in the refreshed seed artifact and review packet

### Subtask 2 — Build a June 22 seed register from live high-value signals
- Timebox: `45-90 min`
- Acceptance criteria:
  - At least six entries sourced from current `dashboard/data/signals.json`.
  - Entries favor live ranked-buyer overlap and active initiative pressure, not only legacy generic themes.
  - Every entry has a concrete next action hook and evidence refs.
- Dependencies: Subtask 1
- Output: `mission-control/artifacts/signal-register-v1-seed-2026-06-22.json`

### Subtask 3 — Publish a review packet with the next automation splice
- Timebox: `30-45 min`
- Acceptance criteria:
  - States observations, assumptions, recommendations, and next approval asks.
  - Names the next bounded implementation slice for turning the register into a generated artifact.
  - Explicitly says no board state changed and `TASK-0012` is not Done from this packet alone.
- Dependencies: Subtask 2
- Output: `mission-control/review-packets/RP-2026-06-22T03-10-00Z-signal-register-v1-refresh.md`

## Dependency sequence
1. Refresh field contract
2. Build seeded register
3. Publish review packet

## Execution choice for this window
Execute all three subtasks because they remain artifact-only, fit the build-window governance rules, and create a concrete current-state handoff without mutating board statuses.
