# Credential Smoke Evidence Handoff Card — 2026-05-02 10:40 UTC

## Objective
Unblock `TASK-0097` / `TASK-0103` immediately when credentials are present.

## Inputs required
- `BASE_URL`
- `TEAM_SESSION_COOKIE`

## One-pass command sequence
```bash
export BASE_URL="<live-base-url>"
export TEAM_SESSION_COOKIE="<cookie>"
bash scripts/pipeline-run-credential-preflight.sh && \
  bash scripts/pipeline-run-credentialed-once.sh && \
  node scripts/pipeline-run-evidence-report.mjs
```

## Expected evidence
- Preflight PASS output
- 201 success with `runId`
- 400 validation failure path
- Evidence report artifact path

## Governance
- Do not mark Done without approved RP.
- Attach evidence path comments to `TASK-0097` and `TASK-0103`.
