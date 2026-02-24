# RP-0006 — Workflow A v3.1 Evidence + Stale Date Filter

## Title
Workflow A v3.1: evidence snippets + stale-date rejection for pressure scoring

## Summary
Implemented v3.1 enhancements:
- field-level evidence snippets for each extracted field,
- stale date filtering (dates older than 24 months set to `MISSING` for pressure event scoring),
- retained provenance/confidence model from v3.

## Artifacts
- `mission-control/workflow-a/run-workflow-a-v3_1.mjs`
- `mission-control/workflow-a/out/workflow-a-v3_1-2026-02-24T18-09-17-775Z.json`

## Quality Notes
- Chromium integration remains pending (`chromiumStatus: PENDING_INTEGRATION`).
- Evidence snippets now provide traceability for each extracted field.

## Status
Ready for Review
