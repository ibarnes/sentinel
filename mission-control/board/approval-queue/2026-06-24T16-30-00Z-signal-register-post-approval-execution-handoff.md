# Signal Register v1 Post-Approval Execution Handoff
Generated: 2026-06-24 16:30 UTC
Task anchor: `TASK-0012` - EP-G Signal Register v1 for pressure tracking
Status: Execution-handoff artifact only - not approved, not implemented, not Done

## Why this exists
- The approval bundle now states what should happen after approval, but not yet as one exact file-and-command handoff card.
- The next honest midday move is to make the first approved implementation slice startable within one bounded session instead of reopening contract interpretation.
- This card freezes the proposed output locations, verification steps, and non-write boundary for the first generator run.

## Mandatory decomposition gate

### Subtask A - Build the read-only generator
- Timebox: `45-90 min`
- Acceptance criteria:
  - Reads only the five approved source files plus the optional allowlist template.
  - Emits generated JSON in the June 22 seed shape.
  - Does not mutate upstream source files or `BOARD.json`.

### Subtask B - Publish the validation receipt
- Timebox: `30-45 min`
- Acceptance criteria:
  - Receipt records included signal, buyer, and initiative IDs plus excluded initiative IDs with reason.
  - Verification commands prove JSON parse, required entry fields, and exclusion compliance.
  - Receipt states no downstream workflow has been switched to depend on the new artifact yet.

## Proposed implementation targets
- Proposed generator script path:
  - `scripts/signals-feed/build-signal-register-v1.mjs`
- Proposed generated artifact path:
  - `mission-control/artifacts/signal-register-v1-generated-first-run.json`
- Proposed validation receipt path:
  - `mission-control/board/approval-queue/2026-06-24T16-30-00Z-signal-register-first-run-validation-receipt.md`

## Approved input boundary
- `dashboard/data/signals.json`
- `dashboard/data/buyers.json`
- `dashboard/data/initiatives.json`
- `dashboard/data/state_constraints.json`
- `mission-control/signal-pressure/out/pressure-delta.json`
- `mission-control/artifacts/signal-register-v1-allowlist-template-2026-06-23.json` as optional narrowing input only

## Required output contract
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

## Verification commands to run after implementation
```bash
node -e "JSON.parse(require('fs').readFileSync('mission-control/artifacts/signal-register-v1-generated-first-run.json','utf8')); console.log('signal-register-json-ok')"
node - <<'NODE'
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('mission-control/artifacts/signal-register-v1-generated-first-run.json', 'utf8'));
const required = ['signal_key','verification_status','impact_level','buyers','initiatives','constraints','decision_owners','action_hook','why_it_matters','evidence_refs','source_registers'];
for (const [i, entry] of (data.entries || []).entries()) {
  for (const key of required) {
    if (!(key in entry)) throw new Error(`missing ${key} at entry ${i}`);
  }
}
console.log('signal-register-entry-shape-ok');
NODE
```

## Explicit non-write boundary
- Do not mutate `dashboard/data/signals.json`, `buyers.json`, `initiatives.json`, `state_constraints.json`, or `pressure-delta.json`.
- Do not change `BOARD.json` statuses as part of the first generated run.
- Do not switch buyer-access, memo, or other downstream workflows to consume the generated artifact until the validation receipt exists and is reviewed.

## Immediate next Sentinel action after approval
1. Create the generator script at the proposed path.
2. Generate the first-run artifact at the proposed output path.
3. Publish the validation receipt with included/excluded IDs and verification command results.
4. Stop there until Isaac explicitly approves downstream consumption.

## Governance
- This artifact does not start implementation by itself.
- No generated artifact exists yet at the proposed output path.
- `TASK-0012` remains not Done.
