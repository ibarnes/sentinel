# July 11 Stale Review Contraction Card
Generated: 2026-07-11 06:30 UTC

## Live reread
- Re-read live `mission-control/board/BOARD.json` at sweep time.
- Truthful stalled open set at `2026-07-11T06:30:00Z`:
  - `0` `Doing >48h`
  - `11` stale `Ready for Review >24h`
  - blocked parents: `TASK-0107`, `TASK-0269`
  - decision-gated followers still waiting on owner choice: `TASK-0335`, `TASK-0379`

## Stale `Ready for Review` rows
1. `TASK-0421` - TS-UI1.1a Add persistent board detail rail + route-bound task selection
2. `TASK-0422` - TS-UI1.1b Harden board panel reopen state + comment metadata fidelity
3. `TASK-0424` - TS-UI1.2a Add actionable board-detail save validation and error surfacing
4. `TASK-0425` - TS-UI1.2b Honor selected board status on save via governed move sequencing
5. `TASK-0426` - TS-UI1.2c Replace board-detail comment alerts with inline notice flow
6. `TASK-0427` - TS-UI1.2d Inline approval request UX and review-packet status in board detail rail
7. `TASK-0428` - TS-UI1.2e Add acceptance-criteria editing to board detail rail
8. `TASK-0430` - TS-UI1.2f Publish editing-lane review handoff and realign parent status
9. `TASK-0431` - TS-UI1.2g Normalize legacy BOARD rows before strict write validation
10. `TASK-0432` - TS-UI1.2h Publish isolated board smoke receipt and governed approval blocker
11. `TASK-0433` - TS-UI1.2i Surface board approval gate blockers before request-approval submit

## Why the bucket contracted
- The July 10 recovery sweep refreshed these rows at `2026-07-10T06:31:46Z`:
  - `TASK-0029`
  - `TASK-0030`
  - `TASK-0107`
  - `TASK-0269`
- As of `2026-07-11T06:30:00Z`, `TASK-0029`, `TASK-0030`, and `TASK-0269` are each still just under `24h` old from that linkage refresh, so it would be inaccurate to keep counting them in the stale-review bucket.
- The blocked parent lane still matters, but the truthful stale-review surface is the 11 child leaves above, not yesterday's 14-row shape.

## Decomposition gate result
- No fresh implementation decomposition is honest tonight.
- The remaining stale TS-UI leaves are already bounded `30-90m` children with explicit `parent_id` and `acceptance_criteria`.
- `TASK-0107` and `TASK-0269` remain blocked for owner choice, not because they are oversized or under-specified.
- `TASK-0335` and `TASK-0379` remain atomic decision-gated apply slices with explicit acceptance criteria and should not be reopened without owner input.

## Smallest current decision surface
- Default compact tuple remains:
  - `TASK-0029 = APPROVE_CLOSEOUT_BUNDLE`
  - `TASK-0030 = APPROVE_CLOSEOUT_BUNDLE`
  - `TASK-0269 = BLOCKED_KEEP`
  - `TASK-0335 = HOLD`
  - `TASK-0379 = CLOSE_SUPERSEDED`
- Interactive replay branch remains:
  - `TASK-0029 = HOLD_FOR_INTERACTIVE_REPLAY`
  - `TASK-0030 = HOLD_FOR_INTERACTIVE_REPLAY`
- Reopen branch remains:
  - `TASK-0269 = REOPEN_ACTIVE`
  - choose `TASK-0335 = START_APPLY` or `TASK-0335 = HOLD`

## Governance
- Routing-only artifact.
- No blocked apply path started.
- No board status changed.
