# Morning Brief (Daily) — 2026-03-20 (America/New_York)
Delivery Target: 07:15 ET

## 1) Top Priorities
- Maintain **Monitor-only** posture until verification-threshold evidence supports escalation.
- Execute today’s Workflow B queue baseline: `mission-control/review-packets/RP-0085-workflow-b-top-target-queue-2026-03-20.md`.
- Keep credential-gated blocker chain queued for live window: `TASK-0159` (live run) then `TASK-0160` (post-PASS replay).

## 2) Risks
- **Source-access risk:** Workflow A still shows repeated source failures (`HTTP_403`, `HTTP_404`, `FETCH_fetch failed`, `HTTP_500`) across key buyers.
- **Data-completeness risk:** most rows remain missing date/capital/geography/mandate fields, reducing pressure precision.
- **Execution risk:** credentialed live execution remains blocked in unattended mode without runtime env (`BASE_URL`, `TEAM_SESSION_COOKIE`).

## 3) Opportunities
- Fresh Workflow A output exists:
  - `mission-control/workflow-a/out/workflow-a-2026-03-20T10-30-40-296Z.json`
- Fresh Workflow B packet exists:
  - `mission-control/review-packets/RP-0085-workflow-b-top-target-queue-2026-03-20.md`
- Fresh board-build packet exists:
  - `mission-control/review-packets/RP-0082-board-build-window-night-2026-03-20.md`

## 4) Pressure Surface Changes (Workflow A + Signal Pressure)
### Observations
- New Workflow A run generated at `2026-03-20T10:30:40Z`.
- Legacy shortlist directional scores this cycle:
  - PIF **1.0**
  - GIC **1.0**
  - Brookfield **2.2**
  - GIP **1.0**
  - NigeriaMortgageFund **1.4**
- Signal-pressure freshness flow at 11:05 UTC: stale detected -> refreshed succeeded.
- Fresh delta remains flat: `new_high_impact_count = 0`.

### Assumptions
- This cycle supports monitoring and prioritization, not posture change.

### Recommendations
- Keep **Monitor-only** posture for this cycle.
- Prioritize source-hardening for repeat-failure buyers (PIF, AFC, AfDB, NSIA, GIC, SFD, MUBADALA, HCC, ANSCHUTZ, KOCH, GIP).
- Continue provenance/date-first gating before promoting any signal to action posture.

### Next actions for Isaac to approve
- [ ] Approve monitor-only posture for today
- [ ] Approve source-hardening pass on repeat-failure entities
- [ ] Approve continued provenance/date-first gating

## 5) Salesforce Target Queue Summary (Workflow B)
### Observations
- Latest queue packet: `RP-0085-workflow-b-top-target-queue-2026-03-20.md`.
- Structural hygiene pressure persists in top-ranked buyers:
  - Missing decision-architecture coverage remains across 7/10 top buyers.
  - High-influence/no-path gap persists (notably DFC).
  - Metadata drift remains open (`hq`, `region`, `buyer_role`, `buyer_class`) across top-10.
- Contact-path aging pressure persists:
  - `PATH-NSIA-001` (Warming) >14 days
  - `PATH-TAFF-FAISAL-NET-001` (Warming) >14 days

### Assumptions
- No external CRM/API pull was authorized in this run.

### Recommendations
- Run same-day metadata correction sprint for top-10 buyers.
- Complete DA baseline for uncovered top buyers.
- Enforce person-level path completion for high-influence stakeholders.
- Reactivate or reclassify stale Warming paths with dated next-touch evidence.

### Next actions for Isaac to approve
- [ ] Approve top-10 metadata normalization batch
- [ ] Approve DA baseline for uncovered top buyers
- [ ] Approve person-level path completion for unresolved high-influence stakeholders
- [ ] Approve stale-path reactivation/reclassification sweep

## 6) Short Action Plan (Today)
- 1) Hold **Monitor-only** posture.
- 2) Execute buyer-access graph hygiene sprint (metadata + architecture + person-level path completion).
- 3) Run one credentialed execution window (`TASK-0159`), then apply replay (`TASK-0160`) if PASS evidence lands.
