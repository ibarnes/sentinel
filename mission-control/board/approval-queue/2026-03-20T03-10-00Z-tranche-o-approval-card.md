# Tranche-O Approval Card — 2026-03-20T03:10:00Z

## Pending Approve/Hold asks (oldest Ready for Review)
- TASK-0150, TASK-0151
- TASK-0171, TASK-0172
- TASK-0180, TASK-0181
- TASK-0187, TASK-0188
- TASK-0192, TASK-0193
- TASK-0194, TASK-0195

## Why these first
- They are the full oldest RFR set (queue-age concentration).
- Approvals collapse stale queue pressure and simplify blocker-chain replay once live credential evidence lands.

## Decision format
- `Approve: <ids>`
- `Hold: <ids> — <reason>`

## Guardrail
- No item transitions to Done without approved review packet governance.
