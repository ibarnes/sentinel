# Credential Window Launch Checklist — 2026-03-14 03:10 UTC

## Objective
Close `TASK-0111 -> TASK-0103 -> TASK-0097 -> TASK-0095 -> TASK-0043` in one credentialed window.

## Preconditions
1. `BASE_URL` exported.
2. `TEAM_SESSION_COOKIE` exported.
3. `scripts/pipeline-run-credentialed-once.sh` executable.

## Command Sequence
```bash
# 1) Preflight
./scripts/pipeline-run-credential-preflight.sh

# 2) One-pass run + capture
./scripts/pipeline-run-credentialed-once.sh

# 3) Closeout report
scripts/pipeline-run-closeout.sh <evidence-dir>
```

## PASS Criteria
- Valid-path result captured (`HTTP 201`, includes `runId`, `status=started`).
- Invalid-path result captured (`HTTP 400`, deterministic validation error).
- Evidence report status is `PASS`.
- Transition plan + action card generated.

## Immediate Board Replay Order (post-PASS)
1. `TASK-0111` -> Ready for Review (evidence attached)
2. `TASK-0103` -> Ready for Review
3. `TASK-0097` -> Ready for Review
4. `TASK-0095` -> Ready for Review
5. `TASK-0043` -> Ready for Review

## BLOCKED Branch
- Attach preflight artifact and one-pass runner output.
- Record exact missing env/credential reason.
- Keep statuses unchanged; schedule next credential window.
