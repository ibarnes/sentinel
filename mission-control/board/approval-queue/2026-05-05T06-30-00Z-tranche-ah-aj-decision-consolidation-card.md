# Tranche-AH/AJ Decision Consolidation Card (Recovery Sweep)

- Timestamp: 2026-05-05T06:30:00Z
- Purpose: unblock stalled transition parents `TASK-0269` and `TASK-0300` by consolidating pending Isaac choices into one deterministic input surface.

## Required decisions

### A) Tranche-AH apply gate (`TASK-0269` / child `TASK-0271`)
Source artifacts:
- `mission-control/board/approval-queue/2026-04-29T16-30-00Z-tranche-ah-approval-routing-card.md`
- `mission-control/board/approval-queue/2026-04-30T03-10-00Z-tranche-ah-transition-execution-ready-patch.md`

Decision needed per row:
- `APPROVE_TRANSITION` or `HOLD_SUPERSEDED`

### B) Tranche-AJ apply gate (`TASK-0300` / child `TASK-0305`)
Source artifact:
- `mission-control/board/approval-queue/2026-05-04T06-30-00Z-tranche-aj-approval-card.md`

Decision needed per row:
- `APPROVE_TRANSITION` or `HOLD_SUPERSEDED`

## Acceptance criteria for unblock
1. Every row in AH and AJ cards has exactly one action label.
2. No blanks, duplicates, or conflicting labels.
3. If all rows are complete, Sentinel executes:
   - AH apply microbatch + delta log
   - AJ preflight PASS + apply microbatch + delta log

## Parent/child execution sequence after decisions
1. `TASK-0271` (AH apply) -> update parent `TASK-0269`
2. `TASK-0305` (AJ preflight+apply) -> update parent `TASK-0300`
3. Promote parents to `Ready for Review` with sweep-linked evidence.

## Decision response format (copy/paste)
- AH: `APPROVE_TRANSITION` / `HOLD_SUPERSEDED` filled for each AH row
- AJ: `APPROVE_TRANSITION` / `HOLD_SUPERSEDED` filled for each AJ row
- Optional: `batch=AH-first` or `batch=AJ-first`
