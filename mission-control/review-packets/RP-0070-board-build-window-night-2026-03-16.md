# RP-0070 — Board Build Window (Night) — 2026-03-16 03:10 UTC

## Scope
- Build-window deep work focused on governance-safe queue reduction and approval acceleration.
- Stream selected: `TASK-0107` (stale Ready-for-Review recovery).

## Decomposition Gate
- Parent item `TASK-0107` remains too broad; decomposed into two atomic subtasks (30–90 min each):
  1. `TASK-0173` — build oldest-RFR tranche-J decision packet.
  2. `TASK-0174` — publish compact approval routing card for low-latency decisions.
- Dependency sequence: `TASK-0173` -> `TASK-0174` -> Isaac approval input -> `TASK-0113` decision replay path.

## Tranche-J Decision Set (Oldest Ready for Review)

| Task | Title | Recommendation | Why it matters |
|---|---|---|---|
| TASK-0150 | TS-H1.1c.2u Publish credential-window operator card for one-pass execution | Approve | Advances blocker-chain closure or reduces RFR queue age without violating governance. |
| TASK-0151 | TS-H1.1c.2v Build blocker-chain closure matrix with transition gates | Approve | Advances blocker-chain closure or reduces RFR queue age without violating governance. |
| TASK-0171 | TS-H1.1c.2aj Capture sweep-time credential preflight artifact (midday execution window) | Approve | Advances blocker-chain closure or reduces RFR queue age without violating governance. |
| TASK-0172 | TS-H1.1c.2ak Run one-command credentialed wrapper dry-run and capture fail-fast evidence (midday) | Approve | Advances blocker-chain closure or reduces RFR queue age without violating governance. |

## Governance Guardrails
- No tasks moved to Done based on this packet alone.
- Approvals here authorize transition/replay actions only where evidence + RP requirements are already satisfied.

## Isaac Decision Format
- Reply with one line:
  - `Tranche-J: APPROVE all`
  - or `Tranche-J: HOLD <TASK-IDs> ; APPROVE rest`

## Next Execution on Approval
1. Apply decisions via precomputed transition paths (`TASK-0113` chain).
2. Keep credential-bound tasks (`TASK-0159`, `TASK-0160`) pending live credential window evidence.
