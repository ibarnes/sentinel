# USG Live Deal Detection Sprint Board (6 Sprint Kit)

This kit is optimized for Airtable (works in Notion/SmartSuite with equivalent fields/views).

## Goal
Reward **qualified live deals**, not activity volume.

Core question per opportunity:
**Did we find a real deal with pressure, a blocker, and a buyer path?**

---

## Files
- `sprints.csv` → Sprint table (preloaded for 6 two-week sprints)
- `pipeline.csv` → Main SWAT pipeline table (contacts + deal qualification)
- `activity_log.csv` → Optional event table for daily score precision

---

## Table design

### 1) Sprints table
Import `sprints.csv`.

Required sprint fields included:
- Sprint ID
- Sprint Start Date
- Sprint End Date
- Sprint Theme
- Sprint Hypothesis
- Sprint Outcome
- Source Cohort
- Converted to Paid Review (Yes/No)
- Paid Review Amount

Targets included per sprint:
- New Targets Added: 500
- Messages Sent: 300
- Follow-Ups Sent: 150
- Replies Received: 100
- Deal Mentions: 50
- Possible Live Deals: 30
- Qualified Live Deals: 10
- Deal Review Handoffs: 5
- Paid Deal Reviews: 1 to 3

### 2) Pipeline table
Import `pipeline.csv`.

Use these single-select options:
- **Status**: New Target, Researched, Message Sent, Follow-Up Needed, Replied, Deal Mentioned, Qualifying, Qualified Live Deal, Deal Review Handoff, Paid Deal Review, Dead / Not Now
- **Contact Type**: Deal Owner, Advisor, Attorney, Accountant, Capital Raiser, M&A Advisor, Consultant, Family Office Connector, Investor, Operator, Government/Infrastructure Insider, Other
- **Source**: LinkedIn, Existing Contact, Referral, Email, WhatsApp, Event, Phone, Other
- **Relationship Strength**: Cold, Warm, Strong
- **Reply Status**: No Reply, Replied, Follow-Up Needed, Not Interested, Referred Someone, Deal Mentioned
- **Deal Mentioned**: Yes, No
- **Deal Type**: Capital Raise, Acquisition, JV, Project Finance, Expansion, License, Asset Sale, Strategic Partnership, Other
- **Blocker Category**: Decision Path, Structure, Risk, Parties, Proof, Capital Path, Story, Other
- **Urgency**: Low, Medium, High
- **Decision-Maker Known**: Yes, No
- **Budget Path**: Clear, Possible, Unknown, Unlikely
- **Live Deal Score**: 1 Noise, 2 Signal Source, 3 Possible Live Deal, 4 Qualified Live Deal, 5 Deal Review Ready
- **Handoff Ready**: Yes, No
- **Converted to Paid Review**: Yes, No

### 3) Activity Log table (optional but recommended)
Import `activity_log.csv` and use **Activity Type** values:
- New Target Added
- Message Sent
- Follow-Up Sent
- Reply Received
- Deal Mentioned
- Possible Live Deal
- Qualified Live Deal
- Deal Review Handoff
- Paid Deal Review

---

## Required views

1. **Daily Activity**
- Base: Activity Log
- Filter: Date is today
- Group: Team Owner

2. **Contact Pipeline (Kanban)**
- Base: Pipeline
- Layout: Kanban grouped by Status
- Stage order exactly:
  New Target → Researched → Message Sent → Follow-Up Needed → Replied → Deal Mentioned → Qualifying → Qualified Live Deal → Deal Review Handoff → Paid Deal Review → Dead / Not Now

3. **Follow-Up Queue**
- Base: Pipeline
- Filter:
  - Follow-Up Date is on or before today
  - Status is not Dead / Not Now

4. **Qualified Live Deals**
- Base: Pipeline
- Filter: Live Deal Score is 4 Qualified Live Deal OR 5 Deal Review Ready

5. **Deal Review Handoffs**
- Base: Pipeline
- Filter: Handoff Ready = Yes

6. **Paid Deal Reviews**
- Base: Pipeline
- Filter: Converted to Paid Review = Yes OR Status = Paid Deal Review

7. **Source Performance**
- Base: Pipeline
- Filter: Status is not Dead / Not Now
- Group by Source, then Contact Type, then Source Cohort

8. **Team Scoreboard**
- Base: Activity Log (or Pipeline rollups)
- Group by Team Owner

9. **Sprint Scoreboard**
- Base: Pipeline / Activity Log
- Group by Sprint ID

10. **Six-Sprint Learning Dashboard**
- Build an Interface page with 6 Sprint cards (S01–S06)
- Show side-by-side totals + conversion rates

---

## Automations

1. **Follow-Up Queue inclusion**
- Condition: Follow-Up Date <= today AND Status != Dead / Not Now
- Action: set `Follow-Up Queue Flag = Yes` (or rely on view filter only)

2. **Auto-mark Handoff Ready**
Set `Handoff Ready = Yes` when all are true:
- Deal Mentioned = Yes
- Live Deal Score is 4 or 5
- Urgency is Medium or High
- Blocker Category is filled
- (Decision-Maker Known = Yes OR Budget Path is Clear/Possible)

3. **Deal Review Handoffs view feed**
- Condition: Handoff Ready = Yes
- Action: none needed (view filter handles it)

4. **Paid conversion stage sync**
- Condition: Converted to Paid Review = Yes
- Action: set Status = Paid Deal Review

5. **Metric counters (daily + sprint)**
- Preferred: create one Activity Log row per action event (most accurate)
- Alternative: derive from Pipeline date fields where possible

---

## Dashboard cards (for each KPI)
For each of these, display:
- Today
- Current Sprint Total
- Current Sprint Target
- Six-Sprint Total
- Conversion Rate (where relevant)

KPI list:
- New Targets Added
- Messages Sent
- Follow-Ups Sent
- Replies Received
- Deal Mentions
- Possible Live Deals
- Qualified Live Deals
- Deal Review Handoffs
- Paid Deal Reviews
- Paid Review Revenue

---

## Conversion rates to track
- Contacted to Reply = Replies Received / Messages Sent
- Reply to Deal Mention = Deal Mentions / Replies Received
- Deal Mention to Possible Live Deal = Possible Live Deals / Deal Mentions
- Possible Live Deal to Qualified Live Deal = Qualified Live Deals / Possible Live Deals
- Qualified Live Deal to Handoff = Deal Review Handoffs / Qualified Live Deals
- Handoff to Paid Deal Review = Paid Deal Reviews / Deal Review Handoffs

---

## Score guardrails
- **1 Noise**: No clear deal, no pressure.
- **2 Signal Source**: Close to deal flow, no concrete deal yet.
- **3 Possible Live Deal**: Deal may exist, unclear details.
- **4 Qualified Live Deal**: Specific deal, pressure, blocker, likely decision-maker.
- **5 Deal Review Ready**: Specific deal + urgency + decision-maker or budget path + clear blocker + reason to pay now.

---

## Handoff gate (must answer all 7)
1. What is the deal?
2. Who owns it?
3. What is the desired outcome?
4. What is blocking movement?
5. Why does this need help now?
6. Who can pay?
7. What is the next decision?

If any are missing, keep it in **Qualifying**.

---

## Primary operating rule
The team is **not** pitching partnerships.
The team is searching for **live deals**.
