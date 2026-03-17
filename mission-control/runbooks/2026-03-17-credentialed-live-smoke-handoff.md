# Credentialed Live-Smoke Handoff Bundle — 2026-03-17 06:30 UTC

## Purpose
Unblock `TASK-0097` by giving the credentialed operator a single deterministic execution path and evidence capture checklist.

## Scope
- Parent task: `TASK-0097` (authenticated live smoke)
- Downstream chain: `TASK-0111 -> TASK-0103 -> TASK-0097 -> TASK-0095/TASK-0043`

## One-Pass Execution Steps
1. Export credential env vars (per secure operator channel).
2. Run preflight:
   - `node scripts/pipeline-run-credential-env-check.mjs`
3. Run wrapper:
   - `bash scripts/pipeline-run-smoke-capture.sh`
4. Validate evidence completeness:
   - `node scripts/pipeline-run-evidence-report.mjs --latest`

## Required Evidence (PASS gate)
- 201 response payload + runId
- 400 validation-path payload
- Auth context + timestamp envelope
- Artifact paths logged in evidence report

## Fail-Fast Rules
- If env check fails, stop and mark `TASK-0097` blocked with exact missing keys (no retries without correction).
- If wrapper exits non-zero, preserve stdout/stderr bundle and stop.
- Do not move any task to Done on partial evidence.

## Board Transition Gate (post-PASS)
1. Move `TASK-0097` to Ready for Review.
2. Trigger replay sequence for `TASK-0159/TASK-0160` per closure matrix.
3. Publish short review packet with PASS/BLOCKED outcome and artifact links.
