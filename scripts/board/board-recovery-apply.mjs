#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);
const boardPath = args[0];
const packetPath = args[1];

if (!boardPath || !packetPath) {
  console.error('usage: node scripts/board/board-recovery-apply.mjs <board-json> <decision-pack-markdown> [--section=a|b|all] [--out <board-json-output>]');
  process.exit(2);
}

let sectionMode = 'all';
let outPath = null;
for (let i = 2; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--section') {
    sectionMode = args[i + 1] || '';
    i += 1;
    continue;
  }
  if (arg.startsWith('--section=')) {
    sectionMode = arg.slice('--section='.length);
    continue;
  }
  if (arg === '--out') {
    outPath = args[i + 1] || '';
    i += 1;
    continue;
  }
  if (arg.startsWith('--out=')) {
    outPath = arg.slice('--out='.length);
    continue;
  }
}

if (!new Set(['a', 'b', 'all']).has(sectionMode)) {
  console.error('invalid --section value: ' + JSON.stringify(sectionMode));
  process.exit(2);
}

const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const packet = fs.readFileSync(packetPath, 'utf8');

const SECTION_A_ALLOWED = new Set(['Approve', 'Hold', 'Needs Changes']);
const SECTION_B_ALLOWED = new Set(['APPROVE_COMPACT', 'HOLD_RETAIN']);
const PROTECTED_CANONICAL_TASKS = new Set(['TASK-0355', 'TASK-0364', 'TASK-0374', 'TASK-0375']);

function parsePipeRow(line) {
  return line.split('|').slice(1, -1).map((cell) => cell.trim());
}

function sectionSlice(sourceText, startHeading, endHeading) {
  const start = sourceText.indexOf(startHeading);
  if (start === -1) return '';
  const end = endHeading ? sourceText.indexOf(endHeading, start) : -1;
  return sourceText.slice(start, end === -1 ? undefined : end);
}

function parsePacket(sourceText) {
  const sectionAText = sectionSlice(
    sourceText,
    '## Decision Section A: Tranche-AH Apply Gate',
    '## Decision Section B: Credential-Cluster Compaction Gate'
  );
  const sectionBText = sectionSlice(
    sourceText,
    '## Decision Section B: Credential-Cluster Compaction Gate',
    '## Recommended Execution Order After Decision'
  );

  const sectionA = [];
  for (const line of sectionAText.split('\n')) {
    if (!line.startsWith('| TASK-')) continue;
    const [task_id, packet_current_status, recommended_decision, recommended_target_status, isaac_decision, isaac_target_status, isaac_note] = parsePipeRow(line);
    sectionA.push({ task_id, packet_current_status, recommended_decision, recommended_target_status, isaac_decision, isaac_target_status, isaac_note });
  }

  const sectionB = [];
  for (const line of sectionBText.split('\n')) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue;
    const [apply_order, task_id, packet_current_status, canonical_replacement, recommended_decision, isaac_decision, isaac_note] = parsePipeRow(line);
    sectionB.push({
      apply_order: Number.parseInt(apply_order, 10),
      task_id,
      packet_current_status,
      canonical_replacement,
      recommended_decision,
      isaac_decision,
      isaac_note
    });
  }

  return { sectionA, sectionB };
}

function countBy(items, key, value) {
  return items.filter((item) => item[key] === value).length;
}

const tasks = new Map((board.tasks || []).map((task) => [task.id, task]));

function summarizeSectionA(rows) {
  return rows.map((row) => {
    const liveTask = tasks.get(row.task_id);
    const live_status = liveTask?.status ?? null;
    const warnings = [];
    if (!liveTask) warnings.push('task_missing_from_board');
    if (live_status !== row.packet_current_status) warnings.push('packet_current_status_mismatch');
    if (!row.isaac_decision) return { task_id: row.task_id, live_status, packet_current_status: row.packet_current_status, isaac_decision: '', apply_state: 'blocked', reason: 'missing_decision', target_status: null, warnings };
    if (!SECTION_A_ALLOWED.has(row.isaac_decision)) return { task_id: row.task_id, live_status, packet_current_status: row.packet_current_status, isaac_decision: row.isaac_decision, apply_state: 'blocked', reason: 'invalid_decision', target_status: null, warnings };
    if (row.isaac_decision === 'Approve') {
      if (!row.isaac_target_status) return { task_id: row.task_id, live_status, packet_current_status: row.packet_current_status, isaac_decision: row.isaac_decision, apply_state: 'blocked', reason: 'missing_target_status', target_status: null, warnings };
      return { task_id: row.task_id, live_status, packet_current_status: row.packet_current_status, isaac_decision: row.isaac_decision, apply_state: live_status === row.isaac_target_status ? 'noop' : 'ready', reason: live_status === row.isaac_target_status ? 'already_at_target' : 'approved_transition', target_status: row.isaac_target_status, warnings };
    }
    return { task_id: row.task_id, live_status, packet_current_status: row.packet_current_status, isaac_decision: row.isaac_decision, apply_state: 'noop', reason: row.isaac_decision === 'Hold' ? 'retain_current_status' : 'needs_changes', target_status: null, warnings };
  });
}

function summarizeSectionB(rows) {
  return rows.map((row) => {
    const liveTask = tasks.get(row.task_id);
    const live_status = liveTask?.status ?? null;
    const warnings = [];
    if (!liveTask) warnings.push('task_missing_from_board');
    if (live_status !== row.packet_current_status) warnings.push('packet_current_status_mismatch');
    if (!row.isaac_decision) return { apply_order: row.apply_order, task_id: row.task_id, live_status, packet_current_status: row.packet_current_status, canonical_replacement: row.canonical_replacement, isaac_decision: '', apply_state: 'blocked', reason: 'missing_decision', target_status: null, warnings };
    if (!SECTION_B_ALLOWED.has(row.isaac_decision)) return { apply_order: row.apply_order, task_id: row.task_id, live_status, packet_current_status: row.packet_current_status, canonical_replacement: row.canonical_replacement, isaac_decision: row.isaac_decision, apply_state: 'blocked', reason: 'invalid_decision', target_status: null, warnings };
    if (row.isaac_decision === 'APPROVE_COMPACT') return { apply_order: row.apply_order, task_id: row.task_id, live_status, packet_current_status: row.packet_current_status, canonical_replacement: row.canonical_replacement, isaac_decision: row.isaac_decision, apply_state: live_status === 'Superseded' ? 'noop' : 'ready', reason: live_status === 'Superseded' ? 'already_compacted' : 'approved_compaction', target_status: 'Superseded', warnings };
    return { apply_order: row.apply_order, task_id: row.task_id, live_status, packet_current_status: row.packet_current_status, canonical_replacement: row.canonical_replacement, isaac_decision: row.isaac_decision, apply_state: 'noop', reason: 'retain_current_status', target_status: null, warnings };
  });
}

const parsed = parsePacket(packet);
const sectionA = summarizeSectionA(parsed.sectionA);
const sectionB = summarizeSectionB(parsed.sectionB);
const generatedAt = new Date().toISOString();

const summary = {
  generated_at: generatedAt,
  board_path: boardPath,
  packet_path: packetPath,
  mode: outPath ? 'write' : 'dry-run',
  selected_section: sectionMode,
  section_a: { apply_task: 'TASK-0335', ready_for_apply: sectionA.every((row) => row.apply_state !== 'blocked'), blocked_count: countBy(sectionA, 'apply_state', 'blocked'), ready_count: countBy(sectionA, 'apply_state', 'ready'), noop_count: countBy(sectionA, 'apply_state', 'noop'), rows: sectionA },
  section_b: { apply_task: 'TASK-0379', ready_for_apply: sectionB.every((row) => row.apply_state !== 'blocked'), blocked_count: countBy(sectionB, 'apply_state', 'blocked'), ready_count: countBy(sectionB, 'apply_state', 'ready'), noop_count: countBy(sectionB, 'apply_state', 'noop'), rows: sectionB }
};

summary.overall = {
  packet_ready_for_full_apply: summary.section_a.ready_for_apply && summary.section_b.ready_for_apply,
  total_blocked_rows: summary.section_a.blocked_count + summary.section_b.blocked_count,
  total_ready_rows: summary.section_a.ready_count + summary.section_b.ready_count,
  total_noop_rows: summary.section_a.noop_count + summary.section_b.noop_count
};

const selectedSections = sectionMode === 'all' ? ['a', 'b'] : [sectionMode];
const blockers = [];

function inspectSection(sectionKey, rows, applyTask) {
  for (const row of rows) {
    if (row.apply_state === 'blocked') {
      blockers.push({ section: sectionKey, apply_task: applyTask, task_id: row.task_id, reason: row.reason });
      continue;
    }
    if (row.warnings && row.warnings.length > 0) {
      blockers.push({ section: sectionKey, apply_task: applyTask, task_id: row.task_id, reason: 'row_warnings_present', warnings: row.warnings });
    }
  }
}

if (selectedSections.includes('a')) inspectSection('a', sectionA, 'TASK-0335');
if (selectedSections.includes('b')) inspectSection('b', sectionB, 'TASK-0379');

const mutableBoard = JSON.parse(JSON.stringify(board));
const mutableTasks = new Map((mutableBoard.tasks || []).map((task) => [task.id, task]));
const changes = [];

function touchTask(taskId, targetStatus, reason, sectionKey) {
  if (PROTECTED_CANONICAL_TASKS.has(taskId)) {
    blockers.push({ section: sectionKey, task_id: taskId, reason: 'protected_canonical_task' });
    return;
  }
  const task = mutableTasks.get(taskId);
  if (!task) {
    blockers.push({ section: sectionKey, task_id: taskId, reason: 'task_missing_from_board' });
    return;
  }
  if (task.status === targetStatus) return;
  const fromStatus = task.status;
  changes.push({ section: sectionKey, task_id: taskId, from_status: fromStatus, to_status: targetStatus, reason });
  task.status = targetStatus;
  task.updated_at = generatedAt;
  task.updated_by = 'sentinel';
  task.comments = Array.isArray(task.comments) ? task.comments : [];
  task.comments.push({
    author: 'sentinel',
    created_at: generatedAt,
    text: 'Unified recovery apply (' + sectionKey + ') via decision pack: ' + reason + '. Status ' + fromStatus + ' -> ' + targetStatus + '.'
  });
}

if (blockers.length === 0) {
  if (selectedSections.includes('a')) for (const row of sectionA) if (row.apply_state === 'ready') touchTask(row.task_id, row.target_status, row.reason, 'a');
  if (selectedSections.includes('b')) for (const row of sectionB) if (row.apply_state === 'ready') touchTask(row.task_id, row.target_status, row.reason, 'b');
}

summary.apply_result = {
  blockers,
  change_count: changes.length,
  changes,
  output_board_path: outPath,
  write_performed: false
};

if (blockers.length === 0 && outPath) {
  fs.writeFileSync(outPath, JSON.stringify(mutableBoard, null, 2) + '\n');
  summary.apply_result.write_performed = true;
}

summary.apply_result.outcome = blockers.length > 0 ? 'blocked' : outPath ? 'applied' : 'ready_dry_run';

console.log(JSON.stringify(summary, null, 2));
process.exit(blockers.length === 0 ? 0 : 1);
