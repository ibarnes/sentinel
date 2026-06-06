# Board Recovery Apply Preview

Timestamp: 2026-06-06T16:30:00Z
Owner: sentinel
Primary Parent: TASK-0107
Secondary Parent: TASK-0269

## Purpose
Create one deterministic preview surface for the unified recovery packet so the post-decision apply pass is zero-guess:
- validate whether Section A (TASK-0335) is ready
- validate whether Section B (TASK-0379) is ready
- show the exact statuses that would change before any writeback to BOARD.json

## Commands
- Validation: node scripts/board/tranche-ah-decision-validate.mjs mission-control/board/approval-queue/2026-06-06T06-30-00Z-board-recovery-decision-pack.md
- Apply preview: node scripts/board/board-recovery-apply-preview.mjs mission-control/board/BOARD.json mission-control/board/approval-queue/2026-06-06T06-30-00Z-board-recovery-decision-pack.md

## Current Preview Result
- Packet readiness: blocked
- Section A apply task TASK-0335 blocked on 6 missing Isaac decisions
- Section B apply task TASK-0379 blocked on 12 missing Isaac decisions
- Current status drift detected: none

## Planned Status Rules Once Filled
### Section A
- Approve + target status: apply exact target status
- Hold: keep current status
- Needs Changes: keep current status and route back for correction

### Section B
- APPROVE_COMPACT: change only the listed stale row to Superseded
- HOLD_RETAIN: keep current status
- Never mutate retained canonical tasks: TASK-0355, TASK-0364, TASK-0374, TASK-0375

## Governance
- This is a preview-only artifact. No board mutation is authorized here.
- Run the preview again immediately after Isaac fills the packet; only then execute TASK-0335 and/or TASK-0379.
