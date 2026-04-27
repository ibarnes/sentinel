# Credential Window Run Card — 2026-04-27T16:30:00Z

## Objective
Unblock `TASK-0097` / `TASK-0103` by executing one credentialed smoke window for `POST /pipeline/run` (201 + 400) and capturing evidence.

## Required Inputs
- `BASE_URL`
- `TEAM_SESSION_COOKIE`

## Exact Command Sequence
```bash
export BASE_URL='<https://...>'
export TEAM_SESSION_COOKIE='...'
bash scripts/pipeline-run-credential-preflight.sh
bash scripts/pipeline-run-credentialed-once.sh
# closeout command emitted by wrapper output
```

## Expected Evidence
- Preflight markdown with `Status: READY`
- Wrapper outputs for:
  - 201 success (`runId`, `status=started`)
  - 400 validation failure
- Evidence report from closeout path

## Decision Format
Reply in one line:

`Credential Window: APPROVED | BASE_URL=<...> | TEAM_SESSION_COOKIE=<...>`

Or:

`Credential Window: HOLD | reason=<...>`

## Guardrail
No `Done` transition for parent pipeline tasks without credentialed evidence attached and reviewed.
