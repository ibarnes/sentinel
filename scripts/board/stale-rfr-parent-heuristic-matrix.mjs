#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);
const reportPath = args[0];
const boardPath = args[1];

if (!reportPath || !boardPath) {
  console.error('usage: node scripts/board/stale-rfr-parent-heuristic-matrix.mjs <report-json> <board-json> [--out <json-output>]');
  process.exit(2);
}

let outPath = null;
for (let i = 2; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--out') {
    outPath = args[i + 1] || outPath;
    i += 1;
    continue;
  }
  if (arg.startsWith('--out=')) {
    outPath = arg.slice('--out='.length);
  }
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const tasks = board.tasks || [];
const tasksById = new Map(tasks.map((task) => [task.id, task]));
const generatedAt = new Date().toISOString();

function parentTitle(taskId) {
  return tasksById.get(taskId)?.title || '(missing task)';
}

function hasDirectRef(row, taskId) {
  return (row.task_refs || []).includes(taskId);
}

function hasTagHint(row, taskId) {
  return (row.tag_hints || []).some((tag) => tag.endsWith(`:${taskId}`));
}

function siblingConsensusCount(row) {
  const task = tasksById.get(row.task_id);
  if (!task || !row.inferred_parent_id) return 0;
  return tasks.filter((candidate) => (
    candidate.id !== task.id &&
    candidate.parent_id === row.inferred_parent_id &&
    candidate.title &&
    row.family_stem &&
    candidate.title
      .replace(/^TS-[A-Z0-9.]+\s+/i, '')
      .replace(/^BRS-\d{4}-\d{2}-\d{2}[a-z]?\s+/i, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\b(morning|midday|night|late[- ]night|execution window|progress sweep|build window)\b/gi, '')
      .replace(/\d{4}-\d{2}-\d{2}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase() === row.family_stem
  )).length;
}

function reviewBucket(row) {
  if (!row.inferred_parent_id) return 'hold';
  if (row.inference_rule === 'single_descendant_ref') return 'reviewer_confirmable';
  if (row.inference_rule === 'family_stem_consensus' && hasDirectRef(row, row.inferred_parent_id)) {
    return 'reviewer_confirmable';
  }
  if (row.inference_rule === 'single_ancestor_ref' && hasDirectRef(row, row.inferred_parent_id)) {
    return 'reviewer_confirmable';
  }
  return 'hold';
}

function rationale(row, bucket) {
  if (bucket !== 'reviewer_confirmable') {
    return 'Hold until a reviewer confirms the inferred parent stream.';
  }
  if (row.inference_rule === 'single_descendant_ref') {
    return 'Exactly one descendant reference survives after ancestor reduction, so the inferred parent stream is bounded and reviewer-checkable.';
  }
  if (row.inference_rule === 'family_stem_consensus') {
    return 'Sibling task family and direct parent-stream refs agree on the same inferred parent, making this suitable for a guarded reviewer-approved metadata pass.';
  }
  return 'Direct parent-stream evidence is present and narrows the row to one reviewer-checkable parent.';
}

const heuristicRows = (report.rows || [])
  .filter((row) => row.confidence === 'heuristic')
  .map((row) => {
    const bucket = reviewBucket(row);
    return {
      task_id: row.task_id,
      title: row.title,
      inferred_parent_id: row.inferred_parent_id,
      inferred_parent_title: parentTitle(row.inferred_parent_id),
      inference_rule: row.inference_rule,
      family_stem: row.family_stem,
      supporting_refs: row.supporting_refs || [],
      direct_parent_ref_present: hasDirectRef(row, row.inferred_parent_id),
      direct_parent_tag_present: hasTagHint(row, row.inferred_parent_id),
      sibling_consensus_count: siblingConsensusCount(row),
      review_bucket: bucket,
      rationale: rationale(row, bucket)
    };
  })
  .sort((a, b) => {
    if (a.review_bucket !== b.review_bucket) {
      return a.review_bucket.localeCompare(b.review_bucket);
    }
    if (a.inferred_parent_id !== b.inferred_parent_id) {
      return String(a.inferred_parent_id).localeCompare(String(b.inferred_parent_id));
    }
    return a.task_id.localeCompare(b.task_id);
  });

const output = {
  generated_at: generatedAt,
  source_report_generated_at: report.generated_at,
  source_report: reportPath,
  board_path: boardPath,
  heuristic_candidate_count: heuristicRows.length,
  reviewer_confirmable_count: heuristicRows.filter((row) => row.review_bucket === 'reviewer_confirmable').length,
  hold_count: heuristicRows.filter((row) => row.review_bucket === 'hold').length,
  rows: heuristicRows
};

const serialized = JSON.stringify(output, null, 2) + '\n';
if (outPath) fs.writeFileSync(outPath, serialized);
process.stdout.write(serialized);
