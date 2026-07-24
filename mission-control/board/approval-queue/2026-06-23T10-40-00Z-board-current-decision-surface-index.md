# June 23 Board Current Decision Surface Index

Timestamp: 2026-06-23T10:40:00Z
Owner: sentinel
Executed Child Task: `TASK-0467`
Scope: `TASK-0029`, `TASK-0030`, `TASK-0269`, `TASK-0335`, `TASK-0379`

## Purpose
Refresh the canonical packet map for the only live five-row board lane so the morning operator surface resolves from one June 23 entry point instead of a June 21 index plus a separate June 22/23 freshness chain.

## Canonical June 23 Packet Set

| Order | Use | Canonical Artifact | Why It Is Current |
|---|---|---|---|
| 1 | Whole-lane entry point | `mission-control/board/approval-queue/2026-06-23T10-40-00Z-board-current-decision-surface-index.md` | This file replaces the June 21 index as the top-level operator map after the June 22 fast path, same-day proof, branch map, and June 23 no-drift receipt. |
| 2 | Fastest recommended reply block | `mission-control/board/approval-queue/2026-06-22T06-30-00Z-board-default-branch-fast-path.md` | Still the smallest honest copy-paste owner reply surface for the recommended parked/default branch. |
| 3 | Same-day proof of exact default write set | `mission-control/board/approval-queue/2026-06-22T16-30-00Z-board-default-branch-current-state-receipt.md` | Confirms the recommended tuple still resolves to the same three-row write set and explicit non-write boundary. |
| 4 | Branch-to-contract lookup | `mission-control/board/approval-queue/2026-06-22T16-30-00Z-board-branch-to-contract-operator-map.md` | Maps each valid live branch to the exact downstream contract and immediate Sentinel action. |
| 5 | Freshness / no-drift proof | `mission-control/board/approval-queue/2026-06-23T06-30-00Z-board-lane-overnight-no-drift-receipt.md` | Confirms the June 22 fast path and branch map still match live `BOARD.json` statuses on the morning of June 23. |
| 6 | TS-UI parent closeout contract | `mission-control/board/approval-queue/2026-06-19T16-30-00Z-board-ui-closeout-preview-refresh.md` | Current parent-only write contract if Isaac approves the TS-UI closeout bundle. |
| 7 | Default three-row write order | `mission-control/board/approval-queue/2026-06-20T16-30-00Z-default-bundle-write-sequence-receipt.md` | Exact governed write sequence for the recommended default branch. |
| 8 | `TASK-0379` close-superseded branch | `mission-control/board/approval-queue/2026-06-20T16-30-00Z-task-0379-superseded-closeout-preview.md` | Current one-row write contract for `TASK-0379 = CLOSE_SUPERSEDED`. |
| 9 | Recovery apply rebuild branch | `mission-control/board/approval-queue/2026-06-19T16-30-00Z-recovery-post-reply-execution-bundle-contract.md` | Current branch contract if Isaac explicitly chooses `TASK-0269 = REOPEN_ACTIVE` and `TASK-0335 = START_APPLY`. |
| 10 | `TASK-0379` rescope branch | `mission-control/board/approval-queue/2026-06-18T16-30-00Z-task-0379-rescope-successor-candidate.md` | Current bounded successor contract if Isaac chooses `TASK-0379 = RESCOPE`. |

## Open Order
1. Start here if the question is "what is the current live decision surface right now?"
2. Open the June 22 fast-path card next if the goal is the shortest coherent owner reply.
3. Open the June 22 current-state receipt if the question is "what exactly moves on the default branch?"
4. Open the June 22 branch map only after the chosen branch is known.
5. Open the downstream write/rebuild contract only after the branch is explicitly selected.

## Historical But No Longer Top-Level Entry Points
- `mission-control/board/approval-queue/2026-06-21T16-30-00Z-board-current-decision-surface-index.md`
  - still useful history, but superseded by this June 23 index because the canonical packet set now includes the June 22 fast path, same-day proof, branch map, and the June 23 no-drift receipt
- `mission-control/board/approval-queue/2026-06-21T06-30-00Z-board-bundle-ballot.md`
  - still valid context for broader branch combinations, but no longer the smallest current entry point
- `mission-control/board/approval-queue/2026-06-20T03-10-00Z-board-night-decision-bundle.md`
  - historical context only; superseded by the June 21 and June 22 operator surfaces

## Live Row Mapping
- `TASK-0029`
  - canonical ask: approve closeout bundle or hold for interactive replay
- `TASK-0030`
  - canonical ask: approve closeout bundle or hold for interactive replay
- `TASK-0269`
  - canonical ask: keep blocked or reopen active
- `TASK-0335`
  - canonical ask: hold or start apply, but only if `TASK-0269 = REOPEN_ACTIVE`
- `TASK-0379`
  - canonical ask: close superseded or rescope

## Recommended Morning Branch

```text
BOARD FAST PATH
TASK-0029 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0030 | decision=APPROVE_CLOSEOUT_BUNDLE | note=
TASK-0269 | decision=BLOCKED_KEEP | note=
TASK-0335 | decision=HOLD | note=
TASK-0379 | decision=CLOSE_SUPERSEDED | note=
```

## Governance
- Index only.
- Does not mutate `BOARD.json`.
- Exists to stop artifact drift and entry-point sprawl from becoming the hidden blocker.
