# RP-0106 — Workflow B Top Target Queue — 2026-03-25

## Observations
- Top-10 buyer ranking remains: USVI-RECOVERY-AUTHORITY, ALPHA_WAVE, GIP, STONEPEAK, HAUN, KKR, TAFF, GENERAL_ATLANTIC, PIF, TEMASEK.
- Decision-architecture coverage is still missing for 8/10 top buyers (ALPHA_WAVE, GIP, STONEPEAK, HAUN, KKR, GENERAL_ATLANTIC, PIF, TEMASEK).
- High-influence/no-path gap in top set persists at least for:
  - TAFF: Tariq Al Futtaim (high influence, no direct named path row).
- Contact-path SLA breach (>14d, Blocked/Warming) still present:
  - TAFF `PATH-TAFF-FAISAL-NET-001` (Warming, stale >14d).
- Additional recency pressure (>21d) remains on a top buyer:
  - PIF `PATH-PIF-001` (Ready, stale >21d).
- Top-10 metadata quality remains degraded: core fields (`hq`, `region`, `buyer_role`, `buyer_class`) are missing across the ranked cohort.
- Signal pressure still maps new high-impact context to top-cohort buyers (ALPHA_WAVE, GIP, KKR, STONEPEAK, GENERAL_ATLANTIC, HAUN), increasing urgency to establish executable access paths.

## Assumptions
- This run uses local authoritative snapshots only: `dashboard/data/buyers.json`, `dashboard/data/decision_architecture.json`, `dashboard/data/contact_paths.json`, `mission-control/signal-pressure/out/pressure-delta.json`.
- No external CRM mutations or outbound comms were executed.
- Missing decision-architecture or named path entries are treated as execution blockers for buyer access conversion.

## Top 10 Accounts to Touch + Why Now
1. **ALPHA_WAVE** — Priority 10 (Urgency 4 / Buyer Fit 2 / Staleness 4)
   - Why now: top-ranked with zero decision architecture and no contact path; now tied to fresh high-impact signal pressure.
   - Recommended next touch: create baseline decision map + first dated path with owner and ask.
2. **GIP** — Priority 10 (Urgency 4 / Buyer Fit 2 / Staleness 4)
   - Why now: top-ranked, no DA/path, and mapped in current high-impact signal context.
   - Recommended next touch: add decision sponsor/operator records and open first executable lane.
3. **STONEPEAK** — Priority 10 (Urgency 4 / Buyer Fit 2 / Staleness 4)
   - Why now: ranked in top cohort without DA/path; signal pressure context increased.
   - Recommended next touch: seed DA minimum viable map and first path entry with next-touch date.
4. **HAUN** — Priority 10 (Urgency 4 / Buyer Fit 2 / Staleness 4)
   - Why now: no architecture or access lane despite top-10 placement.
   - Recommended next touch: add high-influence actor row + first contact-path with concrete ask.
5. **KKR** — Priority 10 (Urgency 4 / Buyer Fit 2 / Staleness 4)
   - Why now: top-ranked account still has zero DA/path coverage.
   - Recommended next touch: establish named stakeholder map and first routed approach path.
6. **GENERAL_ATLANTIC** — Priority 10 (Urgency 4 / Buyer Fit 2 / Staleness 4)
   - Why now: remains top-ranked without DA/path readiness.
   - Recommended next touch: add DA baseline + first path aligned to active initiative hypothesis.
7. **TEMASEK** — Priority 10 (Urgency 3 / Buyer Fit 2 / Staleness 5)
   - Why now: no DA/path plus metadata drift in ranked cohort.
   - Recommended next touch: normalize metadata and open first executable contact lane.
8. **PIF** — Priority 10 (Urgency 3 / Buyer Fit 2 / Staleness 5)
   - Why now: no DA and path recency drift beyond 21 days.
   - Recommended next touch: refresh `PATH-PIF-001` immediately and attach DA entries to active initiatives.
9. **TAFF** — Priority 10 (Urgency 4 / Buyer Fit 2 / Staleness 4)
   - Why now: warming path is stale >14 days and high-influence principal path gap remains.
   - Recommended next touch: add direct Tariq path row and either reactivate or replace stale warming lane.
10. **USVI-RECOVERY-AUTHORITY** — Priority 9 (Urgency 3 / Buyer Fit 2 / Staleness 4)
   - Why now: top-ranked and path set exists, but metadata quality drift still weakens graph reliability.
   - Recommended next touch: metadata normalization + confirm dated next-touch cadence on current federal oversight lane.

## Recommendations
- Execute a **top-cohort access onboarding sprint** for ALPHA_WAVE, GIP, STONEPEAK, HAUN, KKR, GENERAL_ATLANTIC (DA baseline + first path in same cycle).
- Run a **stale-lane remediation pass** for TAFF and PIF with dated next-touch updates.
- Apply a **top-10 metadata normalization batch** before next ranking pass.
- Enforce a **named high-influence path requirement** so all High influence actors have explicit executable lanes.

## Next Actions (for Isaac approval)
1. Approve one-cycle onboarding for the six top-cohort buyers lacking DA/path.
2. Approve immediate TAFF and PIF path refresh with dated follow-up ownership.
3. Approve metadata normalization (`hq`, `region`, `buyer_role`, `buyer_class`, and `hq_country` where missing) for top-10 buyers.
4. Approve high-influence path rule enforcement across ranked buyers before next Workflow B run.
