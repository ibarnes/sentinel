import crypto from 'crypto';
import fs from 'fs/promises';
import { buildStepCoordinateReplay } from './coordinateReplayService.js';
import { getFlow } from './retrievalService.js';
import { fileForReviewedFlow, fileForNormalizedFlow, readJson, writeJson } from '../storage/revealStorage.js';

export const REPLAY_CHECKSUM_VERSION = 'v1';

/**
 * Canonicalization rules:
 * - Stable key ordering for all objects
 * - Arrays keep semantic order unless explicitly sorted (reason codes, warnings sorted)
 * - Numbers rounded to 6 decimal places
 * - undefined removed, null preserved
 * - Volatile fields (timestamps/request ids) excluded from checksum source
 */
function canonicalize(value, keyPath = '') {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Number(Number(value).toFixed(6));
  }
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
  const src = buildChecksumSource(replay);
  const json = JSON.stringify(src);
  const hash = crypto.createHash('sha256').update(json).digest('hex');
  return { replayChecksum: hash, checksumSource: src };
}

function setStepIntegrity(step, integrity) {
  step.metadata = step.metadata || {};
  step.metadata.replayChecksum = integrity.replayChecksum || null;
  step.metadata.replayChecksumVersion = REPLAY_CHECKSUM_VERSION;
  step.metadata.replayIntegrityStatus = integrity.status;
  step.metadata.replayIntegrityLastCheckedAt = new Date().toISOString();
  step.metadata.replayIntegrityReasonCodes = integrity.reasonCodes || [];
}

async function loadPreferredWritableFlow(flowId) {
  const reviewed = await readJson(fileForReviewedFlow(flowId), null);
  if (reviewed) return { path: fileForReviewedFlow(flowId), flow: reviewed, source: 'reviewed' };
  const normalized = await readJson(fileForNormalizedFlow(flowId), null);
  if (normalized) return { path: fileForNormalizedFlow(flowId), flow: normalized, source: 'normalized' };
  return null;
}

export async function integrityForStep(flowId, stepId, { persist = false } = {}) {
  const replay = await buildStepCoordinateReplay(flowId, stepId);
  if (replay.error) {
    return { stepId, status: 'unreplayable_step', reasonCodes: replay.reasons || [replay.error], replayChecksum: null, storedChecksum: null };
  }

  const { replayChecksum } = checksumForReplay(replay);
  const flowAny = await getFlow(flowId, 'preferred');
  const step = flowAny?.flow?.steps?.find((s) => s.id === stepId);
  const storedChecksum = step?.metadata?.replayChecksum || null;
  const storedVersion = step?.metadata?.replayChecksumVersion || null;

  let status = 'missing_baseline_checksum';
  const reasonCodes = [];

  if (!storedChecksum) {
    status = 'missing_baseline_checksum';
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

  const result = {
    stepId,
    status,
    replayChecksum,
    replayChecksumVersion: REPLAY_CHECKSUM_VERSION,
    storedChecksum,
    storedChecksumVersion: storedVersion,
    reasonCodes,
    replaySource: replay.replaySource,
    warnings: replay.warnings || []
  };

  if (persist) {
    const writable = await loadPreferredWritableFlow(flowId);
    if (writable?.flow?.steps) {
      const s = writable.flow.steps.find((x) => x.id === stepId);
      if (s) {
        setStepIntegrity(s, result);
        await writeJson(writable.path, writable.flow);
      }
    }
  }

  return result;
}

export async function integrityRecomputeFlow(flowId, { persist = true } = {}) {
  const flowAny = await getFlow(flowId, 'preferred');
  if (!flowAny) return { error: 'flow_not_found' };

  const results = [];
  for (const step of flowAny.flow.steps || []) {
    const r = await integrityForStep(flowId, step.id, { persist });
    results.push(r);
  }

  const summary = {
    totalReplayableSteps: results.filter((r) => r.status !== 'unreplayable_step').length,
    matchedSteps: results.filter((r) => r.status === 'match').length,
    mismatchedSteps: results.filter((r) => r.status === 'mismatch').length,
    unreplayableSteps: results.filter((r) => r.status === 'unreplayable_step').length,
    missingChecksumSteps: results.filter((r) => r.status === 'missing_baseline_checksum').length
  };

  return { flowId, checksumVersion: REPLAY_CHECKSUM_VERSION, summary, steps: results };
}
