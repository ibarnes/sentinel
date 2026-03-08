# Reveal (Phase 1 Scaffold)

Product-intelligence capture system at `/reveal`.

## Scope included
- Chrome extension capture scaffold
- API ingestion scaffold
- Deterministic normalization pipeline scaffold
- Flow editor shell
- Storage conventions for sessions/events/flows/assets

## Storage layout
- `reveal/storage/sessions/{sessionId}.json`
- `reveal/storage/raw-events/{sessionId}.jsonl`
- `reveal/storage/normalized-flows/{flowId}.json`
- `reveal/storage/reviewed-flows/{flowId}.json`
- `reveal/storage/assets/{sessionId}/{stepId}/{before|after|highlight}.jpg`

## Test path
1. Start admin server.
2. Load unpacked extension from `reveal/extension` in Chrome.
3. Click extension action to start recording.
4. Interact with any web app.
5. Click extension action again to stop.
6. Response from `/reveal/api/sessions/:id/stop` returns `flowId`.
7. Open `/reveal/editor/{flowId}`.
