# RP-0071 — Board Build Window (Night) — 2026-03-17 03:10 UTC

## Scope
- Deep-work execution on board-recovery stream `TASK-0107`.
- Objective: reduce approval latency by packaging oldest Ready-for-Review set with explicit queue age + action syntax.

## Decomposition Gate
Parent `TASK-0107` was decomposed into two atomic 30–90 minute subtasks before execution:
1. `TASK-0175` — build tranche-K decision digest with queue-age context and per-task recommendations.
2. `TASK-0176` — publish tranche-K approval routing card with one-line decision syntax.

Dependency sequence: `TASK-0175` -> `TASK-0176` -> Isaac approval input -> transition replay path (`TASK-0113`) under governance.

## Tranche-K Decision Set (Oldest Ready for Review)

| Task | Queue age (days) | Recommendation | Why it matters |
|---|---:|---|---|
| TASK-0150 | 4 | Approve | Operator card is already prepared; approval clears stale queue and improves launch readiness for next credential window. |
| TASK-0151 | 4 | Approve | Closure matrix is prebuilt and needed for deterministic post-credential replay. |
| TASK-0171 | 1 | Approve | Midday preflight evidence is complete; keeping it unapproved slows blocker-chain throughput. |
| TASK-0172 | 1 | Approve | Dry-run fail-fast evidence exists; approval removes unnecessary review lag without changing credential gate. |

## Governance Guardrails
- No `Done` transitions were applied to these Ready-for-Review tasks in this run.
- Credential-gated live execution remains blocked on `TASK-0159` until runtime credentials are provided.

## Isaac Decision Syntax
- `Tranche-K: APPROVE all`
- or `Tranche-K: HOLD <TASK-IDs> ; APPROVE rest`

## Artifacts Produced
- `mission-control/board/approval-queue/2026-03-17T03-10-00Z-tranche-k-approval-card.md`
- `mission-control/board/sweeps/2026-03-17T03-10-00Z-board-build-window-night.md`
