# Stale-RFR Heuristic Parent Routing Card

Timestamp: 2026-06-12T03:10:00.000Z
Owner: sentinel
Parent: TASK-0107
Child Task: TASK-0414
Input Report: mission-control/artifacts/2026-06-12-stale-rfr-parent-report.json

## Purpose
Turn the stale Ready-for-Review rows that are missing `parent_id` into one reviewer-friendly routing surface grouped by inferred parent stream, while keeping ambiguous rows explicitly on hold.

## Summary
- stale Ready for Review rows scanned: 196
- stale rows missing parent_id: 33
- strict metadata-apply candidates: 0
- heuristic routing candidates: 14
- hold / ambiguous rows: 19
- hold buckets: ambiguous=14, no_lineage_evidence=1, explicit_multi_parent_tags=4

## Heuristic Routing Candidates
These rows are not safe for unattended writeback, but each has a narrowed parent recommendation and supporting evidence for human review.

### TASK-0103 — TS-H1.1c.2b Execute credentialed authenticated smoke and attach evidence

| Task ID | Title | Rule | Supporting Refs | Recommended Review Action |
|---|---|---|---|---|
| TASK-0293 | TS-H1.1c.2bg Refresh credential blocker evidence snapshot (morning execution window) | family_stem_consensus | TASK-0097, TASK-0103 | If the parent linkage matches intent, backfill parent_id=TASK-0103 in the next guarded metadata pass. |
| TASK-0294 | TS-H1.1c.2bh Publish credentialed smoke operator handoff refresh (single-run command chain) | family_stem_consensus | TASK-0097, TASK-0103 | If the parent linkage matches intent, backfill parent_id=TASK-0103 in the next guarded metadata pass. |
| TASK-0308 | TS-H1.1c.2bo Refresh credential blocker evidence snapshot (midday execution window) | family_stem_consensus | TASK-0097, TASK-0103 | If the parent linkage matches intent, backfill parent_id=TASK-0103 in the next guarded metadata pass. |
| TASK-0309 | TS-H1.1c.2bp Publish credentialed smoke operator handoff refresh (single-run chain) | family_stem_consensus | TASK-0097, TASK-0103 | If the parent linkage matches intent, backfill parent_id=TASK-0103 in the next guarded metadata pass. |
| TASK-0310 | TS-H1.1c.2bq Refresh credential blocker evidence snapshot (night build window) | family_stem_consensus | TASK-0097, TASK-0103 | If the parent linkage matches intent, backfill parent_id=TASK-0103 in the next guarded metadata pass. |
| TASK-0311 | TS-H1.1c.2br Refresh credentialed smoke operator handoff packet (night build window) | family_stem_consensus | TASK-0097, TASK-0103 | If the parent linkage matches intent, backfill parent_id=TASK-0103 in the next guarded metadata pass. |
| TASK-0317 | TS-H1.1c.2bv Refresh credential blocker evidence snapshot (midday progress sweep) | family_stem_consensus | TASK-0097, TASK-0103 | If the parent linkage matches intent, backfill parent_id=TASK-0103 in the next guarded metadata pass. |
| TASK-0318 | TS-H1.1c.2bw Refresh credentialed smoke operator handoff packet (midday progress sweep) | family_stem_consensus | TASK-0097, TASK-0103, TASK-0317 | If the parent linkage matches intent, backfill parent_id=TASK-0103 in the next guarded metadata pass. |
| TASK-0325 | TS-H1.1c.2ca Refresh credential blocker evidence snapshot (morning execution sweep) | family_stem_consensus | TASK-0097, TASK-0103 | If the parent linkage matches intent, backfill parent_id=TASK-0103 in the next guarded metadata pass. |
| TASK-0326 | TS-H1.1c.2cb Refresh credentialed smoke operator handoff packet (morning execution sweep) | family_stem_consensus | TASK-0097, TASK-0103 | If the parent linkage matches intent, backfill parent_id=TASK-0103 in the next guarded metadata pass. |
| TASK-0374 | TS-H1.1c.2l Refresh credential blocker evidence snapshot (midday) | family_stem_consensus | TASK-0103, TASK-0097 | If the parent linkage matches intent, backfill parent_id=TASK-0103 in the next guarded metadata pass. |
| TASK-0375 | TS-H1.1c.2m Refresh credentialed smoke operator handoff packet (midday) | family_stem_consensus | TASK-0103, TASK-0097 | If the parent linkage matches intent, backfill parent_id=TASK-0103 in the next guarded metadata pass. |

### TASK-0264 — TS-H1.1c.2e Refresh credential preflight evidence snapshot

| Task ID | Title | Rule | Supporting Refs | Recommended Review Action |
|---|---|---|---|---|
| TASK-0265 | TS-H1.1c.2f Publish credential-window run card with exact command sequence | single_descendant_ref | TASK-0103, TASK-0264 | If the parent linkage matches intent, backfill parent_id=TASK-0264 in the next guarded metadata pass. |

### TASK-0284 — BRS-2026-05-02a Build tranche-AH decision input validator + template

| Task ID | Title | Rule | Supporting Refs | Recommended Review Action |
|---|---|---|---|---|
| TASK-0285 | BRS-2026-05-02b Publish tranche-AH dry-run transition preview + apply guardrails | single_descendant_ref | TASK-0271, TASK-0284 | If the parent linkage matches intent, backfill parent_id=TASK-0284 in the next guarded metadata pass. |

## Hold Cases
Do not backfill these rows from heuristics alone. They are grouped below so governed dual-parent artifacts stay separate from low-evidence leftovers.

### ambiguous

| Task ID | Title | Supporting Refs | Hold Reason | Suggested Next Step |
|---|---|---|---|---|
| TASK-0257 | TS-H1.1c.2d Publish credential-window run card with exact command sequence | TASK-0103, TASK-0255 | Multiple plausible parent streams or no lineage evidence. | Keep on manual hold until a dedicated routing/decision artifact names the canonical parent. |
| TASK-0277 | Credential-window preflight refresh pack (Night) | TASK-0097, TASK-0269 | Multiple plausible parent streams or no lineage evidence. | Keep on manual hold until a dedicated routing/decision artifact names the canonical parent. |
| TASK-0278 | Tranche-AH decision reminder + apply sequencing card (Night) | TASK-0269, TASK-0271 | Multiple plausible parent streams or no lineage evidence. | Keep on manual hold until a dedicated routing/decision artifact names the canonical parent. |
| TASK-0279 | Stale-RFR tranche-AA compaction digest (oldest credential evidence tasks) | TASK-0098, TASK-0269 | Multiple plausible parent streams or no lineage evidence. | Keep on manual hold until a dedicated routing/decision artifact names the canonical parent. |
| TASK-0280 | Stale-RFR tranche-AA apply card (post-approval transition sequence) | TASK-0098, TASK-0279 | Multiple plausible parent streams or no lineage evidence. | Keep on manual hold until a dedicated routing/decision artifact names the canonical parent. |
| TASK-0303 | BRS-2026-05-04 Build tranche-AJ transition microbatch plan artifact (decision-gated) | TASK-0300, TASK-0299 | Multiple plausible parent streams or no lineage evidence. | Keep on manual hold until a dedicated routing/decision artifact names the canonical parent. |
| TASK-0304 | BRS-2026-05-05 Build tranche-AJ transition preflight checklist artifact (decision-gated) | TASK-0300, TASK-0299 | Multiple plausible parent streams or no lineage evidence. | Keep on manual hold until a dedicated routing/decision artifact names the canonical parent. |
| TASK-0306 | BRS-2026-05-05 Build AH/AJ decision consolidation card to unblock stalled apply streams | TASK-0269, TASK-0300, TASK-0305 | Multiple plausible parent streams or no lineage evidence. | Keep on manual hold until a dedicated routing/decision artifact names the canonical parent. |
| TASK-0327 | TS-H1.1c.2cc Midday blocker evidence refresh for credentialed smoke stream | TASK-0097, TASK-0103 | Multiple plausible parent streams or no lineage evidence. | Keep on manual hold until a dedicated routing/decision artifact names the canonical parent. |
| TASK-0328 | TS-H1.1c.2cd Midday operator handoff refresh for one-pass credentialed smoke execution | TASK-0097, TASK-0103 | Multiple plausible parent streams or no lineage evidence. | Keep on manual hold until a dedicated routing/decision artifact names the canonical parent. |
| TASK-0329 | TS-H1.1c.2ce Night blocker evidence refresh for credentialed smoke stream | TASK-0097, TASK-0103 | Multiple plausible parent streams or no lineage evidence. | Keep on manual hold until a dedicated routing/decision artifact names the canonical parent. |
| TASK-0330 | TS-H1.1c.2cf Night operator handoff refresh for one-pass credentialed smoke execution | TASK-0097, TASK-0103 | Multiple plausible parent streams or no lineage evidence. | Keep on manual hold until a dedicated routing/decision artifact names the canonical parent. |
| TASK-0338 | TS-H1.1c.2ch Midday blocker evidence refresh for credentialed smoke stream | TASK-0097, TASK-0103 | Multiple plausible parent streams or no lineage evidence. | Keep on manual hold until a dedicated routing/decision artifact names the canonical parent. |
| TASK-0339 | TS-H1.1c.2ci Midday operator handoff refresh for one-pass credentialed smoke execution | TASK-0097, TASK-0103 | Multiple plausible parent streams or no lineage evidence. | Keep on manual hold until a dedicated routing/decision artifact names the canonical parent. |

### no_lineage_evidence

| Task ID | Title | Supporting Refs | Hold Reason | Suggested Next Step |
|---|---|---|---|---|
| TASK-0313 | BRS-2026-05-06 Build stale-RFR tranche-AK compaction + decision template artifact | none | No task refs or parent-tag evidence are present. | Keep on manual hold until a narrower companion artifact or direct lineage note is added. |

### explicit_multi_parent_tags

| Task ID | Title | Supporting Refs | Hold Reason | Suggested Next Step |
|---|---|---|---|---|
| TASK-0382 | BRS-2026-06-06g Add unified recovery apply-preview script | child-of:TASK-0107, child-of:TASK-0269 | Task already carries multiple explicit parent-stream tags. | Keep on governed dual-parent hold until a reviewer names the canonical parent stream or confirms it should remain shared. |
| TASK-0383 | BRS-2026-06-06h Publish live apply-preview card for unified recovery packet | child-of:TASK-0107, child-of:TASK-0269 | Task already carries multiple explicit parent-stream tags. | Keep on governed dual-parent hold until a reviewer names the canonical parent stream or confirms it should remain shared. |
| TASK-0384 | BRS-2026-06-07a Add guarded unified recovery apply engine | child-of:TASK-0107, child-of:TASK-0269 | Task already carries multiple explicit parent-stream tags. | Keep on governed dual-parent hold until a reviewer names the canonical parent stream or confirms it should remain shared. |
| TASK-0385 | BRS-2026-06-07b Publish blocked apply receipt for current unified recovery packet | child-of:TASK-0107, child-of:TASK-0269 | Task already carries multiple explicit parent-stream tags. | Keep on governed dual-parent hold until a reviewer names the canonical parent stream or confirms it should remain shared. |

## Governance
- This card does not mutate `BOARD.json`.
- No task moves to `Done` or changes status from this artifact.
- Any future metadata backfill should remain guarded: strict-only apply by default, heuristic rows only after explicit reviewer confirmation.

## Recommended Next Steps
1. Review the TASK-0103 heuristic cluster together; most of it appears to be historical credential-blocker / handoff refresh residue.
2. Keep the governed dual-parent recovery artifacts (`TASK-0382` to `TASK-0385`) separate from generic ambiguity so any future lineage decision is explicit and reversible.
3. If reviewer confirmation is obtained, run one guarded metadata-only pass for the approved heuristic rows and log the before/after delta in `mission-control/board/sweeps/`.

