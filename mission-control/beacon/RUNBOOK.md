# Sponsor Beacon Weekly Cadence Runbook (TS-SBP2.2b)

## Objective
Operate a strict low-volume, high-density Sponsor Beacon cycle that converts live friction into structural signal presence.

## Weekly Operating Cadence

### Monday — Signal Selection
- Select exactly one live friction signal from `/dashboard/signals`.
- Link exactly one initiative from `/dashboard/initiatives`.
- Write one-line mandate implication.
- Output: beacon queue draft shell with required linkage fields.

### Tuesday — Draft
- Draft one beacon (target 60–140 words).
- Must remain structural and commitment-boundary focused.
- No authority claims. No CTA.

### Wednesday — Architecture Hardening
- Remove soft/non-structural language.
- Tighten sentence density.
- Ensure at least required hard-term coverage per lint rules.

### Thursday — Approval
- Architect reviews and marks: `approved`, `rejected`, or `hold`.
- Approval must include reason if not approved.
- Audit event must exist for decision.

### Friday — Publish or Hold
- Publish only if status is `approved` and lint status is `PASS`.
- Otherwise set `hold` with reason note.

## Required Inputs Per Beacon
- `signal_id`
- `initiative_id`
- `mandate_implication`
- `draft_text`

## Quality Guardrails
- Rule A: no future-tense authority claims.
- Rule B: no embedded mandate offers / CTA.
- L1: soft-term ban enforced.
- L2: hard-term threshold enforced.

## Failure Conditions (Auto-Reject)
- Missing required linkage fields.
- Any Rule A or Rule B phrase detected.
- Soft-term dictionary hit.
- Hard-term threshold not met.

## Handoff Rules
- Never publish from draft directly.
- Never bypass architect approval for approve/publish transitions.
- Every state transition must be logged via audit events.
