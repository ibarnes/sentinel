#!/usr/bin/env node
import fs from 'node:fs';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('usage: node scripts/board/tranche-ah-decision-validate.mjs <decision-json-or-markdown-pack>');
  process.exit(2);
}

const LEGACY_REQUIRED = ['TASK-0187', 'TASK-0188', 'TASK-0192', 'TASK-0193', 'TASK-0194', 'TASK-0195'];
const LEGACY_ALLOWED = new Set(['APPROVE_TRANSITION', 'HOLD_SUPERSEDED']);
const SECTION_A_REQUIRED = ['TASK-0269', 'TASK-0271', 'TASK-0307', 'TASK-0324', 'TASK-0335', 'TASK-0363'];
const SECTION_A_ALLOWED = new Set(['Approve', 'Hold', 'Needs Changes']);
const SECTION_B_REQUIRED = ['TASK-0150', 'TASK-0151', 'TASK-0171', 'TASK-0172', 'TASK-0180', 'TASK-0181', 'TASK-0187', 'TASK-0188', 'TASK-0192', 'TASK-0193', 'TASK-0194', 'TASK-0195'];
const SECTION_B_ALLOWED = new Set(['APPROVE_COMPACT', 'HOLD_RETAIN']);
const SECTION_A_NORMALIZED = {
  Approve: 'APPROVE_TRANSITION',
  Hold: 'HOLD_SUPERSEDED',
  'Needs Changes': 'NEEDS_CHANGES'
};

const raw = fs.readFileSync(inputPath, 'utf8');

function parsePipeRow(line) {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function parseLegacyJson(sourceText) {
  const data = JSON.parse(sourceText);
  const decisions = data.decisions || {};
  const errors = [];
  for (const id of LEGACY_REQUIRED) {
    const value = decisions[id];
    if (!value) {
      errors.push(`${id}: missing`);
      continue;
    }
    if (!LEGACY_ALLOWED.has(value)) {
      errors.push(`${id}: invalid value ${JSON.stringify(value)}`);
    }
  }

  return {
    format: 'legacy-json',
    valid: errors.length === 0,
    required_count: LEGACY_REQUIRED.length,
    provided_count: Object.keys(decisions).length,
    extras: Object.keys(decisions).filter((k) => !LEGACY_REQUIRED.includes(k)),
    errors,
    decisions
  };
}

function sectionSlice(sourceText, startHeading, endHeading) {
  const start = sourceText.indexOf(startHeading);
  if (start === -1) return '';
  const end = endHeading ? sourceText.indexOf(endHeading, start) : -1;
  return sourceText.slice(start, end === -1 ? undefined : end);
}

function parseMarkdownPack(sourceText) {
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

  const sectionARows = [];
  for (const line of sectionAText.split('\n')) {
    if (!line.startsWith('| TASK-')) continue;
    const [task_id, current_status, recommended_decision, recommended_target_status, isaac_decision, isaac_target_status, isaac_note] = parsePipeRow(line);
    sectionARows.push({
      task_id,
      current_status,
      recommended_decision,
      recommended_target_status,
      isaac_decision,
      isaac_target_status,
      isaac_note,
      normalized_decision: SECTION_A_NORMALIZED[isaac_decision] || null
    });
  }

  const sectionBRows = [];
  for (const line of sectionBText.split('\n')) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue;
    const [apply_order, task_id, current_status, canonical_replacement, recommended_decision, isaac_decision, isaac_note] = parsePipeRow(line);
    sectionBRows.push({
      apply_order: Number.parseInt(apply_order, 10),
      task_id,
      current_status,
      canonical_replacement,
      recommended_decision,
      isaac_decision,
      isaac_note
    });
  }

  const errors = [];
  const warnings = [];

  const sectionATaskIds = sectionARows.map((row) => row.task_id);
  for (const id of SECTION_A_REQUIRED) {
    if (!sectionATaskIds.includes(id)) errors.push(`section_a ${id}: missing row`);
  }
  for (const row of sectionARows) {
    if (!SECTION_A_REQUIRED.includes(row.task_id)) warnings.push(`section_a ${row.task_id}: extra row`);
    if (row.isaac_decision && !SECTION_A_ALLOWED.has(row.isaac_decision)) {
      errors.push(`section_a ${row.task_id}: invalid decision ${JSON.stringify(row.isaac_decision)}`);
    }
    if (row.isaac_decision === 'Approve' && !row.isaac_target_status) {
      errors.push(`section_a ${row.task_id}: Approve requires target status`);
    }
    if (row.isaac_decision && row.isaac_decision !== 'Approve' && row.isaac_target_status) {
      warnings.push(`section_a ${row.task_id}: target status should usually be blank for ${row.isaac_decision}`);
    }
  }

  const sectionBTaskIds = sectionBRows.map((row) => row.task_id);
  for (const id of SECTION_B_REQUIRED) {
    if (!sectionBTaskIds.includes(id)) errors.push(`section_b ${id}: missing row`);
  }
  for (const row of sectionBRows) {
    if (!SECTION_B_REQUIRED.includes(row.task_id)) warnings.push(`section_b ${row.task_id}: extra row`);
    if (row.isaac_decision && !SECTION_B_ALLOWED.has(row.isaac_decision)) {
      errors.push(`section_b ${row.task_id}: invalid decision ${JSON.stringify(row.isaac_decision)}`);
    }
  }

  return {
    format: 'board-recovery-markdown',
    valid: errors.length === 0,
    complete: [...sectionARows, ...sectionBRows].every((row) => row.isaac_decision),
    errors,
    warnings,
    section_a: {
      required_count: SECTION_A_REQUIRED.length,
      provided_count: sectionARows.length,
      complete: sectionARows.every((row) => row.isaac_decision),
      rows: sectionARows
    },
    section_b: {
      required_count: SECTION_B_REQUIRED.length,
      provided_count: sectionBRows.length,
      complete: sectionBRows.every((row) => row.isaac_decision),
      rows: sectionBRows
    }
  };
}

let summary;
try {
  summary = parseLegacyJson(raw);
} catch {
  summary = parseMarkdownPack(raw);
}

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.valid ? 0 : 1);
