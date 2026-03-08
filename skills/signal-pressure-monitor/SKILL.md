# signal-pressure-monitor

Automate platform-formation signal collection across four channels: **news, technology, politics, capital**.

## Purpose
Collect only signals that anchor to at least one internal object:
- buyers
- initiatives
- infrastructure lifecycle layers

Reject generic news with no platform-formation pressure.

## Inputs
- `dashboard/data/signals.json` (raw/legacy signal intake)
- `dashboard/data/buyers.json`
- `dashboard/data/initiatives.json`

## Required tags per collected signal
- `channel` (news|technology|politics|capital)
- `related_buyers` (if applicable)
- `related_initiatives` (if applicable)
- `lifecycle_layers`
- `confidence_score`
- `verification_status`
- `verification_basis`

## Run
```bash
node mission-control/signal-pressure/run-signal-pressure-monitor.mjs
```

## Outputs
- `mission-control/signal-pressure/out/signals.jsonl`
- `mission-control/signal-pressure/out/pressure-delta.json`
- `mission-control/review-packets/RP-<timestamp>-signal-pressure-monitor.md`

## Heartbeat behavior
Heartbeat should only inspect `pressure-delta.json` and emit user-visible update **only** when meaningful new pressure appears.

## Cron behavior
Use deterministic runs for collection/normalization:
- Pre-brief collection
- Verification pass
- Midday refresh
- End-of-day drift scan

See: `mission-control/signal-pressure/cron/signal-pressure.cron.example`
