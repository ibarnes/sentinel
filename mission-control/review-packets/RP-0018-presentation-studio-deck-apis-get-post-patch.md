# RP-0018 — Presentation Studio Deck APIs (GET/POST/PATCH)

## Summary
Implemented Phase-1 deck management API surface for Presentation Studio:
- `GET /api/presentation-studio/decks` (selector-filtered list)
- `POST /api/presentation-studio/decks` (validated create)
- `PATCH /api/presentation-studio/decks/:deckId` (metadata updates)

Governance status: **Ready for Review** (not Done).

## Mandatory Decomposition Gate

### Parent Work Item
- `TASK-0019` / `ST-B1 Add Deck APIs (GET/POST/PATCH)`

### Execution Subtasks (30–90 min units)
1) **ST-B1.1a** — Add filtered deck list endpoint (`GET`)
- Acceptance criteria:
  - Supports selector filters (`initiativeId`, `deckType`, `buyerId`)
  - Returns deterministic `count`, `selectors`, and `decks`
- Dependency: existing deck store readers (`readDeckSpecStore`, `resolveDeckSelectors`)

2) **ST-B1.1b** — Add deck create endpoint (`POST`)
- Acceptance criteria:
  - Requires `initiativeId`
  - Prevents duplicate deck creation for identical selectors
  - Persists deck via v2 defaults
  - Emits audit event `deckspec.create`
- Dependency: ST-B1.1a complete; existing `defaultDeckSpecV2`

3) **ST-B1.2a** — Add deck patch endpoint (`PATCH`)
- Acceptance criteria:
  - Supports updates for `globalTemplateTheme`, `styleMode`, `copyProvider`, `imageProvider`, `currentSavePointId`
  - Validates `styleMode` enum (`professional|creative`)
  - Updates `updatedAt`
  - Emits audit event `deckspec.update` with before/after metadata
- Dependency: existing deck lookup by `deckId`

## What Changed
- File: `admin-server/src/server.js`
  - Added `GET /api/presentation-studio/decks`
  - Added `POST /api/presentation-studio/decks`
  - Added `PATCH /api/presentation-studio/decks/:deckId`

## Verification
- Syntax check passed:
  - `node --check admin-server/src/server.js`

## Risk Notes
- Low risk: changes are additive API routes, no destructive schema migration.
- Existing resolve/layout/slots endpoints left intact.

## Recommended Next Actions
1. Approve RP-0018.
2. After approval, run authenticated API smoke tests for create/list/patch flow.
3. Proceed to slide CRUD APIs (`TASK-0023`, `TASK-0024`).
