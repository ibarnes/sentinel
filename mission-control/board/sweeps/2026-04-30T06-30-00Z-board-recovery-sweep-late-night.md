# Board Recovery Sweep (Late Night) — 2026-04-30 06:30 UTC

## Stalled list
- **In Progress >48h:** 0 by strict timestamp filter.
- **Ready for Review >24h:** 69 (dominated by credential-gated repeated evidence microtasks).
- **Blocked stream anchors:** TASK-0043, TASK-0095, TASK-0097, TASK-0103 (credential/input gated).

## Decomposition updates (mandatory gate)
Oversized stalled stream selected: `TASK-0097` (credentialed live smoke chain with stale-RFR accumulation).

Created child subtasks:
1. `TASK-0272` (30–60m)
   - Acceptance: publish compaction artifact for stale RFR tranche units with deterministic routing policy and guardrails.
2. `TASK-0273` (30–60m)
   - Acceptance: refresh credential-window handoff card with exact env requirements, command chain, and evidence destinations.

## Unblock action taken
- Executed `TASK-0272` to **Ready for Review**.
- Artifact published:
  - `mission-control/board/approval-queue/2026-04-30T06-30-00Z-stale-rfr-tranche-ai-compaction-card.md`

## Recovery plan
1. Apply Isaac decision on compaction policy (hold vs keep-active) for stale tranche units.
2. Execute `TASK-0273` in next credential window prep cycle.
3. Then run single-pass credentialed live smoke path (`TASK-0097` / `TASK-0103`) when auth inputs are available.

## Isaac decision needed next
- Approve default routing for stale tranche-AI duplicates:
  - `HOLD_SUPERSEDED` (recommended), or
  - targeted `APPROVE_TRANSITION` for specific IDs to keep active.
- Provide any audit-critical exception IDs that must stay active.
