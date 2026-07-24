# UnifiedAfrica Commitment Marketplace — PRD v1 (Draft)

## 1) Product Thesis
UnifiedAfrica is a curated commitment marketplace for investable African opportunities.

No project enters on ambition alone; every approved project must show verified outside commitment.

## 2) Core Workflow (Canonical)
Submit → Screen → Conditional Approval → Coalition Commitment → Payment → Activation

## 3) Gate Logic
- Submission: Free
- Screening: USG-led qualification
- Conditional Approval: Passes initial screen, not yet active
- Commitment Gate: At least 1 verified qualified participant beyond sponsor
- Payment Trigger: Activation fee due only after commitment gate passes
- Activation: Project becomes active in marketplace

## 4) Qualified Participant Types
- Capital partner
- Operator
- Technology partner
- Anchor customer
- Government body
- Landowner
- Strategic buyer
- Distributor
- Family office
- Institutional partner

(Per-deal-type eligibility matrix to be configured by USG.)

## 5) MVP User Stories
1. As a sponsor, I can submit a project with structured intake fields.
2. As USG, I can screen and assign status (Rejected / Needs Work / Conditionally Approved).
3. As USG, I can invite and track qualified participant commitments.
4. As USG, I can verify commitment evidence and pass/fail the commitment gate.
5. As sponsor, I get activation invoice only when gate is passed.
6. As USG, I can activate project and publish to qualified partner pool.

## 6) MVP States
- Draft
- Submitted
- Screening
- Needs Work
- Rejected
- Conditionally Approved
- Commitment Pending
- Commitment Verified
- Payment Pending
- Activated

## 7) Acceptance Criteria (Critical)
- No record can transition to Activated without:
  - Conditional approval = true
  - Verified qualified commitments ≥ 1
  - Activation payment confirmed
- Sponsor cannot be counted as qualifying counterparty.
- Commitment verification requires evidence artifact + reviewer approval.
- All state transitions are timestamped + auditable.

## 8) Sprint Plan

### Sprint 0 (1 week) — Foundations
- Finalize rules, state model, and data schema
- Define commitment evidence standards
- Draft legal/commercial language for activation terms
- Build low-fi UX for intake + ops console
- Exit: signed-off functional spec

### Sprint 1 (2 weeks) — MVP Core
- Intake form + project records
- Screening workflow + status engine
- Commitment tracking + verification workflow
- Payment trigger logic (manual invoice hook okay in v1)
- Exit: end-to-end internal demo

### Sprint 2 (2 weeks) — Activation + Partner Layer
- Partner invite and response capture
- Activation flow and sponsor notifications
- Basic dashboard (pipeline, conversion, gate bottlenecks)
- Exit: pilot-ready with first live opportunities
