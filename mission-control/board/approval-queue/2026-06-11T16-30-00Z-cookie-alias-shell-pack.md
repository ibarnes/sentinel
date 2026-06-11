# Cookie Alias Shell Pack (2026-06-11T16:30:00Z)

- Parent Stream: TASK-0103
- Subtask Candidates: TASK-0411, TASK-0412
- Sweep: Board Progress Sweep (Midday)

## Canonical auth env
- Preferred: `TEAM_SESSION_COOKIE`
- Legacy alias still accepted: `COOKIE`
- `BASE_URL` remains required.

## Lowest-risk direct mode
```bash
export BASE_URL='https://<target-host>'
export TEAM_SESSION_COOKIE='connect.sid=<redacted>'
export DECK_ID='INIT-001::utc-internal::none'
bash scripts/pipeline-run-credential-preflight.sh
bash scripts/pipeline-run-credentialed-once.sh
```

## Selector mode
```bash
export BASE_URL='https://<target-host>'
export TEAM_SESSION_COOKIE='connect.sid=<redacted>'
export INITIATIVE_ID='INIT-001'
export DECK_TYPE='utc-internal'
unset BUYER_ID
bash scripts/pipeline-run-credential-preflight.sh
bash scripts/pipeline-run-credentialed-once.sh
```

## Legacy alias fallback
```bash
export BASE_URL='https://<target-host>'
export COOKIE='connect.sid=<redacted>'
export DECK_ID='INIT-001::utc-internal::none'
bash scripts/pipeline-run-credential-preflight.sh
bash scripts/pipeline-run-credentialed-once.sh
```

## Expected outputs
- Preflight should print a generated markdown path and exit `0`.
- Credentialed runner should print `OUTPUT_DIR=mission-control/evidence/pipeline-run/credentialed-<STAMP>`.
- The evidence bundle must contain:
  - `auth-smoke.log`
  - `valid-response.json`
  - `invalid-response.json`
  - `pipeline-run-created.audit.json`
  - `manifest.json`
  - `evidence-report.md`
  - `transition-plan.json`

## PASS closure follow-up
1. Confirm both `evidence-report.md` and `transition-plan.json` say `PASS`.
2. If needed, rerun `bash scripts/pipeline-run-closeout.sh <evidence-dir>`.
3. Only then request the review-safe transition chain:
   - `TASK-0111`
   - `TASK-0103`
   - `TASK-0097`
   - `TASK-0095`
   - `TASK-0043`

## Still blocked without Isaac input
- Real `BASE_URL`
- Real authenticated session cookie
- One concrete targeting mode in the same shell
