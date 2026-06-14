# RP-2026-06-14T16-30-00Z - Board Smoke Validation Receipt

## Scope
- Linked task: `TASK-0432`
- Parent lane: `TASK-0030`
- Validation target: authenticated `/board` flows on an isolated local admin-server instance using a scratch mission-control root

## Validated
1. Admin login succeeded on the isolated validation server.
2. `/board` rendered the task detail rail with the acceptance-criteria field and inline approval controls.
3. Authenticated create flow succeeded for a scratch task.
4. Authenticated edit flow succeeded, including `acceptance_criteria` round-trip.
5. Authenticated comment flow succeeded.
6. Scratch task cleanup succeeded after validation.

## Blockers Found
1. `request-approval` on a generic scratch task is blocked by policy with:
   - `state gate blocked: missing initiative reference (add INIT-... in linked_refs)`
2. A fully governed `request-approval` / `approve` smoke could not be completed because the current initiative dataset does not contain a candidate that satisfies the existing `governance_ready` / `execution_ready` gate requirements.

## Additional Fix Included
- Patched the `request-approval` route so it defines `gateChecks` before evaluating the board state gate. The previous runtime path threw `ReferenceError: gateChecks is not defined`.

## Reviewer Focus
1. Confirm the isolated smoke evidence is enough to treat create/edit/comment as validated.
2. Decide whether non-initiative board tasks should remain blocked from `Ready for Review` via UI, or whether generic operational tasks need a governance-safe exemption.
