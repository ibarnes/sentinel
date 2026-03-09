# RP-0043 — Pipeline Per-Stage Status Persistence (TS-H1.2)

## Delivered
Implemented per-stage transition persistence for pipeline runs in `admin-server/src/server.js`.

### Decomposition Gate (applied before execution)
- `TASK-0122` — Define per-stage state model + transition rules
- `TASK-0123` — Persist stage transitions + run-level status derivation
- `TASK-0124` — Add stage transition/read endpoints + smoke + RP

## Code Changes
- Added stage status flow constants:
  - `PIPELINE_STAGE_STATUS_FLOW`
  - `PIPELINE_STAGE_ALLOWED_STATUS`
- Added helpers:
  - `buildInitialPipelineStageState(stages)`
  - `derivePipelineRunStatus(stageState)`
  - `updatePipelineRunStage({ runId, stage, nextStatus, error })`
- Extended run creation:
  - `createPipelineRunRecord(...)` now persists `stageState[]` and derives run `status`.
- Added endpoints:
  - `GET /api/presentation-studio/pipeline/runs/:runId`
  - `PATCH /api/presentation-studio/pipeline/runs/:runId/stages/:stage`
- Added audit event:
  - `pipeline.run.stage.updated`

## Behavior
- New runs initialize with deterministic stage statuses:
  - first stage `in_progress`, remaining stages `pending`
- Stage transitions are validated against flow rules:
  - `pending -> in_progress|skipped`
  - `in_progress -> completed|failed|skipped`
- Run-level status rolls up automatically:
  - `failed` if any stage failed
  - `completed` if all stages completed/skipped
  - `running` if any stage in progress
  - else `started`

## Smoke Evidence
- Command: `node --check admin-server/src/server.js`
- Result: pass

## Risks / Rollback
- Existing run records without `stageState` are backfilled lazily during first stage update.
- Rollback path: remove new helpers/endpoints and revert to prior run shape (`stages` + `status` only).

## Governance
- No tasks moved to Done.
- Parent task moved to Ready for Review with approval request via this RP.
