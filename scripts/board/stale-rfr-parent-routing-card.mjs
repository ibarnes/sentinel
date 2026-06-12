#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);
const reportPath = args[0];
const boardPath = args[1];

if (!reportPath || !boardPath) {
  console.error('usage: node scripts/board/stale-rfr-parent-routing-card.mjs <report-json> <board-json> [--out <markdown-output>]');
  process.exit(2);
}

let outPath = null;
let parentTaskId = 'TASK-0107';
let childTaskId = 'TASK-0402';
for (let i = 2; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--out') {
    outPath = args[i + 1] || outPath;
    i += 1;
    continue;
  }
  if (arg.startsWith('--out=')) {
    outPath = arg.slice('--out='.length);
    continue;
  }
  if (arg === '--parent-task') {
    parentTaskId = args[i + 1] || parentTaskId;
    i += 1;
    continue;
  }
  if (arg.startsWith('--parent-task=')) {
    parentTaskId = arg.slice('--parent-task='.length);
    continue;
  }
  if (arg === '--child-task') {
    childTaskId = args[i + 1] || childTaskId;
    i += 1;
    continue;
  }
  if (arg.startsWith('--child-task=')) {
    childTaskId = arg.slice('--child-task='.length);
  }
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const tasks = board.tasks || [];
const tasksById = new Map(tasks.map((task) => [task.id, task]));

function titleFor(taskId) {
  return tasksById.get(taskId)?.title || '(missing task)';
}

function fmtRefs(refs) {
  return refs.length ? refs.join(', ') : 'none';
}

function holdReason(row) {
  if (row.inference_rule === 'explicit_multi_parent_tags') {
    return 'Task already carries multiple explicit parent-stream tags.';
  }
  if (row.inference_rule === 'no_lineage_evidence') {
    return 'No task refs or parent-tag evidence are present.';
  }
  return 'Multiple plausible parent streams or no lineage evidence.';
}

function suggestedNextStep(row) {
  if (row.inference_rule === 'explicit_multi_parent_tags') {
    return 'Keep on governed dual-parent hold until a reviewer names the canonical parent stream or confirms it should remain shared.';
  }
  if (row.inference_rule === 'no_lineage_evidence') {
    return 'Keep on manual hold until a narrower companion artifact or direct lineage note is added.';
  }
  return 'Keep on manual hold until a dedicated routing/decision artifact names the canonical parent.';
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

const rows = report.rows || [];
const heuristicRows = rows
  .filter((row) => row.confidence === 'heuristic')
  .sort((a, b) => {
    if (a.inferred_parent_id !== b.inferred_parent_id) {
      return String(a.inferred_parent_id).localeCompare(String(b.inferred_parent_id));
    }
    return String(a.task_id).localeCompare(String(b.task_id));
  });

const holdRows = rows
  .filter((row) => row.confidence === 'hold')
  .sort((a, b) => String(a.task_id).localeCompare(String(b.task_id)));

const heuristicByParent = groupBy(heuristicRows, (row) => row.inferred_parent_id || 'UNMAPPED');
const holdByRule = groupBy(holdRows, (row) => row.inference_rule || 'ambiguous');

const lines = [];
lines.push('# Stale-RFR Heuristic Parent Routing Card');
lines.push('');
lines.push(`Timestamp: ${report.generated_at}`);
lines.push('Owner: sentinel');
lines.push(`Parent: ${parentTaskId}`);
lines.push(`Child Task: ${childTaskId}`);
lines.push(`Input Report: ${reportPath}`);
lines.push('');
lines.push('## Purpose');
lines.push('Turn the stale Ready-for-Review rows that are missing `parent_id` into one reviewer-friendly routing surface grouped by inferred parent stream, while keeping ambiguous rows explicitly on hold.');
lines.push('');
lines.push('## Summary');
lines.push(`- stale Ready for Review rows scanned: ${report.stale_ready_for_review_count}`);
lines.push(`- stale rows missing parent_id: ${report.missing_parent_count}`);
lines.push(`- strict metadata-apply candidates: ${report.ready_for_immediate_metadata_apply_count}`);
lines.push(`- heuristic routing candidates: ${report.heuristic_candidate_count}`);
lines.push(`- hold / ambiguous rows: ${report.hold_count}`);
if (report.hold_rule_counts && Object.keys(report.hold_rule_counts).length) {
  lines.push(`- hold buckets: ${Object.entries(report.hold_rule_counts).map(([rule, count]) => `${rule}=${count}`).join(', ')}`);
}
lines.push('');
lines.push('## Heuristic Routing Candidates');
lines.push('These rows are not safe for unattended writeback, but each has a narrowed parent recommendation and supporting evidence for human review.');
lines.push('');

for (const [parentId, parentRows] of heuristicByParent.entries()) {
  lines.push(`### ${parentId} — ${titleFor(parentId)}`);
  lines.push('');
  lines.push('| Task ID | Title | Rule | Supporting Refs | Recommended Review Action |');
  lines.push('|---|---|---|---|---|');
  for (const row of parentRows) {
    lines.push(`| ${row.task_id} | ${row.title} | ${row.inference_rule} | ${fmtRefs(row.supporting_refs || [])} | If the parent linkage matches intent, backfill parent_id=${parentId} in the next guarded metadata pass. |`);
  }
  lines.push('');
}

lines.push('## Hold Cases');
lines.push('Do not backfill these rows from heuristics alone. They are grouped below so governed dual-parent artifacts stay separate from low-evidence leftovers.');
lines.push('');
for (const [rule, ruleRows] of holdByRule.entries()) {
  lines.push(`### ${rule}`);
  lines.push('');
  lines.push('| Task ID | Title | Supporting Refs | Hold Reason | Suggested Next Step |');
  lines.push('|---|---|---|---|---|');
  for (const row of ruleRows) {
    lines.push(`| ${row.task_id} | ${row.title} | ${fmtRefs(row.supporting_refs || [])} | ${holdReason(row)} | ${suggestedNextStep(row)} |`);
  }
  lines.push('');
}
lines.push('## Governance');
lines.push('- This card does not mutate `BOARD.json`.');
lines.push('- No task moves to `Done` or changes status from this artifact.');
lines.push('- Any future metadata backfill should remain guarded: strict-only apply by default, heuristic rows only after explicit reviewer confirmation.');
lines.push('');
lines.push('## Recommended Next Steps');
lines.push('1. Review the TASK-0103 heuristic cluster together; most of it appears to be historical credential-blocker / handoff refresh residue.');
lines.push('2. Keep the governed dual-parent recovery artifacts (`TASK-0382` to `TASK-0385`) separate from generic ambiguity so any future lineage decision is explicit and reversible.');
lines.push('3. If reviewer confirmation is obtained, run one guarded metadata-only pass for the approved heuristic rows and log the before/after delta in `mission-control/board/sweeps/`.');
lines.push('');

const output = `${lines.join('\n')}\n`;
if (outPath) fs.writeFileSync(outPath, output);
process.stdout.write(output);
