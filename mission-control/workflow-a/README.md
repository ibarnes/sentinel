# Workflow A Scraper (v1)

This workflow pulls buyer press pages and extracts structured deltas:
- Date
- Capital amount
- Sector
- Geography
- Mandate language
- Urgency indicator

## Sources
- `mission-control/buyer-sources.yaml`

## Run
```bash
node mission-control/workflow-a/run-workflow-a.mjs
```

## Notes
- Uses direct-source scraping first.
- Brave search enrichment is optional and enabled only when `BRAVE_API_KEY` is available.
- If a field is unknown, it is recorded as `MISSING` (never inferred).
- After each run, update per-buyer cards in `mission-control/buyer-cards/`.
- For each material change, append one row to that buyer’s timeline (newest first).
