# Workspace Memory (restored from MEMORY backup)

## Daily Rhythm
1) Morning Brief (once daily): top priorities, risks, opportunities, short action plan
2) Night Shift (continuous): run assigned workflows, generate outputs, queue review packets for approval
3) Review Packets: every deliverable includes title + summary + link/file path + recommended next step

## Mission Control Tracking
- Maintain board: Backlog → In Progress → Ready for Review → Done
- Nothing moves to Done without Isaac’s explicit approval

## Workflow Definitions
- Workflow A — Buyer/Pressure Monitor (daily, 6:30am ET)
  - Goal: wake up to who moved and why it matters
  - Scope: shortlist monitoring (GIC, PIF, Brookfield, GIP, etc.) and new signals (allocations, mandates, infra announcements)
  - Output: Morning Brief section: "Pressure Surface Changes"
- Workflow B — Salesforce Hygiene + Target Queue (daily/weekly, daily run at 7:00am ET)
  - Goal: CRM as a living radar
  - Scope: daily top accounts/opps to review; flag missing fields, weak buyer fit, stale notes
  - Output: Review Packet: "Top 10 Accounts to Touch + why"
- Workflow C — Artifact Factory (nightly, 11:00pm ET, queued tasks only)
  - Goal: draft recurring manual artifacts
  - Scope: 1-pagers, outreach messages, meeting briefs, deck slide copy
  - Output: Review Packet with copy-ready drafts

## Scheduling + Prompts
- Timezone: America/New_York
- Workflow A: daily 6:30am ET
- Workflow B: daily 7:00am ET
- Morning Brief delivery: 7:15am ET
- Evening intake prompt: 7:00pm ET (ask Isaac what to queue for Artifact Factory)
- Workflow C: nightly 11:00pm ET on queued tasks

## Scoring Policy (v1 draft)
- Buyer Signal Strength (A): factors scored 1–5
  - Capital allocation announcement
  - Infrastructure mandate expansion
  - Geographic focus alignment
  - Public statements from leadership
  - Timing urgency buckets:
    - 5 = 0–90 days
    - 4 = 90–180 days
    - 3 = 6–12 months
    - 2 = 12–24 months
    - 1 = >24 months
- Account Priority Model (B): factors scored 1–5
  - Structural buyer class fit
  - Pre-FID relevance
  - Existing relationship proximity
  - Mandate probability (90-day)
  - Capital size threshold
- Hard gates for B:
  - If Pre-FID relevance = 1 → max B score = 3
  - If Mandate probability (90-day) = 1 → max B score = 3
  - If Structural buyer class fit ≤ 2 → max B score = 2
- Weighting adjustments requested:
  - Relationship proximity weight: 30%
  - Capital size weight: 5%
  - Remaining weights pending explicit confirmation
- Breakout trigger:
  - If Structural Fit = 5 AND Pre-FID ≥ 4 AND Mandate90d ≥ 3 → Auto Tier 1 candidate
- 2026-03-01 review: no scoring model or weighting changes approved.
- 2026-03-02 maintenance: no new scoring changes approved.

## Backup Index
Latest snapshot source: `memory/backups/memory-md-git/047_2026-03-26_37e6efd2.md` @ commit `37e6efd2`
Full history index: `memory/backups/memory-md-git/index.md`
