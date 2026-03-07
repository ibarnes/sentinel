---
rp_id: RP-0037
title: Presentation Studio Slide Mutations (POST/PATCH/DELETE)
linked_task: TASK-0024
created_by: sentinel
created_at: 2026-03-07T04:10:00Z
status: Ready for Review
recommended_action: Approve
architect_decision: null
architect_notes: null
---

# RP-0037 — Presentation Studio Slide Mutations (POST/PATCH/DELETE)

## Summary
Implemented the first mutation slice for Presentation Studio slide APIs under `/api/presentation-studio/decks/:deckId/slides`.

This delivery adds:
- `POST /api/presentation-studio/decks/:deckId/slides`
- `PATCH /api/presentation-studio/decks/:deckId/slides/:slideId`
- `DELETE /api/presentation-studio/decks/:deckId/slides/:slideId`

All endpoints persist changes to `dashboard/data/slidespecs.v2.json`, maintain `deck.slideOrder`, and write audit events.

## Observations
- Prior API surface only supported list/get; no server-side mutation path existed for SlideSpec v2 records.
- Slide order integrity was a hard dependency for downstream single-slide rendering and editor stability.
- Legacy field compatibility (layout/title/bullets/imagePrompt) remains necessary during v1→v2 coexistence.

## Assumptions
- Slide IDs may be client-provided, otherwise server-generated in deterministic `slide-###` format.
- PATCH updates are partial and should not require full object replacement.
- Deleting a slide is allowed even when it leaves zero slides (this can be tightened later if product policy changes).

## Recommendations
1. Approve this mutation slice so editor/runtime can transition from JSON-file direct writes toward governed API writes.
2. Next, add route-level integration smoke (authenticated HTTP) for POST→PATCH→DELETE cycle against a test deck.
3. Follow with reorder-specific endpoint if the UI begins drag/drop reordering independent of mutation calls.

## Next Actions for Isaac
1. **Approve RP-0037** to mark TASK-0024 delivery slice accepted.
2. Authorize follow-on smoke packet for authenticated request/response evidence capture.
3. Confirm whether product policy should block deletion of the final remaining slide.

## Acceptance Evidence
- Code changes: `admin-server/src/server.js`
- New endpoints added:
  - `POST /api/presentation-studio/decks/:deckId/slides`
  - `PATCH /api/presentation-studio/decks/:deckId/slides/:slideId`
  - `DELETE /api/presentation-studio/decks/:deckId/slides/:slideId`
- Validation smoke:
  - `node --check admin-server/src/server.js` (pass)
