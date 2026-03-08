# Signal Pressure Monitor

Automated normalization and pressure-delta detection for signals anchored to buyers/initiatives/lifecycle layers.

## Run

```bash
node mission-control/signal-pressure/run-signal-pressure-monitor.mjs
```

## Artifacts
- `out/signals.jsonl` — normalized signal ledger
- `out/pressure-delta.json` — novelty + high-impact delta for heartbeat checks
- `mission-control/review-packets/RP-*-signal-pressure-monitor.md` — run packet

## Cron
Use template:
- `cron/signal-pressure.cron.example`
