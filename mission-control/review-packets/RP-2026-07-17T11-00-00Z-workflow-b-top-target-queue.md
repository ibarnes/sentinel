# Workflow B Top Target Queue - 2026-07-17

## Observations
- Top-10 buyer ranking for this run resolves from the canonical order in `dashboard/data/buyers.json` to: Public Investment Fund, Gulf Investment Corporation, Africa Finance Corporation, Nigeria Sovereign Investment Authority, Federal Ministry of Finance (Nigeria), Abu Dhabi Fund for Development, Saudi Fund for Development, African Development Bank, International Finance Corporation, and Mubadala Investment Company.
- The ranked set changed materially versus `2026-07-16`: Alpha Wave Global, USVI Recovery Program Authority (ODR + VIHFA), Global Infrastructure Partners, Brookfield Infrastructure Partners L.P., Haun Ventures, Stonepeak, KKR & Co. Inc., General Atlantic, Tariq Al Futtaim Family Foundation (TAFF), and ADQ all dropped out of the current top 10, while PIF, GIC, AFC, NSIA, FMF-NG, ADFD, SFD, AfDB, IFC, and MUBADALA are now the active queue.
- Decision-architecture coverage is missing for 10/10 ranked buyers; none of the current top 10 carry mapped decision roles in `dashboard/data/decision_architecture.json`.
- Contact-path coverage is missing for 7/10 ranked buyers; only Public Investment Fund, Africa Finance Corporation, and Nigeria Sovereign Investment Authority currently carry any path record in `dashboard/data/contact_paths.json`.
- 1 ranked buyer still carries a stale warming lane older than 14 days: Nigeria Sovereign Investment Authority still has `PATH-NSIA-001` in `Warming` status with `last_touch_at=2026-02-25` and `next_touch_at=2026-03-05`, so the path is operationally stale even though its explicit freshness field has not been updated.
- Core buyer profile coverage remains intact for the current ranked set under the live schema: all 10/10 ranked buyers carry `type`, `geo_focus`, `sector_focus`, and `mandate_summary`, so the immediate quality gap is route creation rather than profile completion.
- Signal-pressure freshness was checked before this run; current delta remains `generated_at=2026-07-17T05:41:18.401Z` with `new_high_impact_count=0` and `new_signal_count=0`, so the queue is still driven by access-readiness and graph coverage rather than a new event spike.
- Workflow A context still matters for the Nigeria lane inside this queue: `FMF-NG` lost its recovered dated signal in the 10:30 UTC Workflow A run, which weakens current evidence quality precisely where access coverage is also blank.

## Assumptions
- This run uses local snapshots only: `dashboard/data/buyers.json`, `dashboard/data/decision_architecture.json`, `dashboard/data/contact_paths.json`, and the freshness-checked `mission-control/signal-pressure/out/pressure-delta.json`.
- No external CRM writes, outbound account touches, or approval-state changes were executed in this run.
- Any path with a stale dated touch surface or unresolved next action is treated as operationally stale even when the stored `freshness_days` field is not current.

## Top 10 Accounts to Touch + Why Now
1. **Public Investment Fund** - Score 2.2
   - Why now: it sits first in the current canonical queue and already has one ready path, but there is still no mapped decision route behind the Investment Committee surface.
   - Recommended next touch: convert the existing ready path into a named sponsor chain and capture the first dated IC-adjacent route tied to strategic infrastructure allocation.
2. **Gulf Investment Corporation** - Score 1.8
   - Why now: it is second in the live queue with no decision architecture and no path coverage.
   - Recommended next touch: define the committee and sponsor chain, then open one dated path into the infrastructure co-investment lane.
3. **Africa Finance Corporation** - Score 2.1
   - Why now: it remains a high-relevance Africa infrastructure buyer and already has one ready path, but no decision architecture exists behind the current relationship surface.
   - Recommended next touch: map the project-preparation and investment-committee route, then attach the existing path to one dated bankability conversation.
4. **Nigeria Sovereign Investment Authority** - Score 1.9
   - Why now: it is the only ranked buyer with a clearly stale warming lane, and it still has no mapped decision architecture.
   - Recommended next touch: either reactivate or retire `PATH-NSIA-001`, then replace it with one dated owner path tied to the current Nigeria infrastructure mandate surface.
5. **Federal Ministry of Finance (Nigeria)** - Score 1.8
   - Why now: it remains inside the active queue with no path coverage, and Workflow A just showed evidence regression on the FMF-NG signal surface.
   - Recommended next touch: define the fiscal approval chain and open one dated route into the budget or executive-approval lane before the evidence trail cools further.
6. **Abu Dhabi Fund for Development** - Score 1.8
   - Why now: it is in the current top 10 with zero decision-map and zero path coverage.
   - Recommended next touch: create the first decision route and one dated owner path aligned to development-finance allocation.
7. **Saudi Fund for Development** - Score 1.8
   - Why now: it remains queued without any access graph coverage.
   - Recommended next touch: define the financing authority chain and open one dated route into the relevant program owner.
8. **African Development Bank** - Score 2.0
   - Why now: it stays in the top cohort, but the access graph is still fully blank.
   - Recommended next touch: map the project-preparation and sovereign-coordination decision path, then open one dated entry route.
9. **International Finance Corporation** - Score 1.9
   - Why now: it remains a live institutional buyer with no decision architecture and no path coverage.
   - Recommended next touch: define the infrastructure mobilization route and open one dated path into the PPP or infrastructure sponsor chain.
10. **Mubadala Investment Company** - Score 2.1
   - Why now: it rounds out the current top 10 while still lacking any access-graph coverage.
   - Recommended next touch: identify the strategic capital decision route and open one dated path into the AI or infrastructure allocation lane.

## Recommendations
- Re-baseline Workflow B on the current sovereign and DFI-heavy top 10 before doing more packaging work around the July 16 private-capital cohort.
- Execute one-cycle graph hardening on all 10 ranked buyers because decision-architecture coverage is currently zero across the active queue.
- Clean up the stale NSIA warming lane before opening lower-priority net-new Nigeria routes.
- Treat FMF-NG as the most time-sensitive evidence-plus-access gap because today’s Workflow A run weakened the dated proof surface while path coverage is still blank.

## Next Actions (for Isaac approval)
1. Approve one-cycle decision-architecture mapping for the current top 10 queue.
2. Approve stale-path cleanup and route replacement for NSIA before any new Nigeria-lane packaging.
3. Approve first-pass path creation for GIC, FMF-NG, ADFD, SFD, AfDB, IFC, and MUBADALA so the queue is not blocked by zero-route accounts.
