# Workflow B Top Target Queue - 2026-07-22

## Observations
- Top-10 buyer ranking for this run resolves from the canonical order in `dashboard/data/buyers.json` to: Public Investment Fund, Gulf Investment Corporation, Africa Finance Corporation, Nigeria Sovereign Investment Authority, Federal Ministry of Finance (Nigeria), Abu Dhabi Fund for Development, Saudi Fund for Development, African Development Bank, International Finance Corporation, and Mubadala Investment Company.
- The ranked set is unchanged versus Tuesday, July 21, 2026; no new entrant displaced the current sovereign and DFI-heavy top 10 queue.
- Decision-architecture coverage is still missing for 10/10 ranked buyers; none of the current top 10 carry mapped decision roles in `dashboard/data/decision_architecture.json`.
- Contact-path coverage is still missing for 7/10 ranked buyers; only Public Investment Fund, Africa Finance Corporation, and Nigeria Sovereign Investment Authority currently carry any path record in `dashboard/data/contact_paths.json`.
- 1 ranked buyer still carries a stale warming lane older than 14 days: Nigeria Sovereign Investment Authority still has `PATH-NSIA-001` in `Warming` status with `last_touch_at=2026-02-25` and `next_touch_at=2026-03-05`, so the path is now about 147 days stale and still unresolved.
- Core buyer profile coverage remains intact for the current ranked set under the live schema: all 10/10 ranked buyers carry `type`, `geo_focus`, `sector_focus`, and `mandate_summary`, so the immediate quality gap is route creation rather than profile completion.
- Signal-pressure freshness was checked before this run; current delta is still the 2026-07-22 06:11:42.809 UTC snapshot in `mission-control/signal-pressure/out/pressure-delta.json` with `new_high_impact_count=0` and `new_signal_count=0`, so the queue is still driven by access-readiness and graph coverage rather than a new event spike.
- Workflow A no longer held flat on the buyer evidence surface before this packet: the 10:30 UTC run regressed `FMF-NG` from Tuesday, July 21, 2026's recovered `fetchStatus=OK` row to `fetchStatus=HTTP_404`, with `date`, `capitalAmount`, `mandateLanguage`, and `leadershipStatement` all falling back to `MISSING`, so the FMF-NG lane is now a combined evidence-and-access failure rather than a pure access-creation gap.

## Assumptions
- This run uses local snapshots only: `dashboard/data/buyers.json`, `dashboard/data/decision_architecture.json`, `dashboard/data/contact_paths.json`, the freshness-checked `mission-control/signal-pressure/out/pressure-delta.json`, and the latest 10:30 UTC Workflow A artifact.
- No external CRM writes, outbound account touches, or approval-state changes were executed in this run.
- Any path with a stale dated touch surface or unresolved next action is treated as operationally stale even when the stored `freshness_days` field is not current.

## Top 10 Accounts to Touch + Why Now
1. **Public Investment Fund** - Score 2.2
   - Why now: it still sits first in the canonical queue, and there is still no mapped decision architecture.
   - Recommended next touch: convert the existing ready path into a named sponsor chain and capture the first dated IC-adjacent route tied to strategic infrastructure allocation.
2. **Gulf Investment Corporation** - Score 1.8
   - Why now: there is still no mapped decision architecture, and path coverage is still zero.
   - Recommended next touch: define the committee and sponsor chain, then open one dated path into the infrastructure co-investment lane.
3. **Africa Finance Corporation** - Score 2.1
   - Why now: there is still no mapped decision architecture.
   - Recommended next touch: map the project-preparation and investment-committee route, then attach the existing path to one dated bankability conversation.
4. **Nigeria Sovereign Investment Authority** - Score 1.9
   - Why now: there is still no mapped decision architecture, and its only active route is now stale in `Warming` status.
   - Recommended next touch: either reactivate or retire `PATH-NSIA-001`, then replace it with one dated owner path tied to the current Nigeria infrastructure mandate surface.
5. **Federal Ministry of Finance (Nigeria)** - Score 1.8
   - Why now: there is still no mapped decision architecture, path coverage is still zero, and Workflow A has now regressed the buyer evidence row into a 404-backed missing-data surface, so both proof quality and access creation are open risks again.
   - Recommended next touch: repair the source/evidence chain first, then define the fiscal approval chain and open one dated route into the budget or executive-approval lane once the mandate evidence surface is trustworthy again.
6. **Abu Dhabi Fund for Development** - Score 1.8
   - Why now: there is still no mapped decision architecture, and path coverage is still zero.
   - Recommended next touch: create the first decision route and one dated owner path aligned to development-finance allocation.
7. **Saudi Fund for Development** - Score 1.8
   - Why now: there is still no mapped decision architecture, and path coverage is still zero.
   - Recommended next touch: define the financing authority chain and open one dated route into the relevant program owner.
8. **African Development Bank** - Score 2
   - Why now: there is still no mapped decision architecture, and path coverage is still zero.
   - Recommended next touch: map the project-preparation and sovereign-coordination decision path, then open one dated entry route.
9. **International Finance Corporation** - Score 1.9
   - Why now: there is still no mapped decision architecture, and path coverage is still zero.
   - Recommended next touch: define the infrastructure mobilization route and open one dated path into the PPP or infrastructure sponsor chain.
10. **Mubadala Investment Company** - Score 2.1
   - Why now: there is still no mapped decision architecture, and path coverage is still zero.
   - Recommended next touch: identify the strategic capital decision route and open one dated path into the AI or infrastructure allocation lane.

## Recommendations
- Keep Workflow B re-baselined on the current sovereign and DFI-heavy top 10; no ranked-set churn justifies reopening the prior private-capital packet shape.
- Execute one-cycle graph hardening on all 10 ranked buyers because decision-architecture coverage is still zero across the active queue.
- Clean up the stale NSIA warming lane before opening lower-priority net-new Nigeria routes.
- Treat FMF-NG as the sharpest combined risk in the queue until the evidence surface is repaired and the first path is created.

## Next Actions (for Isaac approval)
1. Approve one-cycle decision-architecture mapping for the current top 10 queue.
2. Approve stale-path cleanup and route replacement for NSIA before any new Nigeria-lane packaging.
3. Approve FMF-NG evidence repair plus first-pass path creation so the Nigeria lane is not carried forward on a broken proof surface.
4. Approve first-pass path creation for GIC, ADFD, SFD, AfDB, IFC, and MUBADALA so the queue is not blocked by zero-route accounts.
