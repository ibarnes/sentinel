# Review Packet — RP-0002 Scoring Thresholds v1 (Workflow A + B)
Date: 2026-02-24
Owner: Sentinel
Status: Ready for Review

## Summary
Defined v1 scoring thresholds for Buyer/Pressure Monitor (signal scoring + surfacing bands) and Salesforce Target Queue (weighted priority model + queue tiers).

## Deliverable Link / File Path
- mission-control/SCORING_THRESHOLDS_V1.md

## Observations
- Workflow A now has a quantified score using signal type, materiality, recency, and confidence multipliers.
- Workflow B now has weighted scoring across urgency, buyer fit, staleness, and data hygiene.
- Both workflows now have explicit surfacing thresholds to reduce noise and improve consistency.

## Assumptions
- CRM inputs for Workflow B come from Isaac-approved exports/snapshots.
- v1 weights are intended as operational defaults, then tuned after live usage.

## Recommendations
- Approve v1 and run for 7 days before calibration.
- During calibration, track false positives/false negatives and adjust threshold bands.

## Recommended Next Step
- Approve RP-0002, then apply thresholds on next scheduled A/B runs.

## Next actions for Isaac to approve
- [ ] Approve as-is
- [ ] Request revisions
- [ ] Defer
