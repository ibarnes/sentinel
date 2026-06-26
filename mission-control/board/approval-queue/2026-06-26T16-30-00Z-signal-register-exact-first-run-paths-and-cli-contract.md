# Signal Register v1 Exact First-Run Paths and CLI Contract
Generated: 2026-06-26 16:30 UTC
Task anchor: `TASK-0012` - EP-G Signal Register v1 for pressure tracking
Status: Contract artifact only - not approved, not implemented, not Done

## Why this exists
- The current generator lane already had a bounded stopline, but older handoff notes still left the exact first-run receipt location and canonical invocation implied across multiple documents.
- The honest midday move is to freeze one exact file-and-command contract so `TASK-0486` and `TASK-0487` can execute without filename drift if approval arrives.
- This artifact stays contract-only and does not start implementation.

## Exact future outputs
- Generator script path:
  - `scripts/signals-feed/build-signal-register-v1.mjs`
- Generated artifact path:
  - `mission-control/artifacts/signal-register-v1-generated-first-run.json`
- Filled validation receipt path:
  - `mission-control/review-packets/RP-2026-06-26T16-30-00Z-signal-register-first-run-validation-receipt.md`

## Canonical future invocation for `TASK-0486`
```bash
node scripts/signals-feed/build-signal-register-v1.mjs \
  --output mission-control/artifacts/signal-register-v1-generated-first-run.json \
  --allowlist mission-control/artifacts/signal-register-v1-allowlist-template-2026-06-23.json
```

## Contract notes
- The allowlist argument remains narrowing-only and may not bypass the default exclusion boundary.
- `TASK-0486` ends after the generator script exists and successfully emits the generated artifact at the exact path above.
- `TASK-0487` begins only after `TASK-0486` local verification passes and must fill the receipt at the exact review-packet path above.

## `TASK-0487` receipt fill source
- Use the frozen template at:
  - `mission-control/board/approval-queue/2026-06-25T10-40-00Z-signal-register-first-run-validation-receipt-template.md`
- Fill the template into:
  - `mission-control/review-packets/RP-2026-06-26T16-30-00Z-signal-register-first-run-validation-receipt.md`

## Verification sequence after approval
1. Run the canonical generator invocation.
2. Confirm the generated artifact parses as JSON.
3. Confirm required top-level and per-entry fields are present.
4. Fill the frozen receipt with included IDs, excluded IDs, verdicts, and divergence notes.
5. Stop after receipt publication.

## Explicit non-write boundary
- Do not mutate `dashboard/data/signals.json`, `dashboard/data/buyers.json`, `dashboard/data/initiatives.json`, `dashboard/data/state_constraints.json`, or `mission-control/signal-pressure/out/pressure-delta.json`.
- Do not change `BOARD.json` statuses during the first run.
- Do not switch any downstream workflow to consume the generated artifact before review of the filled receipt.

## Governance
- This artifact does not authorize implementation by itself.
- No generated artifact or filled receipt exists yet at the paths named above.
- `TASK-0012` remains not Done.
