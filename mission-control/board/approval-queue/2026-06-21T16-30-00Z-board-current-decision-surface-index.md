# June 21 Board Current Decision Surface Index

Timestamp: 2026-06-21T16:30:00Z
Owner: sentinel
Executed Child Task: `TASK-0459`
Scope: `TASK-0029`, `TASK-0030`, `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Name the explicit June 21 source-of-truth packet set for the only live five-row board lane so the next human or operator does not have to infer which older artifacts are still canonical.

## Canonical June 21 Packet Set

| Order | Use | Canonical Artifact | Why It Is Current |
|---|---|---|---|
| 1 | Whole-board decision entry point | `mission-control/board/approval-queue/2026-06-21T06-30-00Z-board-bundle-ballot.md` | Latest coherent five-row ballot; constrains valid reply combinations across TS-UI and recovery lanes. |
| 2 | Fastest recommended reply block | `mission-control/board/approval-queue/2026-06-21T03-10-00Z-board-default-reply-and-sequencing-card.md` | Latest copy-paste default branch plus immediate governed operator order. |
| 3 | TS-UI parent closeout contract | `mission-control/board/approval-queue/2026-06-19T16-30-00Z-board-ui-closeout-preview-refresh.md` | Current parent-only approval write contract for `TASK-0029` and `TASK-0030`. |
| 4 | Default three-row write order | `mission-control/board/approval-queue/2026-06-20T16-30-00Z-default-bundle-write-sequence-receipt.md` | Exact write order for the recommended parked/default branch. |
| 5 | `TASK-0379` close-superseded branch | `mission-control/board/approval-queue/2026-06-20T16-30-00Z-task-0379-superseded-closeout-preview.md` | Current one-row write contract for `TASK-0379 = CLOSE_SUPERSEDED`. |
| 6 | Recovery apply rebuild branch | `mission-control/board/approval-queue/2026-06-19T16-30-00Z-recovery-post-reply-execution-bundle-contract.md` | Current branch contract if Isaac explicitly reopens `TASK-0269` and starts `TASK-0335`. |
| 7 | Residue rescope branch | `mission-control/board/approval-queue/2026-06-18T16-30-00Z-task-0379-rescope-successor-candidate.md` | Current bounded successor if Isaac chooses `TASK-0379 = RESCOPE`. |

## Open Order
1. Open the June 21 ballot first if the question is "what can Isaac validly decide right now?"
2. Open the June 21 default reply card second if the question is "what is the fastest recommended response?"
3. Open the relevant branch contract only after the reply branch is known:
   - TS-UI parent closeout preview for `TASK-0029` / `TASK-0030`
   - `TASK-0379` superseded preview for `CLOSE_SUPERSEDED`
   - recovery post-reply execution bundle contract only for `REOPEN_ACTIVE + START_APPLY`
   - residue rescope successor only for `RESCOPE`

## Historical But Not Current Entry Points
- `mission-control/board/approval-queue/2026-06-20T03-10-00Z-board-night-decision-bundle.md`
  - still useful context, but superseded as the main entry point by the June 21 ballot plus June 21 default reply card
- `mission-control/board/approval-queue/2026-06-20T06-30-00Z-stalled-board-decision-shortcut.md`
  - still valid shorthand, but superseded by the June 21 default reply card
- `mission-control/board/approval-queue/2026-06-06T06-30-00Z-board-recovery-decision-pack.md`
  - historical reference only; not a live execution entry point after the June 19 drift receipt

## Live Row Mapping
- `TASK-0029` and `TASK-0030`
  - canonical ask: approve closeout bundle or hold for interactive replay
- `TASK-0269`
  - canonical ask: keep blocked or reopen active
- `TASK-0335`
  - canonical ask: hold or start apply, but only if `TASK-0269 = REOPEN_ACTIVE`
- `TASK-0379`
  - canonical ask: close superseded or rescope

## Governance
- Index only.
- Does not mutate `BOARD.json`.
- Exists to stop artifact drift from becoming the hidden blocker.
