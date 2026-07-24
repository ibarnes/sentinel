# Stale-RFR Tranche-AK Compaction Plan — 2026-05-06 06:30 UTC

## Purpose
Compress the next oldest stale Ready-for-Review tranche into a single decision packet without violating governance.

## Stalled In Progress (>48h)
- None active in this sweep window.

## Stale Ready for Review (>24h) — tranche AK
- TASK-0199 | TS-H1.1c.2ay Capture sweep-time credential preflight artifact (morning execution sweep) | age_h=1123.8
- TASK-0200 | TS-H1.1c.2az Run one-command credentialed wrapper dry-run and capture fail-fast evidence (morning) | age_h=1123.8
- TASK-0201 | TS-H1.1c.2ba Capture sweep-time credential preflight artifact (midday progress sweep) | age_h=1118.0
- TASK-0202 | TS-H1.1c.2bb Run one-command credentialed wrapper dry-run and capture fail-fast evidence (midday) | age_h=1118.0
- TASK-0207 | TS-H1.1c.2bc Capture sweep-time credential preflight artifact (morning execution sweep) | age_h=1099.8
- TASK-0208 | TS-H1.1c.2bd Run one-command credentialed wrapper dry-run and capture fail-fast evidence (morning) | age_h=1099.8
- TASK-0209 | TS-H1.1c.2be Capture sweep-time credential preflight artifact (midday progress sweep) | age_h=1094.0
- TASK-0210 | TS-H1.1c.2bf Run one-command credentialed wrapper dry-run and capture fail-fast evidence (midday) | age_h=1094.0
- TASK-0215 | TS-H1.1c.2bg Capture sweep-time credential preflight artifact (morning execution sweep) | age_h=1075.8
- TASK-0216 | TS-H1.1c.2bh Run one-command credentialed wrapper dry-run and capture fail-fast evidence (morning) | age_h=1075.8
- TASK-0217 | TS-H1.1c.2bi Capture sweep-time credential preflight artifact (midday progress sweep) | age_h=1070.0
- TASK-0218 | TS-H1.1c.2bj Run one-command credentialed wrapper dry-run and capture fail-fast evidence (midday) | age_h=1070.0

## Decomposition (30–90m)
1. **TASK-0313** (30–60m, completed): produce tranche-AK decision template with explicit per-row transition action.
2. **TASK-0314** (30–90m, queued): apply approved transitions only; publish transition receipt with before/after states.

## Acceptance Criteria
- No task moved to `Done`.
- Every row has explicit `APPROVE_TRANSITION` or `HOLD_SUPERSEDED`.
- Transition receipt includes timestamp, operator, and per-task before/after states.

## Isaac decision needed next
Return decisions for tranche-AK template rows to unblock `TASK-0314`.
