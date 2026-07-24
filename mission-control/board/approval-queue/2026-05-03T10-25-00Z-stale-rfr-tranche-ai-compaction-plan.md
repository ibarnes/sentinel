# Stale-RFR Tranche-AI Compaction Plan — 2026-05-03 10:25 UTC

## Purpose
Compress oldest stale Ready-for-Review items into one decision packet Isaac can approve/reject quickly without violating governance.

## Stalled In Progress (>48h)
- TASK-0043 | TS-H1.1 Implement POST /pipeline/run request validation + runId creation | age_h=113.9
- TASK-0095 | TS-H1.1c Wire POST /pipeline/run endpoint + smoke verification | age_h=113.9

## Stale Ready for Review (>24h) — top tranche
- TASK-0150 | TS-H1.1c.2u Publish credential-window operator card for one-pass execution | age_h=1231.3
- TASK-0151 | TS-H1.1c.2v Build blocker-chain closure matrix with transition gates | age_h=1231.3
- TASK-0171 | TS-H1.1c.2aj Capture sweep-time credential preflight artifact (midday execution window) | age_h=1169.9
- TASK-0172 | TS-H1.1c.2ak Run one-command credentialed wrapper dry-run and capture fail-fast evidence (midday) | age_h=1169.9
- TASK-0180 | TS-H1.1c.2ao Capture sweep-time credential preflight artifact (midday progress window) | age_h=1121.9
- TASK-0181 | TS-H1.1c.2ap Run one-command credentialed wrapper dry-run and capture fail-fast evidence (midday progress window) | age_h=1121.9
- TASK-0187 | TS-H1.1c.2as Capture sweep-time credential preflight artifact (midday progress sweep) | age_h=1097.9
- TASK-0188 | TS-H1.1c.2at Run one-command credentialed wrapper dry-run and capture fail-fast evidence (midday) | age_h=1097.9
- TASK-0192 | TS-H1.1c.2au Capture sweep-time credential preflight artifact (morning execution sweep) | age_h=1079.8
- TASK-0193 | TS-H1.1c.2av Run one-command credentialed wrapper dry-run and capture fail-fast evidence (morning) | age_h=1079.8
- TASK-0194 | TS-H1.1c.2aw Capture sweep-time credential preflight artifact (midday progress sweep) | age_h=1073.9
- TASK-0195 | TS-H1.1c.2ax Run one-command credentialed wrapper dry-run and capture fail-fast evidence (midday) | age_h=1073.9

## Decomposition (30–90m)
1. **TASK-0291** (30–60m, completed): Produce tranche-AI approval template with explicit per-task decision fields.
2. **TASK-0292** (30–90m, queued): Apply approved transitions only; emit transition receipt + audit artifact.

## Acceptance Criteria
- No task moved to Done.
- Each transition row has explicit APPROVE_TRANSITION or HOLD_SUPERSEDED decision.
- Receipts include timestamp, operator, and per-task before/after states.

## Isaac decision needed next
Return decisions for tranche-AI template rows to unblock TASK-0292.
