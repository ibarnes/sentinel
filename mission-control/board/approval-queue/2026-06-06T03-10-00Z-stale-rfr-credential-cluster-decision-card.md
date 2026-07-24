# Stale-RFR Credential-Cluster Decision Card

Timestamp: 2026-06-06T03:10:00Z
Owner: sentinel
Parent: TASK-0107
Child Task: TASK-0377
Input Basis: mission-control/board/approval-queue/2026-06-06T03-10-00Z-stale-rfr-credential-cluster-supersession-map.md

## Isaac Decision Fields
Choose APPROVE_COMPACT or HOLD_RETAIN for each row.
If HOLD_RETAIN, add one short reason.

| Apply Order | Task ID | Recommended Action | Canonical Replacement | Isaac Decision | Isaac Note |
|---:|---|---|---|---|---|
| 1 | TASK-0150 | APPROVE_COMPACT | TASK-0364 + TASK-0375 |  |  |
| 2 | TASK-0151 | APPROVE_COMPACT | TASK-0355 + TASK-0364 |  |  |
| 3 | TASK-0171 | APPROVE_COMPACT | TASK-0374 |  |  |
| 4 | TASK-0172 | APPROVE_COMPACT | TASK-0375 |  |  |
| 5 | TASK-0180 | APPROVE_COMPACT | TASK-0374 |  |  |
| 6 | TASK-0181 | APPROVE_COMPACT | TASK-0375 |  |  |
| 7 | TASK-0187 | APPROVE_COMPACT | TASK-0374 |  |  |
| 8 | TASK-0188 | APPROVE_COMPACT | TASK-0375 |  |  |
| 9 | TASK-0192 | APPROVE_COMPACT | TASK-0374 |  |  |
| 10 | TASK-0193 | APPROVE_COMPACT | TASK-0375 |  |  |
| 11 | TASK-0194 | APPROVE_COMPACT | TASK-0374 |  |  |
| 12 | TASK-0195 | APPROVE_COMPACT | TASK-0375 |  |  |

## Deterministic Apply Order
1. Compact the two high-level legacy operator docs first: TASK-0150, TASK-0151.
2. Compact evidence snapshots before paired dry-run artifacts, oldest to newest.
3. Leave TASK-0355, TASK-0364, TASK-0374, and TASK-0375 untouched as the retained canonical surface.

## Governance
- This card does not apply any status changes.
- No parent task moves to Done from this decision surface.
- Actual writeback should be a separate apply artifact after Isaac fills this card.
