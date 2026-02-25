---
name: generate-presentation
description: Generate governed HTML5 presentation decks from initiative and buyer context. Use when asked to create, regenerate, or revise decks with inputs buyer_id, initiative_id, deck_type (utc-internal or buyer-mandate-mirror), template_id, prompt, and provider settings; outputs deck.json, slides/*.html, assets, and index.html with readability constraints.
---

# Generate Presentation

Generate decks through the workspace presentation engine with deterministic file outputs and guardrails.

## Workflow

1. Confirm inputs:
   - `initiative_id` (required)
   - `buyer_id` (optional for utc-internal, recommended for buyer-mandate-mirror)
   - `deck_type`: `utc-internal` or `buyer-mandate-mirror`
   - `template_id`: `sovereign-memo`, `clean-minimal`, or `blueprint`
   - `image_provider`: `placeholder|openai|gemini|grok`
   - `copy_provider`: `local|claude`
   - `prompt` (optional but recommended)

2. Run `scripts/generate_presentation.py` with those inputs.

3. Validate outputs exist:
   - `presentations/<initiative>/decks/.../deck.json`
   - `slides/*.html`
   - `assets/*`
   - `index.html`

4. If requested, run export (`pptx` or `pdf`) via `scripts/export_deck.js`.

## Commands

Generate deck:

```bash
python3 skills/generate-presentation/scripts/generate_presentation.py \
  --initiative-id INIT-001 \
  --buyer-id PIF \
  --deck-type buyer-mandate-mirror \
  --template-id sovereign-memo \
  --image-provider placeholder \
  --copy-provider local \
  --prompt "SLIDE 1 Title: ..."
```

Generate with auto mode:

```bash
python3 skills/generate-presentation/scripts/generate_presentation.py \
  --initiative-id INIT-001 \
  --deck-type utc-internal \
  --template-id blueprint \
  --auto-generate
```

Export (optional):

```bash
node scripts/export_deck.js --deck presentations/INIT-001/decks/utc-internal --format pptx
```

## Rules

- Keep readability target 8th–9th grade.
- Keep max 6 bullets per slide (generator enforces).
- Keep no-hype wording.
- Preserve structural input format when provided (`SLIDE N Title: ... • ...`).

## Troubleshooting

- If slide count drops to 5, ensure prompt includes explicit multi-slide markers (`SLIDE N` or numbered lines).
- If images are placeholders, configure provider keys in runtime env.
- If mobile navigation appears stuck, open deck `index.html` and use swipe / tap edges / on-screen controls.
