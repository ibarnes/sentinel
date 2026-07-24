# Stale RFR Compaction Candidate Matrix — 2026-05-02 06:30 UTC

## Scope
Oldest Ready-for-Review credential-chain cluster and adjacent tranche stream.

## Candidate groups

### Group A — Credential preflight duplicates (supersede candidates)
- Earlier-window artifacts likely superseded by newer equivalents:
  - `TASK-0150`, `TASK-0171`, `TASK-0180`, `TASK-0187`, `TASK-0192`, `TASK-0194`, `TASK-0199`, `TASK-0201`, `TASK-0207`, `TASK-0209`, `TASK-0215`, `TASK-0217`
- Recommendation: mark superseded where newer same-lane artifact exists.

### Group B — Credential dry-run duplicates (supersede candidates)
- Paired with Group A in same duplicate pattern:
  - `TASK-0151`, `TASK-0172`, `TASK-0181`, `TASK-0188`, `TASK-0193`, `TASK-0195`, `TASK-0200`, `TASK-0202`, `TASK-0208`, `TASK-0210`, `TASK-0216`, `TASK-0218`
- Recommendation: keep latest execution-ready pair, supersede older duplicates.

### Group C — Decision-gated tranche items (hold for Isaac choice)
- `TASK-0187`, `TASK-0188`, `TASK-0192`, `TASK-0193`, `TASK-0194`, `TASK-0195`
- Required input: Isaac per-ID `APPROVE_TRANSITION` vs `HOLD_SUPERSEDED`.

## Acceptance criteria for compaction apply
1. Every transition references explicit reason (`duplicate`, `superseded_by`, or `approved_transition`).
2. No `Done` transition without approved RP.
3. No out-of-scope task IDs mutated.
4. Before/after delta note emitted in board sweeps log.
