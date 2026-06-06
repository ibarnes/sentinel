#!/usr/bin/env node
import fs from 'node:fs';

const [boardPath, packetPath] = process.argv.slice(2);
if (!boardPath || !packetPath) {
  console.error('usage: node scripts/board/board-recovery-apply-preview.mjs <board-json> <decision-pack-markdown>');
  process.exit(2);
}

const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const packet = fs.readFileSync(packetPath, 'utf8');
const tasks = new Map((board.tasks || []).map((task) => [task.id, task]));

const SECTION_A_ALLOWED = new Set(['Approve', 'Hold', 'Needs Changes']);
const SECTION_B_ALLOWED = new Set(['APPROVE_COMPACT', 'HOLD_RETAIN']);

function parsePipeRow(line) {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
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
    const [
      task_id,
      packet_current_status,
      recommended_decision,
      recommended_target_status,
      isaac_decision,
      isaac_target_status,
      isaac_note
    ] = parsePipeRow(line);
    sectionA.push({
      task_id,
      packet_current_status,
      recommended_decision,
      recommended_target_status,
      isaac_decision,
      isaac_target_status,
      isaac_note
    });
  }

  const sectionB = [];
  for (const line of sectionBText.split('\n')) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue;
    const [
      apply_order,
      task_id,
      packet_current_status,
      canonical_replacement,
      recommended_decision,
      isaac_decision,
      isaac_note
    ] = parsePipeRow(line);
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

function summarizeSectionA(rows) {
  return rows.map((row) => {
    const liveTask = tasks.get(row.task_id);
    const live_status = liveTask?.status ?? null;
    const status_mismatch = live_status !== row.packet_current_status;
    const warnings = [];
    if (!liveTask) warnings.push('task_missing_from_board');
    if (status_mismatch) warnings.push('packet_current_status_mismatch');

    if (!row.isaac_decision) {
      return {
        task_id: row.task_id,
        live_status,
        packet_current_status: row.packet_current_status,
        isaac_decision: '',
        apply_state: 'blocked',
        reason: 'missing_decision',
        target_status: null,
        warnings
      };
    }

    if (!SECTION_A_ALLOWED.has(row.isaac_decision)) {
      return {
        task_id: row.task_id,
        live_status,
        packet_current_status: row.packet_current_status,
        isaac_decision: row.isaac_decision,
        apply_state: 'blocked',
        reason: 'invalid_decision',
        target_status: null,
        warnings
      };
    }

    if (row.isaac_decision === 'Approve') {
      if (!row.isaac_target_status) {
        return {
          task_id: row.task_id,
          live_status,
          packet_current_status: row.packet_current_status,
          isaac_decision: row.isaac_decision,
          apply_state: 'blocked',
          reason: 'missing_target_status',
          target_status: null,
          warnings
        };
      }

      return {
        task_id: row.task_id,
        live_status,
        packet_current_status: row.packet_current_status,
        isaac_decision: row.isaac_decision,
        apply_state: live_status === row.isaac_target_status ? 'noop' : 'ready',
        reason: live_status === row.isaac_target_status ? 'already_at_target' : 'approved_transition',
        target_status: row.isaac_target_status,
        warnings
      };
    }

    return {
      task_id: row.task_id,
      live_status,
      packet_current_status: row.packet_current_status,
      isaac_decision: row.isaac_decision,
      apply_state: 'noop',
      reason: row.isaac_decision === 'Hold' ? 'retain_current_status' : 'needs_changes',
      target_status: null,
      warnings
    };
  });
}

function summarizeSectionB(rows) {
  return rows.map((row) => {
    const liveTask = tasks.get(row.task_id);
    const live_status = liveTask?.status ?? null;
    const status_mismatch = live_status !== row.packet_current_status;
    const warnings = [];
    if (!liveTask) warnings.push('task_missing_from_board');
    if (status_mismatch) warnings.push('packet_current_status_mismatch');

    if (!row.isaac_decision) {
      return {
        apply_order: row.apply_order,
        task_id: row.task_id,
        live_status,
        packet_current_status: row.packet_current_status,
        canonical_replacement: row.canonical_replacement,
        isaac_decision: '',
        apply_state: 'blocked',
        reason: 'missing_decision',
        target_status: null,
        warnings
      };
    }

    if (!SECTION_B_ALLOWED.has(row.isaac_decision)) {
      return {
        apply_order: row.apply_order,
        task_id: row.task_id,
        live_status,
        packet_current_status: row.packet_current_status,
        canonical_replacement: row.canonical_replacement,
        isaac_decision: row.isaac_decision,
        apply_state: 'blocked',
        reason: 'invalid_decision',
        target_status: null,
        warnings
      };
    }

    if (row.isaac_decision === 'APPROVE_COMPACT') {
      const target_status = 'Superseded';
      return {
        apply_order: row.apply_order,
        task_id: row.task_id,
        live_status,
        packet_current_status: row.packet_current_status,
        canonical_replacement: row.canonical_replacement,
        isaac_decision: row.isaac_decision,
        apply_state: live_status === target_status ? 'noop' : 'ready',
        reason: live_status === target_status ? 'already_compacted' : 'approved_compaction',
        target_status,
        warnings
      };
    }

    return {
      apply_order: row.apply_order,
      task_id: row.task_id,
      live_status,
      packet_current_status: row.packet_current_status,
      canonical_replacement: row.canonical_replacement,
      isaac_decision: row.isaac_decision,
      apply_state: 'noop',
      reason: 'retain_current_status',
      target_status: null,
      warnings
    };
  });
}

const parsed = parsePacket(packet);
const section_a = summarizeSectionA(parsed.sectionA);
const section_b = summarizeSectionB(parsed.sectionB);

function countBy(items, key, value) {
  return items.filter((item) => item[key] === value).length;
}

const output = {
  generated_at: new Date().toISOString(),
  board_path: boardPath,
  packet_path: packetPath,
  section_a: {
    apply_task: 'TASK-0335',
    ready_for_apply: section_a.every((row) => row.apply_state !== 'blocked'),
    blocked_count: countBy(section_a, 'apply_state', 'blocked'),
    ready_count: countBy(section_a, 'apply_state', 'ready'),
    noop_count: countBy(section_a, 'apply_state', 'noop'),
    rows: section_a
  },
  section_b: {
    apply_task: 'TASK-0379',
    ready_for_apply: section_b.every((row) => row.apply_state !== 'blocked'),
    blocked_count: countBy(section_b, 'apply_state', 'blocked'),
    ready_count: countBy(section_b, 'apply_state', 'ready'),
    noop_count: countBy(section_b, 'apply_state', 'noop'),
    rows: section_b
  }
};

output.overall = {
  packet_ready_for_full_apply: output.section_a.ready_for_apply && output.section_b.ready_for_apply,
  total_blocked_rows: output.section_a.blocked_count + output.section_b.blocked_count,
  total_ready_rows: output.section_a.ready_count + output.section_b.ready_count,
  total_noop_rows: output.section_a.noop_count + output.section_b.noop_count
};

console.log(JSON.stringify(output, null, 2));
