# Pipeline Run Validation Decision Table — 2026-04-27 10:40 UTC

Parent: `TASK-0043`
Child: `TASK-0254`
Endpoint: `POST /api/presentation-studio/decks/{deckId}/pipeline/run`

## Decision Table

| Condition | Rule | Expected HTTP | Error/Result |
|---|---|---:|---|
| deckId missing from path | Reject request | 400 | `deckId is required` |
| Body omitted/null | Reject request | 400 | `request body required` |
| `mode` missing | Reject request | 400 | `mode is required` |
| `mode` not in allowlist (`slide`,`deck`) | Reject request | 400 | `mode must be one of: slide, deck` |
| `initiatedBy` missing/empty | Reject request | 400 | `initiatedBy is required` |
| `metadata` provided but not object | Reject request | 400 | `metadata must be an object` |
| `idempotencyKey` provided but not string | Reject request | 400 | `idempotencyKey must be a string` |
| All required fields valid | Create run record (`status=started`) | 201 | `{ runId, status, deckId }` |

## Edge-case Checklist (negative vectors)
1. Invalid JSON body (parse failure).
2. Empty string for `deckId` in route.
3. `mode` casing mismatch (`Deck`, `SLIDE`).
4. Oversized `metadata` payload beyond service limit.
5. Unexpected top-level field when strict schema mode is enabled.
6. Duplicate `idempotencyKey` reused within active dedupe window.
7. `initiatedBy` present but whitespace-only.
8. Conflicting payload (`mode=slide` with deck-only options).
9. Null values for required fields (`mode`, `initiatedBy`).
10. Non-UTF-8/invalid character payload in string fields.

## Implementation Notes
- Validate route params before body schema for deterministic errors.
- Return stable machine-readable error codes for smoke assertions.
- Emit audit event only on successful run creation.
