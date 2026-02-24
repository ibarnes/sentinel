# RP-0005 — Workflow A v3 Reliability Layer

## Title
Workflow A v3: fallback source handling + field provenance + confidence labels

## Summary
Implemented v3 reliability layer for Workflow A:
- fallback URL chain per buyer,
- field-level provenance (`verified_source`, `search_derived`, `missing`),
- overall confidence label,
- explicit missing-input capture,
- v3 run output generated.

## Artifacts
- `mission-control/workflow-a/fallback-sources.json`
- `mission-control/workflow-a/run-workflow-a-v3.mjs`
- `mission-control/workflow-a/out/workflow-a-v3-2026-02-24T18-07-27-830Z.json`

## Notes
- Chromium extraction remains `PENDING` in metadata (not yet automated in-script).
- Brave enrichment may rate-limit (`BRAVE_HTTP_429`) on some runs.
- No inferred fields: unknowns stay `MISSING`.

## Recommended next step
Approve v3.1:
1) wire Chromium pass via browser automation,
2) attach evidence snippets for each extracted field,
3) reject stale historical dates (e.g., entity founding dates) from event scoring.

## Status
Ready for Review
