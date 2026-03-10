# Board Recovery Sweep — Apply-Ready Transition Patchset

Timestamp: 2026-03-10 06:30 UTC
Window: Late Night Recovery Sweep

## Scope
Precomputed, decision-dependent board transition instructions for stalled chain and high-leverage review items.

## Stalled chain snapshot
- TASK-0043 (In Progress, stale >48h)
- TASK-0095 (In Progress, stale >48h)
- TASK-0103 (In Progress, stale >48h; credential-bound)

## Patchset A — Credential execution outcomes (TASK-0103/TASK-0097)

### If credentialed smoke evidence succeeds (201 + 400 captured)
1. TASK-0111 -> Ready for Review
   - Comment template: "Credentialed smoke executed; evidence captured at <path>. 201+400 acceptance criteria met."
2. TASK-0103 -> Ready for Review
   - Comment template: "Acceptance criteria satisfied via TASK-0111 evidence; promoting for review."
3. TASK-0097 -> Ready for Review
   - Comment template: "Authenticated live smoke evidence complete; parent blocker cleared."
4. TASK-0095 -> Ready for Review
   - Comment template: "Endpoint wiring smoke closure complete; promoting for review."
5. TASK-0043 -> Ready for Review
   - Comment template: "Decomposition children complete; validation/runId slice ready for approval."

### If credentialed smoke fails or returns non-deterministic errors
1. Keep TASK-0103 In Progress (or set Blocked with explicit error reason)
2. Add bugfix child task (30–90 min) with failure signature + expected fix path
3. Keep TASK-0097/TASK-0095/TASK-0043 In Progress with dependency comment update

## Patchset B — Tranche-C decision application (TASK-0113)
Use precomputed plan: `mission-control/board/tranche-c-transition-plan-2026-03-07.md`

- For each approved item: move Ready for Review -> Done only if approved RP evidence exists
- For each deferred item: append blocker rationale + next check date (+72h rule)
- For each hold item: leave status; add explicit owner + unblock trigger

## Patchset C — Immediate hygiene normalization (no credentials required)
1. Reclassify credential-bound task as Blocked when no credential window exists:
   - TASK-0103 status In Progress -> Blocked
   - Add blocker comment with required input: valid session cookie + execution window
2. Keep parent chain visible but dependency-annotated (no Done transitions)

## Decision asks queued for Isaac
1. Authorize credentialed execution window for TASK-0111/TASK-0103
2. Approve review packets in unblock order: RP-0044 -> RP-0043 -> RP-0042
3. Confirm tranche-C microbatch decisions for TASK-0113 application

## Governance constraints
- No Done transitions without approved review packet evidence.
- Do not bypass decomposition parent/child lineage.
