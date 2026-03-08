# RP-0041 — Savepoint API Contract (TS-B3.2a)

## Scope
Defined contract for:
- `GET /api/presentation-studio/decks/:deckId/savepoints`
- `POST /api/presentation-studio/decks/:deckId/savepoints`
- `POST /api/presentation-studio/decks/:deckId/savepoints/:savePointId/restore`

## Contract Summary
- **List** returns `{ ok, deckId, count, savepoints[] }` sorted newest-first.
- **Create** returns `201` with `{ ok, deckId, savepoint }` where `savepoint.snapshot` includes immutable deck/slides snapshot.
- **Restore** returns `{ ok, deckId, savePointId, deck, restoredSlides }`.

## Snapshot Shape
`savepoint.snapshot`:
- `deck` (full DeckSpec object clone)
- `slides` (array clone from `slidesByDeck[deckId]`)

## Error Model
- `400`: missing required path params.
- `404`: deck not found or savepoint not found.
- `409`: malformed/invalid stored snapshot at restore time.

## Governance
- No Done transitions performed.
- Parent task remains non-Done pending approval and follow-on validation.
