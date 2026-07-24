# Board Build Window (Night) - 2026-06-08T03:10:00Z

## Selection
- Highest-leverage executable stream remained the P0 credentialed `/pipeline/run` closure lane (`TASK-0095` -> `TASK-0097` -> `TASK-0103`).
- Decision-gated recovery apply work (`TASK-0335`, `TASK-0379`) was still blocked on missing Isaac input, so unattended board mutation remained unjustified.
- The active gap was not another missing reminder artifact: the canonical one-pass execution path itself was internally inconsistent and would fail even if credentials arrived.

## Mandatory Decomposition Gate
- Parent stream `TASK-0095` remained too broad for direct execution, so tonight's work was constrained to one bounded 30-60 minute child:
  - `TASK-0391` (30-60m): repair the one-pass credentialed smoke wrapper path and align canonical operator instructions with the actual script interfaces.
- Dependency sequence:
  - `TASK-0095` -> `TASK-0097` -> `TASK-0103`
  - `TASK-0391` repairs the wrapper/report/capture path
  - next live credential window executes `scripts/pipeline-run-credentialed-once.sh`
  - only after real evidence exists can the chain request `Ready for Review`

## Atomic Task Executed
1. `TASK-0391` executed -> `Ready for Review`
   - Script fixes:
     - `scripts/pipeline-run-smoke-capture.sh` now accepts the `--base-url`, `--cookie`, and `--out-dir` flags already used by `scripts/pipeline-run-credentialed-once.sh`.
     - `scripts/pipeline-run-evidence-report.mjs` now supports both legacy positional usage and the `--dir` / `--out` flag form used by existing wrappers and docs.
     - `scripts/pipeline-run-transition-plan.mjs` now accepts the actual capture bundle shape (`auth-smoke.log`, audit artifact) and evaluates PASS/BLOCKED against the current four-artifact requirement.
     - `scripts/pipeline-run-closeout.sh` now calls the report generator with a valid argument form.
   - Operator artifact refresh:
     - `mission-control/runbooks/pipeline-run-auth-smoke.md`
     - `mission-control/board/approval-queue/2026-06-07T10-40-00Z-task-0095-current-closure-routing-card.md`

## Verification
- `bash scripts/pipeline-run-credentialed-once.sh`
  - result: still fail-fast on missing `BASE_URL` / `TEAM_SESSION_COOKIE`, which is the correct pre-credential behavior
- `node scripts/pipeline-run-evidence-report.mjs --dir mission-control/evidence/pipeline-run/2026-03-11T03-10-00Z --out /tmp/pipeline-run-evidence-report-test.md`
- `node scripts/pipeline-run-transition-plan.mjs --dir mission-control/evidence/pipeline-run/2026-03-11T03-10-00Z --out /tmp/pipeline-run-transition-plan-test.json`
- `bash scripts/pipeline-run-closeout.sh mission-control/evidence/pipeline-run/2026-03-11T03-10-00Z`

## Governance
- No task moved to `Done`.
- No board status was changed without an approved review packet.
- No credentialed execution was attempted without the required live inputs.

## Next Queued Subtasks
1. Execute `scripts/pipeline-run-credentialed-once.sh` in the next authenticated window with `BASE_URL`, `TEAM_SESSION_COOKIE`, and either `DECK_ID` or selector inputs.
2. Attach the resulting evidence bundle to `TASK-0111`, `TASK-0103`, `TASK-0097`, and `TASK-0095`, then request review-safe transitions to `Ready for Review` only if the report and transition plan both pass.
3. Keep `TASK-0335` and `TASK-0379` parked until Isaac fills the unified recovery decision pack.
