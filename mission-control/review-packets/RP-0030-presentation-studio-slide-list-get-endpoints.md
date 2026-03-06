# RP-0030 — Presentation Studio Slide List/Get Endpoints

## Summary
Implemented the first slice of slide API surface for Presentation Studio:
- `GET /api/presentation-studio/decks/:deckId/slides`
- `GET /api/presentation-studio/decks/:deckId/slides/:slideId`

Governance status: **Ready for Review** (not Done).

## Mandatory Decomposition Gate

### Parent Work Item
- `TASK-0023` — TS-B2.1 Implement slide list/get endpoints

### Execution Subtasks (30–90 min units)
1) **TS-B2.1a** — Add slide spec store bootstrap/read/write helpers
- Acceptance criteria:
  - Slide store file auto-created at startup when missing
  - Store read/write helpers handle malformed/missing shape safely
- Dependency: existing JSON helpers + startup file bootstrap path

2) **TS-B2.1b** — Add deck-scoped slide list endpoint
- Acceptance criteria:
  - Validates `deckId`
  - 404 when deck does not exist
  - Returns deterministic ordering using `deck.slideOrder` first, then created timestamp
- Dependency: TS-B2.1a complete; deck store lookup available

3) **TS-B2.1c** — Add deck-scoped single slide endpoint
- Acceptance criteria:
  - Validates `deckId` + `slideId`
  - 404 when deck missing
  - 404 when slide missing
  - Returns stable envelope `{ ok, deckId, slide }`
- Dependency: TS-B2.1a complete

## What Changed
- File: `admin-server/src/server.js`
  - Added `DASHBOARD_SLIDE_SPECS_FILE` constant (`dashboard/data/slidespecs.v2.json`)
  - Added `defaultSlideSpecStore()`
  - Bootstrapped slide spec store creation in `ensureTeamAndBoardFiles()`
  - Added `readSlideSpecStore()` and `writeSlideSpecStore()` helpers
  - Added `GET /api/presentation-studio/decks/:deckId/slides`
  - Added `GET /api/presentation-studio/decks/:deckId/slides/:slideId`

## Verification
- Syntax check passed:
  - `node --check admin-server/src/server.js`

## Risk Notes
- Low risk: additive routes and additive data file only.
- No schema migration against existing deckspec/pipeline files.
- Existing presentation endpoints are untouched.

## Recommended Next Actions
1. Approve RP-0030.
2. Run authenticated smoke for list/get routes with seeded slide records.
3. Execute `TASK-0024` (slide create/update/delete endpoints) to complete CRUD.
