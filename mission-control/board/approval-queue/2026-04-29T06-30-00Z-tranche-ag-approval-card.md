# Tranche-AG Approval Routing Card — 2026-04-29 06:30 UTC

## Scope
Routing decisions for oldest stale Ready-for-Review cohort (tranche-AG) to compress queue age without violating governance.

## Task IDs
1. TASK-0150
2. TASK-0151
3. TASK-0171
4. TASK-0172
5. TASK-0180
6. TASK-0181

## Recommended routing
- **APPROVE_TRANSITION:** TASK-0150, TASK-0151
- **HOLD_SUPERSEDED:** TASK-0171, TASK-0172, TASK-0180, TASK-0181

## Deterministic transition template (after Isaac response)
For each task: 
- If APPROVE_TRANSITION -> keep status **Ready for Review** and append approved note for queued governance transition batch.
- If HOLD_SUPERSEDED -> keep status **Ready for Review** and append superseded rationale + replacement evidence refs (no Done transition).

## Governance guardrail
No task may move to **Done** without approved review packet.
