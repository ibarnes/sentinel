# Reveal (Phase 1 Scaffold)

Product-intelligence capture system at `/reveal`.

## Scope included
- Chrome extension capture scaffold
- API ingestion scaffold
- Deterministic normalization pipeline scaffold
- Reviewed-flow mutation API + persistence
- True highlight rendering pipeline (extension-rendered overlay + persisted assets)
- Coordinate replay debugger endpoint + editor inspector
- Replay integrity checksum + drift detection (step + flow)
- Stage-diff mismatch explainer (first divergence + structured diff)
- Semantic reason refinement for mismatches (rule-based path/stage mapping)

## Semantic mismatch mapping notes
- Rule priority is top-down and deterministic; first matching rule wins.
- Mapping uses diff path + stage + field + reason context only.
- Raw reason/path are always preserved; semantic reason is additive.
- If no rule matches, `semanticReason` becomes `unclassified_change`.
- If multiple rules match, first rule is used and ambiguity note is attached.
- Flow editor compare mode (baseline vs reviewed diffs)
- Flow editor shell with live reviewed mutations
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
