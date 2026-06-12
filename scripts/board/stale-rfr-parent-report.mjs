#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);
const boardPath = args[0];

if (!boardPath) {
  console.error('usage: node scripts/board/stale-rfr-parent-report.mjs <board-json> [--now <iso>] [--out <json-output>]');
  process.exit(2);
}

let nowIso = new Date().toISOString();
let outPath = null;
for (let i = 1; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--now') {
    nowIso = args[i + 1] || nowIso;
    i += 1;
    continue;
  }
  if (arg.startsWith('--now=')) {
    nowIso = arg.slice('--now='.length);
    continue;
  }
  if (arg === '--out') {
    outPath = args[i + 1] || outPath;
    i += 1;
    continue;
  }
  if (arg.startsWith('--out=')) {
    outPath = arg.slice('--out='.length);
  }
}

const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const tasks = board.tasks || [];
const tasksById = new Map(tasks.map((task) => [task.id, task]));
const now = new Date(nowIso);

function hoursSince(iso) {
  return Math.round((((now - new Date(iso)) / 36e5) + Number.EPSILON) * 10) / 10;
}

function taskRefs(task) {
  return (task.linked_refs || []).filter((ref) => /^TASK-\d+$/.test(ref));
}

function parentTags(task) {
  return (task.tags || []).filter((tag) => /^parent:|^child-of:/.test(tag));
}

function depth(taskId) {
  let current = tasksById.get(taskId);
  let d = 0;
  const seen = new Set();
  while (current?.parent_id && !seen.has(current.parent_id)) {
    seen.add(current.parent_id);
    current = tasksById.get(current.parent_id);
    d += 1;
  }
  return d;
}

function ancestorChain(taskId) {
  const chain = [];
  const seen = new Set([taskId]);
  let current = tasksById.get(taskId);
  while (current?.parent_id && !seen.has(current.parent_id)) {
    chain.push(current.parent_id);
    seen.add(current.parent_id);
    current = tasksById.get(current.parent_id);
  }
  return chain;
}

function isAncestor(ancestorId, taskId) {
  return ancestorChain(taskId).includes(ancestorId);
}

function familyStem(title) {
  return title
    .replace(/^TS-[A-Z0-9.]+\s+/i, '')
    .replace(/^BRS-\d{4}-\d{2}-\d{2}[a-z]?\s+/i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(morning|midday|night|late[- ]night|execution window|progress sweep|build window)\b/gi, '')
    .replace(/\d{4}-\d{2}-\d{2}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function classify(task) {
  const tagHints = parentTags(task);
  const refs = taskRefs(task);

  if (tagHints.length > 1) {
    const hintedParents = [...new Set(tagHints.map((tag) => tag.split(':')[1]).filter((id) => tasksById.has(id)))];
    if (hintedParents.length > 1) {
      return {
        rule: 'explicit_multi_parent_tags',
        confidence: 'hold',
        inferred_parent_id: null,
        supporting_refs: tagHints
      };
    }
  }

  if (tagHints.length === 1) {
    const inferred = tagHints[0].split(':')[1];
    if (tasksById.has(inferred)) {
      return {
        rule: 'single_tag_hint',
        confidence: 'strict',
        inferred_parent_id: inferred,
        supporting_refs: tagHints
      };
    }
  }

  if (refs.length === 1 && tasksById.has(refs[0])) {
    return {
      rule: 'single_task_ref',
      confidence: 'strict',
      inferred_parent_id: refs[0],
      supporting_refs: refs
    };
  }

  const descendantRefs = refs.filter((ref) => refs.every((other) => other === ref || isAncestor(other, ref)));
  if (descendantRefs.length === 1) {
    return {
      rule: 'single_descendant_ref',
      confidence: 'heuristic',
      inferred_parent_id: descendantRefs[0],
      supporting_refs: refs
    };
  }

  const ancestorRefs = refs.filter((ref) => refs.every((other) => other === ref || isAncestor(ref, other)));
  if (ancestorRefs.length === 1) {
    return {
      rule: 'single_ancestor_ref',
      confidence: 'heuristic',
      inferred_parent_id: ancestorRefs[0],
      supporting_refs: refs
    };
  }

  const stem = familyStem(task.title);
  const siblingParents = tasks
    .filter((candidate) => candidate.id !== task.id && candidate.parent_id && familyStem(candidate.title) === stem)
    .map((candidate) => candidate.parent_id);
  const uniqueSiblingParents = [...new Set(siblingParents)];
  if (uniqueSiblingParents.length === 1) {
    return {
      rule: 'family_stem_consensus',
      confidence: 'heuristic',
      inferred_parent_id: uniqueSiblingParents[0],
      supporting_refs: refs
    };
  }

  if (refs.length === 0 && tagHints.length === 0) {
    return {
      rule: 'no_lineage_evidence',
      confidence: 'hold',
      inferred_parent_id: null,
      supporting_refs: []
    };
  }

  return {
    rule: 'ambiguous',
    confidence: 'hold',
    inferred_parent_id: null,
    supporting_refs: refs
  };
}

const staleReadyForReview = tasks.filter((task) => task.status === 'Ready for Review' && task.updated_at && hoursSince(task.updated_at) > 24);
const missingParent = staleReadyForReview.filter((task) => !task.parent_id);

const rows = missingParent.map((task) => {
  const classification = classify(task);
  return {
    task_id: task.id,
    title: task.title,
    updated_at: task.updated_at,
    stale_hours: hoursSince(task.updated_at),
    task_ref_count: taskRefs(task).length,
    task_refs: taskRefs(task),
    tag_hints: parentTags(task),
    family_stem: familyStem(task.title),
    inferred_parent_id: classification.inferred_parent_id,
    inference_rule: classification.rule,
    confidence: classification.confidence,
    inferred_parent_depth: classification.inferred_parent_id ? depth(classification.inferred_parent_id) : null,
    supporting_refs: classification.supporting_refs
  };
});

const strict = rows.filter((row) => row.confidence === 'strict');
const heuristic = rows.filter((row) => row.confidence === 'heuristic');
const hold = rows.filter((row) => row.confidence === 'hold');

const report = {
  generated_at: now.toISOString(),
  board_path: boardPath,
  stale_ready_for_review_count: staleReadyForReview.length,
  missing_parent_count: missingParent.length,
  ready_for_immediate_metadata_apply_count: strict.length,
  heuristic_candidate_count: heuristic.length,
  hold_count: hold.length,
  heuristic_rule_counts: heuristic.reduce((acc, row) => {
    acc[row.inference_rule] = (acc[row.inference_rule] || 0) + 1;
    return acc;
  }, {}),
  hold_rule_counts: hold.reduce((acc, row) => {
    acc[row.inference_rule] = (acc[row.inference_rule] || 0) + 1;
    return acc;
  }, {}),
  rows
};

const serialized = JSON.stringify(report, null, 2) + '\n';
if (outPath) fs.writeFileSync(outPath, serialized);
process.stdout.write(serialized);
