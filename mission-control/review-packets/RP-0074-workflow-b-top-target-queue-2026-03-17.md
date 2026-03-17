# RP-0074 — Workflow B Top Target Queue — 2026-03-17

## Observations
- CRM hygiene remains structurally degraded across the top-ranked buyer set: all top-10 buyers are missing core metadata fields (`hq`, `region`, `buyer_role`, `buyer_class`).
- Decision-architecture coverage is still absent for 8/10 top buyers (PIF, TEMASEK, ADQ, AFC, MUBADALA, WORLDBANK, QIA, AfDB).
- Contact-path recency remains weak for multiple top buyers (no recent touch evidence captured), with known warming-path drag still present.

## Assumptions
- Isaac-approved local snapshots (`buyers.json`, `decision_architecture.json`, `contact_paths.json`) are the operating source for this run.
- Missing recency data implies staleness risk until proven otherwise.
- No external CRM/API pull is authorized in this run.

## Top 10 Accounts to Touch + Why Now
1. **TEMASEK** — Priority 10 (Urgency 3 / Fit 2 / Staleness 5)
   - Why now: no decision-architecture mapping + no captured touch recency + metadata drift.
   - Recommended next touch: create minimum decision architecture (1 high-influence + 1 operator) and open first path.
2. **ADQ** — Priority 10
   - Why now: same structural gap profile as TEMASEK; currently unmapped in decision architecture.
   - Recommended next touch: map sponsor/operator pair and log first contact path with owner/date.
3. **MUBADALA** — Priority 10
   - Why now: top-ranked buyer with no decision architecture and stale/no-path recency evidence.
   - Recommended next touch: establish first path and attach mandate hypothesis to contact plan.
4. **DFC** — Priority 10
   - Why now: high-influence roles exist with incomplete path quality; metadata still missing.
   - Recommended next touch: route a direct path refresh for high-influence personas and timestamp latest touch.
5. **WORLDBANK** — Priority 10
   - Why now: no decision architecture despite active signal relevance; metadata drift unresolved.
   - Recommended next touch: map counterpart structure and define one actionable access path.
6. **QIA** — Priority 10
   - Why now: no decision architecture + no recent path evidence in top-10 context.
   - Recommended next touch: seed minimal decision map and assign owner for first-touch sequence.
7. **AfDB** — Priority 10
   - Why now: no decision architecture coverage and metadata incompleteness in top-ranked set.
   - Recommended next touch: map influence structure and record first path with next-step date.
8. **PIF** — Priority 9
   - Why now: no decision architecture and stale recency (~18d).
   - Recommended next touch: refresh active path and add decision-architecture entries tied to current initiatives.
9. **AFC** — Priority 9
   - Why now: no decision architecture and stale recency (~19d).
   - Recommended next touch: create decision architecture baseline and execute a dated re-engagement touch.
10. **TAFF** — Priority 5
   - Why now: active warming state present; still missing metadata fields.
   - Recommended next touch: move warming path to active with concrete ask and complete metadata fields.

## Recommendations
- Run a **metadata correction sprint** for top-10 buyers first (hq/region/role/class), then re-score.
- Execute a **decision-architecture minimum baseline** (at least one high-influence and one execution operator) for all uncovered top buyers this cycle.
- Enforce a **recency SLA**: no top-10 path older than 14 days without explicit blocker note.

## Next Actions (for Isaac approval)
1. Approve metadata normalization for top-10 buyers as a same-day hygiene batch.
2. Approve decision-architecture baseline mapping for the 8 uncovered top buyers.
3. Approve path reactivation touches for PIF/AFC/TAFF with logged owner + due date.
