# Review Packet — Workflow B Top Target Queue (2026-03-03)
Date: 2026-03-03
Owner: Sentinel
Status: Ready for Review

## Summary
Executed Workflow B using the current source-of-truth buyer dataset (`dashboard/data/buyers.json`) plus latest Workflow A context (`workflow-a-v3_1-2026-03-03T11-31-21-679Z.json`). Produced a ranked Top-10 touch queue and documented CRM hygiene constraints.

## Deliverable Link / File Path
mission-control/review-packets/RP-0017-workflow-b-top-target-queue-2026-03-03.md

## Ranking Method (Current)
- Primary sort: `dashboard/data/buyers.json` score (descending).
- Tie-breakers: (1) pressure factor urgency, (2) evidence confidence from latest Workflow A, (3) strategic relevance to active initiatives.
- Constraint: no fresh Isaac-approved Salesforce export in workspace, so CRM recency/owner/stage fields remain incomplete.

## Top 10 Accounts to Touch + Why

| Rank | Account | Source Score | Signal Status | Why now | Recommended next touch |
|---|---|---:|---|---|---|
| 1 | Public Investment Fund (PIF) | 2.2 | Monitor | Highest score; strategic-fit remains strongest despite verification gaps and committee-gated access. | Send IC-level, thesis-led checkpoint note focused on pre-FID governance architecture and timing window. |
| 2 | Africa Finance Corporation (AFC) | 2.1 | Monitor | High deployment pressure with project-prep orientation; structurally suitable for mandate pathway qualification. | Queue qualification brief mapping AIFF/project-prep route and request scope-alignment call. |
| 3 | Mubadala Investment Company | 2.1 | Monitor | High capital deployment profile with rising Gulf-Africa relevance; pathway still in evidence-gathering stage. | Send concise platform-thesis memo request through investment-routing channel; validate mandate entry point. |
| 4 | U.S. DFC | 2.1 | Monitor | Strong strategic alignment and institutional financing relevance; still blocked on verified live allocation pathway. | Prepare mandate-pathway note tied to project-preparation/FID boundary and request qualification signal. |
| 5 | African Development Bank (AfDB) | 2.0 | Monitor | Multilateral fit is strong, but still missing confirmed engagement pathway despite high infrastructure relevance. | Build short eligibility/PPF pathway checklist and route for approval before outreach. |
| 6 | The Pritzker Organization (TPO) | 2.0 | Monitor | Principal-capital profile can move faster if a concrete platform scope is defined. | Draft one-page commitment-architecture memo aimed at principal-level investment routing. |
| 7 | Henry Crown & Company (HCC) | 2.0 | Monitor | Strong private-capital fit; needs live platform context to avoid exploratory dead-end cycles. | Prepare targeted outreach framing around one concrete platform bottleneck + FID boundary. |
| 8 | The Anschutz Corporation | 2.0 | Monitor | Industrial-scale capital profile fits pre-FID structuring thesis, pending validated conduit. | Build conduit-first touch plan (co-investor/legal routing) before direct outreach attempt. |
| 9 | Koch Industries / KIG | 2.0 | Monitor | Large deployment capacity and strategic fit; high bar for non-generic entry. | Draft KIG-specific governance compression brief; hold send until conduit confidence improves. |
| 10 | Cox Enterprises | 2.0 | Monitor | Diversified private platform with infrastructure adjacency; requires precise, non-advisory framing. | Prepare corporate-investment routing note with explicit FID sequencing value proposition. |

## Observations
- Workflow B is now aligned to `dashboard/data/buyers.json` as source-of-truth for ranked outputs.
- Full Top-10 is now achievable from local structured buyer records (previous 5-account limitation removed).
- CRM hygiene diagnostics are still partial because Salesforce-native fields are absent (owner, stage, next step, last touch date).
- Latest Workflow A output still supports **Monitor** posture across named buyers pending threshold-grade verification.

## Assumptions
- Current buyer scores in `dashboard/data/buyers.json` represent Isaac-approved ranking baseline until revised.
- No unlogged outreach/state changes occurred outside workspace artifacts.
- “Touch” includes prep actions (memo/checklist/conduit mapping), not automatic external outreach.

## Recommendations
- Approve this Top-10 as today’s operating queue for outreach prep and pathway qualification.
- Authorize ingestion of latest Salesforce snapshot to restore full hygiene scoring (recency + ownership + stage).
- Add explicit CRM hygiene gates per account: owner, stage, next-step, dated last-contact, and next action date.

## Recommended Next Step
- Approve RP-0017 queue, then authorize Salesforce snapshot intake to harden tomorrow’s Workflow B scoring with true recency and hygiene penalties.

## Next actions for Isaac to approve
- [ ] Approve as-is
- [ ] Request revisions
- [ ] Defer
