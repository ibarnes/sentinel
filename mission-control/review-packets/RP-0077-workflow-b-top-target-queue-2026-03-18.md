# RP-0077 — Workflow B Top Target Queue — 2026-03-18

## Observations
- Top-10 buyer hygiene remains materially incomplete: all top-10 entries are still missing core metadata fields (`hq`, `region`, `buyer_role`, `buyer_class`).
- Decision-architecture coverage remains absent for 7/10 top buyers (PIF, TEMASEK, ADQ, AFC, MUBADALA, WORLDBANK, QIA).
- Path quality gaps are concentrated in high-influence roles without person-linked access paths:
  - USVI-RECOVERY-AUTHORITY: Adrienne L. Williams-Octalien, Eugene Jones Jr., HUD/FEMA oversight bodies
  - DFC: Ben Black, Conor Coleman
- Recency risk persists where paths exist but are stale: PIF (~19d), AFC (~20d), TAFF (~12d and still in warming posture).

## Assumptions
- Local snapshots (`dashboard/data/buyers.json`, `dashboard/data/decision_architecture.json`, `dashboard/data/contact_paths.json`) are the authorized source of truth for this run.
- Missing path owner/date evidence implies no executable outreach lane.
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
   - Why now: no DA coverage despite active strategic relevance; no path evidence.
   - Recommended next touch: define counterpart map and create one actionable path with next-step timestamp.
5. **QIA** — Priority 10
   - Why now: no DA, no path, full metadata drift.
   - Recommended next touch: seed minimum DA and assign first-touch sequence owner.
6. **DFC** — Priority 10
   - Why now: high-influence stakeholders exist but remain unmapped to person-specific paths.
   - Recommended next touch: add/confirm named access paths for Ben Black and Conor Coleman with channel + owner + date.
7. **USVI-RECOVERY-AUTHORITY** — Priority 10
   - Why now: high-influence roles exist with non-person-linked path records, reducing execution clarity.
   - Recommended next touch: convert generic path rows into named stakeholder paths for core operators.
8. **PIF** — Priority 9
   - Why now: no DA coverage and path recency drift (~19 days).
   - Recommended next touch: refresh path with dated re-engagement and add DA entries linked to current initiatives.
9. **AFC** — Priority 9
   - Why now: no DA coverage and stale path recency (~20 days).
   - Recommended next touch: add DA baseline and execute a logged reactivation touch.
10. **TAFF** — Priority 6
   - Why now: DA now present, but path freshness and warming-state conversion remain unresolved.
   - Recommended next touch: push warming path to active with concrete ask and explicit next action date.

## Recommendations
- Run a **top-10 metadata normalization batch** first; re-score only after required fields are populated.
- Execute a **DA baseline sprint** for the 7 uncovered top buyers in one cycle.
- Enforce a **named-path rule** for high-influence stakeholders (no generic/non-person path rows).
- Apply a **14-day recency SLA** for all top-10 paths with mandatory blocker note if exceeded.

## Next Actions (for Isaac approval)
1. Approve same-day metadata normalization for all top-10 buyers.
2. Approve DA baseline creation for PIF, TEMASEK, ADQ, AFC, MUBADALA, WORLDBANK, and QIA.
3. Approve named-path remediation for USVI and DFC high-influence stakeholders.
4. Approve recency refresh touches for PIF/AFC/TAFF with owner + due date logging.
