# RP-0085 — Workflow B Top Target Queue — 2026-03-20

## Observations
- Top-10 buyer hygiene remains incomplete: all top-10 entries are still missing core metadata fields (`hq`, `region`, `buyer_role`, `buyer_class`).
- Decision-architecture coverage remains absent for 7/10 top buyers (PIF, TEMASEK, ADQ, AFC, MUBADALA, WORLDBANK, QIA).
- High-influence/no-path gaps remain active for top-ranked buyers:
  - DFC: Ben Black, Conor Coleman
  - TAFF: Tariq Al Futtaim
- Recency risk is now fully in breach for warming/blocked lanes over 14 days:
  - NSIA `PATH-NSIA-001` (Warming, ~23.5d)
  - TAFF `PATH-TAFF-FAISAL-NET-001` (Warming, ~14.6d)
- Additional staleness pressure persists on high-priority ready lanes:
  - PIF `PATH-PIF-001` (~21.5d)
  - AFC `PATH-AFC-001` (~22.5d)

## Assumptions
- Local snapshots (`dashboard/data/buyers.json`, `dashboard/data/decision_architecture.json`, `dashboard/data/contact_paths.json`) are the source of truth for this run.
- Missing person-linked path evidence implies no executable outreach lane for that stakeholder.
- No direct external CRM/API access is authorized for this run.

## Top 10 Accounts to Touch + Why Now
1. **TEMASEK** — Priority 10 (Urgency 3 / Fit 2 / Staleness 5)
   - Why now: zero decision architecture + zero contact paths + full metadata drift.
   - Recommended next touch: add minimum influence map (1 high-influence, 1 operator) and open first dated path.
2. **ADQ** — Priority 10
   - Why now: identical structural gap profile (no DA, no path, no metadata).
   - Recommended next touch: map sponsor/operator pair and assign path owner with first-touch date.
3. **MUBADALA** — Priority 10
   - Why now: top-ranked account with no DA coverage and no active access path.
   - Recommended next touch: create baseline DA and log first executable outreach path tied to mandate hypothesis.
4. **WORLDBANK** — Priority 10
   - Why now: no DA coverage despite strategic relevance; no path evidence.
   - Recommended next touch: define counterpart map and create one actionable path with next-step timestamp.
5. **QIA** — Priority 10
   - Why now: no DA, no path, full metadata drift.
   - Recommended next touch: seed minimum DA and assign first-touch sequence owner.
6. **DFC** — Priority 10
   - Why now: high-influence stakeholders remain unmapped to person-specific access paths.
   - Recommended next touch: add named access paths for Ben Black and Conor Coleman with channel + owner + date.
7. **PIF** — Priority 9
   - Why now: no DA coverage and path recency drift now >21 days.
   - Recommended next touch: refresh path with dated re-engagement and add DA entries linked to current initiatives.
8. **AFC** — Priority 9
   - Why now: no DA coverage and path recency drift now >22 days.
   - Recommended next touch: add DA baseline and execute a logged reactivation touch.
9. **TAFF** — Priority 8
   - Why now: named high-influence gap persists and one warming path exceeded 14-day SLA.
   - Recommended next touch: add named high-influence path and either convert warming status to active or replace with a fresh lane.
10. **NSIA** — Priority 8
   - Why now: warming path now >23 days without progression.
   - Recommended next touch: run immediate reactivation or explicit blocker resolution and reset next-touch date.

## Recommendations
- Run a **top-10 metadata normalization batch** first; re-score only after required fields are populated.
- Execute a **DA baseline sprint** for the 7 uncovered top buyers in one cycle.
- Enforce a **named-path rule** for high-influence stakeholders (no generic/non-person path rows).
- Apply a **14-day recency SLA** for all top-10 paths with mandatory blocker note if exceeded.

## Next Actions (for Isaac approval)
1. Approve same-day metadata normalization for all top-10 buyers.
2. Approve DA baseline creation for PIF, TEMASEK, ADQ, AFC, MUBADALA, WORLDBANK, and QIA.
3. Approve named-path remediation for DFC and TAFF high-influence stakeholders.
4. Approve recency refresh touches for NSIA/PIF/AFC/TAFF with owner + due date logging.
