# Workflow B Top Target Queue - 2026-06-08

## Observations
- Top-10 buyer ranking currently is: Public Investment Fund, Gulf Investment Corporation, Africa Finance Corporation, Nigeria Sovereign Investment Authority, Federal Ministry of Finance (Nigeria), Abu Dhabi Fund for Development, Saudi Fund for Development, African Development Bank, International Finance Corporation, Mubadala Investment Company.
- Decision-architecture coverage is still missing for 10/10 top buyers.
- Contact-path coverage now exists for 3/10 top buyers, but only as thin undated paths: Public Investment Fund and Africa Finance Corporation each have one path in `Ready`, while Nigeria Sovereign Investment Authority has one path in `Warming`; the other 7 buyers remain pathless.
- Top-cohort metadata quality remains degraded for 10/10 ranked records (missing at least one of `hq_country`, `region`, `buyer_role`, or `buyer_class`).
- Signal-pressure delta refreshed at 2026-06-08T11:01:27.588Z with `new_high_impact_count=0` and `new_signal_count=0`; durable signal overlap remains heaviest on Africa Finance Corporation, African Development Bank, International Finance Corporation, Public Investment Fund, Nigeria Sovereign Investment Authority, and Mubadala Investment Company.

## Assumptions
- This run uses local snapshots only: buyers, decision architecture, contact paths, and refreshed signal-pressure delta.
- No external CRM writes or outbound account touches were executed in this run.
- Thin undated contact paths are treated as insufficient operating coverage until they carry dated ownership, status hygiene, and decision-route context.

## Top 10 Accounts to Touch + Why Now
1. **Public Investment Fund** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: sovereign-capital pressure remains high and PIF now has one thin ready-state path, but there is still no decision architecture and no durable dated access route.
   - Recommended next touch: turn the existing PIF path into a dated route with named investment-committee owner, platform sponsor, and next-step timing.
2. **Gulf Investment Corporation** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: cross-border infrastructure relevance is present in the signal register, but GIC still has no decision architecture, no path coverage, and incomplete ranked metadata.
   - Recommended next touch: define the GIC committee path, map one GCC-aligned introducer, and normalize core buyer metadata.
3. **Africa Finance Corporation** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: AFC carries the densest current signal overlap in the top queue and now has one thin ready-state path, yet there is still no decision architecture or dated execution route.
   - Recommended next touch: build the AFC project-preparation decision map and convert the current path into one dated route into AIFF or adjacent project-preparation leadership.
4. **Nigeria Sovereign Investment Authority** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: NSIA remains pressure-linked to Nigeria infrastructure and balance-sheet signals, but its only mapped path is still warming and the account is still DA-empty and metadata-incomplete.
   - Recommended next touch: define NSIA board and infrastructure-fund decision roles, then upgrade the warming path into one dated sovereign co-development route.
5. **Federal Ministry of Finance (Nigeria)** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: fiscal-authority relevance remains high against Nigeria financing pressure, but there is still no decision architecture, no access path, and no ranked metadata baseline.
   - Recommended next touch: map executive and budget approval owners and open one dated path tied to infrastructure allocation authority.
6. **Abu Dhabi Fund for Development** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: bilateral-development relevance persists, but ADFD is still missing decision architecture, path coverage, and normalized ranked metadata.
   - Recommended next touch: establish the ADFD board and preparation-window owner map, then create one dated bilateral-introducer path.
7. **Saudi Fund for Development** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: SFD still lacks a usable decision map, a live access path, and complete ranked metadata despite staying inside the Gulf development-capital lane.
   - Recommended next touch: define the SFD approval route and open one dated path through a Saudi development-finance introducer.
8. **African Development Bank** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: AfDB remains heavily represented in the live signal register, but there is still no decision architecture or mapped access path in the access graph.
   - Recommended next touch: build the AfDB project-preparation and approval map, then open one dated path into the relevant PPF or infrastructure leadership node.
9. **International Finance Corporation** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: IFC remains signal-dense and strategically aligned, but the access graph still has zero decision-architecture or path coverage.
   - Recommended next touch: map the IFC upstream and advisory ownership chain and open one dated path into the relevant regional investment or upstream lead.
10. **Mubadala Investment Company** - Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: Mubadala remains strongly represented in the durable signal register, but the account is still DA-empty, pathless, and metadata-incomplete.
   - Recommended next touch: define the direct-investments platform owner path and open one dated sovereign-aligned introducer route.

## Recommendations
- Execute a top-10 access-graph foundation sprint focused first on converting the three existing thin paths into dated, owned routes and creating a first path for the other seven buyers.
- Build one decision-architecture baseline per ranked buyer before the next Workflow B cycle; path coverage without decision-route clarity will not be enough to sequence outreach.
- Normalize ranked buyer metadata fields `hq_country`, `region`, `buyer_role`, and `buyer_class` for all 10 buyers before any outreach sequencing.
- Start with AFC, AfDB, IFC, PIF, NSIA, and Mubadala because they combine the heaviest durable pressure overlap with the weakest usable access-graph coverage.

## Next Actions (for Isaac approval)
1. Approve a one-cycle access-graph foundation sprint for the current top 10 ranked buyers.
2. Approve upgrading the existing PIF, AFC, and NSIA paths into dated owned routes before opening net-new lower-priority paths.
3. Approve metadata normalization for the same top 10 before the next Workflow B run.

