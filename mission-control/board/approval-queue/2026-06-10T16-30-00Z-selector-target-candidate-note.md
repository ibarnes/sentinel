# Selector Target Candidate Note (2026-06-10T16:30:00Z)

- Parent Stream: TASK-0103
- Subtask Candidate: TASK-0407
- Sweep: Board Progress Sweep (Midday)

## Current local selector-safe candidate
- `INITIATIVE_ID=INIT-001`
- `DECK_TYPE=utc-internal`
- `BUYER_ID` unset
- Existing local deckspec entry: `INIT-001::utc-internal::none`

## Source basis
- `dashboard/data/deckspecs.v2.json` currently contains one concrete deckspec row matching those selectors.
- `admin-server/src/server.js` resolves selectors through `GET /api/presentation-studio/decks/resolve` and defaults `createIfMissing=true`, so selector mode can also create a missing deckspec when authorized.

## Recommended execution choices
1. Lowest-risk technical proof path:
   - direct mode: `DECK_ID=INIT-001::utc-internal::none`
   - or selector mode: `INITIATIVE_ID=INIT-001`, `DECK_TYPE=utc-internal`
2. Preferred business-relevant path:
   - Isaac names a live initiative/deck target instead of the archived test deck.

## Isaac decision still needed
- Decide whether the next credentialed smoke should use the existing archived test deck for fast technical closure, or a live initiative/deck target for stronger business relevance.

## Why this matters
- The lane is no longer blocked by abstract target ambiguity alone; there is now one known selector-safe candidate and one explicit decision boundary for Isaac.
