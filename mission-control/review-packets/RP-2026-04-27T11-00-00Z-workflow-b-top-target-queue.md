# Workflow B Top Target Queue — 2026-04-27

## Observations
- Top-10 buyer ranking currently is: ADQ, ALPHA_WAVE, GENERAL_ATLANTIC, GIP, HAUN, KKR, STONEPEAK, TAFF, USVI-RECOVERY-AUTHORITY, PIF.
- Decision-architecture coverage remains missing for 8/10 top buyers.
- Contact-path SLA breach (>14d, Blocked/Warming) present:
  - TAFF PATH-TAFF-FAISAL-NET-001 (Warming, stale ~52.6d).
  - USVI-RECOVERY-AUTHORITY PATH-USVI-FED-001 (Warming, stale ~30.0d).
- Top-cohort metadata quality remains degraded for 10/10 ranked records (missing hq_country/region/buyer_role/buyer_class).
- Signal-pressure delta: new_high_impact_count=0 (generated_at 2026-04-27T09:11:01.081Z).

## Assumptions
- This run uses local authoritative snapshots only: `dashboard/data/buyers.json`, `dashboard/data/decision_architecture.json`, `dashboard/data/contact_paths.json`, `mission-control/signal-pressure/out/pressure-delta.json`.
- No external CRM writes or outbound account touches were executed in this workflow run.
- Missing decision architecture and stale paths are treated as immediate conversion blockers for outreach planning.

## Top 10 Accounts to Touch + Why Now
1. **ADQ** — Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: missing decision architecture; no mapped access path; metadata drift.
   - Recommended next touch: Create DA baseline (economic + technical owner) and open first dated access path.
2. **ALPHA_WAVE** — Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: missing decision architecture; no mapped access path; metadata drift.
   - Recommended next touch: Create DA baseline (economic + technical owner) and open first dated access path.
3. **GENERAL_ATLANTIC** — Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: missing decision architecture; no mapped access path; metadata drift.
   - Recommended next touch: Create DA baseline (economic + technical owner) and open first dated access path.
4. **GIP** — Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: missing decision architecture; no mapped access path; metadata drift.
   - Recommended next touch: Create DA baseline (economic + technical owner) and open first dated access path.
5. **HAUN** — Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: missing decision architecture; no mapped access path; metadata drift.
   - Recommended next touch: Create DA baseline (economic + technical owner) and open first dated access path.
6. **KKR** — Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: missing decision architecture; no mapped access path; metadata drift.
   - Recommended next touch: Create DA baseline (economic + technical owner) and open first dated access path.
7. **STONEPEAK** — Priority 11 (Urgency 4 / Buyer Fit 2 / Staleness 5)
   - Why now: missing decision architecture; no mapped access path; metadata drift.
   - Recommended next touch: Create DA baseline (economic + technical owner) and open first dated access path.
8. **TAFF** — Priority 10 (Urgency 4 / Buyer Fit 2 / Staleness 4)
   - Why now: stale blocked/warming contact path >14d; metadata drift.
   - Recommended next touch: Replace or reactivate stale path with owner, timestamp, and specific ask.
9. **USVI-RECOVERY-AUTHORITY** — Priority 10 (Urgency 4 / Buyer Fit 2 / Staleness 4)
   - Why now: stale blocked/warming contact path >14d; metadata drift.
   - Recommended next touch: Replace or reactivate stale path with owner, timestamp, and specific ask.
10. **PIF** — Priority 8 (Urgency 4 / Buyer Fit 2 / Staleness 2)
   - Why now: missing decision architecture; metadata drift.
   - Recommended next touch: Create DA baseline (economic + technical owner) and open first dated access path.

## Recommendations
- Run top-cohort DA + first-path sprint for any pathless ranked buyers in one cycle.
- Execute stale-lane remediation immediately for any top-ranked buyer with >14d warming/blocked paths.
- Normalize ranked buyer metadata fields (`hq_country`, `region`, `buyer_role`, `buyer_class`) before next Workflow B run.
- Keep hard rule: no top-ranked buyer stays pathless across consecutive daily cycles.

## Next Actions (for Isaac approval)
1. Approve one-cycle onboarding for pathless top-ranked buyers (DA baseline + first access path).
2. Approve immediate stale-path remediation for any warming/blocked lanes older than 14 days.
3. Approve metadata normalization batch for top-10 ranked buyers.
4. Approve daily enforcement check to escalate any top-ranked buyer still missing DA/path after cycle close.
