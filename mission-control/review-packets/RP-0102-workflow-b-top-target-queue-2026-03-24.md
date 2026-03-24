# RP-0102 — Workflow B Top Target Queue — 2026-03-24

## Observations
- Top-10 ranking rotated materially: new entries now include ALPHA_WAVE, GIP, STONEPEAK, HAUN, KKR, GENERAL_ATLANTIC.
- Decision-architecture coverage is absent for 8/10 top buyers (ALPHA_WAVE, GIP, STONEPEAK, HAUN, KKR, GENERAL_ATLANTIC, PIF, TEMASEK).
- High-influence/no-path gaps persist in top-ranked set:
  - USVI-RECOVERY-AUTHORITY: HUD / FEMA oversight bodies
  - TAFF: Tariq Al Futtaim
- Warming/blocked recency SLA breach (>14d) remains active:
  - TAFF `PATH-TAFF-FAISAL-NET-001` (Warming, ~18.6d)
- Additional recency pressure (>21d) remains:
  - PIF `PATH-PIF-001` (Ready, ~25.5d)
- Top-10 metadata quality remains degraded: all 10 miss core fields (`hq`, `region`, `buyer_role`, `buyer_class`), and PIF/TEMASEK also miss `hq_country`.

## Assumptions
- Local snapshots are authoritative for this run: `dashboard/data/buyers.json`, `dashboard/data/decision_architecture.json`, `dashboard/data/contact_paths.json`.
- No external CRM/API writes were performed.
- Missing person-linked path evidence means no executable outreach lane for that stakeholder.

## Top 10 Accounts to Touch + Why Now
1. **ALPHA_WAVE** — Priority 10 (Urgency 3 / Fit 2 / Staleness 5)
   - Why now: newly top-ranked with zero decision architecture and zero contact paths.
   - Recommended next touch: create baseline sponsor/operator map and open first dated path.
2. **GIP** — Priority 10 (Urgency 3 / Fit 2 / Staleness 5)
   - Why now: top-rank entry with no DA and no path execution lane.
   - Recommended next touch: define high-influence buyer lane and assign first-touch owner/date.
3. **STONEPEAK** — Priority 10 (Urgency 3 / Fit 2 / Staleness 5)
   - Why now: high-priority account currently has no mapped access architecture.
   - Recommended next touch: add minimum DA (decision sponsor + operator) and first path record.
4. **HAUN** — Priority 10 (Urgency 3 / Fit 2 / Staleness 5)
   - Why now: entered top cohort without DA/path coverage.
   - Recommended next touch: seed initial DA rows and log first outreach path with a concrete ask.
5. **KKR** — Priority 10 (Urgency 3 / Fit 2 / Staleness 5)
   - Why now: no DA and no path despite top-10 ranking.
   - Recommended next touch: establish named stakeholder map and open first executable lane.
6. **GENERAL_ATLANTIC** — Priority 10 (Urgency 3 / Fit 2 / Staleness 5)
   - Why now: top-10 placement with zero architecture/path readiness.
   - Recommended next touch: add DA baseline and create first path tied to current initiative hypothesis.
7. **TEMASEK** — Priority 10 (Urgency 3 / Fit 2 / Staleness 5)
   - Why now: no DA/path plus metadata drift, despite strategic ranking.
   - Recommended next touch: normalize metadata + establish first decision map and dated path.
8. **PIF** — Priority 10 (Urgency 3 / Fit 2 / Staleness 5)
   - Why now: no DA coverage and ready path has gone stale beyond 21-day recency threshold.
   - Recommended next touch: refresh `PATH-PIF-001` and add DA entries linked to active initiatives.
9. **TAFF** — Priority 10 (Urgency 4 / Fit 2 / Staleness 4)
   - Why now: named high-influence stakeholder lacks path mapping and warming lane is stale >14 days.
   - Recommended next touch: add direct path for Tariq Al Futtaim and convert/replace stale warming lane.
10. **USVI-RECOVERY-AUTHORITY** — Priority 10 (Urgency 4 / Fit 2 / Staleness 4)
   - Why now: top-ranked account retains high-influence oversight gap (HUD/FEMA) without direct path.
   - Recommended next touch: add named federal-oversight path with owner, channel, and next-touch date.

## Recommendations
- Run a **new-top-cohort onboarding sprint** for ALPHA_WAVE/GIP/STONEPEAK/HAUN/KKR/GENERAL_ATLANTIC (DA baseline + first path).
- Enforce a **named high-influence path rule** for TAFF and USVI oversight stakeholders.
- Execute a **recency refresh pass** for stale path items (`PATH-TAFF-FAISAL-NET-001`, `PATH-PIF-001`).
- Apply a **top-10 metadata normalization batch** before next scoring pass.

## Next Actions (for Isaac approval)
1. Approve one-cycle DA + first-path onboarding for the six new top-cohort buyers.
2. Approve named-path remediation for TAFF and USVI high-influence stakeholders.
3. Approve immediate recency-refresh touches for TAFF and PIF stale lanes.
4. Approve top-10 metadata normalization (`hq/hq_country/region/buyer_role/buyer_class`) before next Workflow B run.
