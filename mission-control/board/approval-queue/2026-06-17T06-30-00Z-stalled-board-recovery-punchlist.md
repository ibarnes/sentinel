# June 17 Stalled Board Recovery Punchlist

Timestamp: 2026-06-17T06:30:00Z
Owner: sentinel
Executed Child Task: `TASK-0442`
Primary Parent: `TASK-0107`

## Purpose
Publish one current stalled-work punchlist for the late-night sweep so the board shows the real queue shape: 12 aging review leaves already routed to one live parent bundle, plus the 3-row recovery minimum that still cannot move without Isaac decisions.

## Stalled Set At Sweep Time
- `In Progress >48h`: none
- `Ready for Review >24h`: 12 rows
- `Blocked`: 2 rows

## Ready for Review >24h
These are evidence leaves, not 12 separate live approval asks.

### Routed to `TASK-0029`
- `TASK-0421` - 99.3h stale
- `TASK-0422` - 99.3h stale
- `TASK-0435` - 43.8h stale

Decision surface:
- active parent: `TASK-0029`
- active bundle branch: `APPROVE_CLOSEOUT_BUNDLE` or `HOLD_FOR_INTERACTIVE_REPLAY`

### Routed to `TASK-0030`
- `TASK-0424` - 91.8h stale
- `TASK-0425` - 91.8h stale
- `TASK-0426` - 86.0h stale
- `TASK-0427` - 86.0h stale
- `TASK-0428` - 75.3h stale
- `TASK-0430` - 67.8h stale
- `TASK-0431` - 62.0h stale
- `TASK-0432` - 62.0h stale
- `TASK-0433` - 51.3h stale

Decision surface:
- active parent: `TASK-0030`
- active bundle branch: `APPROVE_CLOSEOUT_BUNDLE`, `HOLD_FOR_INTERACTIVE_REPLAY`, or split hold only if Isaac wants replay

## Blocked / Decision-Gated Recovery Minimum
- `TASK-0269` - `Blocked` - 96.0h since update
- `TASK-0107` - `Blocked` - 67.8h since update
- `TASK-0335` - `Todo`, decision-gated apply row under `TASK-0269`
- `TASK-0379` - `Todo`, decision-gated residue row under `TASK-0107`

## Recovery Plan
1. Close the TS-UI1.x parent review surface instead of treating the 12 child leaves as separate decisions.
2. Preserve `TASK-0269` as blocked unless Isaac explicitly changes lane posture.
3. Do not start `TASK-0335` without an explicit `START_APPLY` decision.
4. Either close `TASK-0379` as superseded or rescope it into one new bounded slice.

## Exact Owner Reply Block
```text
BOARD STALLED RECOVERY
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE or HOLD_FOR_INTERACTIVE_REPLAY | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE or HOLD_FOR_INTERACTIVE_REPLAY | note=
TASK-0269 | decision=BLOCKED_KEEP or CLOSE_SUPERSEDED or REOPEN_ACTIVE | note=
TASK-0335 | decision=START_APPLY or HOLD | note=
TASK-0379 | decision=CLOSE_SUPERSEDED or RESCOPE | note=
```

## Recommended Defaults
- `TASK-0029`: `APPROVE_CLOSEOUT_BUNDLE`
- `TASK-0030`: `APPROVE_CLOSEOUT_BUNDLE`
- `TASK-0269`: `BLOCKED_KEEP`
- `TASK-0335`: `HOLD`
- `TASK-0379`: `CLOSE_SUPERSEDED`

## Governance
- This artifact is routing only.
- No `BOARD.json` status mutation was performed here.
- The only executed work in this sweep is the punchlist publication itself.
