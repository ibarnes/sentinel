# Stale RFR Transition Microbatch Template — 2026-05-02 10:40 UTC

## Purpose
Deterministic apply template for stale RFR compaction with Isaac-gated branches.

## Scope IDs
- Credential preflight lane: TASK-0150, TASK-0171, TASK-0180, TASK-0187, TASK-0192, TASK-0194, TASK-0199, TASK-0201, TASK-0207, TASK-0209, TASK-0215, TASK-0217
- Credential dry-run lane: TASK-0151, TASK-0172, TASK-0181, TASK-0188, TASK-0193, TASK-0195, TASK-0200, TASK-0202, TASK-0208, TASK-0210, TASK-0216, TASK-0218
- Decision-gated tranche-AH: TASK-0187, TASK-0188, TASK-0192, TASK-0193, TASK-0194, TASK-0195

## Transition policy
- `duplicate_superseded` → target status: `Superseded`
- `approved_transition` → target status: `Done` **only if approved RP exists**
- `hold_superseded` → target status: `Superseded`
- `hold_rfr` → target status: `Ready for Review`

## Isaac-gated branch map (required)
For each of TASK-0187/0188/0192/0193/0194/0195 choose:
- `APPROVE_TRANSITION` -> `approved_transition`
- `HOLD_SUPERSEDED` -> `hold_superseded`

## Microbatch payload skeleton
```json
{
  "run_id": "stale-rfr-microbatch-2026-05-02T10:40:00Z",
  "changes": [
    {"id": "TASK-0150", "reason": "duplicate_superseded", "to_status": "Superseded"},
    {"id": "TASK-0151", "reason": "duplicate_superseded", "to_status": "Superseded"},
    {"id": "TASK-0187", "reason": "<approved_transition|hold_superseded>", "to_status": "<Done|Superseded>"}
  ]
}
```

## Acceptance checks
1. All changed IDs are in-scope.
2. Any `to_status: Done` entry has `review_packet_id` + `approved_at` evidence.
3. Before/after delta note saved under `mission-control/board/sweeps/`.
4. No non-target task mutation.
