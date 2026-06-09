# Credential Artifact Contract Correction (2026-06-09T16:30:00Z)

- Parent Stream: TASK-0103
- Subtask Candidate: TASK-0400
- Sweep: Board Progress Sweep (Midday)

## Problem Corrected
The latest morning handoff packet named non-canonical evidence files (`post-valid-201.json`, `post-invalid-400.json`) that do not match the actual capture/report tooling.

## Canonical Evidence Bundle
1. `auth-smoke.log`
2. `valid-response.json`
3. `invalid-response.json`
4. `pipeline-run-created.audit.json`
5. `manifest.json`
6. `evidence-report.md`
7. `transition-plan.json`

## Why this matters
The next credential window should be executable without translating filenames by hand. Review closure for TASK-0103 / TASK-0097 / TASK-0095 depends on this exact bundle.

## Verification Surface
- `scripts/pipeline-run-smoke-capture.sh`
- `scripts/pipeline-run-evidence-report.mjs`
- `scripts/pipeline-run-transition-plan.mjs`
- `mission-control/runbooks/pipeline-run-auth-smoke.md`

