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
- Semantic sub-reason drilldown (deterministic subtype classification)
- Immutable review snapshots + exportable reviewed/snapshot artifacts (JSON/Markdown)

## Semantic mismatch mapping notes
- Rule priority is top-down and deterministic; first matching rule wins.
- Mapping uses diff path + stage + field + reason context only.
- Raw reason/path are always preserved; semantic reason is additive.
- semanticSubReason is applied after semanticReason selection using semantic-specific rules.
- If no semantic rule matches: `semanticReason=unclassified_change`.
- If no sub-rule matches: `semanticSubReason=null`.
- If multiple rules match, first rule is used and ambiguity note is attached.
- Use broad semanticReason for clustering; use semanticSubReason for triage/root-cause hints.

## Mapping test matrix
- Fixture file: `admin-server/src/reveal/normalization/fixtures/semantic-mapping-matrix.json`
- Runner: `node admin-server/src/reveal/normalization/fixtures/run-semantic-mapping-tests.mjs`
- Runner validates:
  - duplicate ids
  - expected semantic/subreason validity
  - orphan sub-reasons
  - full taxonomy coverage
- To add a new semanticReason:
  1) extend taxonomy in `semanticDiffReasonService.js`
  2) add broad rule
  3) add sub-rules
  4) add explicit matrix cases
- To intentionally update outputs after rule changes: update matrix expectations and rerun; keep precedence cases explicit.

## Snapshots + exports
- Snapshot storage: `reveal/storage/review-snapshots/{flowId}/{snapshotId}.json`
- Snapshot routes:
  - `POST /reveal/api/flows/:flowId/snapshots`
  - `GET /reveal/api/flows/:flowId/snapshots`
  - `GET /reveal/api/flows/:flowId/snapshots/:snapshotId`
- Export routes:
  - `GET /reveal/api/flows/:flowId/export?format=json|markdown`
  - `GET /reveal/api/flows/:flowId/snapshots/:snapshotId/export?format=json|markdown`
- Snapshot fixture runner: `node admin-server/src/reveal/normalization/fixtures/run-snapshot-fixtures.mjs`
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
