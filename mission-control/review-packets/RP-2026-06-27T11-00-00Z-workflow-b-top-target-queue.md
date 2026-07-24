# Workflow B Top Target Queue - 2026-06-27

## Observations
- Top-10 buyer ranking for this run resolves from `dashboard/data/buyers.json` to: USVI Recovery Program Authority (ODR + VIHFA), Alpha Wave Global, Global Infrastructure Partners, Stonepeak, Haun Ventures, Brookfield Infrastructure Partners L.P., KKR & Co. Inc., Tariq Al Futtaim Family Foundation (TAFF), General Atlantic, Public Investment Fund.
- Decision-architecture coverage is still missing for 8/10 ranked buyers; only USVI Recovery Program Authority and TAFF currently carry any mapped decision roles in `dashboard/data/decision_architecture.json`.
- Contact-path coverage is still missing for 7/10 ranked buyers; only USVI Recovery Program Authority, Tariq Al Futtaim Family Foundation (TAFF), and Public Investment Fund currently carry any mapped path coverage in `dashboard/data/contact_paths.json`.
- 2 ranked buyers still carry stale warming lanes older than 14 days: Tariq Al Futtaim Family Foundation (TAFF) still has `PATH-TAFF-FAISAL-NET-001` in `Warming` status last updated `2026-03-05T20:48:00Z` (about 113 days old), and USVI Recovery Program Authority (ODR + VIHFA) still has `PATH-USVI-FED-001` in `Warming` status last updated `2026-03-17T15:03:00Z` (about 101 days old).
- Ranked-record metadata quality remains degraded for 10/10 buyers because every current top-10 record is missing at least `region`, `buyer_role`, or `buyer_class`; Public Investment Fund is still the weakest record because it also lacks `hq_country`.
- Signal-pressure delta remained fresh from `2026-06-27T08:41:27.785Z` with `new_high_impact_count=0` and `new_signal_count=0`, so the queue is still driven by access-readiness and graph-quality gaps rather than a new event spike.

## Assumptions
- This run uses local snapshots only: `dashboard/data/buyers.json`, `dashboard/data/decision_architecture.json`, `dashboard/data/contact_paths.json`, and the fresh `mission-control/signal-pressure/out/pressure-delta.json`.
- No external CRM writes, outbound account touches, or approval-state changes were executed in this run.
- Warming paths older than 14 days are treated as stale until they carry a dated owner, explicit next step, and decision-route context.

## Top 10 Accounts to Touch + Why Now
1. **USVI Recovery Program Authority (ODR + VIHFA)** - Score 2.7
   - Why now: it remains the highest-ranked buyer and the strongest access-graph record in the queue, but the federal oversight lane is still stuck in `Warming` roughly 101 days after its last update.
   - Recommended next touch: collapse ODR, VIHFA, and HUD/FEMA oversight into one dated owner map and force a single next step tied to workforce deployment or funding-rule friction.
2. **Alpha Wave Global** - Score 2.7
   - Why now: it remains at the top of the ranked queue, but there is still no decision architecture, no path coverage, and no normalized role/class metadata.
   - Recommended next touch: define the principal decision chain and open the first dated route tied to AI and strategic-platform capital deployment pressure.
3. **Global Infrastructure Partners** - Score 2.6
   - Why now: GIP remains inside the top cohort, yet the access graph still has zero decision-map or path coverage.
   - Recommended next touch: map the investment-committee and operating-partner chain, then open one dated route into the current infrastructure-allocation lane.
4. **Stonepeak** - Score 2.5
   - Why now: Stonepeak is still structurally empty from an access standpoint while staying inside the active ranked surface.
   - Recommended next touch: define the Stonepeak decision route and create one dated path into the relevant infrastructure or digital-capital owner.
5. **Haun Ventures** - Score 2.5
   - Why now: it remains in the top cohort with no decision architecture, no path coverage, and no buyer-role normalization.
   - Recommended next touch: identify the principal and portfolio-operations owner chain, then open one dated route tied to the digital-infrastructure thesis.
6. **Brookfield Infrastructure Partners L.P.** - Score 2.5
   - Why now: Brookfield remains ranked, but the access graph is still fully blank.
   - Recommended next touch: establish the Brookfield infrastructure and AI-power owner map, then create the first dated path into the relevant platform lead.
7. **KKR & Co. Inc.** - Score 2.4
   - Why now: KKR remains a top-10 name with no decision architecture, no mapped path, and no normalized role metadata.
   - Recommended next touch: build the KKR decision route and open one dated path into the infrastructure or strategic-capital lane.
8. **Tariq Al Futtaim Family Foundation (TAFF)** - Score 2.3
   - Why now: TAFF already has direct access and decision-role coverage, but one strategic network path is still stuck in `Warming` roughly 113 days after its last update.
   - Recommended next touch: either reactivate or retire the stale Faisal-network warming path and tighten the direct Isaac/Abdelraouf lanes into one dated mandate step.
9. **General Atlantic** - Score 2.3
   - Why now: GA remains in the top 10, yet the access graph still has zero decision-map or path coverage.
   - Recommended next touch: define the growth-platform owner path and open one dated route into the most relevant digital-infrastructure adjacency lead.
10. **Public Investment Fund** - Score 2.2
   - Why now: PIF still has a mapped path, but it remains the weakest ranked record on metadata quality and still has no decision architecture.
   - Recommended next touch: turn the existing PIF path into a dated route with named investment-committee owner, platform sponsor, and explicit next-step timing.

## Recommendations
- Execute one-cycle access-graph remediation for the 7 ranked buyers still missing both a decision map and a first usable path.
- Clean up the 2 stale warming lanes already inside the current top 10 before opening lower-priority net-new lanes.
- Normalize ranked buyer metadata fields `region`, `buyer_role`, and `buyer_class` for all 10 buyers, plus `hq_country` for PIF, before the next Workflow B run.
- Prioritize graph hardening for USVI, TAFF, PIF, GIP, and KKR because they are already inside the active queue but still carry the biggest execution-readiness gaps.

## Next Actions (for Isaac approval)
1. Approve one-cycle graph hardening for the current ranked top 10.
2. Approve explicit stale-path cleanup on USVI Recovery Program Authority and TAFF before opening lower-priority net-new lanes.
3. Approve metadata normalization for the same top 10 before the next Workflow B run.
