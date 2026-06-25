# Signal Register v1 Approval-to-First-Run Stopline
Generated: 2026-06-25 16:30 UTC
Task anchor: `TASK-0012` - EP-G Signal Register v1 for pressure tracking
Status: Execution-sequencing artifact only - not approved, not implemented, not Done

## Why this exists
- The post-approval handoff and receipt template now both exist, but the exact approval-to-stop sequence is still split across multiple dated artifacts.
- The honest midday move is to freeze one current stopline so approval leads to one bounded implementation session and then a hard stop for review.
- This card converts the future execution lane into two explicit atomic subtasks without starting code.

## Mandatory decomposition gate

### Atomic subtask A - Build the read-only generator
- Timebox: `45-90 min`
- Output:
  - `scripts/signals-feed/build-signal-register-v1.mjs`
- Acceptance criteria:
  - Reads only `dashboard/data/signals.json`, `dashboard/data/buyers.json`, `dashboard/data/initiatives.json`, `dashboard/data/state_constraints.json`, `mission-control/signal-pressure/out/pressure-delta.json`, and the optional allowlist template.
  - Emits JSON in the approved June 22 seed shape with deterministic divergence allowed only where the June 25 parity card permits it.
  - Does not mutate upstream source files, `BOARD.json`, or downstream workflow config.

### Atomic subtask B - Emit first run, publish receipt, and stop
- Timebox: `30-45 min`
- Outputs:
  - `mission-control/artifacts/signal-register-v1-generated-first-run.json`
  - one filled receipt based on `mission-control/board/approval-queue/2026-06-25T10-40-00Z-signal-register-first-run-validation-receipt-template.md`
- Acceptance criteria:
  - Generated artifact parses as JSON and contains the required top-level and per-entry fields.
  - Receipt records included and excluded IDs, pass/fail verdicts, and seed-divergence notes.
  - Work stops after receipt publication with no downstream consumer switched to the generated artifact.

## Exact execution sequence after approval
1. Create `scripts/signals-feed/build-signal-register-v1.mjs`.
2. Run it against the approved read-only source set.
3. Write `mission-control/artifacts/signal-register-v1-generated-first-run.json`.
4. Fill the June 25 validation receipt template with verification output and divergence notes.
5. Stop and wait for review before any downstream adoption work.

## Verification commands for atomic subtask B
```bash
node -e "JSON.parse(require('fs').readFileSync('mission-control/artifacts/signal-register-v1-generated-first-run.json','utf8')); console.log('signal-register-json-ok')"
node - <<'NODE'
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('mission-control/artifacts/signal-register-v1-generated-first-run.json', 'utf8'));
const topLevel = ['generated_at','version','purpose','schema_notes','entries'];
for (const key of topLevel) {
  if (!(key in data)) throw new Error(`missing top-level ${key}`);
}
const required = ['signal_key','verification_status','impact_level','buyers','initiatives','constraints','decision_owners','action_hook','why_it_matters','evidence_refs','source_registers'];
for (const [i, entry] of (data.entries || []).entries()) {
  for (const key of required) {
    if (!(key in entry)) throw new Error(`missing ${key} at entry ${i}`);
  }
}
console.log('signal-register-shape-ok');
NODE
```

## Explicit stopline
- Do not mutate `BOARD.json` statuses during the first run.
- Do not switch buyer-access, memo, board, or any downstream workflow to consume the generated artifact.
- Do not treat a passing receipt as approval for broader rollout.

## Governance
- This artifact does not authorize implementation by itself.
- No generated artifact exists yet at the proposed output path.
- `TASK-0012` remains not Done.
