#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const meetingsPath = path.join(root, 'dashboard/data/meeting_minutes.json');
const outPath = path.join(root, 'mission-control/reports/meeting-minutes-coverage.json');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function hasText(v, min = 80) {
  return typeof v === 'string' && v.trim().length >= min;
}

function isPlaceholderText(text = '') {
  const t = String(text).toLowerCase();
  return ['tbd', 'pending', 'name pending', 'to be added', 'blocked'].some((m) => t.includes(m));
}

function evaluate(meeting) {
  const issues = [];
  if (!hasText(meeting.summary, 80)) issues.push('summary_missing_or_thin');
  if (!Array.isArray(meeting.decisions) || meeting.decisions.length === 0) issues.push('decisions_missing');
  if (!Array.isArray(meeting.risks) || meeting.risks.length === 0) issues.push('risks_missing');
  if (!Array.isArray(meeting.next_actions) || meeting.next_actions.length === 0) issues.push('next_actions_missing');

  const source = meeting.source || {};
  const hasLink = !!source.link;
  if (!hasLink) issues.push('source_link_missing');

  const blob = [
    meeting.title || '',
    meeting.summary || '',
    ...(meeting.decisions || []),
    ...(meeting.risks || []),
    ...((meeting.next_actions || []).map((a) => (typeof a === 'string' ? a : a?.action || ''))),
  ].join(' \n ');
  if (isPlaceholderText(blob)) issues.push('placeholder_content_detected');

  return { complete: issues.length === 0, issues };
}

const meetings = readJson(meetingsPath);
const evaluated = meetings.map((m) => {
  const { complete, issues } = evaluate(m);
  const tags = Array.isArray(m.tags) ? m.tags : [];
  const needsParse = tags.includes('needs_transcript_parse');
  return {
    meeting_id: m.meeting_id,
    date_time: m.date_time || null,
    title: m.title || null,
    complete,
    issues,
    needs_transcript_parse: needsParse,
    source_link: m.source?.link || null,
  };
});

const incomplete = evaluated.filter((e) => !e.complete);
const report = {
  generated_at: new Date().toISOString(),
  total_meetings: evaluated.length,
  complete_count: evaluated.length - incomplete.length,
  incomplete_count: incomplete.length,
  policy: {
    required_fields: ['summary', 'decisions', 'risks', 'next_actions'],
    min_summary_chars: 80,
    placeholder_tokens_blocked: ['tbd', 'pending', 'name pending', 'to be added', 'blocked'],
    handling_rule: 'If only source link exists, mark tags += needs_transcript_parse and keep in remediation queue.',
  },
  incomplete,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`Wrote ${outPath}`);
console.log(`total=${report.total_meetings} complete=${report.complete_count} incomplete=${report.incomplete_count}`);
