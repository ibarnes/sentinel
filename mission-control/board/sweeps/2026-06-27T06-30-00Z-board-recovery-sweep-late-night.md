# Board Recovery Sweep (Late Night)
Generated: 2026-06-27 06:30 UTC

## Queue read
- Re-read live `mission-control/board/BOARD.json` before execution.
- Stalled open set at sweep start:
  - `0` `Doing >48h`
  - `14` stale `Ready for Review >24h`
  - blocked parents: `TASK-0107`, `TASK-0269`
  - branch-gated dependents still waiting on an owner branch: `TASK-0335`, `TASK-0379`

## Mandatory decomposition gate

### Oversized stalled work check
- No stalled row needed fresh implementation decomposition.
- The 12 stale TS-UI review leaves remain atomic `30-90m` children under `TASK-0029` and `TASK-0030`.
- `TASK-0029` and `TASK-0030` have now crossed from the June 26 edge condition into fully stale parent review asks at `48.0h`.
- `TASK-0335` and `TASK-0379` remain atomic branch-gated slices, and `TASK-0269` remains owner-decision-blocked rather than under-decomposed.

### Executable unblock selected
- Parent lane: `TASK-0107` - BRS-2026-03-07 Recover stale Ready for Review queue via decision tranche C
- Why this won:
  - no blocked or review-gated row became honestly executable as unattended implementation work
  - the real change since the prior late-night sweep is that the two TS-UI parent asks crossed into clearly stale status
  - one bounded routing artifact could capture that threshold crossing and reduce the live decision surface without violating any blocked apply boundary

### Subtask executed
- `TASK-0491` - Publish stale-parent threshold crossing card for the live five-row lane
- Timebox: `30-45 min`
- Acceptance criteria:
  - Artifact lists the full stalled open set at sweep start, including `0` `Doing >48h`, `14` stale `Ready for Review >24h`, and blocked parents `TASK-0107` / `TASK-0269`.
  - Artifact confirms no fresh implementation decomposition is honest because the stale TS-UI leaves and recovery branch slices already carry explicit `acceptance_criteria` and `parent_id` structure.
  - Artifact includes one exact default reply tuple plus the alternate replay/reopen branch rules without mutating `BOARD.json` statuses.
  - Board linkage points the live parent rows to the June 27 recovery surfaces.

## Artifacts produced
- `mission-control/board/approval-queue/2026-06-27T06-30-00Z-stalled-parent-threshold-crossing-card.md`
- `mission-control/board/sweeps/2026-06-27T06-30-00Z-board-recovery-sweep-late-night.md`

## Board linkage
- updated `mission-control/board/BOARD.json` to attach the June 27 threshold-crossing card and sweep to `TASK-0107`, `TASK-0029`, and `TASK-0030`
- added completed subtask `TASK-0491`

## Isaac decision needed next
- If no interactive replay is required, approve the compact default tuple:
  - `TASK-0029 = APPROVE_CLOSEOUT_BUNDLE`
  - `TASK-0030 = APPROVE_CLOSEOUT_BUNDLE`
  - `TASK-0269 = BLOCKED_KEEP`
  - `TASK-0335 = HOLD`
  - `TASK-0379 = CLOSE_SUPERSEDED`
- If interactive proof is required, the only change needed is:
  - `TASK-0029 = HOLD_FOR_INTERACTIVE_REPLAY`
  - `TASK-0030 = HOLD_FOR_INTERACTIVE_REPLAY`

## Verification
```bash
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('mission-control/board/BOARD.json','utf8')); console.log('board-json-ok')"
```

## Governance
- Work stayed routing-only and proof-oriented.
- No `Ready for Review`, `Blocked`, or `Todo` status changed.
- No blocked apply path was started.
