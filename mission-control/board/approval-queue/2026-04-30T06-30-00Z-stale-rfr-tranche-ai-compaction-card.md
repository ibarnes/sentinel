# Stale RFR Tranche-AI Compaction Card — 2026-04-30 06:30 UTC

Parent stream: TASK-0097 (credential-gated live smoke chain)
Executed decomposition child: TASK-0272

## Stalled list focus
Ready for Review (>24h) credential-gated microtasks in recurring pairs (preflight + fail-fast evidence), including:
- TASK-0171/0172
- TASK-0180/0181
- TASK-0187/0188
- TASK-0192/0193
- TASK-0194/0195
- TASK-0199/0200
- TASK-0201/0202
- TASK-0207/0208
- TASK-0209/0210
- TASK-0214/0215
- TASK-0216/0217
- TASK-0221/0222
- TASK-0227/0228
- TASK-0229/0230
- TASK-0242/0243
- TASK-0244/0245
- TASK-0246/0247
- TASK-0248/0249
- TASK-0256/0257

## Compaction policy
1. Treat pairs as tranche units (A/B preflight+wrapper evidence).
2. Default routing for aged duplicated evidence units: `HOLD_SUPERSEDED` unless explicitly needed for audit continuity.
3. Keep latest two evidence pairs near active parent (`TASK-0097`) as canonical lineage; older duplicates remain discoverable via linked review packets.

## Apply guardrails
- No `Done` transitions without approved RP.
- No deletion of historical artifacts; only status routing/hold annotation.
- Out-of-scope IDs remain untouched.

## Isaac decision needed
- Confirm compaction default for stale tranche-AI units:
  - `APPROVE_TRANSITION` (keep selected units active), or
  - `HOLD_SUPERSEDED` (default for older duplicates).
- Confirm whether any specific pair must remain active for external audit/reporting.
