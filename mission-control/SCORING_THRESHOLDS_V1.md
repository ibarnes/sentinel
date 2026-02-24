# Scoring Thresholds v1
Date: 2026-02-24
Owner: Sentinel
Timezone: America/New_York

This document defines scoring logic for:
- Workflow A — Buyer/Pressure Monitor
- Workflow B — Salesforce Hygiene + Target Queue

---

## Workflow A — Buyer/Pressure Monitor

### A1) Signal Type Weights (Base)
- Capital allocation / committed fund launch / strategy expansion: **5**
- New mandate award / exclusive process entry: **5**
- Major infra announcement with direct buyer relevance: **4**
- Leadership change in investment team / platform head: **3**
- Partnership/JV/consortium participation: **3**
- Public commentary without concrete action: **1**

### A2) Materiality Multiplier
- Global / flagship-scale impact: **x1.5**
- Regional / platform-level impact: **x1.2**
- Niche / exploratory impact: **x1.0**

### A3) Recency Multiplier
- 0–3 days: **x1.3**
- 4–7 days: **x1.15**
- 8–14 days: **x1.0**
- 15+ days: **x0.8**

### A4) Confidence Multiplier (source quality)
- High confidence (official filings/press releases/primary statements): **x1.2**
- Medium confidence (credible secondary source): **x1.0**
- Low confidence (single weak source/rumor): **x0.7**

### A5) Final Score
**Signal Score = Base Weight × Materiality × Recency × Confidence**

### A6) Threshold Bands
- **Critical (>=8.0):** Must appear at top of Morning Brief with explicit action recommendation.
- **Elevated (5.5–7.9):** Include in Pressure Surface Changes with “why now.”
- **Watch (3.0–5.4):** Include only if trend-reinforcing or repeated.
- **Noise (<3.0):** Log internally; do not surface unless requested.

### A7) Daily Output Rules
- For each shortlist entity, provide either:
  - at least one scored signal, or
  - “No material change.”
- Max 5 surfaced signals/day to keep briefing focused.

---

## Workflow B — Salesforce Hygiene + Target Queue

### B1) Component Scores (0–5 each)
1. **Urgency (0–5)**
   - 5: Active deal window / near-term catalyst / immediate follow-up needed
   - 4: Strong timing signal within 1–2 weeks
   - 3: Moderate timing signal this month
   - 2: Possible action but low immediacy
   - 1: No timing pressure
   - 0: Dormant

2. **Buyer Fit (0–5)**
   - 5: Strong mandate and historical fit
   - 4: Good strategic fit with minor gaps
   - 3: Partial fit, needs qualification
   - 2: Weak fit
   - 1: Poor fit
   - 0: Not a target

3. **Staleness Penalty (0–5)**
   - 5: No meaningful update for >60 days
   - 4: 45–60 days stale
   - 3: 30–44 days stale
   - 2: 21–29 days stale
   - 1: 14–20 days stale
   - 0: <14 days fresh

4. **Data Hygiene Penalty (0–5)**
   - 5: Critical fields missing (owner/stage/next step/date)
   - 3: Non-critical but important fields missing
   - 1: Minor hygiene issues
   - 0: Complete

### B2) Weighted Priority Formula
**Priority Score = (Urgency × 0.35) + (Buyer Fit × 0.30) + (Staleness × 0.20) + (Data Hygiene × 0.15)**

Normalized to 0–5.

### B3) Queue Bands
- **Tier 1 (>=4.0):** Must be in Top 10 queue unless excluded with reason.
- **Tier 2 (3.2–3.9):** Include as secondary touch candidates.
- **Tier 3 (2.4–3.1):** Monitor / improve hygiene before outreach.
- **Tier 4 (<2.4):** Deprioritize for now.

### B4) Top 10 Construction Rules
- Include exactly 10 accounts when available.
- Each row must include:
  - Account name
  - Priority score
  - Primary driver (urgency/fit/staleness/hygiene)
  - “Why now” sentence
  - Recommended next touch
- If fewer than 10 qualify, list all and state the gap reason.

---

## Governance
- These are v1 thresholds and should be reviewed after 7 operating days.
- Any overrides must be documented in the day’s review packet.
