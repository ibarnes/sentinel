# Workflow B Top Target Queue - 2026-06-12

## Observations
- Top-10 buyer ranking currently is: Alpha Wave Global, USVI Recovery Program Authority (ODR + VIHFA), Global Infrastructure Partners, Brookfield Infrastructure Partners L.P., Haun Ventures, Stonepeak, KKR & Co. Inc., General Atlantic, Tariq Al Futtaim Family Foundation (TAFF), ADQ.
- Decision-architecture coverage is missing for 8/10 top buyers.
- Contact-path coverage is missing for 8/10 top buyers; 2/10 ranked buyers also carry stale warming or blocked paths older than 14 days.
- Top-cohort metadata quality remains degraded for 10/10 ranked records (missing at least one of `hq_country`, `region`, `buyer_role`, or `buyer_class`).
- Signal-pressure delta remained fresh from `2026-06-12T08:41:38.586Z` with `new_high_impact_count=0` and `new_signal_count=0`; the heaviest durable signal overlap now sits on ADQ.

## Assumptions
- This run uses local snapshots only: buyers, decision architecture, contact paths, and the current fresh signal-pressure delta.
- No external CRM writes or outbound account touches were executed in this run.
- Missing decision architecture, missing first-path coverage, and stale warming/blocked paths are treated as conversion blockers for outreach planning.

## Top 10 Accounts to Touch + Why Now
1. **Alpha Wave Global** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: there is durable signal overlap; there is no decision-architecture baseline; there is no mapped access path; ranked metadata remains incomplete.
   - Recommended next touch: define the economic and technical owner map, then open the first dated path tied to current venture-infrastructure thesis pressure.
2. **USVI Recovery Program Authority (ODR + VIHFA)** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: usable direct coverage exists, but 1 warming lane still needs cleanup; ranked metadata remains incomplete.
   - Recommended next touch: tighten the ODR/VIHFA direct lane into one dated next step and explicitly resolve the HUD/FEMA oversight dependency.
3. **Global Infrastructure Partners** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: signal density is among the highest in the queue; there is no decision-architecture baseline; there is no mapped access path; ranked metadata remains incomplete.
   - Recommended next touch: create the investment-committee and operating-partner map, then open one dated route tied to current infrastructure-allocation pressure.
4. **Brookfield Infrastructure Partners L.P.** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: there is durable signal overlap; there is no decision-architecture baseline; there is no mapped access path; ranked metadata remains incomplete.
   - Recommended next touch: establish the Brookfield infrastructure owner map and create the first dated route into the relevant platform lead.
5. **Haun Ventures** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: there is durable signal overlap; there is no decision-architecture baseline; there is no mapped access path; ranked metadata remains incomplete.
   - Recommended next touch: identify the principal and portfolio-operations decision path and create one dated access route.
6. **Stonepeak** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: there is durable signal overlap; there is no decision-architecture baseline; there is no mapped access path; ranked metadata remains incomplete.
   - Recommended next touch: map the Stonepeak committee and operating-owner chain, then open one dated access path tied to live capital-deployment pressure.
7. **KKR & Co. Inc.** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: signal density is among the highest in the queue; there is no decision-architecture baseline; there is no mapped access path; ranked metadata remains incomplete.
   - Recommended next touch: build the KKR decision route and open one dated path into the relevant infrastructure or strategic-capital lead.
8. **General Atlantic** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: there is durable signal overlap; there is no decision-architecture baseline; there is no mapped access path; ranked metadata remains incomplete.
   - Recommended next touch: define the GA platform owner map and create one dated route into the relevant growth or infrastructure adjacency lead.
9. **Tariq Al Futtaim Family Foundation (TAFF)** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: there is durable signal overlap; usable direct coverage exists, but 1 warming lane still needs cleanup; ranked metadata remains incomplete.
   - Recommended next touch: convert the active family-capital lanes into one dated mandate step and either reactivate or retire the stale warming network path.
10. **ADQ** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: signal density is among the highest in the queue; there is no decision-architecture baseline; there is no mapped access path; ranked metadata remains incomplete.
   - Recommended next touch: create the ADQ decision baseline, map one sovereign-aligned introducer, and normalize core ranked metadata before sequencing outreach.

## Recommendations
- Execute one-cycle access-graph remediation for the 8 ranked buyers still missing a decision map or first usable path.
- Escalate the 2 stale warming/blocked paths already inside the current top 10 before opening lower-priority net-new lanes.
- Normalize ranked buyer metadata fields `hq_country`, `region`, `buyer_role`, and `buyer_class` before the next Workflow B run.
- Prioritize graph hardening for ADQ, KKR & Co. Inc., Global Infrastructure Partners, Stonepeak, Tariq Al Futtaim Family Foundation (TAFF) because they carry the densest live signal overlap inside the current queue.

## Next Actions (for Isaac approval)
1. Approve one-cycle graph hardening for the current ranked top 10.
2. Approve explicit stale-path cleanup on the current ranked buyers before opening lower-priority net-new lanes.
3. Approve metadata normalization for the same top 10 before the next Workflow B run.
