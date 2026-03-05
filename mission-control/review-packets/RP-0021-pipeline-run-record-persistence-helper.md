# RP-0021 — TS-H1.1b runId + run-record persistence helper

## Summary
Implemented persisted pipeline run record scaffolding for Presentation Studio.

## Scope Delivered
- Added pipeline run store path: `dashboard/data/pipeline_runs.v1.json`
- Added default store shape:
  - `version`
  - `runs[]`
- Added read/write helpers:
  - `readPipelineRunStore()`
  - `writePipelineRunStore()`
- Added deterministic payload normalization:
  - `normalizePipelineRunPayload(payload)`
  - Enforces scope, slideId conditional, stage enum, non-empty, no duplicates
- Added run record creation helper:
  - `buildPipelineRunId()`
  - `createPipelineRunRecord()`
  - Persists `runId, deckId, scope, slideId, stages, status, createdAt, updatedAt`
- Added file bootstrap in `ensureTeamAndBoardFiles()` to initialize pipeline run store if missing.

## Validation
- Static syntax check passed:
  - `node --check admin-server/src/server.js`

## Files Changed
- `admin-server/src/server.js`

## Risk
- Low. Changes are additive and isolated to Presentation Studio pipeline-run scaffolding.

## Recommended Decision
- Approve and merge.
