# RP-0004 — Workflow A v2 Hardening

## Title
Workflow A v2: structured extraction rules + run-to-run delta detection

## Summary
Implemented v2 of Workflow A with:
- structured extraction rules (`extraction-rules.json`),
- optional Brave enrichment when API key is available,
- explicit missing-input reporting,
- run-to-run `changedFields` delta detection,
- generated markdown summary for Morning Brief ingestion.

## Artifacts
- `mission-control/workflow-a/run-workflow-a-v2.mjs`
- `mission-control/workflow-a/extraction-rules.json`
- `mission-control/workflow-a/out/workflow-a-2026-02-24T17-45-13-717Z.json`
- `mission-control/workflow-a/out/workflow-a-2026-02-24T17-45-13-717Z.md`

## Key Output Notes
- PIF/GIC/GIP direct fetch still blocked or mismatched (403/404), but enrichment extracted partial fields.
- Brave enrichment hit rate limits on some buyers (`BRAVE_HTTP_429`).
- Missing data remains explicit (date, leadership statements often missing).
- A-scores computed from extracted fields only; no inferred data.

## Risk / Quality Notes
- Chromium-rendered extraction is marked pending in v2 metadata and not yet automated in script.
- Some extracted amounts likely come from search snippets; should be validated against first-party page content before executive usage.

## Recommended next step
Approve v3 for source reliability:
1) Add Chromium automation pass for blocked JS pages,
2) add snippet provenance/quote capture,
3) strict confidence labels (`verified_source` vs `search_derived`),
4) fallback URL list per buyer.

## Status
Ready for Review
