# Stale-RFR Tranche-AA Compaction Digest — 2026-05-01 06:30 UTC

Parent stream: TASK-0098 (Board Recovery)

## Scope
Oldest credential-chain Ready for Review tasks requiring transition decision batching:
- TASK-0187, TASK-0188
- TASK-0192, TASK-0193
- TASK-0194, TASK-0195

## Why this tranche
These six IDs are longstanding RFR artifacts in the same preflight/dry-run chain and are already represented in transition templates; batching reduces repeated review overhead.

## Acceptance criteria
- Tranche membership explicit and stable (6 IDs).
- Decision options normalized per ID: `APPROVE_TRANSITION` | `HOLD_SUPERSEDED`.
- Apply-order dependency fixed for deterministic execution.

## Proposed apply order
1) TASK-0187
2) TASK-0188
3) TASK-0192
4) TASK-0193
5) TASK-0194
6) TASK-0195

## Isaac decision needed
Provide one choice per ID (`APPROVE_TRANSITION` or `HOLD_SUPERSEDED`) to unlock TASK-0280 apply sequence execution.
