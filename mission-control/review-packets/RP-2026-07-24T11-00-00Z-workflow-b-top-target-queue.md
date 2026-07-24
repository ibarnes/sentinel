# Workflow B Top Target Queue - 2026-07-24

## Observations
- Top-10 buyer ranking for this run resolves from the canonical order in `dashboard/data/buyers.json` to: USVI Recovery Program Authority (ODR + VIHFA), Alpha Wave Global, Global Infrastructure Partners, Stonepeak, Haun Ventures, Brookfield Infrastructure Partners L.P., KKR & Co. Inc., Tariq Al Futtaim Family Foundation (TAFF), General Atlantic, and Public Investment Fund.
- The ranked set changed materially versus Thursday, July 23, 2026: only Public Investment Fund remained in the top 10, while USVI Recovery Program Authority, Alpha Wave Global, Global Infrastructure Partners, Stonepeak, Haun Ventures, Brookfield Infrastructure Partners L.P., KKR & Co. Inc., TAFF, and General Atlantic displaced Gulf Investment Corporation, Africa Finance Corporation, Nigeria Sovereign Investment Authority, Federal Ministry of Finance (Nigeria), Abu Dhabi Fund for Development, Saudi Fund for Development, African Development Bank, International Finance Corporation, and Mubadala Investment Company.
- Decision-architecture coverage is now missing for 8/10 ranked buyers rather than 10/10; USVI Recovery Program Authority and TAFF already carry mapped decision-role coverage in `dashboard/data/decision_architecture.json`.
- Contact-path coverage is now missing for 7/10 ranked buyers rather than 7/10 on a different sovereign-heavy queue; USVI Recovery Program Authority, TAFF, and Public Investment Fund currently carry at least one path record in `dashboard/data/contact_paths.json`.
- 2 ranked buyers carry warming paths that are structurally stale and should be either reactivated or retired: `PATH-USVI-FED-001` for USVI Recovery Program Authority and `PATH-TAFF-FAISAL-NET-001` for TAFF both remain in `Warming` without a current dated next move.
- Core buyer profile coverage remains intact for the current ranked set under the live schema: all 10/10 ranked buyers carry `type`, `geo_focus`, `sector_focus`, and `mandate_summary`, so the immediate operating gap is route construction and graph quality, not profile completion.
- Signal-pressure freshness was checked before this run; `node mission-control/signal-pressure/run-if-stale.mjs` reported `status=fresh`, and the active delta remains `generated_at=2026-07-24T09:11:20.007Z` in `mission-control/signal-pressure/out/pressure-delta.json` with `new_high_impact_count=0` and `new_signal_count=0`, so the queue is not being reordered by a fresh event spike.
- Workflow A did not introduce any field-level deltas versus Thursday, July 23, 2026's 10:30 UTC run, so today's Workflow B shift is coming from the live ranking source in `buyers.json`, not from a new buyer-evidence change in the extractor.

## Assumptions
- This run uses local snapshots only: `dashboard/data/buyers.json`, `dashboard/data/decision_architecture.json`, `dashboard/data/contact_paths.json`, the freshness-checked `mission-control/signal-pressure/out/pressure-delta.json`, and the latest 10:30 UTC Workflow A artifact.
- No external CRM writes, outbound account touches, or approval-state changes were executed in this run.
- Any path left in `Warming` without a current dated next move is treated as stale even if the stored freshness field is old or incomplete.

## Top 10 Accounts to Touch + Why Now
1. **USVI Recovery Program Authority (ODR + VIHFA)** - Score 2.7
   - Why now: it moved to the top of the canonical queue, already has some decision-architecture and path scaffolding, and can be converted faster than net-new buyers if the federal oversight lane is clarified.
   - Recommended next touch: reactivate or retire `PATH-USVI-FED-001`, then pin one dated sponsor path that ties ODR / VIHFA operating pressure to the federal funding authority layer.
2. **Alpha Wave Global** - Score 2.7
   - Why now: it now ranks second on the live board with no mapped decision architecture and no path coverage, while its stored buyer-state still points to an early-entry, sovereign-aligned platform thesis.
   - Recommended next touch: open the first sovereign-aligned introduction path and map the partner / IC sponsor chain around the Angola AI corridor thesis.
3. **Global Infrastructure Partners** - Score 2.6
   - Why now: it is now a top-three canonical target with zero graph coverage, and its stored posture still depends on platform aggregation plus institutional-scale access.
   - Recommended next touch: map the partner-level decision route and open one sovereign co-investor introduction path tied to platform-scale infrastructure aggregation.
4. **Stonepeak** - Score 2.5
   - Why now: it entered the top 10 with no decision-architecture or path coverage and remains attractive only if the route is framed around contracted, scalable infrastructure cash-flow logic.
   - Recommended next touch: define the infrastructure-deal sponsor chain and create one dated operator or developer-led access path.
5. **Haun Ventures** - Score 2.5
   - Why now: it entered the top 10 with no graph coverage and a stored focus on scalable digital platforms plus regulatory durability.
   - Recommended next touch: identify the first founder, operator, or strategic network conduit and map the decision route around AI infrastructure platform formation.
6. **Brookfield Infrastructure Partners L.P.** - Score 2.5
   - Why now: it now sits inside the active queue with no decision architecture and no path coverage even though the mandate logic is already well-shaped in the buyer record.
   - Recommended next touch: create the first co-investor or strategic-partner introduction path and map the investment-grade infrastructure approval chain.
7. **KKR & Co. Inc.** - Score 2.4
   - Why now: it entered the top 10 with zero graph coverage and will stay theoretical unless the access route is framed around downside-protected infrastructure scale.
   - Recommended next touch: map the infrastructure or digital-infrastructure deal lead route and open one existing co-investor relationship path.
8. **Tariq Al Futtaim Family Foundation (TAFF)** - Score 2.3
   - Why now: it is the only new entrant besides USVI with both decision-architecture and active-path coverage already present, so it is one of the few accounts where immediate route cleanup can produce movement.
   - Recommended next touch: either reactivate or retire `PATH-TAFF-FAISAL-NET-001`, then use the surviving family-trust channel to formalize the next mandate conversation.
9. **General Atlantic** - Score 2.3
   - Why now: it entered the top 10 with no graph coverage and a stored bias toward scalable technology platforms rather than generic capital outreach.
   - Recommended next touch: identify one founder or operator-led sponsor path and map the growth-equity decision route around a platform-level AI or digital-infrastructure wedge.
10. **Public Investment Fund** - Score 2.2
   - Why now: it is the only buyer retained from Thursday, July 23, 2026's top 10, and although it already has path coverage it still lacks mapped decision architecture.
   - Recommended next touch: preserve the existing path but add the missing decision-role map so the queue is not blocked by unstructured sovereign routing.

## Recommendations
- Re-baseline Workflow B on the new private-capital-heavy top 10 immediately; yesterday's sovereign / DFI packet is no longer the live ranking source of truth.
- Use USVI Recovery Program Authority and TAFF as the fastest graph-tightening candidates because both already have partial coverage and only need route cleanup plus sponsor specificity.
- Treat Alpha Wave Global, Global Infrastructure Partners, Stonepeak, Haun Ventures, Brookfield Infrastructure Partners, KKR, and General Atlantic as first-pass graph-construction work rather than outreach-ready accounts.
- Keep Public Investment Fund in the queue, but shift the gap framing from first-path creation to missing decision-architecture mapping.

## Next Actions (for Isaac approval)
1. Approve a one-cycle rebuild of Workflow B around the current `buyers.json` top 10 rather than the prior sovereign / DFI queue.
2. Approve stale-path cleanup on `PATH-USVI-FED-001` and `PATH-TAFF-FAISAL-NET-001`.
3. Approve first-pass decision-architecture and path mapping for Alpha Wave Global, Global Infrastructure Partners, Stonepeak, Haun Ventures, Brookfield Infrastructure Partners, KKR, and General Atlantic.
4. Approve decision-architecture completion for Public Investment Fund so the only retained account is not left structurally under-mapped.
