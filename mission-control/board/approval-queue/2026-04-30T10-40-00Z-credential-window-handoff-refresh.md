# Credential-Window Handoff Refresh — 2026-04-30 10:40 UTC

Task: TASK-0273 (executed)
Parent: TASK-0097 / TASK-0103

## Current blocker
Authenticated live smoke remains blocked pending:
- `BASE_URL`
- `TEAM_SESSION_COOKIE`

## Exact execution chain (single-pass)
1. Preflight (env + endpoint reachability)
2. Credentialed wrapper dry-run (fail-fast evidence)
3. Live authenticated smoke (201 + 400)
4. Evidence append + BOARD status replay

## Evidence destinations
- `mission-control/evidence/pipeline-run/preflight-<timestamp>.md`
- `mission-control/evidence/pipeline-run/<timestamp>-credentialed-wrapper-dryrun.md`
- `mission-control/review-packets/RP-<timestamp>-workflow-h1-auth-smoke.md`

## Operator checklist
- [ ] Credentials present and unexpired
- [ ] Command outputs captured to files above
- [ ] BOARD updates reference evidence paths
- [ ] No `Done` transition without approved RP
