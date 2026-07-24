#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);
const matrixPath = args[0];

if (!matrixPath) {
  console.error('usage: node scripts/board/stale-rfr-parent-backfill-preview.mjs <matrix-json> [--out <markdown-output>] [--parent-task <task-id>] [--child-task <task-id>]');
  process.exit(2);
}

let outPath = null;
let parentTaskId = 'TASK-0107';
let childTaskId = 'TASK-0417';
for (let i = 1; i < args.length; i += 1) {
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

const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
const confirmable = (matrix.rows || []).filter((row) => row.review_bucket === 'reviewer_confirmable');
const hold = (matrix.rows || []).filter((row) => row.review_bucket !== 'reviewer_confirmable');

function fmtRefs(refs) {
  return refs.length ? refs.join(', ') : 'none';
}

const lines = [];
lines.push('# Stale-RFR Heuristic Backfill Preview');
lines.push('');
lines.push(`Timestamp: ${matrix.generated_at}`);
lines.push('Owner: sentinel');
lines.push(`Parent: ${parentTaskId}`);
lines.push(`Child Task: ${childTaskId}`);
lines.push(`Input Matrix: ${matrixPath}`);
lines.push('');
lines.push('## Purpose');
lines.push('Show the exact stale Ready-for-Review rows that could be included in a future metadata-only parent backfill pass if a reviewer confirms the inferred lineage.');
lines.push('');
lines.push('## Summary');
lines.push(`- heuristic rows reviewed: ${matrix.heuristic_candidate_count}`);
lines.push(`- reviewer-confirmable rows: ${confirmable.length}`);
lines.push(`- remain-on-hold rows: ${hold.length}`);
lines.push('');
lines.push('## Reviewer-Confirmable Preview');
lines.push('These rows are still review-only here. No `BOARD.json` mutation has been applied.');
lines.push('');
lines.push('| Task ID | Proposed parent_id | Parent Title | Rule | Supporting Refs | Why it is bounded |');
lines.push('|---|---|---|---|---|---|');
for (const row of confirmable) {
  lines.push(`| ${row.task_id} | ${row.inferred_parent_id} | ${row.inferred_parent_title} | ${row.inference_rule} | ${fmtRefs(row.supporting_refs)} | ${row.rationale} |`);
}
lines.push('');
lines.push('## Guardrails For Future Apply Pass');
lines.push('1. Require explicit reviewer confirmation for each row or for the whole bounded cluster before any metadata writeback.');
lines.push('2. Limit any future mutation to `parent_id` only; do not change task status, priority, title, tags, comments, or approvals.');
lines.push('3. Exclude any row that picks up a second plausible parent stream before the guarded pass runs.');
lines.push('4. Publish a before/after delta log in `mission-control/board/sweeps/` if a future apply pass is approved.');
lines.push('');
lines.push('## Hold Rows');
if (hold.length === 0) {
  lines.push('- None inside the current heuristic matrix.');
} else {
  for (const row of hold) {
    lines.push(`- ${row.task_id}: keep on hold; ${row.rationale}`);
  }
}
lines.push('');
lines.push('## Recommended Next Step');
lines.push('If this preview is accepted, the next atomic task should be a guarded metadata-only apply pass for the reviewer-confirmed rows plus a deterministic before/after lineage delta receipt.');
lines.push('');

const output = `${lines.join('\n')}\n`;
if (outPath) fs.writeFileSync(outPath, output);
process.stdout.write(output);
