# Tranche-C Transition Plan — 2026-03-07

Snapshot Time (UTC): 2026-03-07T17:30:00Z
Source Ledger: `mission-control/board/tranche-c-decision-ledger-2026-03-07.md`
Parent Stream: `TASK-0107` → `TASK-0109` → `TASK-0113`

## Purpose
Precompute exact board transition actions for tranche-C items so, once Isaac decisions are entered, execution of `TASK-0113` is a fast mechanical update pass (<30 minutes).

## Action Matrix

| Decision | Board Status Action | Required Comment Template | Follow-up Rule |
|---|---|---|---|
| Approve | Move task from `Ready for Review` to `Done` **only if** governance checks pass and approval is explicit in ledger. | `Approved by Isaac on <timestamp>. Transitioned to Done per tranche-C ledger.` | None unless post-implementation audit requested. |
| Defer | Keep task in `Ready for Review` and add deferral rationale. | `Deferred by Isaac on <timestamp>: <reason>. Recheck on <date>.` | Set next-check date +7 days unless otherwise specified. |
| Hold | Keep task in `Ready for Review` or move to `Blocked` when dependency/risk is explicit. | `Placed on hold by Isaac on <timestamp>: <reason>.` | If blocked, include unblock condition and owner. |

## Per-Task Transition Rows (Current Tranche-C Set)

| Task ID | Current Status | Approve Path | Defer Path | Hold Path |
|---|---|---|---|---|
| TASK-0020 | Ready for Review | Done + approval comment | Keep RFR + defer comment | RFR or Blocked + hold reason |
| TASK-0021 | Ready for Review | Done + approval comment | Keep RFR + defer comment | RFR or Blocked + hold reason |
| TASK-0023 | Ready for Review | Done + approval comment | Keep RFR + defer comment | RFR or Blocked + hold reason |
| TASK-0024 | Ready for Review | Done + approval comment | Keep RFR + defer comment | RFR or Blocked + hold reason |
| TASK-0094 | Ready for Review | Done + approval comment | Keep RFR + defer comment | RFR or Blocked + hold reason |
| TASK-0096 | Ready for Review | Done + approval comment | Keep RFR + defer comment | RFR or Blocked + hold reason |
| TASK-0100 | Ready for Review | Done + approval comment | Keep RFR + defer comment | RFR or Blocked + hold reason |
| TASK-0101 | Ready for Review | Done + approval comment | Keep RFR + defer comment | RFR or Blocked + hold reason |

## Fast-Execution Checklist for TASK-0113
1. Confirm Isaac decisions are populated in ledger for each tranche-C item.
2. Apply status transitions in `mission-control/board/BOARD.json` exactly per matrix.
3. Append per-task audit comments with timestamp and rationale.
4. For deferred items, set next-check date (+7d default).
5. Record movement summary in a review packet addendum.
