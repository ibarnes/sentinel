import crypto from 'crypto';
import {
  fileForNormalizedFlow,
  fileForReviewedFlow,
  readJson,
  writeJson
} from '../storage/revealStorage.js';

function nowIso() {
  return new Date().toISOString();
}

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function mutationRecord(type, meta = {}) {
  return { id: crypto.randomUUID(), type, ts: nowIso(), meta };
}

function normalizeStepIndexes(flow) {
  flow.steps = (flow.steps || []).map((s, idx) => ({ ...s, index: idx + 1 }));
}

function bumpReviewVersion(flow, record) {
  flow.reviewVersion = Number(flow.reviewVersion || 1) + 1;
  flow.lastEditedAt = nowIso();
  flow.reviewStatus = 'in_review';
  flow.editHistory = Array.isArray(flow.editHistory) ? flow.editHistory : [];
  flow.editHistory.push(record);
}

async function loadNormalized(flowId) {
  return readJson(fileForNormalizedFlow(flowId), null);
}

async function loadReviewed(flowId) {
  return readJson(fileForReviewedFlow(flowId), null);
}

async function persistReviewed(flowId, flow) {
  await writeJson(fileForReviewedFlow(flowId), flow);
  return flow;
}

export async function initReviewedFlow(flowId) {
  const existing = await loadReviewed(flowId);
  if (existing) return existing;
  const normalized = await loadNormalized(flowId);
  if (!normalized) return null;

  const reviewed = deepClone(normalized);
  reviewed.reviewStatus = 'in_review';
  reviewed.reviewedAt = null;
  reviewed.lastEditedAt = nowIso();
  reviewed.reviewVersion = 1;
  reviewed.editHistory = [mutationRecord('review.init', { from: 'normalized' })];
  reviewed.status = 'reviewed';

  await persistReviewed(flowId, reviewed);
  return reviewed;
}

export async function getReview(flowId) {
  return loadReviewed(flowId);
}

export async function ensureReview(flowId) {
  const reviewed = await loadReviewed(flowId);
  if (reviewed) return reviewed;
  return initReviewedFlow(flowId);
}

export async function updateStep(flowId, stepId, patch = {}) {
  const flow = await ensureReview(flowId);
  if (!flow) return { error: 'flow_not_found' };

  const idx = (flow.steps || []).findIndex((s) => s.id === stepId);
  if (idx < 0) return { error: 'step_not_found' };

  const step = flow.steps[idx];
  if (patch.title !== undefined) {
    const title = String(patch.title || '').trim();
    if (!title) return { error: 'invalid_title' };
    step.title = title;
  }
  if (patch.action !== undefined) step.action = String(patch.action || '').trim() || step.action;
  if (patch.intent !== undefined) step.intent = patch.intent == null ? null : String(patch.intent);
  if (patch.metadata !== undefined && patch.metadata && typeof patch.metadata === 'object' && !Array.isArray(patch.metadata)) {
    step.metadata = { ...(step.metadata || {}), ...patch.metadata };
  }

  bumpReviewVersion(flow, mutationRecord('step.update', { stepId, fields: Object.keys(patch) }));
  await persistReviewed(flowId, flow);
  return { flow, step };
}

export async function reorderSteps(flowId, orderedStepIds = []) {
  const flow = await ensureReview(flowId);
  if (!flow) return { error: 'flow_not_found' };

  const steps = flow.steps || [];
  const currentIds = steps.map((s) => s.id);
  const incoming = orderedStepIds.map(String);

  if (incoming.length !== currentIds.length) return { error: 'invalid_reorder_length' };
  if (new Set(incoming).size !== incoming.length) return { error: 'duplicate_step_ids' };
  if (incoming.some((id) => !currentIds.includes(id))) return { error: 'missing_or_unknown_step_ids' };

  const map = new Map(steps.map((s) => [s.id, s]));
  flow.steps = incoming.map((id) => map.get(id));
  normalizeStepIndexes(flow);

  bumpReviewVersion(flow, mutationRecord('steps.reorder', { orderedStepIds: incoming }));
  await persistReviewed(flowId, flow);
  return { flow };
}

export async function mergeSteps(flowId, stepIds = [], merge = {}) {
  const flow = await ensureReview(flowId);
  if (!flow) return { error: 'flow_not_found' };

  const ids = [...new Set(stepIds.map(String))];
  if (ids.length < 2) return { error: 'merge_requires_two_or_more_steps' };

  const steps = flow.steps || [];
  const selected = steps.filter((s) => ids.includes(s.id));
  if (selected.length !== ids.length) return { error: 'step_not_found' };

  const firstIndex = Math.min(...selected.map((s) => s.index || steps.findIndex((x) => x.id === s.id) + 1));
  const mergedStep = {
    ...selected[0],
    id: `step_${crypto.randomBytes(4).toString('hex')}`,
    title: String(merge.title || '').trim() || selected.map((s) => s.title).join(' + '),
    action: merge.action || 'compound',
    intent: merge.intent ?? selected.find((s) => s.intent)?.intent ?? null,
    events: [...new Set(selected.flatMap((s) => s.events || []))],
    metadata: {
      ...(selected[0].metadata || {}),
      mergedFrom: ids
    },
    annotations: []
  };

  const kept = steps.filter((s) => !ids.includes(s.id));
  kept.splice(firstIndex - 1, 0, mergedStep);
  flow.steps = kept;
  normalizeStepIndexes(flow);

  bumpReviewVersion(flow, mutationRecord('steps.merge', { stepIds: ids, mergedStepId: mergedStep.id }));
  await persistReviewed(flowId, flow);
  return { flow, mergedStep };
}

export async function deleteStep(flowId, stepId) {
  const flow = await ensureReview(flowId);
  if (!flow) return { error: 'flow_not_found' };

  const before = (flow.steps || []).length;
  flow.steps = (flow.steps || []).filter((s) => s.id !== stepId);
  if (flow.steps.length === before) return { error: 'step_not_found' };
  normalizeStepIndexes(flow);

  bumpReviewVersion(flow, mutationRecord('step.delete', { stepId }));
  await persistReviewed(flowId, flow);
  return { flow };
}

export async function addAnnotation(flowId, stepId, payload = {}) {
  const flow = await ensureReview(flowId);
  if (!flow) return { error: 'flow_not_found' };

  const step = (flow.steps || []).find((s) => s.id === stepId);
  if (!step) return { error: 'step_not_found' };

  const text = String(payload.text || '').trim();
  const author = String(payload.author || 'reviewer').trim();
  if (!text) return { error: 'invalid_annotation' };

  step.annotations = Array.isArray(step.annotations) ? step.annotations : [];
  const annotation = {
    id: crypto.randomUUID(),
    author,
    text,
    createdAt: nowIso()
  };
  step.annotations.push(annotation);

  bumpReviewVersion(flow, mutationRecord('step.annotation.add', { stepId, annotationId: annotation.id }));
  await persistReviewed(flowId, flow);
  return { flow, annotation };
}

export async function replaceReview(flowId, incoming = {}) {
  const current = await ensureReview(flowId);
  if (!current) return { error: 'flow_not_found' };

  const next = deepClone(current);
  if (Array.isArray(incoming.steps)) {
    next.steps = incoming.steps;
    normalizeStepIndexes(next);
  }
  if (incoming.name !== undefined) next.name = String(incoming.name || next.name);
  if (incoming.description !== undefined) next.description = incoming.description == null ? null : String(incoming.description);
  if (incoming.reviewStatus !== undefined) next.reviewStatus = String(incoming.reviewStatus);
  if (incoming.reviewedAt !== undefined) next.reviewedAt = incoming.reviewedAt;

  bumpReviewVersion(next, mutationRecord('review.replace', { source: 'put_review' }));
  await persistReviewed(flowId, next);
  return { flow: next };
}
