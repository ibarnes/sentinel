# Workflow B Top Target Queue - 2026-06-19

## Observations
- Top-10 buyer ranking for this run resolves from `dashboard/data/buyers.json` to: Public Investment Fund, Gulf Investment Corporation, Africa Finance Corporation, Nigeria Sovereign Investment Authority, Federal Ministry of Finance (Nigeria), Abu Dhabi Fund for Development, Saudi Fund for Development, African Development Bank, International Finance Corporation, and Mubadala Investment Company.
- Decision-architecture coverage is missing for 10/10 ranked buyers; none of the current top-10 buyer IDs appear in `dashboard/data/decision_architecture.json`.
- Contact-path coverage is still missing for 7/10 ranked buyers; only Public Investment Fund, Africa Finance Corporation, and Nigeria Sovereign Investment Authority currently carry any mapped path coverage.
- One ranked buyer already has a stale warming lane: Nigeria Sovereign Investment Authority still carries `PATH-NSIA-001` in `Warming` status, last touched `2026-02-25`, which is now roughly 114 days old.
- Ranked-record metadata quality remains degraded for 10/10 buyers because every current top-10 record is missing `region`, `buyer_role`, `buyer_class`, and `hq_country`.
- Signal-pressure delta was refreshed successfully at `2026-06-19T11:02:31.339Z` with `new_high_impact_count=0` and `new_signal_count=0`, so the queue remains driven by graph-quality and access-readiness gaps rather than a new event spike.

## Assumptions
- This run uses local snapshots only: `dashboard/data/buyers.json`, `dashboard/data/decision_architecture.json`, `dashboard/data/contact_paths.json`, and the refreshed `mission-control/signal-pressure/out/pressure-delta.json`.
- No external CRM writes, outbound account touches, or approval-state changes were executed in this run.
- A path with no dated refresh since February or early March is treated as stale even if the stored status is still `Ready` or `Warming`.

## Top 10 Accounts to Touch + Why Now
1. **Public Investment Fund**
   - Why now: it is still the first ranked buyer and the only sovereign in the current top slot with at least one mapped path, but that path is old and there is still no decision-architecture coverage for the actual investment-committee route.
   - Recommended next touch: convert the existing Isaac-owned path into one dated mandate-pathway memo review plus a named investment-committee or sponsor map.
2. **Gulf Investment Corporation**
   - Why now: it sits near the top of the ranked queue with zero decision architecture, zero path coverage, and zero normalized metadata.
   - Recommended next touch: define the GIC investment-committee chain and open one dated co-investment or mandate-qualification route.
3. **Africa Finance Corporation**
   - Why now: AFC remains highly relevant to infrastructure structuring and already has one usable path, but there is still no mapped decision chain behind the AIFF or IC process.
   - Recommended next touch: turn the existing Tyreek lane into a dated scope-alignment step tied to the named AFC preparation or investment owner.
4. **Nigeria Sovereign Investment Authority**
   - Why now: NSIA still has one path on file, but it has been stuck in `Warming` since `2026-02-25` and still lacks any decision-architecture coverage.
   - Recommended next touch: either reactivate or retire `PATH-NSIA-001`, then map the specific sovereign-capital owner chain behind mandate qualification.
5. **Federal Ministry of Finance (Nigeria)**
   - Why now: FMF-NG remains inside the ranked top 10 with no path coverage, no decision map, and no normalized buyer metadata despite direct relevance to infrastructure and fiscal authority lanes.
   - Recommended next touch: define the fiscal decision route and open one dated path into the infrastructure-capital or sovereign coordination seat.
6. **Abu Dhabi Fund for Development**
   - Why now: ADFD stays in the active ranked queue, but the access graph remains entirely blank.
   - Recommended next touch: map the technical-assistance or bilateral development approval chain and open a first dated route into the relevant structuring seat.
7. **Saudi Fund for Development**
   - Why now: SFD remains a live ranked target with no decision architecture, no mapped path, and no usable metadata normalization.
   - Recommended next touch: identify the board or preparation-window route and create one dated path tied to technical-assistance eligibility.
8. **African Development Bank**
   - Why now: AfDB is still structurally relevant to project-preparation and multilateral infrastructure lanes, yet the current access graph is blank for the buyer despite high strategic fit.
   - Recommended next touch: map the PPF or facility-management decision chain and open one dated path into the qualifying owner seat.
9. **International Finance Corporation**
   - Why now: IFC remains in the top 10 with FY26 upstream relevance, but there is still no path coverage or named investment/advisory chain in the graph.
   - Recommended next touch: define the upstream or regional investment path and create one dated route into advisory-scope qualification.
10. **Mubadala Investment Company**
   - Why now: Mubadala still ranks inside the active sovereign stack, but there is no mapped path, no decision architecture, and no verified mandate pathway inside the specific investment platform.
   - Recommended next touch: identify the infrastructure or direct-investments owner chain and open one dated sponsor route tied to pre-FID platform architecture.

## Recommendations
- Execute one-cycle graph hardening for the 7 ranked buyers that still have neither a decision map nor any path coverage.
- Clean up the stale NSIA warming lane before opening lower-priority net-new paths in the Nigeria sovereign lane.
- Normalize `region`, `buyer_role`, `buyer_class`, and `hq_country` for the full top 10 before the next Workflow B run.
- Prioritize access-graph hardening for PIF, GIC, AFC, NSIA, and AfDB because they combine high queue position with the biggest execution-readiness gaps.

## Next Actions (for Isaac approval)
1. Approve one-cycle graph hardening for the current ranked top 10.
2. Approve explicit stale-path cleanup on NSIA before expanding the Nigeria sovereign lane further.
3. Approve metadata normalization for the same top 10 before the next Workflow B run.
