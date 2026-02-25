---
rp_id: RP-0011
title: Presentation Maker v2 (Slide-Agent Pipeline)
linked_task: TASK-PRES-V2
created_by: sentinel
created_at: 2026-02-25T15:46:00Z
status: Ready for Review
recommended_action: Approve
architect_decision: null
architect_notes: null
---

# RP-0011 — Presentation Maker v2

## Delivered
1. Pipeline runner: `scripts/deck_pipeline_v2.js`
2. Deck v2 schema: `dashboard/deck.schema.v2.json`
3. QA report generation: `qa-report.json` per deck
4. Added high-quality template: `dark-institutional` (alongside sovereign-memo + clean-minimal)
5. Slide editor v1 in `/dashboard/presentation-studio` (SlideSpec-driven, single-slide rerender)
6. Sample v2 deck regenerated for `INIT-001`

## Pipeline stages implemented
- Plan
- Draft (per slide)
- Critic (per slide)
- Rewrite loop (max 3)
- Image plan/generation (placeholder fallback)
- HTML render
- QA report output
- Assemble index.html

## Traceability
- stage logs at `presentations/<...>/stage-log.jsonl`

## Notes
- Source-of-truth is `deck.json` SlideSpec and editor writes back to SlideSpec before rerender.
- No external integration is required for baseline operation (placeholders used when provider keys absent).
