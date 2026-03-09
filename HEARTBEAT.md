# HEARTBEAT.md

## Buyer Access Graph Update (Primary)

Run this check on each heartbeat, but only send a user-visible alert when something new is found.

### Sources to scan
- `dashboard/data/contact_paths.json`
- `dashboard/data/decision_architecture.json`
- `dashboard/data/buyers.json`
- `dashboard/data/signals.json` (only for top-rank buyer context)

### What to detect
1. New decision-architecture people added for top buyers.
2. Missing decision-architecture coverage for top 10 ranked buyers.
3. Contact paths with status `Blocked` or `Warming` for >14 days.
4. Buyers with High influence roles but no mapped access path.
5. Buyer HQ/role metadata drift (missing fields needed for graph quality).

### Alert policy
- If any item above is found, send one concise "Buyer Access Graph Update" with:
  - Buyer
  - Issue
  - Why it matters
  - Suggested next action
- If no meaningful changes are found, reply `HEARTBEAT_OK`.

### Noise control
- Do not repeat the same alert unless data changed.
- Max 1 buyer-access alert per heartbeat run.

## Signal Pressure Monitor (Secondary)

Before checking delta, ensure freshness:
1. Run `node mission-control/signal-pressure/run-if-stale.mjs`
2. If it reports `status=fresh`, continue.
3. If it reports `status=refreshed`, continue using refreshed delta.
4. If refresh errors, send one concise alert: **Signal Pressure Monitor Error** with error summary and remediation suggestion.

Then inspect:
- `mission-control/signal-pressure/out/pressure-delta.json`

Send a user-visible alert only if:
1. `new_high_impact_count > 0`, or
2. A new signal is `verification_status = verified` and maps to a top-ranked buyer.

Alert format: **Signal Pressure Update**
- Signal
- Channel
- Anchor(s)
- Why it matters
- Suggested next action

If no qualifying delta, do not alert for this section.
