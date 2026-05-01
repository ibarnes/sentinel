# Tranche-AA Apply Sequence Card — 2026-05-01 10:40 UTC

Parent stream: TASK-0269 / TASK-0280

## Scope
Apply-ready sequence for tranche-AA IDs once Isaac decisions are provided:
- TASK-0187
- TASK-0188
- TASK-0192
- TASK-0193
- TASK-0194
- TASK-0195

## Decision input contract
Each ID must have one explicit choice:
- `APPROVE_TRANSITION`
- `HOLD_SUPERSEDED`

## Deterministic apply order
1. TASK-0187
2. TASK-0188
3. TASK-0192
4. TASK-0193
5. TASK-0194
6. TASK-0195

## Acceptance criteria
- All six IDs have explicit decision + approver + timestamp.
- Apply log includes per-ID before/after status and net change summary.
- Governance preserved: no `Done` transitions without approved RP.
