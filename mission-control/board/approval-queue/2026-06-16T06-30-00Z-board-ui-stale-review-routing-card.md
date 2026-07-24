# Board UI Stale Review Routing Card

Timestamp: 2026-06-16T06:30:00Z
Owner: sentinel
Primary Parent: `TASK-0030`
Related Parent: `TASK-0029`
Executed Child Task: `TASK-0438`

## Purpose
Collapse the stale board UI `Ready for Review` leaves back to the current parent decision surface so the live owner ask is the bundle card, not nine separate aging child rows.

## Current Live Decision Surface
- Bundle card: `mission-control/board/approval-queue/2026-06-16T03-10-00Z-board-ui-review-bundle-card.md`
- Parent approvals still live:
  - `TASK-0029` -> `mission-control/review-packets/RP-2026-06-15T10-40-00Z-board-task-detail-rail-review-refresh.md`
  - `TASK-0030` -> `mission-control/review-packets/RP-2026-06-15T06-30-00Z-board-task-editing-lane-refresh.md`
- Remaining boundary is unchanged:
  - no known unattended coding gap remains
  - only a human-requested interactive replay could add more evidence

## Routed Stale Leaves
### Parent `TASK-0029` - TS-UI1.1 detail rail
| Leaf Task | Updated At | Route To | Why It No Longer Stands Alone |
|---|---|---|---|
| `TASK-0421` | 2026-06-13T03:10:00Z | `TASK-0029` review packet + bundle card | Covered by the refreshed TS-UI1.1 handoff and later isolated validation receipt. |
| `TASK-0422` | 2026-06-13T03:10:00Z | `TASK-0029` review packet + bundle card | Covered by the refreshed TS-UI1.1 handoff and later isolated validation receipt. |
| `TASK-0435` | 2026-06-15T10:40:00Z | `TASK-0029` review packet + bundle card | Evidence leaf only; the parent packet already folds in the authenticated contract-level validation and browser-policy boundary. |

### Parent `TASK-0030` - TS-UI1.2 editing lane
| Leaf Task | Updated At | Route To | Why It No Longer Stands Alone |
|---|---|---|---|
| `TASK-0424` | 2026-06-13T10:40:00Z | `TASK-0030` review packet + bundle card | Included in the full editing-lane refresh packet. |
| `TASK-0425` | 2026-06-13T10:40:00Z | `TASK-0030` review packet + bundle card | Included in the full editing-lane refresh packet. |
| `TASK-0426` | 2026-06-13T16:30:00Z | `TASK-0030` review packet + bundle card | Included in the full editing-lane refresh packet. |
| `TASK-0427` | 2026-06-13T16:30:00Z | `TASK-0030` review packet + bundle card | Included in the full editing-lane refresh packet. |
| `TASK-0428` | 2026-06-14T03:10:00Z | `TASK-0030` review packet + bundle card | Included in the full editing-lane refresh packet. |
| `TASK-0430` | 2026-06-14T10:40:00Z | `TASK-0030` review packet + bundle card | Superseded by the later full-lane refresh packet. |
| `TASK-0431` | 2026-06-14T16:30:00Z | `TASK-0030` review packet + bundle card | Included in the full editing-lane refresh packet. |
| `TASK-0432` | 2026-06-14T16:30:00Z | `TASK-0030` review packet + bundle card | Included in the full editing-lane refresh packet. |
| `TASK-0433` | 2026-06-15T03:10:00Z | `TASK-0030` review packet + bundle card | Included in the full editing-lane refresh packet and named in the bundle card. |

## Review Rule
- Default review path: decide the bundle card, then treat the child rows as evidence leaves unless Isaac explicitly asks for granular child-by-child signoff.
- Do not create more unattended coding tasks from these stale leaves unless an interactive replay surfaces a real defect.

## Governance
- This card does not mutate `BOARD.json` status values.
- No task moved to `Done`, `Superseded`, or `Blocked` because of this artifact.
- `TASK-0107` and `TASK-0269` remain separately blocked and are not hidden by this routing step.
