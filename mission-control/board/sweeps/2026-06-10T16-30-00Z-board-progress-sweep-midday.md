# Board Progress Sweep (Midday) — 2026-06-10T16:30:00Z

## Active Stream
- Highest-priority in-progress lane remained the authenticated `/pipeline/run` closure chain: `TASK-0103 -> TASK-0097 -> TASK-0095 -> TASK-0043`.
- Direct parent execution remained inappropriate because live closure is still credential-gated.

## Decomposition Gate
- Added and completed two 30-60 minute atomic subtasks under `TASK-0103`:
  - `TASK-0406` — repair selector-path execution and tighten preflight target gating
  - `TASK-0407` — publish current selector-safe target candidate and explicit Isaac decision boundary

## What moved
- Patched `scripts/pipeline-run-smoke.sh` so selector mode now uses the live server's `GET /api/presentation-studio/decks/resolve` route instead of an incompatible POST.
- Patched `scripts/pipeline-run-smoke-capture.sh` so selector-resolved runs preserve `deck_id` in `manifest.json`.
- Patched `scripts/pipeline-run-credential-preflight.sh` so it now blocks unless both auth env and one targeting mode are present.
- Published review artifacts:
  - `mission-control/board/approval-queue/2026-06-10T16-30-00Z-selector-path-repair-and-preflight-tightening.md`
  - `mission-control/board/approval-queue/2026-06-10T16-30-00Z-selector-target-candidate-note.md`

## Blockers
- `BASE_URL` still not present in unattended runtime.
- `TEAM_SESSION_COOKIE` still not present in unattended runtime.
- Isaac still needs to choose whether the next smoke uses the archived test deck (`INIT-001::utc-internal::none`) for fastest technical closure or a live initiative/deck target for business-relevant evidence.

## Outcome
- `TASK-0406` and `TASK-0407` are ready for review.
- Parent chain remains open, but the target-selection path is now narrower and the selector-mode harness bug is removed.
