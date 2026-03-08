import crypto from 'crypto';
import { buildStepCoordinateReplay } from './coordinateReplayService.js';
import { getFlow } from './retrievalService.js';
import { fileForReviewedFlow, fileForNormalizedFlow, readJson, writeJson } from '../storage/revealStorage.js';
import { attachSemanticReasons } from './semanticDiffReasonService.js';

export const REPLAY_CHECKSUM_VERSION = 'v1';

/** Canonicalization rules:
 * - stable object key ordering
 * - numbers rounded to 6dp
 * - undefined removed, null preserved
 * - reasonCodes/warnings sorted (non-semantic arrays)
 * - semantic arrays keep order (traces)
 * - volatile fields excluded (timestamps/check times)
 */
function canonicalize(value, keyPath = '') {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const arr = value.map((v) => canonicalize(v, keyPath)).filter((v) => v !== undefined);
    if (keyPath.endsWith('reasonCodes') || keyPath.endsWith('warnings')) return [...arr].sort();
    return arr;
  }
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      if (['timestamp', 'replayIntegrityLastCheckedAt'].includes(k)) continue;
      const v = canonicalize(value[k], keyPath ? `${keyPath}.${k}` : k);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return undefined;
}

export function buildChecksumSource(replay) {
  return canonicalize({
    stepId: replay.stepId,
    sourceBox: replay.sourceBox,
    sourceViewport: replay.sourceViewport,
    sourceScales: replay.sourceScales,
    frameTrace: replay.frameTrace,
    normalizationTrace: replay.normalizationTrace,
    validationTrace: replay.validationTrace,
    finalBoxes: replay.finalBoxes,
    finalHighlight: replay.finalHighlight,
    coordinateConfidence: replay.coordinateConfidence,
    reasonCodes: replay.coordinateConfidenceReasonCodes,
    warnings: replay.warnings
  });
}

export function checksumForReplay(replay) {
  const checksumSource = buildChecksumSource(replay);
  const replayChecksum = crypto.createHash('sha256').update(JSON.stringify(checksumSource)).digest('hex');
  return { replayChecksum, checksumSource };
}

function alignStages(stored = [], current = [], basePath) {
  const divergences = [];
  const sNames = stored.map((s) => s?.stage || 'unknown');
  const cNames = current.map((s) => s?.stage || 'unknown');

  for (const stage of sNames) {
    if (!cNames.includes(stage)) divergences.push({ path: `${basePath}.${stage}`, stage, field: 'stage', reason: 'stage_missing' });
  }
  for (const stage of cNames) {
    if (!sNames.includes(stage)) divergences.push({ path: `${basePath}.${stage}`, stage, field: 'stage', reason: 'stage_added' });
  }

  const common = sNames.filter((n) => cNames.includes(n));
  for (const stage of common) {
    const si = sNames.indexOf(stage);
    const ci = cNames.indexOf(stage);
    if (si !== ci) divergences.push({ path: `${basePath}.${stage}`, stage, field: 'order', reason: 'order_changed', storedValue: si, currentValue: ci });

    const s = stored[si] || {};
    const c = current[ci] || {};
    for (const field of ['op', 'warning', 'input', 'output']) {
      if (JSON.stringify(s[field] ?? null) !== JSON.stringify(c[field] ?? null)) {
        divergences.push({ path: `${basePath}.${stage}.${field}`, stage, field, reason: 'value_changed', storedValue: s[field] ?? null, currentValue: c[field] ?? null });
      }
    }
  }

  return divergences;
}

export function explainChecksumDiff(storedSource, currentSource, { maxDivergences = 40 } = {}) {
  if (!storedSource || !currentSource) {
    return {
      status: 'mismatch',
      firstDivergence: { path: 'root', stage: 'root', field: 'payload', reason: 'missing_compare_payload', storedValue: !!storedSource, currentValue: !!currentSource },
      divergences: [],
      summary: { total: 1, reasons: { missing_compare_payload: 1 } }
    };
  }

  const divergences = [];
  const push = (d) => { if (divergences.length < maxDivergences) divergences.push(d); };
  const cmp = (path, a, b, reason = 'value_changed', stage = path.split('.')[0], field = path.split('.').slice(-1)[0]) => {
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) push({ path, stage, field, reason, storedValue: a ?? null, currentValue: b ?? null });
  };

  for (const top of ['sourceBox','sourceViewport','sourceScales','frameTrace','finalBoxes','finalHighlight','coordinateConfidence','reasonCodes','warnings']) {
    cmp(top, storedSource[top], currentSource[top], top === 'coordinateConfidence' ? 'confidence_changed' : 'value_changed', top, top);
  }

  const sNorm = Array.isArray(storedSource.normalizationTrace) ? storedSource.normalizationTrace : [];
  const cNorm = Array.isArray(currentSource.normalizationTrace) ? currentSource.normalizationTrace : [];
  alignStages(sNorm, cNorm, 'normalizationTrace').forEach(push);

  const sVal = Array.isArray(storedSource.validationTrace) ? storedSource.validationTrace : [];
  const cVal = Array.isArray(currentSource.validationTrace) ? currentSource.validationTrace : [];
  alignStages(sVal, cVal, 'validationTrace').forEach(push);

  const firstDivergence = divergences[0] || null;
  const reasons = {};
  for (const d of divergences) reasons[d.reason] = (reasons[d.reason] || 0) + 1;

  return {
    status: divergences.length ? 'mismatch' : 'match',
    firstDivergence,
    divergences,
    summary: { total: divergences.length, reasons }
  };
}

function setStepIntegrity(step, integrity) {
  step.metadata = step.metadata || {};
  step.metadata.replayChecksum = integrity.replayChecksum || null;
  step.metadata.replayChecksumVersion = REPLAY_CHECKSUM_VERSION;
  step.metadata.replayIntegrityStatus = integrity.status;
  step.metadata.replayIntegrityLastCheckedAt = new Date().toISOString();
  step.metadata.replayIntegrityReasonCodes = integrity.reasonCodes || [];
  if (integrity.checksumSource) step.metadata.replayChecksumSource = integrity.checksumSource;
}

async function loadPreferredWritableFlow(flowId) {
  const reviewed = await readJson(fileForReviewedFlow(flowId), null);
  if (reviewed) return { path: fileForReviewedFlow(flowId), flow: reviewed };
  const normalized = await readJson(fileForNormalizedFlow(flowId), null);
  if (normalized) return { path: fileForNormalizedFlow(flowId), flow: normalized };
  return null;
}

export async function integrityForStep(flowId, stepId, { persist = false, includeDiff = false } = {}) {
  const replay = await buildStepCoordinateReplay(flowId, stepId);
  if (replay.error) return { stepId, status: 'unreplayable_step', reasonCodes: replay.reasons || [replay.error], replayChecksum: null, storedChecksum: null };

  const { replayChecksum, checksumSource } = checksumForReplay(replay);
  const flowAny = await getFlow(flowId, 'preferred');
  const step = flowAny?.flow?.steps?.find((s) => s.id === stepId);

  const storedChecksum = step?.metadata?.replayChecksum || null;
  const storedVersion = step?.metadata?.replayChecksumVersion || null;
  const storedSource = step?.metadata?.replayChecksumSource || null;

  let status = 'missing_baseline_checksum';
  const reasonCodes = [];

  if (!storedChecksum) {
    reasonCodes.push('no_stored_checksum');
  } else if (storedVersion && storedVersion !== REPLAY_CHECKSUM_VERSION) {
    status = 'mismatch';
    reasonCodes.push('incompatible_checksum_version');
  } else if (storedChecksum === replayChecksum) {
    status = 'match';
    reasonCodes.push('checksum_match');
  } else {
    status = 'mismatch';
    reasonCodes.push('checksum_mismatch');
  }

  let diff = null;
  if (status === 'mismatch' && includeDiff) {
    diff = attachSemanticReasons(explainChecksumDiff(storedSource, checksumSource));
    if (diff.firstDivergence?.reason === 'missing_compare_payload') reasonCodes.push('missing_stored_checksum_source_payload');
  }

  const briefDiff = status === 'mismatch' ? attachSemanticReasons(explainChecksumDiff(storedSource, checksumSource, { maxDivergences: 1 })) : null;

  const result = {
    stepId,
    status,
    replayChecksum,
    replayChecksumVersion: REPLAY_CHECKSUM_VERSION,
    storedChecksum,
    storedChecksumVersion: storedVersion,
    reasonCodes,
    replaySource: replay.replaySource,
    warnings: replay.warnings || [],
    firstDivergence: (diff || briefDiff)?.firstDivergence || null,
    diffSummary: (diff || briefDiff)?.summary || null,
    ...(includeDiff ? { diff } : {})
  };

  if (persist) {
    const writable = await loadPreferredWritableFlow(flowId);
    if (writable?.flow?.steps) {
      const s = writable.flow.steps.find((x) => x.id === stepId);
      if (s) {
        setStepIntegrity(s, { ...result, checksumSource });
        await writeJson(writable.path, writable.flow);
      }
    }
  }

  return result;
}

export async function integrityRecomputeFlow(flowId, { persist = true, includeDiff = false } = {}) {
  const flowAny = await getFlow(flowId, 'preferred');
  if (!flowAny) return { error: 'flow_not_found' };

  const steps = [];
  for (const step of flowAny.flow.steps || []) steps.push(await integrityForStep(flowId, step.id, { persist, includeDiff }));

  const mismatchByStage = {};
  const mismatchReasonCounts = {};
  const mismatchBySemanticReason = {};
  const mismatchBySemanticSubReason = {};
  const firstDivergentStepIds = [];
  const firstDivergentStepIdsBySemanticReason = {};
  const firstDivergentStepIdsBySemanticSubReason = {};
  for (const s of steps.filter((x) => x.status === 'mismatch')) {
    if (s.firstDivergence?.stage) mismatchByStage[s.firstDivergence.stage] = (mismatchByStage[s.firstDivergence.stage] || 0) + 1;
    if (s.firstDivergence?.reason) mismatchReasonCounts[s.firstDivergence.reason] = (mismatchReasonCounts[s.firstDivergence.reason] || 0) + 1;
    const sem = s.firstDivergence?.semanticReason || 'unclassified_change';
    const sub = s.firstDivergence?.semanticSubReason || 'unclassified_subreason';
    mismatchBySemanticReason[sem] = (mismatchBySemanticReason[sem] || 0) + 1;
    mismatchBySemanticSubReason[sub] = (mismatchBySemanticSubReason[sub] || 0) + 1;
    firstDivergentStepIdsBySemanticReason[sem] = firstDivergentStepIdsBySemanticReason[sem] || [];
    firstDivergentStepIdsBySemanticReason[sem].push(s.stepId);
    firstDivergentStepIdsBySemanticSubReason[sub] = firstDivergentStepIdsBySemanticSubReason[sub] || [];
    firstDivergentStepIdsBySemanticSubReason[sub].push(s.stepId);
    firstDivergentStepIds.push(s.stepId);
  }

  const mostCommonSemanticReason = Object.entries(mismatchBySemanticReason).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const mostCommonSemanticSubReason = Object.entries(mismatchBySemanticSubReason).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const summary = {
    totalReplayableSteps: steps.filter((r) => r.status !== 'unreplayable_step').length,
    matchedSteps: steps.filter((r) => r.status === 'match').length,
    mismatchedSteps: steps.filter((r) => r.status === 'mismatch').length,
    unreplayableSteps: steps.filter((r) => r.status === 'unreplayable_step').length,
    missingChecksumSteps: steps.filter((r) => r.status === 'missing_baseline_checksum').length,
    mismatchByStage,
    mismatchBySemanticReason,
    mismatchBySemanticSubReason,
    firstDivergentStepIds,
    firstDivergentStepIdsBySemanticReason,
    firstDivergentStepIdsBySemanticSubReason,
    mostCommonSemanticReason,
    mostCommonSemanticSubReason,
    mismatchReasonCounts
  };

  return { flowId, checksumVersion: REPLAY_CHECKSUM_VERSION, summary, steps };
}
