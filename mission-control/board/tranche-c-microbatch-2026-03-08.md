# Tranche-C Microbatch — 2026-03-08

Objective: reduce decision latency by presenting the 5 highest-leverage Ready for Review approvals that unlock blocked dependency chains.

## Priority Approval Microbatch (Top 5)
1. TASK-0117 — Template endpoints smoke + RP
   - Why now: closes TS-B3.1 acceptance chain and stabilizes template API surface.
   - If approved: allows TASK-0026 and downstream TS-B3.2 sequencing.

2. TASK-0116 — Implement template list/detail endpoints
   - Why now: core API delivery already coded and syntax-checked.
   - If approved: removes ambiguity on template manifest integration.

3. TASK-0106 — DELETE slide endpoint + smoke checks
   - Why now: completes mutation triad and reduces API incompleteness risk.
   - If approved: tightens closure path for TASK-0024.

4. TASK-0105 — POST/PATCH slide mutation endpoints
   - Why now: highest unblock leverage for slide edit loop.
   - If approved: enables higher-confidence transition for TASK-0024 parent.

5. TASK-0104 — Mutation contract + payload shapes
   - Why now: governance artifact for mutation behavior and error model.
   - If approved: validates decomposition-first approach and supports audit traceability.

## Decision Ask
For each task: Approve / Defer / Hold + one-line rationale.

## Transition Rule
- Approved: parent task may advance per dependency plan.
- Deferred/Hold: annotate blocker reason + next-check date.
