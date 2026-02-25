---
rp_id: RP-0008
title: Activity Feed + Review Packet Governance Layer v1.0
linked_task: TASK-GOV-001
created_by: sentinel
created_at: 2026-02-25T04:22:45Z
status: Ready for Review
recommended_action: Approve
architect_decision: null
architect_notes: null
---

# RP-0008 — Activity Feed + Review Packet Governance Layer

## Scope delivered
- Immutable append-only activity feed at `mission-control/activity/YYYY-MM-DD.jsonl`
- Dashboard activity page (`/dashboard/activity`) with filters by actor/entity/date
- Review packet governance with architect-only approve/reject/archive actions
- Board rule: tasks cannot move to `Done` without approved RP
- Auto RP creation when moving task to `Ready for Review`
- UOS upload now stages to `workspace/uos/pending/<batch>` and creates Draft RP
- UOS publish endpoint requires Approved RP
- Snapshot + changelog updates on key state changes

## Event model
Stored events use:
- ts, actor, role, event_type, entity_type, entity_id, meta

Covered event families:
- task.*
- rp.*
- uos.*
- workflow.*
- cron.trigger (via `/api/events`)
- login.success / login.failed / permission.denied

## Non-negotiables enforced
- Append-only activity logs
- No silent edit path for RP state transitions
- Task `Done` blocked without approved RP

## Files changed
- `admin-server/src/server.js`
- `mission-control/board/BOARD.json`
- `mission-control/board/BOARD.schema.json`
- `mission-control/review-packets/*` (frontmatter governance)
- nginx routing for new endpoints

## Verify
1. `/dashboard/activity` shows reverse chronological feed.
2. Move task to Done without approved RP returns 400.
3. Move task to Ready for Review creates RP + `rp.create` event.
4. Architect approves RP -> task auto Done + `rp.approve` event.
