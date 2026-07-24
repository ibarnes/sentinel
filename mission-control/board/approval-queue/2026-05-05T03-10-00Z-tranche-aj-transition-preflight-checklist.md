# Tranche-AJ Transition Preflight Checklist (Decision-Gated)

- Timestamp: 2026-05-05T03:10:00Z
- Parent stream: `TASK-0300`
- Prepared by: Sentinel

## Objective
Remove ambiguity before state-changing board updates by validating decision-card completeness and producing a deterministic transition input table.

## Inputs
1. `mission-control/board/approval-queue/2026-05-04T06-30-00Z-tranche-aj-approval-card.md` (filled by Isaac)
2. `mission-control/board/BOARD.json`

## Preflight Validation Steps (30–60m)
1. Verify every tranche-AJ row has exactly one action label:
   - `APPROVE_TRANSITION` **or** `HOLD_SUPERSEDED`
2. Verify no row contains conflicting/blank action labels.
3. Build normalized transition table:
   - `task_id`
   - `current_status`
   - `action_label`
   - `target_status`
   - `supersede_note_required` (yes/no)
4. Abort and route back for clarification if any ambiguity remains.

## Acceptance Criteria
- Validation report explicitly marks card as `PASS` or `BLOCKED`.
- Normalized transition table is generated for all rows.
- No BOARD state is changed during this preflight step.

## Dependency Sequence
1. **This checklist/preflight (`TASK-0304`)**
2. Transition microbatch execution (`TASK-0305`)
3. Parent apply task (`TASK-0300`) promoted only after execution log is captured.

## Guardrails
- No `Done` transitions without approved review packet.
- No status mutation if any decision row is ambiguous.
- Single microbatch write only after preflight `PASS`.
