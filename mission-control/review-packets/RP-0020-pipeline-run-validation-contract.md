# RP-0020 — TS-H1.1a /pipeline/run Validation Contract

## Scope
Contract for `POST /api/presentation-studio/decks/{deckId}/pipeline/run` first slice: request validation + runId creation payload shape.

## Request Body (v1)
```json
{
  "scope": "deck",
  "slideId": null,
  "stages": ["plan", "draft", "critique", "rewrite", "render", "qa"]
}
```

### Fields
- `scope` (required): `deck | slide`
- `slideId` (conditional): required when `scope=slide`, must be non-empty string
- `stages` (required): non-empty array of enum values
  - allowed: `plan | draft | critique | rewrite | render | qa`
  - must be unique (no duplicates)

## Success Response (201)
```json
{
  "ok": true,
  "run": {
    "runId": "run_20260305_073000_ab12cd",
    "deckId": "DK-123",
    "scope": "deck",
    "slideId": null,
    "stages": ["plan", "draft", "critique", "rewrite", "render", "qa"],
    "status": "started",
    "createdAt": "2026-03-05T07:30:00Z",
    "updatedAt": "2026-03-05T07:30:00Z"
  }
}
```

## Error Model (400/404)
- `deck_not_found` (404): deckId does not exist.
- `invalid_scope` (400): scope not in enum.
- `slide_id_required` (400): missing slideId when `scope=slide`.
- `invalid_stages` (400): stages missing/empty or contains invalid enum value.
- `duplicate_stages` (400): stages contains duplicates.
- `invalid_payload` (400): malformed payload type.

## Notes
- This contract is intentionally first-slice; execution engine is out of scope.
- Audit event to emit in subsequent subtask: `pipeline.run.created` with `runId`, `deckId`, `scope`, `stages`.
