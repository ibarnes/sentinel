# RP-0044 — Auth Smoke Operator Friction Reduction

## Summary
Executed two atomic unblock tasks under active P0 parent `TASK-0097` to reduce credentialed smoke execution friction:
1. Added selector-based deck auto-resolution path to `scripts/pipeline-run-smoke.sh` when `DECK_ID` is unknown.
2. Updated credentialed runbook with timestamped evidence capture and dual command paths (explicit deck vs auto-resolve).

## Tasks
- TASK-0127 (new): Add deck auto-resolve support to smoke script.
- TASK-0128 (new): Refresh credentialed runbook with auto-resolve and timestamped evidence capture.

## Files Changed
- `scripts/pipeline-run-smoke.sh`
- `mission-control/runbooks/pipeline-run-auth-smoke.md`

## Validation Evidence
- Script syntax check: `bash -n scripts/pipeline-run-smoke.sh` (pass)
- Runbook path references updated and consistent with evidence directory naming.

## Risk / Rollback
- Risk: low. Changes are additive and backward-compatible (existing `DECK_ID` flow unchanged).
- Rollback: revert the two files above to previous revision.

## Governance
- No task moved to Done.
- Packet prepared for Isaac approval flow; parent active task remains in-progress pending credentialed live execution evidence.