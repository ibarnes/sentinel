import fs from 'fs/promises';
import crypto from 'crypto';
import {
  fileForReviewedFlow,
  fileForNormalizedFlow,
  dirForSnapshots,
  fileForSnapshot,
  readJson,
  writeJson
} from '../storage/revealStorage.js';

function countAnnotations(steps = []) {
  return steps.reduce((n, s) => n + ((s.annotations || []).length), 0);
}

function screenshotCoverage(steps = []) {
  const total = steps.length || 0;
  const withBefore = steps.filter((s) => s.screenshots?.beforeUrl).length;
  const withAfter = steps.filter((s) => s.screenshots?.afterUrl).length;
  const withHighlight = steps.filter((s) => s.screenshots?.highlightedUrl).length;
  return { total, withBefore, withAfter, withHighlight };
}

function replayIntegritySummary(steps = []) {
  return {
    matched: steps.filter((s) => s.metadata?.replayIntegrityStatus === 'match').length,
    mismatched: steps.filter((s) => s.metadata?.replayIntegrityStatus === 'mismatch').length,
    unreplayable: steps.filter((s) => s.metadata?.replayIntegrityStatus === 'unreplayable_step').length,
    missing: steps.filter((s) => s.metadata?.replayIntegrityStatus === 'missing_baseline_checksum').length
  };
}

function mkSnapshotId(flowId, reviewVersion) {
  return `snap_${flowId}_${reviewVersion}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

export async function createSnapshot(flowId, { createdBy = 'system' } = {}) {
  const reviewed = await readJson(fileForReviewedFlow(flowId), null);
  if (!reviewed) return { error: 'reviewed_flow_not_found' };

  const normalized = await readJson(fileForNormalizedFlow(flowId), null);
  const reviewVersion = Number(reviewed.reviewVersion || reviewed.version || 1);
  const snapshotId = mkSnapshotId(flowId, reviewVersion);
  const outPath = fileForSnapshot(flowId, snapshotId);

  const exists = await readJson(outPath, null);
  if (exists) return { error: 'snapshot_id_collision' };

  const manifest = {
    snapshotId,
    flowId,
    reviewVersion,
    stepCount: (reviewed.steps || []).length,
    annotationCount: countAnnotations(reviewed.steps || []),
    screenshotCoverage: screenshotCoverage(reviewed.steps || []),
    replayIntegritySummary: replayIntegritySummary(reviewed.steps || []),
    exportAvailability: ['json', 'markdown'],
    createdAt: new Date().toISOString()
  };

  const snapshot = {
    snapshotId,
    flowId,
    reviewVersion,
    snapshotVersion: 1,
    createdAt: manifest.createdAt,
    createdBy,
    sourceReviewedFlowVersion: reviewed.reviewVersion || reviewed.version || 1,
    sourceNormalizedFlowVersion: normalized?.version || 1,
    sourceReplayChecksumSummary: manifest.replayIntegritySummary,
    status: 'frozen',
    manifest,
    reviewedFlow: JSON.parse(JSON.stringify(reviewed))
  };

  await fs.mkdir(dirForSnapshots(flowId), { recursive: true });
  await writeJson(outPath, snapshot);

  return { snapshot };
}

export async function listSnapshots(flowId) {
  const dir = dirForSnapshots(flowId);
  try {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort();
    const snapshots = [];
    for (const f of files) {
      const s = await readJson(`${dir}/${f}`, null);
      if (!s) continue;
      snapshots.push({
        snapshotId: s.snapshotId,
        flowId: s.flowId,
        reviewVersion: s.reviewVersion,
        status: s.status,
        createdAt: s.createdAt,
        manifest: s.manifest
      });
    }
    return { snapshots };
  } catch {
    return { snapshots: [] };
  }
}

export async function getSnapshot(flowId, snapshotId) {
  const s = await readJson(fileForSnapshot(flowId, snapshotId), null);
  return s ? { snapshot: s } : { error: 'snapshot_not_found' };
}
