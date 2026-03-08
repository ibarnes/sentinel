# RP-0042 — Savepoint Restore Endpoint + Smoke (TS-B3.2c)

## Delivered
Implemented savepoint persistence/restore slice in `admin-server/src/server.js`:
- Added store file constant: `dashboard/data/savepoints.v1.json`
- Added defaults + read/write helpers for savepoint store
- Added endpoints:
  - `GET /api/presentation-studio/decks/:deckId/savepoints`
  - `POST /api/presentation-studio/decks/:deckId/savepoints`
  - `POST /api/presentation-studio/decks/:deckId/savepoints/:savePointId/restore`

## Behavior
- Create captures immutable deck + slide snapshots and updates `deck.currentSavePointId`.
- Restore rewrites deck + slide state from stored snapshot and emits audit event.
- List returns savepoints newest-first.

## Smoke Evidence
- Command: `node --check admin-server/src/server.js`
- Result: pass

## Risks / Rollback
- Snapshot payload size grows with slide volume; monitor file size in `savepoints.v1.json`.
- Rollback path: remove endpoint block + helpers and delete savepoint store file if needed.

## Governance
- No task moved to Done.
- Approval requested through this RP before any Done transition.
