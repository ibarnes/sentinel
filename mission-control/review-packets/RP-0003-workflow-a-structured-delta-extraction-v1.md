# RP-0003 — Workflow A Structured Delta Extraction v1

## Title
Workflow A structured press-source extraction + A-score computation (v1)

## Summary
Implemented a first-pass Workflow A extractor that reads `mission-control/buyer-sources.yaml`, scrapes buyer press pages, extracts structured fields, and computes a provisional Buyer Signal Strength score from extracted data. Missing or blocked fields are explicitly marked `MISSING`.

## Artifacts
- Sources file: `mission-control/buyer-sources.yaml`
- Runner: `mission-control/workflow-a/run-workflow-a.mjs`
- Docs: `mission-control/workflow-a/README.md`
- Latest run output: `mission-control/workflow-a/out/workflow-a-2026-02-24T17-41-40-856Z.json`

## Run Output (high-level)
- PIF: blocked (HTTP 403), score 1.0
- GIC: page mismatch (HTTP 404), score 1.0
- Brookfield: partial extraction, score 2.2
- GIP: page mismatch (HTTP 404), score 1.0
- NigeriaMortgageFund: partial extraction, score 1.4

## Constraints / Gaps
- Brave Search enrichment is not active in this environment because `BRAVE_API_KEY` is not configured.
- Several press URLs require anti-bot/cookie handling or corrected endpoints.
- Current extractor is regex-first and should be hardened with browser-rendered extraction (Chromium snapshots) to reduce false positives.

## Recommended next step
Approve v2 hardening:
1) enable Brave API key,
2) add Chromium-rendered extraction pass,
3) pin per-buyer selectors and date parsing rules,
4) add delta-comparison against prior run to populate “What changed”.

## Status
Ready for Review
