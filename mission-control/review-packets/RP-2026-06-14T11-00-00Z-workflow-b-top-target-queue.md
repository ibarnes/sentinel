# Workflow B Top Target Queue - 2026-06-14

## Observations
- Top-10 buyer ranking currently is: USVI Recovery Program Authority (ODR + VIHFA), Alpha Wave Global, Global Infrastructure Partners, Stonepeak, Haun Ventures, Brookfield Infrastructure Partners L.P., KKR & Co. Inc., Tariq Al Futtaim Family Foundation (TAFF), General Atlantic, Public Investment Fund.
- Decision-architecture coverage is missing for 7/10 top buyers; only USVI Recovery Program Authority and TAFF currently carry any mapped decision roles.
- Contact-path coverage is missing for 6/10 top buyers; USVI Recovery Program Authority, TAFF, and Public Investment Fund are the only ranked accounts with any path coverage, and 2/10 ranked buyers still carry warming paths older than 14 days.
- Top-cohort metadata quality remains degraded for 10/10 ranked records because each is still missing at least one of `hq_country`, `region`, `buyer_role`, or `buyer_class`; PIF is the weakest record and is missing all four fields.
- Signal-pressure delta remained fresh from `2026-06-14T05:41:25.427Z` with `new_high_impact_count=0` and `new_signal_count=0`; the heaviest durable overlap in the current queue sits on Public Investment Fund, Global Infrastructure Partners, KKR & Co. Inc., Stonepeak, and TAFF.

## Assumptions
- This run uses local snapshots only: buyers, decision architecture, contact paths, and the current fresh signal-pressure delta.
- No external CRM writes or outbound account touches were executed in this run.
- Warming paths older than 14 days are treated as stale until they carry a dated owner, explicit next step, and decision-route context.

## Top 10 Accounts to Touch + Why Now
1. **USVI Recovery Program Authority (ODR + VIHFA)** - Score 2.7
   - Why now: it is still the top-ranked buyer and already has the strongest direct path and decision-role coverage in the queue, but the federal oversight lane remains only warming and undated for next-step execution.
   - Recommended next touch: collapse ODR, VIHFA, and HUD/FEMA oversight into one dated owner map and force a single next-step tied to workforce deployment or funding-rule friction.
2. **Alpha Wave Global** - Score 2.7
   - Why now: it sits at the top of the ranked queue with durable signal overlap, but there is still no decision architecture, no path coverage, and no normalized role/class metadata.
   - Recommended next touch: define the principal decision chain and open the first dated route tied to AI and strategic-platform capital deployment pressure.
3. **Global Infrastructure Partners** - Score 2.6
   - Why now: GIP carries one of the densest durable signal footprints in the queue, yet the access graph still has zero decision-map or path coverage.
   - Recommended next touch: map the investment-committee and operating-partner chain, then open one dated route into the current infrastructure-allocation lane.
4. **Stonepeak** - Score 2.5
   - Why now: signal overlap is still heavy and the ranked record remains structurally empty from an access standpoint.
   - Recommended next touch: define the Stonepeak decision route and create one dated path into the relevant infrastructure or digital-capital owner.
5. **Haun Ventures** - Score 2.5
   - Why now: it remains inside the top cohort with live signal relevance, but there is still no decision architecture, no path coverage, and no buyer-role normalization.
   - Recommended next touch: identify the principal and portfolio-operations owner chain, then open one dated route tied to the digital-infrastructure thesis.
6. **Brookfield Infrastructure Partners L.P.** - Score 2.5
   - Why now: Brookfield remains ranked despite sparse fresh signal extraction, and the access graph is still fully blank.
   - Recommended next touch: establish the Brookfield infrastructure and AI-power owner map, then create the first dated path into the relevant platform lead.
7. **KKR & Co. Inc.** - Score 2.4
   - Why now: KKR is still among the most signal-dense names in the queue, but there is no decision architecture, no mapped path, and no normalized role metadata.
   - Recommended next touch: build the KKR decision route and open one dated path into the infrastructure or strategic-capital lane.
8. **Tariq Al Futtaim Family Foundation (TAFF)** - Score 2.3
   - Why now: TAFF already has direct access and decision-role coverage, but one strategic network path is still stuck in `Warming` at roughly 100 days old, so the graph is informative but not execution-ready.
   - Recommended next touch: either reactivate or retire the stale Faisal-network warming path and tighten the direct Isaac/Abdelraouf lanes into one dated mandate step.
9. **General Atlantic** - Score 2.3
   - Why now: GA remains in the top 10 with meaningful signal overlap, yet the access graph still has zero decision-map or path coverage.
   - Recommended next touch: define the growth-platform owner path and open one dated route into the most relevant digital-infrastructure adjacency lead.
10. **Public Investment Fund** - Score 2.2
   - Why now: PIF carries the heaviest durable signal overlap in the queue, but its only mapped path is an old ready-state internal lane with no decision architecture and no normalized metadata baseline.
   - Recommended next touch: turn the existing PIF path into a dated route with named investment-committee owner, platform sponsor, and explicit next-step timing.

## Recommendations
- Execute one-cycle access-graph remediation for the 6 ranked buyers still missing both a decision map and a first usable path.
- Clean up the 2 stale warming lanes already inside the current top 10 before opening lower-priority net-new lanes.
- Normalize ranked buyer metadata fields `region`, `buyer_role`, and `buyer_class` for all 10 buyers, plus `hq_country` for PIF, before the next Workflow B run.
- Prioritize graph hardening for PIF, GIP, KKR, Stonepeak, and TAFF because they combine the strongest durable signal overlap with the weakest execution-ready access posture.

## Next Actions (for Isaac approval)
1. Approve one-cycle graph hardening for the current ranked top 10.
2. Approve explicit stale-path cleanup on USVI Recovery Program Authority and TAFF before opening lower-priority net-new lanes.
3. Approve metadata normalization for the same top 10 before the next Workflow B run.
