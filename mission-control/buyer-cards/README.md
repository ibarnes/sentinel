# Buyer Cards

Persistent buyer cards for Workflow A tracking.

## Purpose
Each buyer has one card that keeps:
- Current snapshot (latest posture)
- Verification status against threshold
- Recommended next action
- Timeline of developments over time

## Update Rules
1. Add a new timeline row for every material development (do not overwrite prior rows).
2. Keep newest entries at the top of the timeline table.
3. Tag verification level exactly:
   - `Verified` (first-party OR 2x Tier-1 with attribution OR on-record executive statement)
   - `Monitor` (below threshold)
4. If no new development, add nothing.
5. Keep recommendations short and executable.

## Card Files
- `PIF.md`
- `GIC.md`
- `Brookfield-Renewable.md`
- `GIP.md`
- `Nigeria-Mortgage-Fund.md`
