import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/shot-list-edit-intents';

function fileFor(shotListId) { return path.join(ROOT, `${shotListId}.json`); }
function nowIso() { return new Date().toISOString(); }
function id() { return `ei_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`; }

async function readAll(shotListId) {
  try { return JSON.parse(await fs.readFile(fileFor(shotListId), 'utf8')); } catch { return { shotListId, editIntents: [] }; }
}
async function writeAll(doc) {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(fileFor(doc.shotListId), JSON.stringify(doc, null, 2));
}

const VALID_TYPES = new Set(['hold_extension_ms','trim_start_ms','trim_end_ms','reorder_hint','transition_override','emphasis_override','note','disable_shot','duplicate_for_variant']);

function validateIntent(i) {
  if (!i?.shotId) return 'invalid_shot_id';
  if (!VALID_TYPES.has(i.type)) return 'invalid_edit_intent_type';
  if (['hold_extension_ms','trim_start_ms','trim_end_ms'].includes(i.type)) {
    const n = Number(i.value);
    if (!Number.isFinite(n) || n < 0) return 'invalid_duration_value';
  }
  if (i.type === 'reorder_hint') {
    const n = Number(i.value);
    if (!Number.isInteger(n) || n < 0) return 'invalid_reorder_hint';
  }
  return null;
}

export async function createEditIntent(shotListId, payload = {}) {
  const err = validateIntent(payload);
  if (err) return { error: err };
  const doc = await readAll(shotListId);
  const ei = {
    editIntentId: id(),
    shotId: String(payload.shotId),
    type: String(payload.type),
    value: payload.value ?? null,
    createdAt: nowIso(),
    createdBy: payload.createdBy || null,
    rationale: payload.rationale || null,
    metadata: payload.metadata || {}
  };
  doc.editIntents.push(ei);
  await writeAll(doc);
  return { editIntent: ei };
}

export async function listEditIntents(shotListId) {
  return readAll(shotListId);
}

export async function patchEditIntent(shotListId, editIntentId, patch = {}) {
  const doc = await readAll(shotListId);
  const ei = doc.editIntents.find((x) => x.editIntentId === editIntentId);
  if (!ei) return { error: 'edit_intent_not_found' };
  const next = { ...ei, ...patch };
  const err = validateIntent(next);
  if (err) return { error: err };
  Object.assign(ei, patch, { updatedAt: nowIso() });
  await writeAll(doc);
  return { editIntent: ei };
}

export async function deleteEditIntent(shotListId, editIntentId) {
  const doc = await readAll(shotListId);
  const before = doc.editIntents.length;
  doc.editIntents = doc.editIntents.filter((x) => x.editIntentId !== editIntentId);
  if (doc.editIntents.length === before) return { error: 'edit_intent_not_found' };
  await writeAll(doc);
  return { deleted: true };
}

export function applyEditIntentsToShotList(baselineShotList, intents = []) {
  const shotList = JSON.parse(JSON.stringify(baselineShotList));
  const shotById = new Map();
  for (const sc of shotList.scenes || []) for (const sh of sc.shots || []) shotById.set(sh.shotId, sh);

  const sorted = [...intents].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  for (const ei of sorted) {
    const sh = shotById.get(ei.shotId);
    if (!sh) continue;
    if (ei.type === 'hold_extension_ms') sh.estimatedDurationMs += Number(ei.value || 0);
    if (ei.type === 'trim_start_ms') sh.startTrimMs = Number(ei.value || 0);
    if (ei.type === 'trim_end_ms') sh.endTrimMs = Number(ei.value || 0);
    if (ei.type === 'transition_override') sh.transitionOverride = ei.value;
    if (ei.type === 'emphasis_override') sh.emphasis = String(ei.value || sh.emphasis || 'none');
    if (ei.type === 'note') sh.notes = [sh.notes, String(ei.value || '')].filter(Boolean).join(' | ');
    if (ei.type === 'disable_shot') sh.disabled = Boolean(ei.value ?? true);
    if (ei.type === 'duplicate_for_variant' && ei.value) {
      const dup = { ...sh, shotId: `${sh.shotId}_dup_${String(ei.editIntentId).slice(-4)}`, metadata: { ...(sh.metadata || {}), duplicatedFrom: sh.shotId } };
      const sc = shotList.scenes.find((s) => s.sceneId === sh.sceneId);
      if (sc) sc.shots.push(dup);
    }
  }

  for (const sc of shotList.scenes || []) {
    const reorder = sorted.filter((i) => i.type === 'reorder_hint').map((i) => [i.shotId, Number(i.value)]);
    if (reorder.length) {
      const rank = new Map(reorder);
      sc.shots.sort((a, b) => (rank.get(a.shotId) ?? 999999) - (rank.get(b.shotId) ?? 999999));
    }
  }

  // recompute offsets deterministically
  let cursor = 0;
  for (const sc of shotList.scenes || []) {
    let local = 0;
    for (const sh of sc.shots || []) {
      if (sh.disabled) continue;
      const dur = Math.max(300, Number(sh.estimatedDurationMs || 0) - Number(sh.startTrimMs || 0) - Number(sh.endTrimMs || 0));
      sh.startOffsetMs = cursor + local;
      local += dur;
      sh.endOffsetMs = cursor + local;
      sh.effectiveDurationMs = dur;
    }
    sc.estimatedDurationMs = local;
    sc.timeline.sceneStartMs = cursor;
    sc.timeline.sceneEndMs = cursor + local;
    sc.timeline.linkedNarrationDurationMs = local;
    sc.timeline.linkedVisualDurationMs = local;
    cursor += local;
  }
  shotList.totalEstimatedDurationMs = cursor;
  return shotList;
}

export function diffShotLists(baseline, effective) {
  const bMap = new Map();
  for (const s of baseline.scenes || []) for (const h of s.shots || []) bMap.set(h.shotId, h);
  const out = { changedSceneCount: 0, changedShotCount: 0, firstDivergence: null, shots: {} };
  const changedScenes = new Set();

  for (const s of effective.scenes || []) {
    for (const h of s.shots || []) {
      const b = bMap.get(h.shotId);
      const fields = [];
      let state = 'unchanged';
      if (!b) { state = 'edited'; fields.push('added'); }
      else {
        if ((h.disabled || false) !== (b.disabled || false)) { state = 'disabled'; fields.push('disabled'); }
        if (Number(h.effectiveDurationMs || h.estimatedDurationMs || 0) !== Number(b.estimatedDurationMs || 0)) fields.push('duration');
        if ((h.transitionOverride || null) !== (b.transitionOverride || null)) fields.push('transition_override');
        if ((h.emphasis || '') !== (b.emphasis || '')) fields.push('emphasis');
        if ((h.notes || '') !== (b.notes || '')) fields.push('note');
        if (state === 'unchanged' && fields.length) state = 'edited';
      }
      if (fields.length) {
        out.changedShotCount += 1;
        changedScenes.add(s.sceneId);
        if (!out.firstDivergence) out.firstDivergence = { sceneId: s.sceneId, shotId: h.shotId, state, changedFields: fields };
      }
      out.shots[h.shotId] = { state, changedFields: fields };
    }
  }
  out.changedSceneCount = changedScenes.size;
  return out;
}
