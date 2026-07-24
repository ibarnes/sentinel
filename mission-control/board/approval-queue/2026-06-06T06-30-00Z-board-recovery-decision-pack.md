# Board Recovery Decision Pack

Timestamp: 2026-06-06T06:30:00Z
Owner: sentinel
Primary Parent: TASK-0107
Secondary Parent: TASK-0269
Executed Child Task: TASK-0378

## Purpose
Collapse the open late-night recovery decisions into one fillable surface so one Isaac response can unblock both:
- tranche-AH transition apply (`TASK-0269` -> `TASK-0335`)
- stale credential-cluster compaction (`TASK-0107` -> `TASK-0379`)

## Decision Section A: Tranche-AH Apply Gate
Use `Approve`, `Hold`, or `Needs Changes`.
If `Approve`, fill the exact target status.

| Task ID | Current Status | Recommended Decision | Recommended Target Status | Isaac Decision | Isaac Target Status | Isaac Note |
|---|---|---|---|---|---|---|
| TASK-0269 | In Progress | Approve | Ready for Review |  |  |  |
| TASK-0271 | Backlog | Approve | Done |  |  |  |
| TASK-0307 | Backlog | Hold | n/a |  |  |  |
| TASK-0324 | Backlog | Hold | n/a |  |  |  |
| TASK-0335 | Todo | Approve | In Progress |  |  |  |
| TASK-0363 | Ready for Review | Approve | Ready for Review |  |  |  |

### Section A Apply Rule
If Isaac approves Section A, execute `TASK-0335` using:
- `mission-control/board/approval-queue/2026-06-01T06-30-00Z-tranche-ah-decision-input-refresh.md`
- `mission-control/board/sweeps/2026-06-01T10-40-00Z-tranche-transition-delta-template.md`

## Decision Section B: Credential-Cluster Compaction Gate
Use `APPROVE_COMPACT` or `HOLD_RETAIN`.
If `HOLD_RETAIN`, add one short reason.

| Apply Order | Task ID | Current Status | Canonical Replacement | Recommended Decision | Isaac Decision | Isaac Note |
|---:|---|---|---|---|---|---|
| 1 | TASK-0150 | Ready for Review | TASK-0364 + TASK-0375 | APPROVE_COMPACT |  |  |
| 2 | TASK-0151 | Ready for Review | TASK-0355 + TASK-0364 | APPROVE_COMPACT |  |  |
| 3 | TASK-0171 | Ready for Review | TASK-0374 | APPROVE_COMPACT |  |  |
| 4 | TASK-0172 | Ready for Review | TASK-0375 | APPROVE_COMPACT |  |  |
| 5 | TASK-0180 | Ready for Review | TASK-0374 | APPROVE_COMPACT |  |  |
| 6 | TASK-0181 | Ready for Review | TASK-0375 | APPROVE_COMPACT |  |  |
| 7 | TASK-0187 | Ready for Review | TASK-0374 | APPROVE_COMPACT |  |  |
| 8 | TASK-0188 | Ready for Review | TASK-0375 | APPROVE_COMPACT |  |  |
| 9 | TASK-0192 | Ready for Review | TASK-0374 | APPROVE_COMPACT |  |  |
| 10 | TASK-0193 | Ready for Review | TASK-0375 | APPROVE_COMPACT |  |  |
| 11 | TASK-0194 | Ready for Review | TASK-0374 | APPROVE_COMPACT |  |  |
| 12 | TASK-0195 | Ready for Review | TASK-0375 | APPROVE_COMPACT |  |  |

### Section B Apply Rule
If Isaac approves Section B, execute `TASK-0379` and compact only the approved rows. Do not mutate:
- TASK-0355
- TASK-0364
- TASK-0374
- TASK-0375

## Recommended Execution Order After Decision
1. Apply Section A first via `TASK-0335`.
2. Publish Section A delta log.
3. Apply Section B second via `TASK-0379`.
4. Publish Section B delta log.

## Governance
- No status changes are applied by this packet.
- No `Done` transition is authorized without the normal review-packet guardrail.
- This packet is decision input only.
