# Credential Window One-Pass Checklist (Night Build)

- Scope: `TASK-0103` credentialed live smoke closure (`201` + `400`) in one pass.
- Preconditions (must all be present):
  - `BASE_URL`
  - `TEAM_SESSION_COOKIE`
  - `DECK_ID`
- Execution command:
  - `BASE_URL=... TEAM_SESSION_COOKIE=... DECK_ID=... scripts/pipeline-run-credentialed-once.sh`
- Expected acceptance evidence:
  1. `mission-control/evidence/pipeline-run/*/live-valid-201.json`
  2. `mission-control/evidence/pipeline-run/*/live-invalid-400.json`
  3. `mission-control/evidence/pipeline-run/*/evidence-report.md`
- Fail-fast rule:
  - If any required env var is missing, stop immediately and capture blocker in preflight artifact.
- Governance:
  - No Done transitions without approved RP.
  - Parent stream remains In Progress until credentialed artifacts are attached.
