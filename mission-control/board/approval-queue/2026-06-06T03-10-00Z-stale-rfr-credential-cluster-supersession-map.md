# Stale-RFR Credential-Cluster Supersession Map

Timestamp: 2026-06-06T03:10:00Z
Owner: sentinel
Parent: TASK-0107
Child Task: TASK-0376

## Scope
Oldest credential-chain Ready for Review items in the stale queue. Goal: replace many historical refresh cards with the current canonical execution surface before any compaction writeback is requested.

## Canonical Current Surface
- TASK-0355 -> credentialed smoke closure packet for TASK-0095
- TASK-0364 -> credential-window execution checklist + evidence map
- TASK-0374 -> freshest blocker evidence snapshot
- TASK-0375 -> freshest operator handoff packet

## Supersession Map
| Task ID | Legacy Artifact Purpose | Canonical Replacement | Recommended Action | Rationale |
|---|---|---|---|---|
| TASK-0150 | One-pass operator card | TASK-0364 + TASK-0375 | APPROVE_COMPACT | newer checklist + handoff packet cover the same execution path with fresher evidence hooks |
| TASK-0151 | Blocker-chain closure matrix | TASK-0355 + TASK-0364 | APPROVE_COMPACT | closure sequence and acceptance mapping now live in the closure packet + execution checklist |
| TASK-0171 | Midday preflight snapshot | TASK-0374 | APPROVE_COMPACT | stale evidence-only snapshot superseded by latest blocker evidence |
| TASK-0172 | Midday dry-run fail-fast artifact | TASK-0375 | APPROVE_COMPACT | operational intent preserved by fresher handoff packet and latest blocker state |
| TASK-0180 | Midday progress preflight snapshot | TASK-0374 | APPROVE_COMPACT | duplicate blocker evidence lane, older timestamp |
| TASK-0181 | Midday progress dry-run fail-fast artifact | TASK-0375 | APPROVE_COMPACT | duplicate operator-proof lane, older timestamp |
| TASK-0187 | Midday progress preflight snapshot | TASK-0374 | APPROVE_COMPACT | duplicate blocker evidence lane, older timestamp |
| TASK-0188 | Midday progress dry-run fail-fast artifact | TASK-0375 | APPROVE_COMPACT | duplicate operator-proof lane, older timestamp |
| TASK-0192 | Morning preflight snapshot | TASK-0374 | APPROVE_COMPACT | duplicate blocker evidence lane, older timestamp |
| TASK-0193 | Morning dry-run fail-fast artifact | TASK-0375 | APPROVE_COMPACT | duplicate operator-proof lane, older timestamp |
| TASK-0194 | Midday preflight snapshot | TASK-0374 | APPROVE_COMPACT | duplicate blocker evidence lane, older timestamp |
| TASK-0195 | Midday dry-run fail-fast artifact | TASK-0375 | APPROVE_COMPACT | duplicate operator-proof lane, older timestamp |

## Guardrails
- No Done transition is proposed here.
- No credential-chain parent (TASK-0103, TASK-0097, TASK-0095, TASK-0043) is mutated by this packet.
- Compaction should only target the listed stale child artifacts after Isaac confirms the recommendations.

## Why This Matters
- Shrinks the oldest stale cluster into one current review surface.
- Preserves execution readiness without discarding the latest operator path.
- Reduces board noise ahead of any eventual transition apply pass.
