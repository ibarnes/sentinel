# RP-0097 — Board Build Window (Night) — 2026-03-23 03:10 UTC

## Objective
Reduce stale Ready-for-Review queue age via decomposition-gated tranche-U decision digest and explicit approval routing.

## Decomposition Gate
Parent recovery item `TASK-0107` was decomposed into:
1. `TASK-0219` (30–90 min): produce tranche-U decision digest for oldest stale RFR tranche.
2. `TASK-0220` (30–90 min): publish tranche-U approval routing card with transition-safe capture template.

Dependency sequence: `TASK-0107 -> TASK-0219 -> TASK-0220`.

## Tranche-U (Oldest 12 Ready-for-Review Items)
1. TASK-0150 — Recommend **Approve**
2. TASK-0151 — Recommend **Approve**
3. TASK-0171 — Recommend **Approve**
4. TASK-0172 — Recommend **Approve**
5. TASK-0180 — Recommend **Approve**
6. TASK-0181 — Recommend **Approve**
7. TASK-0187 — Recommend **Approve**
8. TASK-0188 — Recommend **Approve**
9. TASK-0192 — Recommend **Approve**
10. TASK-0193 — Recommend **Approve**
11. TASK-0194 — Recommend **Approve**
12. TASK-0195 — Recommend **Approve**

## Why this is highest leverage
- These are the oldest unresolved RFR artifacts.
- Clearing this tranche collapses stale queue age fastest without violating credential-gated blockers.
- No irreversible execution is required; this is governance-safe approval routing.

## Governance Guardrail
- No parent blocker-chain tasks moved to Done.
- No transition to Done without explicit approved review-packet decision.

## Isaac Decision Needed
- Approve/Defer each tranche-U item above.
- Confirm live credential window (`BASE_URL` + `TEAM_SESSION_COOKIE`) for `TASK-0159` to unblock execution chain.
