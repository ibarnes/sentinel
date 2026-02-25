---
rp_id: RP-0010
title: HTML5 Presentation Engine v1 (templates + images + readability)
linked_task: TASK-PRES-001
created_by: sentinel
created_at: 2026-02-25T04:22:46Z
status: Ready for Review
recommended_action: Approve
architect_decision: null
architect_notes: null
---

# RP-0010 — HTML5 Presentation Engine v1

## Delivered
- Static HTML5 slide deck generation with CSS themes
- Template library with 3 templates:
  - sovereign-memo
  - clean-minimal
  - blueprint
- Deck types:
  - utc-internal
  - buyer-mandate-mirror
- Deck folder structure:
  - `deck.json`
  - `slides/*.html`
  - `assets/*`
  - `index.html`
- Generator script:
  - `scripts/generate_deck.js`
- Export script:
  - `scripts/export_deck.js` (PPTX now, PDF when Playwright available)

## Data + UI
- Buyers + initiatives data model:
  - `dashboard/data/buyers.json`
  - `dashboard/data/initiatives.json`
- UI routes:
  - `/dashboard/buyers`
  - `/dashboard/buyer/:id`
  - `/dashboard/initiative/:id`
- Generate API:
  - `POST /api/presentations/generate`
- Export API:
  - `POST /api/presentations/export`

## Readability constraints
- 8th–9th grade target via heuristic rewrite loop
- No hype-word list scrub
- Bullet constraints enforced in generator:
  - max 6 bullets
  - max 12 words per bullet

## Sample outputs generated
- `presentations/INIT-001/decks/utc-internal/index.html`
- `presentations/INIT-001/decks/buyer-alignment/PIF/index.html`

## Notes
- Image providers supported in pipeline contract (OpenAI/Gemini/placeholder).
- Current fallback behavior: placeholder image when provider keys or generation endpoint are unavailable.
