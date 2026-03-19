# RP-0081 — Workflow B Top Target Queue — 2026-03-19

## Observations
- Top-10 buyer hygiene remains incomplete: all top-10 entries are still missing core metadata fields (`hq`, `region`, `buyer_role`, `buyer_class`).
- Decision-architecture coverage remains absent for 7/10 top buyers (PIF, TEMASEK, ADQ, AFC, MUBADALA, WORLDBANK, QIA).
- High-influence/no-path gaps remain active for top-ranked buyers:
  - DFC: Ben Black, Conor Coleman
  - TAFF: Tariq Al Futtaim
  - USVI-RECOVERY-AUTHORITY: HUD / FEMA oversight bodies
- Recency risk persists where paths exist but are stale: PIF (~20d), AFC (~21d), TAFF (~13d, still warming).

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
7. **USVI-RECOVERY-AUTHORITY** — Priority 9
   - Why now: high-influence oversight role remains without a person-linked path record.
   - Recommended next touch: convert generic oversight lane into named stakeholder path with accountable owner.
8. **PIF** — Priority 9
   - Why now: no DA coverage and path recency drift (~20 days).
   - Recommended next touch: refresh path with dated re-engagement and add DA entries linked to current initiatives.
9. **AFC** — Priority 9
   - Why now: no DA coverage and stale path recency (~21 days).
   - Recommended next touch: add DA baseline and execute a logged reactivation touch.
10. **TAFF** — Priority 7
   - Why now: DA exists but includes a high-influence/no-path gap (Tariq Al Futtaim) and path remains warming/stale.
   - Recommended next touch: add named high-influence path and convert warming status to active with explicit next action date.

## Recommendations
- Run a **top-10 metadata normalization batch** first; re-score only after required fields are populated.
- Execute a **DA baseline sprint** for the 7 uncovered top buyers in one cycle.
- Enforce a **named-path rule** for high-influence stakeholders (no generic/non-person path rows).
- Apply a **14-day recency SLA** for all top-10 paths with mandatory blocker note if exceeded.

## Next Actions (for Isaac approval)
1. Approve same-day metadata normalization for all top-10 buyers.
2. Approve DA baseline creation for PIF, TEMASEK, ADQ, AFC, MUBADALA, WORLDBANK, and QIA.
3. Approve named-path remediation for DFC, TAFF, and USVI high-influence stakeholders.
4. Approve recency refresh touches for PIF/AFC/TAFF with owner + due date logging.
