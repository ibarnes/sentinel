# RP-2026-06-14T16-30-00Z - Board Write-Path Legacy Normalization

## Scope
- Linked task: `TASK-0431`
- Parent lane: `TASK-0030`
- Area: `/board` task editing + `admin-server/src/server.js`

## What Changed
- Added deterministic legacy normalization for board rows before runtime use and before persistence validation.
- Legacy `status` values such as `Todo` are mapped onto the current board column set.
- Legacy comment variants (`by`/`at`, `message`, raw string comments) are normalized into `{ id, author, text, created_at }`.
- `writeBoard()` now validates the normalized board document instead of crashing on older historical row shapes.

## Acceptance Check
1. `node --check admin-server/src/server.js` passes.
2. Isolated authenticated board smoke no longer crashes on the first create/edit/comment write because of historical `BOARD.json` drift.
3. The live board runtime can safely read legacy tasks without hiding `Todo` rows or invalid comment shapes from the strict schema.

## Risk Notes
- This is a compatibility shim, not a schema loosening. Persisted output remains compliant with the current board schema.
- Unknown legacy statuses default to `Backlog`, so future review should keep an eye on any genuinely ambiguous historical rows.

## Reviewer Focus
1. Verify the normalization only touches compatibility fields and does not alter active governance metadata.
2. Confirm the legacy comment ID strategy is deterministic and stable across repeated reads/writes.
