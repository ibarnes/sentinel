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
# Existing rule-based extractor
node mission-control/workflow-a/run-workflow-a-v3_1.mjs

# New signal-physics layer (non-breaking extension)
node mission-control/workflow-a/run-signal-physics.mjs
```

## Signal Physics + Ontology Layer (v1.1)
Adds a lightweight system-dynamics overlay without changing ingest architecture.
Backed by `mission-control/workflow-a/infrastructure-ontology.json` for lifecycle-layer classification.

Outputs:
- `dashboard/data/signal_physics_snapshot.json` (latest state snapshot)
- `mission-control/workflow-a/out/signal-physics-<timestamp>.json` (run archive)

Computed fields include:
- Signal-level: `snr`, `lagDays`, `phase`, `amplitude`, inferred `systems`, `ontologyLayers`
- Initiative-level: `pressure`, `momentum`, `acceleration`, `resonance`, `state`, ontology progression
- Probabilities: `platformFormation`, `fid` (Bayesian-style incremental updates)
- Morning brief helper block: `morningBriefEnhancements`

## Notes
- Uses direct-source scraping first.
- Brave search enrichment is optional and enabled only when `BRAVE_API_KEY` is available.
- If a field is unknown, it is recorded as `MISSING` (never inferred).
- After each run, update per-buyer cards in `mission-control/buyer-cards/`.
- For each material change, append one row to that buyer’s timeline (newest first).
