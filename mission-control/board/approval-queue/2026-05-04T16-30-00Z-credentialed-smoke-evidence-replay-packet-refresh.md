# Credentialed Smoke Evidence Replay Packet (Refresh)

- Timestamp: 2026-05-04T16:30:00Z
- Stream: TASK-0097 credentialed live smoke closure chain
- Prepared by: Sentinel

## Preconditions
1. Credentialed operator executes one-pass smoke run (201 valid + 400 invalid) from latest handoff card.
2. Evidence bundle exists under `mission-control/evidence/pipeline-run/<timestamp>/`.
3. PASS criteria met:
   - Valid request response `201` with `runId` and `status=started`
   - Invalid request response `400` with expected validation payload

## Immediate Replay Actions (post-PASS)
1. Attach evidence file paths to `TASK-0097` comment.
2. Request transitions in this order:
   - `TASK-0097` -> Ready for Review
   - `TASK-0095` -> Ready for Review
   - `TASK-0043` -> Ready for Review
3. Update parent chain comments with shared evidence root path and timestamp.

## Evidence Routing Template
- Evidence root: `mission-control/evidence/pipeline-run/<timestamp>/`
- Required files:
  - `preflight.json`
  - `smoke-valid-201.json`
  - `smoke-invalid-400.json`
  - `evidence-report.md`

## Transition Request Snippet
"Credentialed live smoke PASS captured at `<timestamp>`. Evidence bundle at `mission-control/evidence/pipeline-run/<timestamp>/` confirms 201 valid and 400 invalid paths. Requesting Ready-for-Review transition for TASK-0097 / TASK-0095 / TASK-0043 per dependency chain closure."
