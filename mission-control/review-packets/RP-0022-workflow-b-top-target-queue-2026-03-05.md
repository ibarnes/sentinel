# Review Packet — Workflow B Top Target Queue (2026-03-05)
Date: 2026-03-05
Owner: Sentinel
Status: Ready for Review

## Summary
Executed Workflow B using the canonical ranking source (`dashboard/data/buyers.json`) plus latest Workflow A context (`mission-control/workflow-a/out/workflow-a-v3_1-2026-03-05T11-31-25-709Z.json`). Produced a ranked Top-10 touch queue and logged current CRM hygiene constraints.

## Deliverable Link / File Path
mission-control/review-packets/RP-0022-workflow-b-top-target-queue-2026-03-05.md

## Ranking Method (Current)
- Primary sort: `dashboard/data/buyers.json` score (descending).
- Tie-breakers: (1) timing urgency in pressure factors, (2) source confidence in current signal stack, (3) strategic relevance to active initiatives.
- Constraint: no fresh Isaac-approved Salesforce export in workspace, so owner/stage/next-step/dated recency hygiene checks remain partial.

## Top 10 Accounts to Touch + Why

| Rank | Account | Source Score | Signal Status | Why now | Recommended next touch |
|---|---|---:|---|---|---|
| 1 | Public Investment Fund (PIF) | 2.2 | Monitor | Highest-ranked sovereign with active strategic-sector deployment signals and continued mandate-pathway ambiguity. | Route an IC-grade pre-FID governance memo via trusted conduit; request pathway qualification checkpoint. |
| 2 | Temasek | 2.2 | Monitor | Top-tier score with global infrastructure appetite; currently strong strategic fit but pathway still unverified. | Prepare one-page commitment-architecture thesis and map warm conduit to investment leadership. |
| 3 | ADQ | 2.2 | Monitor | High sovereign deployment profile and rising platform pressure across infrastructure/logistics lanes. | Draft concise platform-architecture brief and identify sovereign-aligned introducer before outreach. |
| 4 | Africa Finance Corporation (AFC) | 2.1 | Monitor | High deployment pressure and project-prep fit continue to make AFC structurally actionable. | Queue scope-alignment brief tied to project-prep mandate pathway and request qualification call. |
| 5 | Mubadala Investment Company | 2.1 | Monitor | Capital capacity and strategic fit remain high; still in evidence-gathering posture for defined mandate entry. | Send targeted pathway-validation prompt through investment routing channel. |
| 6 | U.S. International Development Finance Corporation (DFC) | 2.1 | Monitor | Decision architecture is now clearer, but access-path mapping gap remains a conversion bottleneck. | Build DFC access-path entry (owner + conduit + next touch) and route a pre-FID/FID-boundary note to investments lane. |
| 7 | World Bank (IBRD / IDA) | 2.1 | Monitor | High structural relevance for sovereign platforms, but mandate pathway still blocked by institutional entry requirements. | Prepare sovereign-ministry-aligned structuring memo and identify formal channel sponsor. |
| 8 | Qatar Investment Authority (QIA) | 2.1 | Monitor | High score and sovereign capital relevance with unresolved entry conduit requirements. | Draft capital-stack clarity brief and map one trusted sovereign introducer. |
| 9 | African Development Bank (AfDB) | 2.0 | Monitor | Strong multilateral fit; still lacks fully defined, approved engagement pathway in current dataset. | Build PPF/eligibility checklist for approval before any external touch. |
| 10 | The Pritzker Organization (TPO) | 2.0 | Monitor | Principal-capital profile can move faster if a concrete platform bottleneck is framed precisely. | Prepare one-page principal-level commitment-architecture note tied to one concrete FID blocker. |

## Observations
- Workflow B output now reflects the current expanded ranked universe in `dashboard/data/buyers.json` (not the legacy shortlist).
- Top-10 composition shifted from prior runs as new sovereign/institutional buyers now score at the top.
- CRM hygiene remains partially blind without approved Salesforce snapshot fields (owner, stage, next step, dated last-touch).
- DFC has improved decision-architecture context but still lacks mapped contact-path coverage, reducing execution readiness.

## Assumptions
- `dashboard/data/buyers.json` remains the approved ranking source-of-truth.
- No external outreach execution is implied by this packet; this is a prep/prioritization queue.
- Workflow A output dated 2026-03-05 is the latest approved context snapshot for pressure and signal posture.

## Recommendations
- Approve RP-0022 as today’s operating queue for outreach preparation and conduit qualification.
- Authorize ingestion of latest Salesforce snapshot to restore full hygiene scoring (recency + ownership + stage + next-step quality).
- Patch DFC access-path mapping immediately to remove a preventable conversion bottleneck.

## Recommended Next Step
- Approve queue order, then authorize Salesforce snapshot intake so tomorrow’s Workflow B run can include full hygiene penalties and owner-level accountability.

## Next actions for Isaac to approve
- [ ] Approve as-is
- [ ] Request revisions
- [ ] Defer
