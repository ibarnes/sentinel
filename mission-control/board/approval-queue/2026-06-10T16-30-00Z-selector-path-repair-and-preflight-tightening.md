# Selector Path Repair + Preflight Tightening (2026-06-10T16:30:00Z)

- Parent Stream: TASK-0103
- Subtask Candidate: TASK-0406
- Sweep: Board Progress Sweep (Midday)

## What changed
- Repaired selector-mode deck resolution in `scripts/pipeline-run-smoke.sh` to use the server's live `GET /api/presentation-studio/decks/resolve` contract with query parameters.
- Tightened `scripts/pipeline-run-credential-preflight.sh` so it now blocks unless auth env is present and one targeting mode is supplied:
  - direct: `DECK_ID`
  - selector: `INITIATIVE_ID + DECK_TYPE` with optional `BUYER_ID`
- Updated `scripts/pipeline-run-smoke-capture.sh` so `manifest.json` retains the resolved `deck_id` even when the run started from selector mode.

## Why it matters
- Before this repair, selector mode could not reliably resolve a deck because the harness used the wrong HTTP method for the live server route.
- Even if selector mode succeeded, the capture manifest could still lose the resolved `deckId`, weakening later audit and transition checks.
- Preflight now fails on the same missing-target condition that blocks the real smoke, so the operator gets a true go/no-go gate instead of a false PASS.

## Acceptance check
- `bash -n` passes for the patched shell scripts.
- Preflight exits blocked without a target mode.
- Preflight exits pass when auth env plus a valid direct or selector target mode is supplied.

## Remaining gate
- Live smoke is still blocked in unattended cron until Isaac supplies `BASE_URL`, `TEAM_SESSION_COOKIE`, and chooses a concrete target mode.
