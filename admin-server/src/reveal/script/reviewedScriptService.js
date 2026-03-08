import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getScript } from './narrationScriptService.js';
import { computeScriptDiff } from './scriptDiffService.js';
import { applyStatusTransition } from './scriptApprovalService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/reviewed-scripts';

function fileFor(scriptId) { return path.join(ROOT, `${scriptId}.json`); }
function nowIso() { return new Date().toISOString(); }
function reviewedId(scriptId) { return `rs_${scriptId}_${crypto.randomBytes(3).toString('hex')}`; }

async function readReviewed(scriptId) {
  try { return JSON.parse(await fs.readFile(fileFor(scriptId), 'utf8')); } catch { return null; }
}

async function writeReviewed(reviewed) {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(fileFor(reviewed.scriptId), JSON.stringify(reviewed, null, 2), 'utf8');
}

function cloneSections(sections = []) {
  return sections.map((s) => ({
    ...s,
    annotations: s.annotations || [],
    changeMetadata: { lastChangedAt: null, lastChangedBy: null, changedFields: [] }
  }));
}

export async function initReviewedScript(scriptId, { actor = null } = {}) {
  const baselineOut = await getScript(scriptId);
  if (baselineOut.error) return baselineOut;
  const baseline = baselineOut.script;

  let reviewed = await readReviewed(scriptId);
  if (reviewed) return { baseline, reviewed, diff: computeScriptDiff(baseline, reviewed) };

  const now = nowIso();
  reviewed = {
    reviewedScriptId: reviewedId(scriptId),
    scriptId,
    reviewVersion: 1,
    reviewStatus: 'draft',
    createdAt: now,
    updatedAt: now,
    createdBy: actor || null,
    lastEditedBy: actor || null,
    editHistory: [{ ts: now, actor: actor || null, action: 'init_review' }],
    approvalMetadata: {},
    sections: cloneSections(baseline.sections || [])
  };

  await writeReviewed(reviewed);
  return { baseline, reviewed, diff: computeScriptDiff(baseline, reviewed) };
}

export async function getReviewedScript(scriptId) {
  const baselineOut = await getScript(scriptId);
  if (baselineOut.error) return baselineOut;
  const baseline = baselineOut.script;
  const reviewed = await readReviewed(scriptId);
  if (!reviewed) return { error: 'review_not_found' };
  return { baseline, reviewed, diff: computeScriptDiff(baseline, reviewed) };
}

function bump(reviewed, actor, action, payload = {}) {
  reviewed.reviewVersion = Number(reviewed.reviewVersion || 0) + 1;
  reviewed.updatedAt = nowIso();
  reviewed.lastEditedBy = actor || reviewed.lastEditedBy || null;
  reviewed.editHistory = reviewed.editHistory || [];
  reviewed.editHistory.push({ ts: reviewed.updatedAt, actor: actor || null, action, payload });
}

export async function updateReviewedSection(scriptId, sectionId, patch = {}, actor = null) {
  const out = await getReviewedScript(scriptId);
  if (out.error) return out;
  const reviewed = out.reviewed;
  const sec = (reviewed.sections || []).find((s) => s.sectionId === sectionId);
  if (!sec) return { error: 'section_not_found' };

  const changed = [];
  if (patch.narrationText != null) {
    if (!String(patch.narrationText).trim()) return { error: 'invalid_narration_text' };
    sec.narrationText = String(patch.narrationText);
    changed.push('narrationText');
  }
  if (patch.onScreenText != null) {
    sec.onScreenText = String(patch.onScreenText);
    changed.push('onScreenText');
  }
  if (patch.timing) {
    const t = patch.timing;
    const vals = ['estimatedDurationMs','leadInMs','leadOutMs'].map((k) => Number(t[k]));
    if (vals.some((n) => !Number.isFinite(n) || n < 0)) return { error: 'invalid_timing' };
    sec.timing = { estimatedDurationMs: vals[0], leadInMs: vals[1], leadOutMs: vals[2] };
    changed.push('timing');
  }
  if (patch.notes != null) {
    sec.notes = String(patch.notes);
    changed.push('notes');
  }

  sec.changeMetadata = sec.changeMetadata || {};
  sec.changeMetadata.lastChangedAt = nowIso();
  sec.changeMetadata.lastChangedBy = actor || null;
  sec.changeMetadata.changedFields = [...new Set([...(sec.changeMetadata.changedFields || []), ...changed])];

  bump(reviewed, actor, 'update_section', { sectionId, changed });
  await writeReviewed(reviewed);
  return getReviewedScript(scriptId);
}

export async function reorderReviewedSections(scriptId, orderedSectionIds = [], actor = null) {
  const out = await getReviewedScript(scriptId);
  if (out.error) return out;
  const reviewed = out.reviewed;
  const current = reviewed.sections || [];
  if (!Array.isArray(orderedSectionIds) || orderedSectionIds.length !== current.length) return { error: 'invalid_reorder_payload' };
  const uniq = new Set(orderedSectionIds);
  if (uniq.size !== orderedSectionIds.length) return { error: 'duplicate_reorder_ids' };

  const map = new Map(current.map((s) => [s.sectionId, s]));
  const reordered = [];
  for (const id of orderedSectionIds) {
    const sec = map.get(id);
    if (!sec) return { error: 'section_not_found' };
    reordered.push(sec);
  }
  reviewed.sections = reordered.map((s, idx) => ({ ...s, stepIndex: idx }));
  bump(reviewed, actor, 'reorder_sections', { orderedSectionIds });
  await writeReviewed(reviewed);
  return getReviewedScript(scriptId);
}

export async function addReviewedSectionNote(scriptId, sectionId, note, actor = null) {
  const out = await getReviewedScript(scriptId);
  if (out.error) return out;
  const reviewed = out.reviewed;
  const sec = (reviewed.sections || []).find((s) => s.sectionId === sectionId);
  if (!sec) return { error: 'section_not_found' };
  if (!String(note || '').trim()) return { error: 'invalid_note' };

  sec.annotations = sec.annotations || [];
  sec.annotations.push({ note: String(note), actor: actor || null, at: nowIso() });
  bump(reviewed, actor, 'add_note', { sectionId });
  await writeReviewed(reviewed);
  return getReviewedScript(scriptId);
}

export async function replaceReviewedScript(scriptId, reviewedPayload, actor = null) {
  const out = await getReviewedScript(scriptId);
  if (out.error) return out;
  const reviewed = out.reviewed;
  if (!Array.isArray(reviewedPayload?.sections)) return { error: 'invalid_review_payload' };
  reviewed.sections = reviewedPayload.sections;
  if (reviewedPayload.reviewStatus) reviewed.reviewStatus = reviewedPayload.reviewStatus;
  bump(reviewed, actor, 'replace_review', {});
  await writeReviewed(reviewed);
  return getReviewedScript(scriptId);
}

export async function updateReviewedStatus(scriptId, { targetStatus, reason = null, actor = null } = {}) {
  const out = await getReviewedScript(scriptId);
  if (out.error) return out;
  const reviewed = out.reviewed;

  const transitioned = applyStatusTransition(reviewed, { targetStatus, reason, actor });
  if (transitioned.error) return transitioned;

  bump(reviewed, actor, 'status_transition', { targetStatus, reason });
  await writeReviewed(reviewed);
  return getReviewedScript(scriptId);
}

export function reviewedExport(reviewedEnvelope, format = 'json', includeNotes = true) {
  const { baseline, reviewed } = reviewedEnvelope;
  if (format === 'json') return { contentType: 'application/json', filename: `${reviewed.scriptId}-reviewed.json`, content: JSON.stringify(reviewedEnvelope, null, 2) };
  if (format !== 'markdown') return { error: 'invalid_export_format' };

  const lines = [];
  lines.push(`# ${baseline.title}`);
  lines.push('', `- Script ID: ${baseline.scriptId}`);
  lines.push(`- Reviewed Script ID: ${reviewed.reviewedScriptId}`);
  lines.push(`- Source Type: ${baseline.sourceType}`);
  lines.push(`- Style Profile: ${baseline.styleProfile}`);
  lines.push(`- Review Version: ${reviewed.reviewVersion}`);
  lines.push(`- Approval Status: ${reviewed.reviewStatus}`);
  if (reviewed.approvalMetadata?.approvedAt) lines.push(`- Approved At: ${reviewed.approvalMetadata.approvedAt}`);
  if (reviewed.approvalMetadata?.approvedBy) lines.push(`- Approved By: ${reviewed.approvalMetadata.approvedBy}`);
  if (reviewed.approvalMetadata?.rejectedAt) lines.push(`- Rejected At: ${reviewed.approvalMetadata.rejectedAt}`);
  if (reviewed.approvalMetadata?.rejectionReason) lines.push(`- Rejection Reason: ${reviewed.approvalMetadata.rejectionReason}`);
  if (reviewed.approvalMetadata?.publishedReadyAt) lines.push(`- Published Ready At: ${reviewed.approvalMetadata.publishedReadyAt}`);
  lines.push('', '## Reviewed Sections');

  for (const sec of reviewed.sections || []) {
    lines.push('', `### ${sec.stepIndex + 1}. ${sec.title}`);
    lines.push(`- Narration: ${sec.narrationText}`);
    lines.push(`- On-screen: ${sec.onScreenText || 'n/a'}`);
    lines.push(`- Timing: ${sec.timing?.estimatedDurationMs || 0}ms (lead-in ${sec.timing?.leadInMs || 0}, lead-out ${sec.timing?.leadOutMs || 0})`);
    lines.push(`- Notes: ${sec.notes || 'n/a'}`);
    if (includeNotes && (sec.annotations || []).length) {
      lines.push(`- Annotations:`);
      for (const a of sec.annotations) lines.push(`  - ${a.actor || 'actor'} @ ${a.at}: ${a.note}`);
    }
  }
  return { contentType: 'text/markdown; charset=utf-8', filename: `${reviewed.scriptId}-reviewed.md`, content: lines.join('\n') + '\n' };
}
