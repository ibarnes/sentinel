# Tranche-AL Recovery Routing Card - 2026-05-28 03:10 UTC

## Scope
- Parent stream: TASK-0107 (stale Ready-for-Review recovery)
- Source cut: TASK-0332 candidate list (top-20 oldest stale RFR with gate labels)
- Objective: convert stale tranche into deterministic decision/apply sequence without violating governance

## Decision Matrix (fill one action per row)
Allowed actions:
- APPROVE_TRANSITION
- HOLD_SUPERSEDED

| Task ID | Gate | Recommended Action | Action (fill) | Why |
|---|---|---|---|---|
| TASK-0150 | credential-gated | HOLD_SUPERSEDED |  | Cannot advance to Done without authenticated execution evidence. |
| TASK-0151 | isaac-decision-gated | APPROVE_TRANSITION |  | Decision/template artifact is complete and can be compacted once approved. |
| TASK-0171 | credential-gated | HOLD_SUPERSEDED |  | Preflight evidence only; no live credential run attached. |
| TASK-0172 | credential-gated | HOLD_SUPERSEDED |  | Dry-run fail-fast evidence complete but credential gate still open. |
| TASK-0180 | credential-gated | HOLD_SUPERSEDED |  | Same blocker pattern as upstream preflight tasks. |
| TASK-0181 | credential-gated | HOLD_SUPERSEDED |  | Same blocker pattern as upstream dry-run tasks. |
| TASK-0187 | credential-gated | HOLD_SUPERSEDED |  | Credential window not executed. |
| TASK-0188 | credential-gated | HOLD_SUPERSEDED |  | Credential window not executed. |
| TASK-0192 | credential-gated | HOLD_SUPERSEDED |  | Credential window not executed. |
| TASK-0193 | credential-gated | HOLD_SUPERSEDED |  | Credential window not executed. |
| TASK-0194 | credential-gated | HOLD_SUPERSEDED |  | Credential window not executed. |
| TASK-0195 | credential-gated | HOLD_SUPERSEDED |  | Credential window not executed. |
| TASK-0199 | credential-gated | HOLD_SUPERSEDED |  | Credential window not executed. |
| TASK-0200 | credential-gated | HOLD_SUPERSEDED |  | Credential window not executed. |
| TASK-0201 | credential-gated | HOLD_SUPERSEDED |  | Credential window not executed. |
| TASK-0202 | credential-gated | HOLD_SUPERSEDED |  | Credential window not executed. |
| TASK-0207 | credential-gated | HOLD_SUPERSEDED |  | Credential window not executed. |
| TASK-0208 | credential-gated | HOLD_SUPERSEDED |  | Credential window not executed. |
| TASK-0209 | credential-gated | HOLD_SUPERSEDED |  | Credential window not executed. |
| TASK-0210 | credential-gated | HOLD_SUPERSEDED |  | Credential window not executed. |

## Apply Sequence (post-decision)
1. Validate every row has exactly one action from the allowed set.
2. Apply APPROVE_TRANSITION rows first in ascending task ID order.
3. Apply HOLD_SUPERSEDED rows second in ascending task ID order.
4. Write a delta receipt in sweeps with per-task before/after status and timestamp.
5. Keep governance intact:
   - no Done transition without approved RP
   - no parent closure while decision-gated or credential-gated blockers remain

## Next Dependencies
- TASK-0334: generate tranche-AH decision input sheet (fill-ready)
- TASK-0335: apply tranche-AH transitions after explicit decisions are provided
- TASK-0331: credentialed smoke remains queued for authenticated window
