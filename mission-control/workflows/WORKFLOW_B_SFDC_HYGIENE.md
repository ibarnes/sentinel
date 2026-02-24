# Workflow B — Salesforce Hygiene + Target Queue
Schedule: Daily 07:00 ET (with weekly hygiene rollup)
Output: Review Packet — "Top 10 Accounts to Touch + why"

## Goal
Turn CRM data into a living radar with prioritized outreach targets.

## Inputs
- Isaac-approved CRM exports/snapshots (no direct external account access unless approved).

## Process
1. Check hygiene fields completeness.
2. Flag weak buyer fit.
3. Flag stale notes/opportunities.
4. Rank top 10 accounts by urgency + fit + recency gap.
5. Produce review packet with account-by-account rationale.

## Scoring (Draft)
- Urgency: 0–5
- Buyer Fit: 0–5
- Staleness Penalty: 0–5
- Priority Score = Urgency + Buyer Fit + Staleness Penalty

## Output Contract
- Observations
- Assumptions
- Recommendations
- Next actions for Isaac to approve

## Ready for Review Criteria
- Exactly 10 accounts listed (or explicit reason if fewer available).
- Each account includes "why now" and recommended next touch.
