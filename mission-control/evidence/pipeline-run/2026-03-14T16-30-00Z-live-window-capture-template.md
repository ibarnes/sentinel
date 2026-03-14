# Live Credential Window Capture Template

- Window timestamp (UTC): 2026-03-14T16:30:00Z
- Parent chain: TASK-0111 -> TASK-0103 -> TASK-0097 -> TASK-0095 -> TASK-0043

## Preconditions
- [ ] `BASE_URL` set
- [ ] `TEAM_SESSION_COOKIE` set
- [ ] `DECK_ID` set **or** selector inputs (`INITIATIVE_ID` + `DECK_TYPE` [+ `BUYER_ID`])
- [ ] `scripts/pipeline-run-credential-env-check.sh` returns PASS

## Execution
```bash
scripts/pipeline-run-credentialed-once.sh
```

## Required output capture
- [ ] Evidence directory path printed by wrapper
- [ ] `valid-response.json` includes `runId` and `status: started`
- [ ] `invalid-response.json` includes deterministic 400 validation error payload
- [ ] `evidence-report.md` status = PASS
- [ ] `transition-plan.json` generated

## Post-exec replay (no Done transitions)
1. Update TASK-0111 with evidence paths
2. Update TASK-0103 with PASS evidence + next transition action
3. Update TASK-0097/TASK-0095/TASK-0043 to Ready for Review only if acceptance criteria are met
4. Keep governance guardrail: no Done without approved RP
