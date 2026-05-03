# Credentialed Smoke Operator Handoff Refresh — 2026-05-03 16:30 UTC

## Purpose
Single-run execution chain for `TASK-0097` / `TASK-0103` once credentials are provided.

## Required env
- `BASE_URL`
- `TEAM_SESSION_COOKIE`

## Command chain (exact order)
```bash
bash scripts/pipeline-run-credential-preflight.sh
bash scripts/pipeline-run-credentialed-once.sh
node scripts/pipeline-run-evidence-report.mjs
```

## PASS gate
- Preflight returns credential presence (not BLOCKED)
- Credentialed run emits 201/400 expected smoke evidence
- Evidence report generated and attached to board approval queue

## BLOCKED gate
- Missing `BASE_URL` or `TEAM_SESSION_COOKIE`
- Stop; do not mutate parent task states to Done

## Governance
- No Done transitions without approved review packet.
